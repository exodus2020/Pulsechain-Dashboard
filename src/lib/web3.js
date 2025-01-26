import axios from "axios"
import { plpAbi } from "./abi/plp-abi"
import { ethers } from 'ethers'
import { defaultSettings } from "../config/settings"
import Web3 from 'web3'
import { plsxFactoryAbi } from "./abi/plsx-factory-abi"

// Update ERC20 ABI to proper format for Web3.js
const erc20Abi = [
    {
        "constant": true,
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "name",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    }
]

export const PULSECHAIN_FIRST_BLOCK = 17233000

export const isValidWalletAddress = (address) => {
    const formattedAddress = address.toLowerCase().trim();

    if (!ethers.utils.isAddress(formattedAddress)) {
        console.error("Invalid wallet address");
        return false;
    }
    return true
}

export const batchFetchActivities = async (addresses, network = 'mainnet', settings = defaultSettings) => {
    try {
        const scanApi = settings.scan[network]
        const batchCalls = addresses.map(m => {
            const endpoint = scanApi + `/v2/addresses/${m}/transactions?filter=to%20%7C%20from`
            return axios.get(endpoint).then(r => {
                const transactions = r?.data?.items ?? []

                return {
                    address: m,
                    transactions
                }
            })
        })
        const response = await Promise.allSettled(batchCalls)
        
        const successfulResults = response.filter(f => f.status == 'fulfilled').map(m => m?.value)
        const results = {}

        for (let i = 0; i < successfulResults.length; i++) {
            const item = successfulResults[i]
            results[item.address] = item.transactions.map(m => { return { ...m, originating_address: item.address.toLowerCase() } })
        }

        return results
    } catch {
        // failed
    }
    return
}

// Helper function to create RPC provider with fallback
export const createProvider = (rpcs) => { 
    const provider = new ethers.providers.FallbackProvider(
        rpcs.map(rpc => new ethers.providers.JsonRpcProvider(rpc))
    )
    return provider
}

// Function to batch query getReserves() for multiple LP pairs
export const batchQueryReserves = async (addresses, network = 'mainnet', settings = defaultSettings) => {
    if (!addresses || addresses.length === 0) {
        return {}
    }

    try {
        const web3 = new Web3(settings.rpcs[network][0])
        const batch = new web3.BatchRequest()
        const validAddresses = addresses.filter(addr => addr && typeof addr === 'string')
        
        // Create a promise that resolves when all requests complete
        const batchPromise = new Promise((resolve) => {
            const results = {}
            let completed = 0
            let hasResolved = false

            // Initialize results with default values
            validAddresses.forEach(address => {
                results[address.toLowerCase()] = {
                    reserve0: '0',
                    reserve1: '0',
                    timestamp: '0'
                }
            })

            validAddresses.forEach(address => {
                try {
                    const contract = new web3.eth.Contract(plpAbi, address)
                    
                    batch.add(
                        contract.methods.getReserves().call.request((err, result) => {
                            try {
                                if (!err && result && result['0'] && result['1']) {
                                    results[address.toLowerCase()] = {
                                        reserve0: result['0'].toString(),
                                        reserve1: result['1'].toString(),
                                        timestamp: (result['2'] || '0').toString()
                                    }
                                }
                            } catch (innerErr) {
                                console.warn(`Inner error processing reserves for ${address}:`, innerErr)
                                // Keep default values set during initialization
                            }

                            completed++
                            if (completed === validAddresses.length && !hasResolved) {
                                hasResolved = true
                                resolve(results)
                            }
                        })
                    )
                } catch (contractErr) {
                    console.warn(`Error creating contract for ${address}:`, contractErr)
                    completed++
                    if (completed === validAddresses.length && !hasResolved) {
                        hasResolved = true
                        resolve(results)
                    }
                }
            })
        })

        try {
            batch.execute()
            const results = await batchPromise
            return results
        } catch (batchErr) {
            console.warn('Error executing batch:', batchErr)
            return {} // Return empty object on batch execution failure
        }

    } catch (error) {
        console.warn('Error in batchQueryReserves:', error)
        return {} // Return empty object on any other error
    }
}

export const batchQueryBalances = async (wallets, tokenAddresses, network = 'mainnet', settings = defaultSettings) => {
    try {
        const web3 = new Web3(settings.rpcs[network][0])
        const batch = new web3.BatchRequest()
        const walletAddresses = Object.keys(wallets)
        
        const batchPromise = new Promise((resolve, reject) => {
            const results = {}
            let completed = 0
            const totalCalls = walletAddresses.length * (tokenAddresses.length + 1) 
            let hasResolved = false
            
            walletAddresses.forEach(wallet => {
                results[wallet.toLowerCase()] = {
                    ...wallets[wallet],
                    balances: { PLS: '0' }
                }
            })

            walletAddresses.forEach(walletAddress => {
                batch.add(
                    web3.eth.getBalance.request(walletAddress, (err, balance) => {
                        if (!err) {
                            results[walletAddress.toLowerCase()].balances.PLS = balance
                        }
                        completed++
                        if (completed === totalCalls && !hasResolved) {
                            hasResolved = true
                            resolve(results)
                        }
                    })
                )
            })

            // Add token balance requests
            walletAddresses.forEach(walletAddress => {
                tokenAddresses.forEach(tokenAddress => {
                    const contract = new web3.eth.Contract(erc20Abi, tokenAddress)
                    
                    batch.add(
                        contract.methods.balanceOf(walletAddress).call.request((err, balance) => {
                            if (!err) {
                                results[walletAddress.toLowerCase()].balances[tokenAddress.toLowerCase()] = balance
                            }
                            completed++
                            if (completed === totalCalls && !hasResolved) {
                                hasResolved = true
                                resolve(results)
                            }
                        })
                    )
                })
            })
        })

        // Execute batch and wait for all results
        batch.execute()
        const results = await batchPromise

        // Handle wrapped PLS total
        Object.keys(results).forEach(walletAddress => {
            const wrappedPlsBalance = results[walletAddress].balances['0xa1077a294dde1b09bb078844df40758a5d0f9a27'] || '0'
            const nativePlsBalance = results[walletAddress].balances.PLS || '0'
            const totalPls = BigInt(nativePlsBalance) + BigInt(wrappedPlsBalance)
            
            results[walletAddress].balances['0xa1077a294dde1b09bb078844df40758a5d0f9a27'] = totalPls.toString()
        })

        return results

    } catch (error) {
        console.error('Error in batchQueryBalances:', error)
        throw error
    }
}

