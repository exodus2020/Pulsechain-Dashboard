// useHistory.jsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { fetchLPHistory, fetchMoreLPHistory, fetchLatestLPHistory, fetchLPHistoryKeyPoints } from '../lib/web3'
import { PULSECHAIN_FIRST_BLOCK } from '../lib/web3'
import { ethers } from 'ethers'
import { defaultSettings } from '../config/settings'
import { appSettingsAtom } from '../store'
import { useAtom } from 'jotai'

export default function useHistory({ priceData }) {
    const [history, setHistory] = useState({})
    const [chartKeyPoints, setChartKeyPoints] = useState({})
    const [dailyCandles, setDailyCandles] = useState({})
    const [reserves, setReserves] = useState({})
    const isLoading = useRef(false)
    const isLoadingChart = useRef([])
    const [isFetchingFullHistory, setIsFetchingFullHistory] = useState(false)
    const isError = useRef(false)
    const [progress, setProgress] = useState({
        processed: 0,
        total: 0,
        status: 'idle',
        start: null,
        end: null,
        init: false
    })

    const [settings] = useAtom(appSettingsAtom)

    const { prices } = priceData
    const bestStable = priceData?.bestStable
    const isReady = Object.keys(prices).length > 0 && bestStable?.pair
    const getTokenInfoForLp = useCallback((lpAddress) => {
    if (!lpAddress) return null

    const normalizedLp = lpAddress.toLowerCase()

    const directTokenAddress = Object.keys(prices).find(
        address => prices[address]?.pairId?.toLowerCase() === normalizedLp
    )

    if (directTokenAddress) {
        return prices[directTokenAddress]
    }

    // Fallbacks for hardcoded pairs used in this file
    if (normalizedLp === '0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9') {
        return Object.values(prices).find(p => p.symbol === 'PLSX') ?? null
    }

    if (normalizedLp === '0xf808bb6265e9ca27002c0a04562bf50d4fe37eaa') {
        return Object.values(prices).find(p => p.symbol === 'INC') ?? null
    }

    return null
}, [prices])

    const DAYS = 30// 30 days of data for 30D change
    const CHUNK_SIZE = 50000
    const BLOCKS_TO_FETCH = 86400 / 10 * DAYS // One day worth of blocks
    const BLOCKS_PER_HOUR = 360 // 10 seconds per block * 360 = 1 hour
    const SECONDS_PER_BLOCK = 10

    const [ init, setInit ] = useState(false)
    const initializing = useRef(false)
    const [batchFetching, setBatchFetching] = useState(false)
    const historyRef = useRef(history) // Add ref to track latest history

    const resetHistory = () => {
        setHistory({})
        setDailyCandles({})
        setReserves({})
        isLoading.current = false
        isError.current = false
        initializing.current = false
        setProgress({ ...progress, processed: 0, total: 0, status: 'idle', start: null, end: null, init: false })
        setInit(false)
    }

    // Update historyRef whenever history changes
    useEffect(() => {
        historyRef.current = history
    }, [history])

    // First useEffect for initial data loading
    useEffect(() => {
        if (Object.keys(prices).length === 0) return
        if (!isReady) return
        if (!init) {
            const getInitialData = async () => {
                if (initializing.current) return
                initializing.current = true

                const bestStableAddress = bestStable?.pair ?? '0xe56043671df55de5cdf8459710433c10324de0ae'
                const plsPairId = Object.values(prices).find(p => p.symbol === 'PLS')?.pairId ?? bestStableAddress
                const hexPairId = Object.values(prices).find(p => p.symbol === 'HEX')?.pairId

                const initialPairs = [
                    plsPairId,
                    bestStableAddress,
                    '0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9', // PLSX
                    '0xf808bb6265e9ca27002c0a04562bf50d4fe37eaa', // INC
                    hexPairId ?? '0xf1f4ee610b2babb05c635f726ef8b0c568c8dc65' // HEX
                ].filter((value, index, array) => value && array.indexOf(value) === index)
                
                fetchDailyCandles(bestStableAddress)
                getChartHistory(bestStableAddress, true, settings)

                try {
                    const results = await Promise.allSettled(
                        initialPairs.map(address => getHistory(address, false, settings))
                    )

                    const fulfilledResults = results
                        .filter(result => result.status === 'fulfilled' && result.value && result.value.address)

                    const parsedHistory = fulfilledResults.reduce((acc, result) => {
                        acc[result.value.address] = result.value.history
                        return acc
                    }, {})

                    const parsedReserves = fulfilledResults.reduce((acc, result) => {
                        acc[result.value.address] = result.value.reserves
                            return acc
                    }, {})

// setHistory(parsedHistory)
setChartKeyPoints(prev => ({ ...prev, ...parsedHistory }))
Object.keys(parsedHistory).forEach(address => {
    if (address !== bestStableAddress) {
        fetchDailyCandles(address)
    }
})
setReserves(prev => ({ ...prev, ...parsedReserves }))
                } catch (error) {
                    console.error('Error in getInitialData, attempting again')
                    try {
                        getHistory(bestStableAddress, true, settings).then(() => { //WPLS-DAI
                            getHistory('0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9', true, settings).then(() => { // WPLS-PLSX
                                getHistory('0xf808bb6265e9ca27002c0a04562bf50d4fe37eaa', true, settings).then(() => { // WPLS-Incentive
                                    getHistory(hexPairId ?? '0xf1f4ee610b2babb05c635f726ef8b0c568c8dc65', true, settings).then(() => { // WPLS-HEX
                                        setInit(true)
                                    })
                                })
                            })
                        })
                    } catch (error) {
                        console.error('Error in getInitialData')
                    }
                } finally {
                    initializing.current = false
                    batchFetchHistory()
                    setInit(true)
                }

                // already started above so the full stable history fetch overlaps startup

            }
            getInitialData()
        } else if (init && bestStable?.pair) {
    const bestStableAddress = bestStable.pair

    if (!history?.[bestStableAddress]?.length) {
        console.log('hydrating stable full history')
        getChartHistory(bestStableAddress, true, settings)
    }

    if (!chartKeyPoints?.[bestStableAddress]?.length) {
        console.log('hydrating stable short history')
        getHistory(bestStableAddress, true, settings)
    }

    if (!dailyCandles?.[bestStableAddress]?.length) {
        console.log('hydrating stable daily candles')
        fetchDailyCandles(bestStableAddress)
    }
}
    }, [priceData.bestStable, Object.keys(prices).length, priceData.bestStableUpdated, init])

    const batchFetchHistory = async () => {
        if (batchFetching) return
        setBatchFetching(true)

        try {
            const results = await Promise.allSettled([
                getHistory('0xae8429918fdbf9a5867e3243697637dc56aa76a1', false, settings),
                getHistory('0xe0e1f83a1c64cf65c1a86d7f3445fc4f58f7dcbf', false, settings),
                getHistory('0x42abdfdb63f3282033c766e72cc4810738571609', false, settings) 
])

            const fulfilledResults = results
                .filter(result => result.status === 'fulfilled' && result.value && result.value.address)

            const parsedHistory = fulfilledResults.reduce((acc, result) => {
                acc[result.value.address] = result.value.history
                return acc
}, {})

            const parsedReserves = fulfilledResults.reduce((acc, result) => {
                acc[result.value.address] = result.value.reserves
                return acc
}, {})

            // setHistory(prev => ({ ...prev, ...parsedHistory }))
            setChartKeyPoints(prev => ({ ...prev, ...parsedHistory }))
            setReserves(prev => ({ ...prev, ...parsedReserves }))
        } catch (error) {
            console.error('Error in getInitialData, attempting again')
            try {
                getHistory('0xae8429918fdbf9a5867e3243697637dc56aa76a1', true, settings).then(() => { 
                    getHistory('0xe0e1f83a1c64cf65c1a86d7f3445fc4f58f7dcbf', true, settings).then(() => { 
                        getHistory('0x42abdfdb63f3282033c766e72cc4810738571609', true, settings).then(() => { 
                            
                        })
                    })
                })
            } catch (error) {
                console.error('Error in getInitialData')
            }
        } finally {
            setBatchFetching(false)
        }
    }

    const getHistory = useCallback(async (lpAddress, saveToState = true, settings = defaultSettings) => {
        if (saveToState && (!lpAddress || isLoading.current || chartKeyPoints?.[lpAddress]?.length > 0)) return false

        try {
            isLoading.current = true
            isError.current = false

            let provider = new ethers.providers.JsonRpcProvider(settings.rpcs.mainnet[0])
            let currentBlock;
            try {
                currentBlock = await provider.getBlockNumber()
            } catch {
                provider = new ethers.providers.JsonRpcProvider('https://rpc.pulsechain.com')
                currentBlock = await provider.getBlockNumber()
            }
            
            if (!currentBlock) {
                return false
            }
            const startBlock = Math.max(
                currentBlock - BLOCKS_TO_FETCH,
                PULSECHAIN_FIRST_BLOCK
            )

            const start = new Date().getTime()
            setProgress({ ...progress, start, end: null, status: `fetching ${lpAddress}` })
            const tokenInfo = getTokenInfoForLp(lpAddress) ?? {}

            const { 
                events, 
                currentPrice, 
                currentPriceInverted,
                endingReserve0,
                endingReserve1
            } = await fetchLPHistoryKeyPoints(
                lpAddress,
                startBlock,
                currentBlock,
                CHUNK_SIZE,
                'mainnet',
                settings,
                tokenInfo,
                false
            )
            
            setProgress({ ...progress, start, end: new Date().getTime() })

            // Calculate current time and work backwards
            const currentTime = new Date().getTime()

            // Group prices by hourly blocks
            const priceHistory = {}
            events.forEach(event => {
                const hourlyBlock = Math.floor(event.blockNumber / BLOCKS_PER_HOUR) * BLOCKS_PER_HOUR
                const blockDiff = currentBlock - event.blockNumber
                const timestamp = currentTime - (blockDiff * SECONDS_PER_BLOCK * 1000)

                if (!priceHistory[hourlyBlock]) {
                    priceHistory[hourlyBlock] = {
                        lastPrice: event.price,
                        lastPriceInverted: event.priceInverted,
                        blockNumber: hourlyBlock,
                        timestamp: timestamp
                    }
                } else {
                    // Update only if this event is more recent in the hour
                    if (event.blockNumber > priceHistory[hourlyBlock].blockNumber) {
                        priceHistory[hourlyBlock] = {
                            lastPrice: event.price,
                            lastPriceInverted: event.priceInverted,
                            blockNumber: hourlyBlock,
                            timestamp: timestamp
                        }
                    }
                }
            })

            // Convert to array format with same structure as before
            const hourlyHistory = Object.entries(priceHistory).map(([blockNumber, data]) => ({
                blockNumber: Number(blockNumber),
                timestamp: data.timestamp,
                price: data.lastPrice,
                priceInverted: data.lastPriceInverted
            }))

            const sortedHistory = hourlyHistory.sort((a, b) => a.blockNumber - b.blockNumber)
            
            // Update the last entry with current price and time
            sortedHistory[sortedHistory.length - 1] = {
                ...sortedHistory[sortedHistory.length - 1],
                price: currentPrice,
                priceInverted: currentPriceInverted,
                timestamp: currentTime
            }

            if (!saveToState) {
                isLoading.current = false
                return {
                    address: lpAddress,
                    history: sortedHistory,
                    reserves: {
                        reserve0: endingReserve0,
                        reserve1: endingReserve1
                    }
                }
            }

            setChartKeyPoints(prev => ({
                ...prev,
                [lpAddress]: sortedHistory
            }))

            // Store reserves for this LP
            setReserves(prev => ({
                ...prev,
                [lpAddress]: {
                    reserve0: endingReserve0,
                    reserve1: endingReserve1
                }
            }))

            isLoading.current = false
            return true

        } catch (error) {
            console.error('Error in getHistory:', error)
            isError.current = true
            return false
        }
        
    }, [prices])
    const fetchDailyCandles = async (lpAddress) => {
    try {
        const url = `https://api.geckoterminal.com/api/v2/networks/pulsechain/pools/${lpAddress}/ohlcv/day?aggregate=1&limit=100`

        const res = await fetch(url)
        const json = await res.json()

        const candles = json?.data?.attributes?.ohlcv_list ?? []

        // Format: [timestamp, open, high, low, close, volume]
        const parsed = candles
        .map(c => ({
            timestamp: c[0] * 1000,
            open: c[1],
            high: c[2],
            low: c[3],
            close: c[4],
            volume: c[5]
    }))
    .sort((a, b) => a.timestamp - b.timestamp)

        setDailyCandles(prev => ({
            ...prev,
            [lpAddress]: parsed
        }))
    } catch (err) {
        console.error('Failed to fetch Gecko candles:', lpAddress, err)
    }
}

    const getChartHistory = useCallback(async (lpAddress, saveToState = true, settings = defaultSettings) => {
        const loadingChart = isLoadingChart.current.find(f => f === lpAddress?.toLowerCase()) ? true : false

        if (isFetchingFullHistory) return false
        if (saveToState && (!lpAddress || loadingChart || history[lpAddress])) return false
        if (loadingChart) {
            isLoadingChart.current.push(lpAddress?.toLowerCase())
        }
        setIsFetchingFullHistory(true)

        try {
            isLoading.current = true
            isError.current = false

            let provider = new ethers.providers.JsonRpcProvider(settings.rpcs.mainnet[0])
            let currentBlock;
            try {
                currentBlock = await provider.getBlockNumber()
            } catch {
                provider = new ethers.providers.JsonRpcProvider('https://rpc.pulsechain.com')
                currentBlock = await provider.getBlockNumber()
            }
            
            if (!currentBlock) {
                return false
            }
            const startBlock = Math.max(
                currentBlock - BLOCKS_TO_FETCH,
                PULSECHAIN_FIRST_BLOCK
            )

            const start = new Date().getTime()
            setProgress({ ...progress, start, end: null, status: `fetching ${lpAddress}` })

            const tokenInfo = getTokenInfoForLp(lpAddress) ?? {}
            const { 
                events, 
                currentPrice, 
                currentPriceInverted,
                endingReserve0,
                endingReserve1
            } = await fetchLPHistoryKeyPoints(
                lpAddress,
                startBlock,
                currentBlock,
                CHUNK_SIZE,
                'mainnet',
                settings,
                tokenInfo,
                true
            )
            
            setProgress({ ...progress, start, end: new Date().getTime() })

            // Calculate current time and work backwards
            const currentTime = new Date().getTime()

            // Group prices by hourly blocks
            const priceHistory = {}
            events.forEach(event => {
                const hourlyBlock = Math.floor(event.blockNumber / BLOCKS_PER_HOUR) * BLOCKS_PER_HOUR
                const blockDiff = currentBlock - event.blockNumber
                const timestamp = currentTime - (blockDiff * SECONDS_PER_BLOCK * 1000)

                if (!priceHistory[hourlyBlock]) {
                    priceHistory[hourlyBlock] = {
                        lastPrice: event.price,
                        lastPriceInverted: event.priceInverted,
                        blockNumber: hourlyBlock,
                        timestamp: timestamp
                    }
                } else {
                    // Update only if this event is more recent in the hour
                    if (event.blockNumber > priceHistory[hourlyBlock].blockNumber) {
                        priceHistory[hourlyBlock] = {
                            lastPrice: event.price,
                            lastPriceInverted: event.priceInverted,
                            blockNumber: hourlyBlock,
                            timestamp: timestamp
                        }
                    }
                }
            })

            // Convert to array format with same structure as before
            const hourlyHistory = Object.entries(priceHistory).map(([blockNumber, data]) => ({
                blockNumber: Number(blockNumber),
                timestamp: data.timestamp,
                price: data.lastPrice,
                priceInverted: data.lastPriceInverted
            }))

            const sortedHistory = hourlyHistory.sort((a, b) => a.blockNumber - b.blockNumber)
            
            // Update the last entry with current price and time
            sortedHistory[sortedHistory.length - 1] = {
                ...sortedHistory[sortedHistory.length - 1],
                price: currentPrice,
                priceInverted: currentPriceInverted,
                timestamp: currentTime
            }

            if (!saveToState) {
                isLoading.current = false
                return {
                    address: lpAddress,
                    history: sortedHistory,
                    reserves: {
                        reserve0: endingReserve0,
                        reserve1: endingReserve1
                    }
                }
            }

            setHistory(prev => ({
                ...prev,
                [lpAddress]: sortedHistory
            }))

            // Store reserves for this LP
            setReserves(prev => ({
                ...prev,
                [lpAddress]: {
                    reserve0: endingReserve0,
                    reserve1: endingReserve1
                }
            }))

            isLoading.current = false
            setIsFetchingFullHistory(false)

            return true

        } catch (error) {
            console.error('Error in getHistory:', error)
            isError.current = true
            setIsFetchingFullHistory(false)
            return false
        }
    }, [prices])

    const fetchMore = async(lpAddress, settings = defaultSettings) => {
        try {
            return await _fetchMore(lpAddress, settings?.rpcs?.mainnet?.[0] || "https://rpc.pulsechain.com")
        } catch {
            return await _fetchMore(lpAddress, "https://rpc.pulsechain.com")
        }
        
    }
    
    const _fetchMore = useCallback(async (lpAddress, providerURL) => {
        if (!lpAddress || isLoading.current || !reserves[lpAddress]) return
        
        try {
            isLoading.current = true
            isError.current = false

            let provider = new ethers.providers.JsonRpcProvider(providerURL)
            let currentBlock;
            try {
                currentBlock = await provider.getBlockNumber()
            } catch {
                provider = new ethers.providers.JsonRpcProvider('https://rpc.pulsechain.com')
                currentBlock = await provider.getBlockNumber()
            }

            if (!currentBlock) {
                return false
            }

            // If no history exists, just run getHistory
            if (!history[lpAddress]) {
                return getHistory(lpAddress, true, settings)
            }

            // Get the oldest block we have
            const oldestBlock = Math.min(...history[lpAddress].map(h => h.blockNumber))
            
            // Calculate new start block - one day's worth of blocks before oldest block
            //const blocksPerDay = 86400 / 10 // PulseChain blocks per day
            const startBlock = Math.max(
                oldestBlock - BLOCKS_TO_FETCH, // Get exactly one day's worth of blocks
                PULSECHAIN_FIRST_BLOCK
            )

            // Don't proceed if we've reached the chain start
            if (startBlock === PULSECHAIN_FIRST_BLOCK && oldestBlock <= PULSECHAIN_FIRST_BLOCK) {
                console.log('Reached the beginning of PulseChain history')
                return
            }

            // console.log('Fetching more history:', {
            //     startBlock,
            //     oldestBlock,
            //     blocksToFetch: oldestBlock - startBlock
            // })

            const start = new Date().getTime()
            setProgress({ ...progress, start, end: null })

            const tokenInfo = getTokenInfoForLp(lpAddress) ?? {}

            const { events, endingReserve0, endingReserve1 } = await fetchMoreLPHistory(
                lpAddress,
                startBlock,
                oldestBlock,
                reserves[lpAddress].reserve0,
                reserves[lpAddress].reserve1,
                CHUNK_SIZE,
                'mainnet',
                settings,
                tokenInfo
            )

            setProgress({ ...progress, start, end: new Date().getTime() })

            // Calculate timestamps and group by hour blocks
            const currentTime = new Date().getTime()
            const priceHistory = {}
            events.forEach(event => {
                const hourlyBlock = Math.floor(event.blockNumber / BLOCKS_PER_HOUR) * BLOCKS_PER_HOUR
                const blockDiff = currentBlock - event.blockNumber
                const timestamp = currentTime - (blockDiff * SECONDS_PER_BLOCK * 1000)

                if (!priceHistory[hourlyBlock]) {
                    priceHistory[hourlyBlock] = {
                        lastPrice: event.price,
                        lastPriceInverted: event.priceInverted,
                        blockNumber: hourlyBlock,
                        timestamp: timestamp
                    }
                } else if (event.blockNumber > priceHistory[hourlyBlock].blockNumber) {
                    priceHistory[hourlyBlock] = {
                        lastPrice: event.price,
                        lastPriceInverted: event.priceInverted,
                        blockNumber: hourlyBlock,
                        timestamp: timestamp
                    }
                }
            })

            const hourlyHistory = Object.entries(priceHistory).map(([blockNumber, data]) => ({
                blockNumber: Number(blockNumber),
                timestamp: data.timestamp,
                price: data.lastPrice,
                priceInverted: data.lastPriceInverted
            }))

            // Combine with existing history
            setHistory(prev => ({
                ...prev,
                [lpAddress]: [
                    ...hourlyHistory.sort((a, b) => a.blockNumber - b.blockNumber),
                    ...prev[lpAddress]
                ]
            }))

            // Update reserves with new ending values
            setReserves(prev => ({
                ...prev,
                [lpAddress]: {
                    reserve0: endingReserve0,
                    reserve1: endingReserve1
                }
            }))

        } catch (error) {
            console.error('Error in fetchMore:', error)
            isError.current = true
        } finally {
            isLoading.current = false
        }
    }, [history, reserves, prices])

    // Add new function to update latest history
    const updateLatestHistory = useCallback(async (lpAddress) => {
        if (!lpAddress || isLoading.current || !history[lpAddress]) return
        
        try {
            let provider = new ethers.providers.JsonRpcProvider(settings.rpcs.mainnet[0])
            let currentBlock;
            try {
                currentBlock = await provider.getBlockNumber()
            } catch {
                provider = new ethers.providers.JsonRpcProvider('https://rpc.pulsechain.com')
                currentBlock = await provider.getBlockNumber()
            }

            if (!currentBlock) {
                return false
            }

            const currentHourBlock = Math.floor(currentBlock / BLOCKS_PER_HOUR) * BLOCKS_PER_HOUR

            const tokenInfo = getTokenInfoForLp(lpAddress) ?? {}
            
            const { 
                currentPrice, 
                currentPriceInverted,
                endingReserve0,
                endingReserve1
            } = await fetchLatestLPHistory(
                lpAddress,
                currentHourBlock - BLOCKS_PER_HOUR,
                currentBlock,
                CHUNK_SIZE,
                'mainnet',
                settings,
                tokenInfo
            )

            const currentTime = new Date().getTime()

            // Update history with new data
            setHistory(prev => {
                const prevArray = Array.isArray(prev[lpAddress]) ? prev[lpAddress] : []
                const existingHistory = [...prevArray]
                const lastEntry = existingHistory[existingHistory.length - 1]
                const lastEntryHourBlock = Math.floor(lastEntry?.blockNumber ?? 0 / BLOCKS_PER_HOUR) * BLOCKS_PER_HOUR

                let result
                if (lastEntryHourBlock === currentHourBlock) {
                    // Update existing hour block
                    existingHistory[existingHistory.length - 1] = {
                        ...lastEntry,
                        price: currentPrice,
                        priceInverted: currentPriceInverted,
                        timestamp: currentTime
                    }
                    result = existingHistory
                } else {
                    // Add new hour block
                    result = [
                        ...existingHistory,
                        {
                            blockNumber: currentHourBlock,
                            timestamp: currentTime,
                            price: currentPrice,
                            priceInverted: currentPriceInverted
                        }
                    ]
                }

                return {
                    ...prev,
                    [lpAddress]: result
                }
            })

            // Update reserves
            setReserves(prev => ({
                ...prev,
                [lpAddress]: {
                    reserve0: endingReserve0,
                    reserve1: endingReserve1
                }
            }))

        } catch (error) {
            console.error('Error updating latest history:', error)
        }
    }, [history, prices])

    //useEffect(() => {
        // if (init && !interval.current) {
        //     interval.current = setInterval(() => {
               
        //         Object.keys(historyRef.current).forEach(lpAddress => {
        //             updateLatestHistory(lpAddress)
        //         })
        //     }, 60000)

        //     return () => {
        //         if (interval.current) {
        //             clearInterval(interval.current)
        //             interval.current = null
        //         }
        //     }
        // }
    //}, [init, updateLatestHistory]) // Remove history dependency

    return {
        history,
        chartKeyPoints,
        dailyCandles,
        getHistory,
        getChartHistory,
        fetchMore,
        isLoading: isFetchingFullHistory || isLoading.current, //isLoading.current,
        isError: isError.current,
        progress,
        resetHistory        
    }
} 