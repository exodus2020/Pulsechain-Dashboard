import { useState, useEffect, useRef } from "react"
import { useAtom } from "jotai"
import { appSettingsAtom } from "../store"
import { batchQueryReserves } from "../lib/web3"
import { convertInvertedPricePairToPrice, convertPricePairToPrice, liquidityPairs } from "../lib/tokens"

export default function usePrice(context) {
    const [prices, setPrices] = useState({})
    const [settings] = useAtom(appSettingsAtom)
    const [pricePairs, setPricePairs] = useState({})
    const [priceLastUpdated, setPriceLastUpdated] = useState(new Date())
    const [refresh, setRefresh] = useState(0)
    const [internalUpdate, setInternalUpdate] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const bestStableRef = useRef({ pair: null, symbol: null, price: 0, invert: false })
    const [stableUpdated, setStableUpdated] = useState(0)

    const watchlist = context?.data?.watchlist ?? {}
    const contextInitialized = context?.initialized 

    const fetchReserves = async () => {
        if(!contextInitialized) return
        setIsLoading(true)

        try { 
            const addresses = Object.keys(liquidityPairs)
                .filter(Boolean)

            const watchlistAddresses = Object.keys(watchlist)
                .filter(Boolean) 

            const totalAddresses = [...addresses, ...watchlistAddresses]
            if (totalAddresses.length === 0) return

            const reserves = await batchQueryReserves(totalAddresses, 'mainnet', settings)

            setPricePairs((prevPricePairs) => ({
                ...prevPricePairs,
                ...reserves
            }));
            setInternalUpdate(prev => prev + 1)
            setIsLoading(false)
        } catch (error) {
            console.error('Error fetching price reserves:', error)
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchReserves()
        const interval = setInterval(fetchReserves, 30_000)// Poll every 30 seconds

        return () => clearInterval(interval)
    }, [settings, context.update, contextInitialized])

    useEffect(() => {
        if (pricePairs?.['0xe56043671df55de5cdf8459710433c10324de0ae']) {
            // DAI = 0xe56043671df55de5cdf8459710433c10324de0ae
            // USDC = 0x6753560538eca67617a9ce605178f788be7e524e
            // USDT = 0x322df7921f28f1146cdf62afdac0d6bc0ab80711
            const newPrices = {}
            const timestamp = pricePairs?.['0xe56043671df55de5cdf8459710433c10324de0ae'].timestamp
            const datetime = new Date(timestamp * 1000);
            const wplsAddress = '0xa1077a294dde1b09bb078844df40758a5d0f9a27'

            const wplsdai = pricePairs['0xe56043671df55de5cdf8459710433c10324de0ae']
            const wplsusdc = pricePairs['0x6753560538eca67617a9ce605178f788be7e524e']
            const wplsusdt = pricePairs['0x322df7921f28f1146cdf62afdac0d6bc0ab80711']

            // DAI/WPLS: reserve0 is DAI (18 decimals), reserve1 is WPLS (18 decimals)
            const wplsPriceInDAI = convertPricePairToPrice(wplsdai, 18, 18)

            // USDC/WPLS: reserve0 is USDC (6 decimals), reserve1 is WPLS (18 decimals)
            const wplsPriceInUSDC = (Number(wplsusdc.reserve0) / Math.pow(10, 6)) / 
                                    ((Number(wplsusdc.reserve1) / Math.pow(10, 18)) ?? 1)

            // USDT/WPLS: reserve0 is USDT (6 decimals), reserve1 is WPLS (18 decimals)
            const wplsPriceInUSDT = (Number(wplsusdt.reserve0) / Math.pow(10, 6)) / 
                                    ((Number(wplsusdt.reserve1) / Math.pow(10, 18)) ?? 1)

            const stables = [{
                name: 'Dai Stablecoin',
                symbol: 'DAI',
                pair: '0xe56043671df55de5cdf8459710433c10324de0ae',
                price: wplsPriceInDAI,
                invert: false,
                decimals: 18
            },
            {
                name: 'USD Coin',
                symbol: 'USDC',
                pair: '0x6753560538eca67617a9ce605178f788be7e524e',
                price: wplsPriceInUSDC,
                invert: true,
                decimals: 6
            },
            {
                name: 'Tether USD',
                symbol: 'USDT',
                pair: '0x322df7921f28f1146cdf62afdac0d6bc0ab80711',
                price: wplsPriceInUSDT,
                invert: true,
                decimals: 6
            }]

            const bestStable = stables.reduce((best, stable) => {
                if (isNaN(Number(stable.price))) return best

                const price = Number(stable.price)
                return price > best.price ? stable : best
            }, { pair: null, symbol: null, price: 0, invert: false })

            const priceDifferencePercentage = 
                !bestStableRef?.current?.pair ? 0 // Zero if no current pair exists
                : (Number(bestStable.price) - Number(bestStableRef?.current?.price)) / Number(bestStable.price)
            
            const switchBestStable = priceDifferencePercentage > 0.02

            if (!bestStableRef?.current?.pair || switchBestStable) {
                bestStableRef.current = bestStable
                if (switchBestStable) setStableUpdated(prev => prev + 1)
            }

            const pricePairsKeys = Object.keys(pricePairs)
            for (let i = 0; i < pricePairsKeys.length; i++) {
                const key = pricePairsKeys[i]
                const pair = pricePairs[key]
                const pairInfo = liquidityPairs?.[key] ?? watchlist?.[key] ?? undefined
                if (!pairInfo) continue 

                const isBestStable = key === bestStable.pair
                const bestPrice = bestStable.price

                // Determine if WPLS is token0 or token1
                const invertReserves = pairInfo.token0.id === wplsAddress
                const token0 = invertReserves ? pairInfo.token1 : pairInfo.token0
                const token1 = invertReserves ? pairInfo.token0 : pairInfo.token1
                
                const actualReserve0 = invertReserves ? pair.reserve1 : pair.reserve0
                const actualReserve1 = invertReserves ? pair.reserve0 : pair.reserve1

                // Calculate price using raw reserves
                const price = 
                    (Number(actualReserve1) / Math.pow(10, Number(token1.decimals))) / 
                    (Number(actualReserve0) / Math.pow(10, Number(token0.decimals)));
                const priceUsd = isBestStable 
                    ? bestPrice.toFixed(12) 
                    : (price * bestPrice).toFixed(12)

                if (isBestStable) {
                    const plsResult = {
                        a: wplsAddress,
                        pairId: key.toLowerCase(),
                        name: 'Wrapped Pulse',
                        invertReserves,
                        symbol: "WPLS",
                        decimals: token1.decimals,
                        reserve0: actualReserve1,
                        reserve1: actualReserve0,
                        pair: `${token0.symbol}/${token1.symbol}`,
                        priceUsd: bestPrice.toFixed(8),
                        priceWpls: (1 / bestPrice).toFixed(8),
                        token0,
                        token1
                    }
                    newPrices[wplsAddress] = plsResult
                }

                const result = {
                    a: token0.id,
                    pairId: key.toLowerCase(),
                    name: token0.name,
                    invertReserves,
                    symbol: token0.symbol,
                    decimals: token0.decimals,
                    reserve0: actualReserve0,
                    reserve1: actualReserve1,
                    pair: `${token0.symbol}/${token1.symbol}`,
                    priceUsd: isBestStable ? (bestPrice / priceUsd).toFixed(8) : priceUsd,
                    priceWpls: price.toFixed(8),
                    token0,
                    token1,
                }
                newPrices[token0.id] = result
            }
            setRefresh(prev => prev + 1)
            setPrices(newPrices)
            setPriceLastUpdated(datetime)
        }
    }, [internalUpdate])

    return { prices, pricePairs, priceLastUpdated, refresh, isLoading, initialized: internalUpdate > 0, bestStable: bestStableRef.current, bestStableUpdated: stableUpdated }
}