export const batchQueryLPs = async (addresses, network = 'mainnet', settings = defaultSettings) => {
    try {
        const web3 = new Web3(settings.rpcs[network][0])
        const results = {}
        const walletAddresses = settings?.wallets ? Object.keys(settings.wallets) : []

        // First get LP info for each address
        for (const lpAddress of addresses) {
            const lpContract = new web3.eth.Contract(plpAbi, lpAddress)
            const lpBatch = new web3.BatchRequest()

            await new Promise((resolve) => {
                let completed = 0
                const lpResult = {
                    reserve0: '0',
                    reserve1: '0',
                    timestamp: '0',
                    totalSupply: '0',
                    token0: '',
                    token1: '',
                    version: undefined,
                    balances: {}
                }
                results[lpAddress.toLowerCase()] = lpResult

                // Get reserves
                lpBatch.add(
                    lpContract.methods.getReserves().call.request((err, reserves) => {
                        if (!err && reserves) {
                            lpResult.reserve0 = reserves['0'].toString()
                            lpResult.reserve1 = reserves['1'].toString()
                            lpResult.timestamp = reserves['2']
                        }
                        completed++
                        if (completed === 4) resolve()
                    })
                )

                // Get totalSupply
                lpBatch.add(
                    lpContract.methods.totalSupply().call.request((err, supply) => {
                        if (!err && supply) {
                            lpResult.totalSupply = supply.toString()
                        }
                        completed++
                        if (completed === 4) resolve()
                    })
                )

                // Get token0
                lpBatch.add(
                    lpContract.methods.token0().call.request((err, token0) => {
                        if (!err && token0) {
                            lpResult.token0 = token0.toLowerCase()
                        }
                        completed++
                        if (completed === 4) resolve()
                    })
                )

                // Get token1
                lpBatch.add(
                    lpContract.methods.token1().call.request((err, token1) => {
                        if (!err && token1) {
                            lpResult.token1 = token1.toLowerCase()
                        }
                        completed++
                        if (completed === 4) resolve()
                    })
                )

                lpBatch.execute()
            })
        }

        // Then get all balances in a single batch
        if (walletAddresses.length > 0) {
            const balanceBatch = new web3.BatchRequest()
            await new Promise((resolve) => {
                let completed = 0
                const totalBalanceCalls = addresses.length * walletAddresses.length

                addresses.forEach(lpAddress => {
                    const lpContract = new web3.eth.Contract(plpAbi, lpAddress)
                    
                    walletAddresses.forEach(wallet => {
                        balanceBatch.add(
                            lpContract.methods.balanceOf(wallet).call.request((err, balance) => {
                                if (!err && balance) {
                                    results[lpAddress.toLowerCase()].balances[wallet.toLowerCase()] = balance.toString()
                                } else {
                                    results[lpAddress.toLowerCase()].balances[wallet.toLowerCase()] = '0'
                                }
                                completed++
                                if (completed === totalBalanceCalls) resolve()
                            })
                        )
                    })
                })

                balanceBatch.execute()
            })
        }

        return results

    } catch (error) {
        console.error('Error in batchQueryLPs:', error)
        throw error
    }
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const fetchWithRetry = async (fn, retries = 5, delayMs = 1000, initialChunkSize) => {
    let lastError
    let currentChunkSize = initialChunkSize

    for (let i = 0; i < retries; i++) {
        try {
            return await fn(currentChunkSize ?? 50_000)
        } catch (error) {
            console.warn(`Attempt ${i + 1} failed, retrying with chunk size ${currentChunkSize ?? 50_000}...`)
            lastError = error
            await delay(delayMs)
            // Only reduce chunk size if it was provided
            if (currentChunkSize) {
                currentChunkSize = Math.max(Math.floor(currentChunkSize / 2), 100)
            }
        }
    }
    throw lastError
}

export const fetchLPHistory = async (
    lpAddress, 
    fromBlock, 
    toBlock, 
    chunkSize = 10000, 
    network = 'mainnet', 
    settings = defaultSettings,
    tokenInfo = null
) => {
    const fetchChunk = async (currentChunkSize) => {
        const provider = createProvider(settings.rpcs[network])
        const lpContract = new ethers.Contract(lpAddress, plpAbi, provider)

        // Get current reserves
        const currentReserves = await lpContract.getReserves()
        const currentReserve0 = BigInt(currentReserves?.[0]?.toString() ?? 1)
        const currentReserve1 = BigInt(currentReserves?.[1]?.toString() ?? 1)

        // Calculate price using proper decimals
        const decimals0 = Number(tokenInfo?.token0?.decimals ?? 18)
        const decimals1 = Number(tokenInfo?.token1?.decimals ?? 18)

        const currentPrice = currentReserve0 > 0n 
            ? (Number(currentReserve1) / Math.pow(10, decimals1)) / 
              (Number(currentReserve0) / Math.pow(10, decimals0))
            : 0
        const currentPriceInverted = currentReserve1 > 0n 
            ? (Number(currentReserve0) / Math.pow(10, decimals0)) / 
              (Number(currentReserve1) / Math.pow(10, decimals1))
            : 0

        // Start from current reserves and work backwards
        let reserve0 = currentReserve0
        let reserve1 = currentReserve1

        const mintFilter = lpContract.filters.Mint()
        const burnFilter = lpContract.filters.Burn()
        const swapFilter = lpContract.filters.Swap()

        const events = []
        
        for (let i = fromBlock; i < toBlock; i += currentChunkSize) {
            const endBlock = Math.min(i + currentChunkSize - 1, toBlock)
            
            const mintEvents = await fetchWithRetry(
                async () => await lpContract.queryFilter(mintFilter, i, endBlock), 
                5, 
                1500
            )
            
            const formattedMintEvents = mintEvents.map(e => ({
                type: 'mint',
                blockNumber: e.blockNumber,
                amount0: e.args.amount0.toString(),
                amount1: e.args.amount1.toString()
            }))

            await delay(250)

            const burnEvents = await fetchWithRetry(
                async () => await lpContract.queryFilter(burnFilter, i, endBlock), 
                5, 
                1500
            )

            const formattedBurnEvents = burnEvents.map(e => ({
                type: 'burn',
                blockNumber: e.blockNumber,
                amount0: e.args.amount0.toString(),
                amount1: e.args.amount1.toString()
            }))

            await delay(250)

            const SWAP_CHUNK_SIZE = currentChunkSize / 2
            const swapEvents = []
            
            for (let j = i; j < endBlock; j += SWAP_CHUNK_SIZE) {
                const swapEndBlock = Math.min(j + SWAP_CHUNK_SIZE - 1, endBlock)
                const chunkSwapEvents = await fetchWithRetry(
                    async () => await lpContract.queryFilter(swapFilter, j, swapEndBlock),
                    5,
                    1000
                )
                
                const formattedSwapEvents = chunkSwapEvents.map(e => ({
                    type: 'swap',
                    blockNumber: e.blockNumber,
                    amount0In: e.args.amount0In.toString(),
                    amount1In: e.args.amount1In.toString(),
                    amount0Out: e.args.amount0Out.toString(),
                    amount1Out: e.args.amount1Out.toString()
                }))
                swapEvents.push(...formattedSwapEvents)
                
                // if (j + SWAP_CHUNK_SIZE < endBlock) {
                //     await delay(250)
                // }
            }

            // Sort events from newest to oldest since we're working backwards
            const chunkEvents = [...formattedMintEvents, ...formattedBurnEvents, ...swapEvents]
                .sort((a, b) => b.blockNumber - a.blockNumber)

            // Process events backwards
            chunkEvents.forEach(event => {
                // Ensure all event values are present
                event.amount0 = event.amount0 || '0'
                event.amount1 = event.amount1 || '0'
                event.amount0In = event.amount0In || '0'
                event.amount1In = event.amount1In || '0'
                event.amount0Out = event.amount0Out || '0'
                event.amount1Out = event.amount1Out || '0'

                // Reverse the operations since we're going backwards
                if (event.type === 'mint') {
                    reserve0 -= BigInt(event.amount0)
                    reserve1 -= BigInt(event.amount1)
                } else if (event.type === 'burn') {
                    reserve0 += BigInt(event.amount0)
                    reserve1 += BigInt(event.amount1)
                } else if (event.type === 'swap') {
                    reserve0 = reserve0 - BigInt(event.amount0In) + BigInt(event.amount0Out)
                    reserve1 = reserve1 - BigInt(event.amount1In) + BigInt(event.amount1Out)
                }

                // Ensure reserves stay non-negative
                reserve0 = reserve0 < 0n ? 0n : reserve0
                reserve1 = reserve1 < 0n ? 0n : reserve1

                // Calculate price using proper decimals
                event.price = reserve0 > 0n 
                    ? (Number(reserve1) / Math.pow(10, decimals1)) / 
                      (Number(reserve0) / Math.pow(10, decimals0))
                    : 0
                event.priceInverted = reserve1 > 0n 
                    ? (Number(reserve0) / Math.pow(10, decimals0)) / 
                      (Number(reserve1) / Math.pow(10, decimals1))
                    : 0
            })

            events.push(...chunkEvents)
        }

        // Add current block price
        events.push({
            blockNumber: toBlock,
            price: currentPrice,
            priceInverted: currentPriceInverted
        })

        // Return ending reserves along with other data
        return { 
            events, 
            currentPrice, 
            currentPriceInverted,
            endingReserve0: reserve0,
            endingReserve1: reserve1
        }
    }

    try {
        const result = await fetchWithRetry(fetchChunk, 5, 1000, chunkSize)
        return {
            events: result.events
                .sort((a, b) => b.blockNumber - a.blockNumber)
                .map(e => ({
                    blockNumber: e.blockNumber,
                    price: e.price,
                    priceInverted: e.priceInverted
                })),
            currentPrice: result.currentPrice,
            currentPriceInverted: result.currentPriceInverted,
            endingReserve0: result.endingReserve0,
            endingReserve1: result.endingReserve1
        }
    } catch (error) {
        console.error('Error fetching LP history:', error)
        throw error
    }
}

export const fetchMoreLPHistory = async (
    lpAddress,
    fromBlock,
    toBlock,
    startingReserve0,
    startingReserve1,
    chunkSize = 10000,
    network = 'mainnet',
    settings = defaultSettings,
    tokenInfo = null
) => {
    const fetchChunk = async (currentChunkSize) => {
        const provider = createProvider(settings.rpcs[network])
        const lpContract = new ethers.Contract(lpAddress, plpAbi, provider)

        // Start from provided reserves
        let reserve0 = startingReserve0
        let reserve1 = startingReserve1
        const precision = 1_000_000_000n

        const mintFilter = lpContract.filters.Mint()
        const burnFilter = lpContract.filters.Burn()
        const swapFilter = lpContract.filters.Swap()

        const events = []
        
        for (let i = fromBlock; i < toBlock; i += currentChunkSize) {
            const endBlock = Math.min(i + currentChunkSize - 1, toBlock)
            
            const mintEvents = await fetchWithRetry(
                async () => await lpContract.queryFilter(mintFilter, i, endBlock), 
                5, 
                1500
            )
            
            const formattedMintEvents = mintEvents.map(e => ({
                type: 'mint',
                blockNumber: e.blockNumber,
                amount0: e.args.amount0.toString(),
                amount1: e.args.amount1.toString()
            }))

            await delay(500)

            const burnEvents = await fetchWithRetry(
                async () => await lpContract.queryFilter(burnFilter, i, endBlock), 
                5, 
                1500
            )

            const formattedBurnEvents = burnEvents.map(e => ({
                type: 'burn',
                blockNumber: e.blockNumber,
                amount0: e.args.amount0.toString(),
                amount1: e.args.amount1.toString()
            }))

            await delay(500)

            const SWAP_CHUNK_SIZE = currentChunkSize / 2
            const swapEvents = []
            
            for (let j = i; j < endBlock; j += SWAP_CHUNK_SIZE) {
                const swapEndBlock = Math.min(j + SWAP_CHUNK_SIZE - 1, endBlock)
                const chunkSwapEvents = await fetchWithRetry(
                    async () => await lpContract.queryFilter(swapFilter, j, swapEndBlock),
                    5,
                    1000
                )
                
                const formattedSwapEvents = chunkSwapEvents.map(e => ({
                    type: 'swap',
                    blockNumber: e.blockNumber,
                    amount0In: e.args.amount0In.toString(),
                    amount1In: e.args.amount1In.toString(),
                    amount0Out: e.args.amount0Out.toString(),
                    amount1Out: e.args.amount1Out.toString()
                }))
                swapEvents.push(...formattedSwapEvents)
                
                if (j + SWAP_CHUNK_SIZE < endBlock) {
                    await delay(500)
                }
            }

            // Sort events from newest to oldest since we're working backwards
            const chunkEvents = [...formattedMintEvents, ...formattedBurnEvents, ...swapEvents]
                .sort((a, b) => b.blockNumber - a.blockNumber)

            // Process events backwards
            chunkEvents.forEach(event => {
                // Ensure all event values are present
                event.amount0 = event.amount0 || '0'
                event.amount1 = event.amount1 || '0'
                event.amount0In = event.amount0In || '0'
                event.amount1In = event.amount1In || '0'
                event.amount0Out = event.amount0Out || '0'
                event.amount1Out = event.amount1Out || '0'

                // Reverse the operations since we're going backwards
                if (event.type === 'mint') {
                    reserve0 -= BigInt(event.amount0)
                    reserve1 -= BigInt(event.amount1)
                } else if (event.type === 'burn') {
                    reserve0 += BigInt(event.amount0)
                    reserve1 += BigInt(event.amount1)
                } else if (event.type === 'swap') {
                    reserve0 = reserve0 - BigInt(event.amount0In) + BigInt(event.amount0Out)
                    reserve1 = reserve1 - BigInt(event.amount1In) + BigInt(event.amount1Out)
                }

                // Ensure reserves stay non-negative
                reserve0 = reserve0 < 0n ? 0n : reserve0
                reserve1 = reserve1 < 0n ? 0n : reserve1

                // Calculate price using same method
                event.price = reserve0 > 0n 
                    ? Number(reserve1 * precision / reserve0) / Number(precision)
                    : 0
                event.priceInverted = reserve1 > 0n 
                    ? Number(reserve0 * precision / reserve1) / Number(precision)
                    : 0
            })

            events.push(...chunkEvents)
        }

        return { 
            events, 
            endingReserve0: reserve0,
            endingReserve1: reserve1
        }
    }

    try {
        const result = await fetchWithRetry(fetchChunk, 5, 1000, chunkSize)
        return {
            events: result.events
                .sort((a, b) => b.blockNumber - a.blockNumber)
                .map(e => ({
                    blockNumber: e.blockNumber,
                    price: e.price,
                    priceInverted: e.priceInverted
                })),
            endingReserve0: result.endingReserve0,
            endingReserve1: result.endingReserve1
        }
    } catch (error) {
        console.error('Error fetching more LP history:', error)
        throw error
    }
}

export const fetchLatestLPHistory = async (
    lpAddress,
    lastKnownBlock,
    currentBlock,
    CHUNK_SIZE = 100000,
    network = 'mainnet',
    settings = defaultSettings,
    tokenInfo = null
) => {
    try {
        const provider = new ethers.providers.JsonRpcProvider(settings.rpcs[network][0])
        const lpContract = new ethers.Contract(lpAddress, plpAbi, provider)
        const precision = 10n ** 18n

        // Get current reserves to calculate current price
        const currentReserves = await lpContract.getReserves()
        const currentReserve0 = BigInt(currentReserves[0].toString())
        const currentReserve1 = BigInt(currentReserves[1].toString())
        
        // Calculate current price
        const currentPrice = currentReserve0 > 0n 
            ? Number(currentReserve1 * precision / currentReserve0) / Number(precision)
            : 0
        const currentPriceInverted = currentReserve1 > 0n
            ? Number(currentReserve0 * precision / currentReserve1) / Number(precision)
            : 0

        // Set up event filters
        const mintFilter = lpContract.filters.Mint()
        const burnFilter = lpContract.filters.Burn()
        const swapFilter = lpContract.filters.Swap()

        // Track reserves as we process events
        let reserve0 = currentReserve0
        let reserve1 = currentReserve1

        const events = []
        
        // Fetch events in chunks from current block back to last known block
        for (let i = currentBlock; i > lastKnownBlock; i -= CHUNK_SIZE) {
            const startBlock = Math.max(i - CHUNK_SIZE + 1, lastKnownBlock)
            
            // Fetch all events in parallel for this chunk
            const [mintEvents, burnEvents, swapEvents] = await Promise.all([
                lpContract.queryFilter(mintFilter, startBlock, i),
                lpContract.queryFilter(burnFilter, startBlock, i),
                lpContract.queryFilter(swapFilter, startBlock, i)
            ])

            // Format and combine events
            const chunkEvents = [
                ...mintEvents.map(e => ({
                    type: 'mint',
                    blockNumber: e.blockNumber,
                    amount0: e.args.amount0.toString(),
                    amount1: e.args.amount1.toString()
                })),
                ...burnEvents.map(e => ({
                    type: 'burn',
                    blockNumber: e.blockNumber,
                    amount0: e.args.amount0.toString(),
                    amount1: e.args.amount1.toString()
                })),
                ...swapEvents.map(e => ({
                    type: 'swap',
                    blockNumber: e.blockNumber,
                    amount0In: e.args.amount0In.toString(),
                    amount1In: e.args.amount1In.toString(),
                    amount0Out: e.args.amount0Out.toString(),
                    amount1Out: e.args.amount1Out.toString()
                }))
            ].sort((a, b) => b.blockNumber - a.blockNumber) // Sort newest to oldest

            // Process events and calculate prices
            chunkEvents.forEach(event => {
                if (event.type === 'mint') {
                    reserve0 -= BigInt(event.amount0)
                    reserve1 -= BigInt(event.amount1)
                } else if (event.type === 'burn') {
                    reserve0 += BigInt(event.amount0)
                    reserve1 += BigInt(event.amount1)
                } else if (event.type === 'swap') {
                    reserve0 = reserve0 - BigInt(event.amount0In) + BigInt(event.amount0Out)
                    reserve1 = reserve1 - BigInt(event.amount1In) + BigInt(event.amount1Out)
                }

                // Ensure reserves stay non-negative
                reserve0 = reserve0 < 0n ? 0n : reserve0
                reserve1 = reserve1 < 0n ? 0n : reserve1

                // Calculate price
                event.price = reserve0 > 0n 
                    ? Number(reserve1 * precision / reserve0) / Number(precision)
                    : 0
                event.priceInverted = reserve1 > 0n 
                    ? Number(reserve0 * precision / reserve1) / Number(precision)
                    : 0
            })

            events.push(...chunkEvents)
        }

        return {
            events: events.sort((a, b) => a.blockNumber - b.blockNumber),
            currentPrice,
            currentPriceInverted,
            endingReserve0: currentReserve0,
            endingReserve1: currentReserve1
        }
    } catch (error) {
        console.error('Error fetching latest LP history:', error)
        throw error
    }
}

export const validateAndFetchLPInfo = async (address, network = 'mainnet', settings = defaultSettings) => {
    try {
        const web3 = new Web3(settings.rpcs[network][0])
        const lpContract = new web3.eth.Contract(plpAbi, address)
        
        // First batch: Get LP contract info
        const lpInfo = await new Promise((resolve, reject) => {
            const batch = new web3.BatchRequest()
            const result = {
                id: address.toLowerCase(),
                reserve0: '0',
                reserve1: '0',
                totalSupply: '0',
                token0: { id: '', symbol: '', name: '', derivedUSD: '0' },
                token1: { id: '', symbol: '', name: '', derivedUSD: '0' },
                reserveUSD: '0'
            }
            let completed = 0
            
            // Get reserves
            batch.add(
                lpContract.methods.getReserves().call.request({}, (error, reserves) => {
                    if (!error && reserves) {
                        result.reserve0 = reserves['0'].toString()
                        result.reserve1 = reserves['1'].toString()
                    }
                    completed++
                    if (completed === 4) resolve(result)
                })
            )

            // Get totalSupply
            batch.add(
                lpContract.methods.totalSupply().call.request({}, (error, supply) => {
                    if (!error && supply) {
                        result.totalSupply = supply.toString()
                    }
                    completed++
                    if (completed === 4) resolve(result)
                })
            )

            // Get token0
            batch.add(
                lpContract.methods.token0().call.request({}, (error, token0) => {
                    if (!error && token0) {
                        result.token0.id = token0.toLowerCase()
                    }
                    completed++
                    if (completed === 4) resolve(result)
                })
            )

            // Get token1
            batch.add(
                lpContract.methods.token1().call.request({}, (error, token1) => {
                    if (!error && token1) {
                        result.token1.id = token1.toLowerCase()
                    }
                    completed++
                    if (completed === 4) resolve(result)
                })
            )

            batch.execute()
        })

        // If we got token addresses, fetch their info
        if (lpInfo.token0.id && lpInfo.token1.id) {
            const tokenBatch = new web3.BatchRequest()
            await new Promise((resolve) => {
                let completed = 0
                const totalCalls = 6 // 3 calls per token

                // Token0 info
                const token0Contract = new web3.eth.Contract(erc20Abi, lpInfo.token0.id)
                tokenBatch.add(
                    token0Contract.methods.symbol().call.request({}, (error, symbol) => {
                        if (!error && symbol) {
                            lpInfo.token0.symbol = symbol
                            lpInfo.token0.name = symbol  // Set initial name to symbol
                        }
                        completed++
                        if (completed === totalCalls) resolve()
                    })
                )
                
                // Try to get name, but keep symbol as fallback
                try {
                    tokenBatch.add(
                        token0Contract.methods.name().call.request({}, (error, name) => {
                            if (!error && name) lpInfo.token0.name = name  // Only override if name exists
                            completed++
                            if (completed === totalCalls) resolve()
                        })
                    )
                } catch (error) {
                    completed++
                    if (completed === totalCalls) resolve()
                }

                tokenBatch.add(
                    token0Contract.methods.decimals().call.request({}, (error, decimals) => {
                        if (!error && decimals) lpInfo.token0.decimals = decimals
                        completed++
                        if (completed === totalCalls) resolve()
                    })
                )

                // Token1 info
                const token1Contract = new web3.eth.Contract(erc20Abi, lpInfo.token1.id)
                tokenBatch.add(
                    token1Contract.methods.symbol().call.request({}, (error, symbol) => {
                        if (!error && symbol) {
                            lpInfo.token1.symbol = symbol
                            lpInfo.token1.name = symbol  // Set initial name to symbol
                        }
                        completed++
                        if (completed === totalCalls) resolve()
                    })
                )

                // Try to get name, but keep symbol as fallback
                try {
                    tokenBatch.add(
                        token1Contract.methods.name().call.request({}, (error, name) => {
                            if (!error && name) lpInfo.token1.name = name  // Only override if name exists
                            completed++
                            if (completed === totalCalls) resolve()
                        })
                    )
                } catch (error) {
                    completed++
                    if (completed === totalCalls) resolve()
                }

                tokenBatch.add(
                    token1Contract.methods.decimals().call.request({}, (error, decimals) => {
                        if (!error && decimals) lpInfo.token1.decimals = decimals
                        completed++
                        if (completed === totalCalls) resolve()
                    })
                )

                tokenBatch.execute()
            })
        }


        try {
            const version = await findPairVersion(lpInfo.token0.id, lpInfo.token1.id, network, settings)
            lpInfo.version = version
        } catch (error) {
            console.error('Error getting pair version:', error)
        }

        return lpInfo

    } catch (error) {
        console.error('Not Valid LP Pair')
        return {}
    }
}

export const findAndValidatePulseXPair = async ({tokenAddress, network = 'mainnet', settings = defaultSettings, version = 'v2'}) => {
    const PULSEX_FACTORY = version === 'v2' ? '0x29eA7545DEf87022BAdc76323F373EA1e707C523' : '0x1715a3E4A142d8b698131108995174F37aEBA10D'
    const WPLS = '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
    
    try {
        const web3 = new Web3(settings.rpcs[network][0])
        const factoryContract = new web3.eth.Contract(plsxFactoryAbi, PULSEX_FACTORY)
        
        // Check both possible pair combinations
        const pairAddress = await new Promise((resolve) => {
            const batch = new web3.BatchRequest()
            let completed = 0
            let foundPair = null

            // Check token/WPLS pair
            batch.add(
                factoryContract.methods.getPair(tokenAddress, WPLS).call.request({}, (error, pair) => {
                    if (!error && pair && pair !== '0x0000000000000000000000000000000000000000') {
                        foundPair = pair
                    }
                    completed++
                    if (completed === 2) resolve(foundPair)
                })
            )

            // Check WPLS/token pair
            batch.add(
                factoryContract.methods.getPair(WPLS, tokenAddress).call.request({}, (error, pair) => {
                    if (!error && pair && pair !== '0x0000000000000000000000000000000000000000') {
                        foundPair = pair
                    }
                    completed++
                    if (completed === 2) resolve(foundPair)
                })
            )

            batch.execute()
        })

        // If we found a pair, validate and fetch its info
        if (pairAddress) {
            return await validateAndFetchLPInfo(pairAddress, network, settings)
        }

        return {}

    } catch (error) {
        console.error('Not PulseX Pair')
        return {}
    }
}

export const findPairVersion = async (token0Address, token1Address, network = 'mainnet', settings = defaultSettings) => {
    const PULSEX_V2_FACTORY = '0x29eA7545DEf87022BAdc76323F373EA1e707C523'
    const PULSEX_V1_FACTORY = '0x1715a3E4A142d8b698131108995174F37aEBA10D'
    
    try {
        const web3 = new Web3(settings.rpcs[network][0])
        const v2Factory = new web3.eth.Contract(plsxFactoryAbi, PULSEX_V2_FACTORY)
        const v1Factory = new web3.eth.Contract(plsxFactoryAbi, PULSEX_V1_FACTORY)
        
        // Check both factories in parallel
        const version = await new Promise((resolve) => {
            const batch = new web3.BatchRequest()
            let completed = 0
            let foundVersion = undefined

            // Check v2 pair
            batch.add(
                v2Factory.methods.getPair(token0Address, token1Address).call.request({}, (error, pair) => {
                    if (!error && pair && pair !== '0x0000000000000000000000000000000000000000') {
                        foundVersion = 'v2'
                    }
                    completed++
                    if (completed === 2) resolve(foundVersion)
                })
            )
            batch.add(
                v2Factory.methods.getPair(token1Address, token0Address).call.request({}, (error, pair) => {
                    if (!error && pair && pair !== '0x0000000000000000000000000000000000000000') {
                        foundVersion = 'v2'
                    }
                    completed++
                    if (completed === 2) resolve(foundVersion)
                })
            )

            // Check v1 pair
            batch.add(
                v1Factory.methods.getPair(token0Address, token1Address).call.request({}, (error, pair) => {
                    if (!error && pair && pair !== '0x0000000000000000000000000000000000000000') {
                        // Only set v1 if v2 wasn't found
                        if (!foundVersion) foundVersion = 'v1'
                    }
                    completed++
                    if (completed === 2) resolve(foundVersion)
                })
            )
            batch.add(
                v1Factory.methods.getPair(token1Address, token0Address).call.request({}, (error, pair) => {
                    if (!error && pair && pair !== '0x0000000000000000000000000000000000000000') {
                        // Only set v1 if v2 wasn't found
                        if (!foundVersion) foundVersion = 'v1'
                    }
                    completed++
                    if (completed === 2) resolve(foundVersion)
                })
            )

            batch.execute()
        })

        return version

    } catch (error) {
        console.error('Error checking pair version:', error)
        return undefined
    }
}

export const fetchTokenInfo = async (tokenAddress, network = 'mainnet', settings = defaultSettings) => {
    try {
        const web3 = new Web3(settings.rpcs[network][0])
        const tokenContract = new web3.eth.Contract(erc20Abi, tokenAddress)

        const tokenInfo = await new Promise((resolve) => {
            const batch = new web3.BatchRequest()
            let completed = 0
            const totalCalls = 3

            const result = {
                id: tokenAddress.toLowerCase(),
                symbol: '',
                name: '',
                derivedUSD: '0',
                decimals: 18
            }

            // Get symbol
            batch.add(
                tokenContract.methods.symbol().call.request({}, (error, symbol) => {
                    if (!error && symbol) {
                        result.symbol = symbol
                        result.name = symbol  // Set initial name to symbol as fallback
                    }
                    completed++
                    if (completed === totalCalls) resolve(result)
                })
            )

            // Get name
            batch.add(
                tokenContract.methods.name().call.request({}, (error, name) => {
                    if (!error && name) {
                        result.name = name  // Override symbol with name if available
                    }
                    completed++
                    if (completed === totalCalls) resolve(result)
                })
            )

            // Get decimals
            batch.add(
                tokenContract.methods.decimals().call.request({}, (error, decimals) => {
                    if (!error && decimals) {
                        result.decimals = Number(decimals)
                    }
                    completed++
                    if (completed === totalCalls) resolve(result)
                })
            )

            batch.execute()
        })

        return tokenInfo

    } catch (error) {
        console.error('Error fetching token info:', error)
        return {
            id: tokenAddress.toLowerCase(),
            symbol: '',
            name: '',
            derivedUSD: '0',
            decimals: 18
        }
    }
}

export const batchFetchTokenInfo = async (tokenAddresses, network = 'mainnet', settings = defaultSettings) => {
    try {
        const web3 = new Web3(settings.rpcs[network][0])
        const batch = new web3.BatchRequest()
        
        const results = {}
        let completed = 0
        const totalCalls = tokenAddresses.length * 3 // 3 calls per token

        await new Promise((resolve) => {
            // Process each token address
            tokenAddresses.forEach(address => {
                const tokenContract = new web3.eth.Contract(erc20Abi, address)
                
                // Initialize result object for this token
                results[address.toLowerCase()] = {
                    id: address.toLowerCase(),
                    symbol: '',
                    name: '',
                    derivedUSD: '0',
                    decimals: 18
                }

                // Get symbol
                batch.add(
                    tokenContract.methods.symbol().call.request({}, (error, symbol) => {
                        if (!error && symbol) {
                            results[address.toLowerCase()].symbol = symbol
                            results[address.toLowerCase()].name = symbol // Set initial name to symbol as fallback
                        }
                        completed++
                        if (completed === totalCalls) resolve()
                    })
                )

                // Get name
                batch.add(
                    tokenContract.methods.name().call.request({}, (error, name) => {
                        if (!error && name) {
                            results[address.toLowerCase()].name = name // Override symbol with name if available
                        }
                        completed++
                        if (completed === totalCalls) resolve()
                    })
                )

                // Get decimals
                batch.add(
                    tokenContract.methods.decimals().call.request({}, (error, decimals) => {
                        if (!error && decimals) {
                            results[address.toLowerCase()].decimals = Number(decimals)
                        }
                        completed++
                        if (completed === totalCalls) resolve()
                    })
                )
            })

            batch.execute()
        })

        return results

    } catch (error) {
        console.error('Error batch fetching token info:', error)
        // Return default values for all requested tokens
        return tokenAddresses.reduce((acc, address) => {
            acc[address.toLowerCase()] = {
                id: address.toLowerCase(),
                symbol: '',
                name: '',
                derivedUSD: '0',
                decimals: 18
            }
            return acc
        }, {})
    }
}

export const batchFindPulseXPairs = async (addresses, network = 'mainnet', settings = defaultSettings) => {
    const PULSEX_V2_FACTORY = '0x29eA7545DEf87022BAdc76323F373EA1e707C523'
    const WPLS = '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
    const BATCH_SIZE = 100
    
    try {
        const web3 = new Web3(settings.rpcs[network][0])
        const factoryContract = new web3.eth.Contract(plsxFactoryAbi, PULSEX_V2_FACTORY)
        const validPairs = []

        // Process addresses in batches of 100
        for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
            const batch = new web3.BatchRequest()
            const currentBatch = addresses.slice(i, i + BATCH_SIZE)
            
            await new Promise((resolve) => {
                let completed = 0
                const totalCalls = currentBatch.length * 2 // Check both token orders

                currentBatch.forEach(tokenAddress => {
                    // Check both possible pair combinations
                    batch.add(
                        factoryContract.methods.getPair(WPLS, tokenAddress).call.request({}, (error, pair) => {
                            if (!error && pair && pair !== '0x0000000000000000000000000000000000000000') {
                                validPairs.push({
                                    a: tokenAddress,
                                    pairAddress: pair.toLowerCase(),
                                    needsVerification: true
                                })
                            }
                            completed++
                            if (completed === totalCalls) resolve()
                        })
                    )

                    batch.add(
                        factoryContract.methods.getPair(tokenAddress, WPLS).call.request({}, (error, pair) => {
                            if (!error && pair && pair !== '0x0000000000000000000000000000000000000000') {
                                validPairs.push({
                                    a: tokenAddress,
                                    pairAddress: pair.toLowerCase(),
                                    needsVerification: true
                                })
                            }
                            completed++
                            if (completed === totalCalls) resolve()
                        })
                    )
                })

                batch.execute()
            })
        }

        // Verify token order for valid pairs
        const verifiedPairs = []
        for (let i = 0; i < validPairs.length; i += BATCH_SIZE) {
            const batch = new web3.BatchRequest()
            const currentBatch = validPairs.slice(i, i + BATCH_SIZE)
            
            await new Promise((resolve) => {
                let completed = 0
                
                currentBatch.forEach(pair => {
                    const lpContract = new web3.eth.Contract(plpAbi, pair.pairAddress)
                    
                    // Get token0 to verify order
                    batch.add(
                        lpContract.methods.token0().call.request({}, (error, token0) => {
                            if (!error && token0) {
                                const isToken0Wpls = token0.toLowerCase() === WPLS.toLowerCase()
                                verifiedPairs.push({
                                    ...pair,
                                    token0: isToken0Wpls ? WPLS : pair.a.toLowerCase(),
                                    token1: isToken0Wpls ? pair.a.toLowerCase() : WPLS,
                                    isToken0Wpls
                                })
                            }
                            completed++
                            if (completed === currentBatch.length) resolve()
                        })
                    )
                })

                batch.execute()
            })
        }

        // Get reserves for verified pairs
        const results = []
        for (let i = 0; i < verifiedPairs.length; i += BATCH_SIZE) {
            const batch = new web3.BatchRequest()
            const currentBatch = verifiedPairs.slice(i, i + BATCH_SIZE)
            
            await new Promise((resolve) => {
                let completed = 0
                
                currentBatch.forEach(pair => {
                    const lpContract = new web3.eth.Contract(plpAbi, pair.pairAddress)
                    
                    batch.add(
                        lpContract.methods.getReserves().call.request({}, (error, reserves) => {
                            if (!error && reserves) {
                                results.push({
                                    version: 'v2',
                                    a: pair.a,
                                    pairId: pair.pairAddress,
                                    token0: {
                                        a: pair.token0,
                                        reserves: reserves['0'].toString()
                                    },
                                    token1: {
                                        a: pair.token1,
                                        reserves: reserves['1'].toString()
                                    }
                                })
                            }
                            completed++
                            if (completed === currentBatch.length) resolve()
                        })
                    )
                })

                batch.execute()
            })
        }

        return results

    } catch (error) {
        console.error('Error in batchFindPulseXPairs:', error)
        return []
    }
}
