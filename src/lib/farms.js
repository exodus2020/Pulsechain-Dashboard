import { poolsAbi, lplAbi, poolsAddress } from './abi/pools'
import { defaultSettings } from '../config/settings'
import Web3 from 'web3'

export const fetchPoolInfo = async (settings = defaultSettings) => {
    try {
        const web3 = new Web3(settings.rpcs.mainnet[0])
        const poolContract = new web3.eth.Contract(poolsAbi, poolsAddress)
        
        // Get pool length first
        const poolLength = await poolContract.methods.poolLength().call()
        
        // First batch: Get all pool info
        const getPoolInfo = () => {
            return new Promise((resolve, reject) => {
                try {
                    const batch = new web3.BatchRequest()
                    const results = new Array(poolLength)
                    let completed = 0

                    // Add pool info requests to batch
                    for (let i = 0; i < poolLength; i++) {
                        batch.add(
                            poolContract.methods.poolInfo(i).call.request({}, (error, result) => {
                                if (error) {
                                    console.error('Error in request', i, error)
                                } else if (result) {
                                    try {
                                        results[i] = {
                                            lpAddress: result.lpToken.toLowerCase(),
                                            allocPoints: result.allocPoint.toString(),
                                            lastRewardTime: result.lastRewardTime.toString(),
                                            accIncPerShare: result.accIncPerShare.toString()
                                        }
                                    } catch (e) {
                                        console.error('Error processing result', i, e)
                                    }
                                }
                                
                                completed++
                                if (completed === Number(poolLength)) {
                                    resolve(results.filter(Boolean))
                                }
                            })
                        )
                    }

                    batch.execute()
                } catch (e) {
                    console.error('Error in batch execution:', e)
                    reject(e)
                }
            })
        }

        const poolsInfo = await getPoolInfo()

        // Second stage: Get LP details for each pool
        const lpDetailsPromise = Promise.all(poolsInfo.map(async (pool) => {
            try {
                const lpContract = new web3.eth.Contract(lplAbi, pool.lpAddress)
                const lpBatch = new web3.BatchRequest()
                
                const lpDetailsPromise = new Promise((resolve) => {
                    let completed = 0
                    const lpDetails = {
                        ...pool,
                        reserves: {
                            reserve0: '0',
                            reserve1: '0',
                            blockTimestamp: '0',
                            totalSupply: '0'
                        }
                    }

                    lpBatch.add(
                        lpContract.methods.getReserves().call.request((err, reserves) => {
                            if (!err && reserves) {
                                lpDetails.reserves = {
                                    ...lpDetails.reserves,
                                    reserve0: reserves['0'].toString(),
                                    reserve1: reserves['1'].toString(),
                                    blockTimestamp: reserves['2'].toString()
                                }
                            }
                            completed++
                            if (completed === 4) resolve(lpDetails)
                        })
                    )

                    lpBatch.add(
                        lpContract.methods.totalSupply().call.request((err, supply) => {
                            if (!err && supply) {
                                lpDetails.reserves.totalSupply = supply.toString()
                            }
                            completed++
                            if (completed === 4) resolve(lpDetails)
                        })
                    )

                    lpBatch.add(
                        lpContract.methods.token0().call.request((err, token0) => {
                            if (!err && token0) {
                                lpDetails.token0 = token0.toLowerCase()
                            }
                            completed++
                            if (completed === 4) resolve(lpDetails)
                        })
                    )

                    lpBatch.add(
                        lpContract.methods.token1().call.request((err, token1) => {
                            if (!err && token1) {
                                lpDetails.token1 = token1.toLowerCase()
                            }
                            completed++
                            if (completed === 4) resolve(lpDetails)
                        })
                    )
                })

                lpBatch.execute()
                return await lpDetailsPromise

            } catch (error) {
                console.warn(`Error fetching details for pool ${pool.lpAddress}:`, error)
                return null
            }
        }))

        const results = await lpDetailsPromise
        
        // Filter out incomplete results
        return results.filter(pool => 
            pool && 
            pool.lpAddress && 
            pool.token0 && 
            pool.token1 && 
            pool.reserves.totalSupply !== '0'
        )

    } catch (error) {
        console.error('Error in fetchPoolInfo:', error)
        return []
    }
}

