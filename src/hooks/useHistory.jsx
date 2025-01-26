import { useState, useRef, useCallback, useEffect } from 'react'
import { fetchLPHistory, fetchMoreLPHistory, fetchLatestLPHistory } from '../lib/web3'
import { PULSECHAIN_FIRST_BLOCK } from '../lib/web3'
import { ethers } from 'ethers'
import { defaultSettings } from '../config/settings'

export default function useHistory({ priceData }) {
    const [history, setHistory] = useState({})
    const [reserves, setReserves] = useState({})
    const isLoading = useRef(false)
    const isError = useRef(false)
    const [progress, setProgress] = useState({
        processed: 0,
        total: 0,
        status: 'idle',
        start: null,
        end: null,
        init: false
    })

    const { prices } = priceData
    const bestStable = priceData?.bestStable
    const isReady = Object.keys(prices).length > 0 && bestStable?.pair

    const DAYS = 7// 7 days is about 3mb data + 42s load time
    const CHUNK_SIZE = 100000
    const BLOCKS_TO_FETCH = 86400 / 10 * DAYS // One day worth of blocks
    const BLOCKS_PER_HOUR = 360 // 10 seconds per block * 360 = 1 hour
    const SECONDS_PER_BLOCK = 10

    const [ init, setInit ] = useState(false)
    const initializing = useRef(false)
    const interval = useRef(null)
    const historyRef = useRef(history) // Add ref to track latest history

    const resetHistory = () => {
        setHistory({})
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
                const bestStableInverse = bestStable?.invert ? true : false

                try {
                    const results = await Promise.allSettled([
                        getHistory(bestStableAddress, false), // DAI, USDC, USDT
                        getHistory('0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9', false), // PLSX
                        getHistory('0xf808bb6265e9ca27002c0a04562bf50d4fe37eaa', false), // INC
                        getHistory('0xf1f4ee610b2babb05c635f726ef8b0c568c8dc65', false) // HEX
                    ])

                    const parsedHistory = results.reduce((acc, i) => {
                        acc = { ...acc, [i.value.address]: i.value.history }
                        return acc
                    }, {})
                    const parsedReserves = results.reduce((acc, i) => {
                        acc = { ...acc, [i.value.address]: i.value.history }
                        return acc
                    }, {})
                    setHistory(parsedHistory)
                    setReserves(parsedReserves)
                } catch (error) {
                    console.error('Error in getInitialData, attempting again')
                    try {
                        getHistory(bestStableAddress, true).then(() => { //WPLS-DAI
                            getHistory('0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9').then(() => { // WPLS-PLSX
                                getHistory('0xf808bb6265e9ca27002c0a04562bf50d4fe37eaa').then(() => { // WPLS-Incentive
                                    getHistory('0xf1f4ee610b2babb05c635f726ef8b0c568c8dc65').then(() => { // WPLS-HEX
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
                    setInit(true)
                }
            }
            getInitialData()
        } else if (init && priceData.bestStableUpdated > 0) {
            const bestStableAddress = bestStable?.pair ?? '0xe56043671df55de5cdf8459710433c10324de0ae'

            if (!history?.[bestStableAddress]) {
                console.log('stable switched')
                getHistory(bestStableAddress, true)
            }
        }
    }, [priceData.bestStable, Object.keys(prices).length, priceData.bestStableUpdated, init])

    const getHistory = useCallback(async (lpAddress, saveToState = true) => {
        if (saveToState && (!lpAddress || isLoading.current || history[lpAddress])) return false

        try {
            isLoading.current = true
            isError.current = false

            const provider = new ethers.providers.JsonRpcProvider(defaultSettings.rpcs.mainnet[0])
            const currentBlock = await provider.getBlockNumber()
            const startBlock = Math.max(
                currentBlock - BLOCKS_TO_FETCH,
                PULSECHAIN_FIRST_BLOCK
            )

            const start = new Date().getTime()
            setProgress({ ...progress, start, end: null, status: `fetching ${lpAddress}` })

            const tokenAddress = Object.keys(prices).find(f => prices[f].pairId === lpAddress)
            const tokenInfo = prices[tokenAddress]

            const { 
                events, 
                currentPrice, 
                currentPriceInverted,
                endingReserve0,
                endingReserve1
            } = await fetchLPHistory(
                lpAddress,
                startBlock,
                currentBlock,
                CHUNK_SIZE,
                'mainnet',
                defaultSettings,
                tokenInfo
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
            return true

        } catch (error) {
            console.error('Error in getHistory:', error)
            isError.current = true
            return false
        }
    }, [prices])

    const fetchMore = useCallback(async (lpAddress) => {
        if (!lpAddress || isLoading.current || !reserves[lpAddress]) return
        
        try {
            isLoading.current = true
            isError.current = false

            const provider = new ethers.providers.JsonRpcProvider(defaultSettings.rpcs.mainnet[0])
            const currentBlock = await provider.getBlockNumber()

            // If no history exists, just run getHistory
            if (!history[lpAddress]) {
                return getHistory(lpAddress)
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

            const tokenAddress = Object.keys(prices).find(f => prices[f].pairId === lpAddress)
            const tokenInfo = prices[tokenAddress]

            const { events, endingReserve0, endingReserve1 } = await fetchMoreLPHistory(
                lpAddress,
                startBlock,
                oldestBlock,
                reserves[lpAddress].reserve0,
                reserves[lpAddress].reserve1,
                CHUNK_SIZE,
                'mainnet',
                defaultSettings,
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
            const provider = new ethers.providers.JsonRpcProvider(defaultSettings.rpcs.mainnet[0])
            const currentBlock = await provider.getBlockNumber()
            const currentHourBlock = Math.floor(currentBlock / BLOCKS_PER_HOUR) * BLOCKS_PER_HOUR

            const tokenAddress = Object.keys(prices).find(f => prices[f].pairId === lpAddress)
            const tokenInfo = prices[tokenAddress]
            
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
                defaultSettings,
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

    useEffect(() => {
        if (init && !interval.current) {
            interval.current = setInterval(() => {
               
                Object.keys(historyRef.current).forEach(lpAddress => {
                    updateLatestHistory(lpAddress)
                })
            }, 60000)

            return () => {
                if (interval.current) {
                    clearInterval(interval.current)
                    interval.current = null
                }
            }
        }
    }, [init, updateLatestHistory]) // Remove history dependency

    return {
        history,
        getHistory,
        fetchMore,
        isLoading: isLoading.current,
        isError: isError.current,
        progress,
        resetHistory
    }
} 