export const fetchFarmBalances = async (walletAddresses, poolLength, settings = defaultSettings) => {
    try {
        const web3 = new Web3(settings.rpcs.mainnet[0])
        const poolContract = new web3.eth.Contract(poolsAbi, poolsAddress)

        // Process each wallet with its own batch request
        const walletPromises = walletAddresses.map(walletAddress => {
            return new Promise((resolve, reject) => {
                try {
                    const batch = new web3.BatchRequest()
                    const walletResult = {
                        address: walletAddress,
                        farms: new Array(poolLength)
                    }
                    let completed = 0
                    const totalCalls = poolLength * 2 // userInfo and pendingInc for each pool

                    // Add requests for each pool
                    for (let poolIndex = 0; poolIndex < poolLength; poolIndex++) {
                        // Get userInfo
                        batch.add(
                            poolContract.methods.userInfo(poolIndex, walletAddress).call.request({}, (error, userInfo) => {
                                if (!error && userInfo) {
                                    if (!walletResult.farms[poolIndex]) {
                                        walletResult.farms[poolIndex] = {}
                                    }
                                    walletResult.farms[poolIndex] = {
                                        ...walletResult.farms[poolIndex],
                                        stakedTokensRaw: userInfo.amount.toString(),
                                        stakedTokens: userInfo.amount.toString(),
                                        rewardDebt: userInfo.rewardDebt.toString()
                                    }
                                }
                                completed++
                                if (completed === totalCalls) {
                                    resolve(walletResult)
                                }
                            })
                        )

                        // Get pendingInc
                        batch.add(
                            poolContract.methods.pendingInc(poolIndex, walletAddress).call.request({}, (error, pendingInc) => {
                                if (!error && pendingInc) {
                                    if (!walletResult.farms[poolIndex]) {
                                        walletResult.farms[poolIndex] = {}
                                    }
                                    walletResult.farms[poolIndex] = {
                                        ...walletResult.farms[poolIndex],
                                        pendingInc: pendingInc.toString()
                                    }
                                }
                                completed++
                                if (completed === totalCalls) {
                                    resolve(walletResult)
                                }
                            })
                        )
                    }

                    batch.execute()
                } catch (e) {
                    console.error('Error in wallet batch:', e)
                    reject(e)
                }
            })
        })

        // Wait for all wallet requests to complete
        const results = await Promise.all(walletPromises)
        
        // Format results to match existing structure
        return results.map(result => ({
            address: result.address,
            farms: result.farms.map(farm => farm || {
                stakedTokensRaw: '0',
                stakedTokens: '0',
                rewardDebt: '0',
                pendingInc: '0'
            })
        }))

    } catch (error) {
        console.error('Error in fetchFarmBalances:', error)
        return []
    }
}

export const fetchPendingRewards = async (walletAddresses, poolLength, settings = defaultSettings, farmBalances = {}) => {
    try {
        const web3 = new Web3(settings.rpcs.mainnet[0])
        const poolContract = new web3.eth.Contract(poolsAbi, poolsAddress)

        // Filter wallets and create a map of which pools to check for each wallet
        const walletsToCheck = walletAddresses.reduce((acc, walletAddress) => {
            const walletFarms = farmBalances[walletAddress] || []
            const activePools = walletFarms
                .map((farm, index) => ({
                    poolIndex: index,
                    stakedTokens: BigInt(farm?.stakedTokensRaw || '0')
                }))
                .filter(pool => pool.stakedTokens > 0n)

            if (activePools.length > 0) {
                acc[walletAddress] = activePools
            }
            return acc
        }, {})

        // Process each wallet with its own batch request
        const walletPromises = Object.entries(walletsToCheck).map(([walletAddress, activePools]) => {
            return new Promise((resolve) => {
                try {
                    const batch = new web3.BatchRequest()
                    const rewards = []
                    let completed = 0
                    const totalCalls = activePools.length

                    if (totalCalls === 0) {
                        resolve({ address: walletAddress, rewards: [] })
                        return
                    }

                    // Add pendingInc requests for each active pool
                    activePools.forEach(({ poolIndex }) => {
                        batch.add(
                            poolContract.methods.pendingInc(poolIndex, walletAddress).call.request({}, (error, pendingInc) => {
                                if (!error && pendingInc) {
                                    rewards.push({
                                        poolIndex,
                                        pendingInc: pendingInc.toString()
                                    })
                                } else {
                                    rewards.push({
                                        poolIndex,
                                        pendingInc: '0'
                                    })
                                }
                                completed++
                                if (completed === totalCalls) {
                                    resolve({
                                        address: walletAddress,
                                        rewards: rewards.sort((a, b) => a.poolIndex - b.poolIndex)
                                    })
                                }
                            })
                        )
                    })

                    batch.execute()
                } catch (e) {
                    console.error(`Error in wallet batch for ${walletAddress}:`, e)
                    resolve({
                        address: walletAddress,
                        rewards: activePools.map(({ poolIndex }) => ({
                            poolIndex,
                            pendingInc: '0'
                        }))
                    })
                }
            })
        })

        // Wait for all wallet requests to complete
        return await Promise.all(walletPromises)

    } catch (error) {
        console.error('Error in fetchPendingRewards:', error)
        return []
    }
} 