import axios from "axios"
import { useEffect, useRef, useState } from "react"
import { getSearchQuery, GRAPHQL_PULSEX, GRAPHQL_PULSEX_V2 } from "../lib/graphiql"
import { appSettingsAtom } from "../store"
import { useAtom } from "jotai"
import { batchFetchTokenInfo, batchFindPulseXPairs, findAndValidatePulseXPair } from "../lib/web3"
import { defaultTokenInformation } from "../lib/tokens"
import { useSettings } from "./useSettings"

export default function useTokenSearch ({searchTerm, filter = true, wallets, watchlistAddresses, wplsPrice}) {
    const [ noResults, setNoResults ] = useState(false)
    const [ isError, setIsError ] = useState(false)
    const [ data, setData ] = useState([])
    const isLoading = useRef(false)
    const [isScanning, setIsScanning ]= useState(false)
    const { scan, settings } = useSettings({network: 'mainnet'})

    const scanForTokens = async () => {
        setIsScanning(true)
        const promises = wallets.map(m => axios.get(`${scan[0]}/v2/addresses/${m}/token-balances`).then(r => r).catch(e => undefined))
        let responses = []
        try {
            responses = await Promise.allSettled(promises)
        } catch (err) {
            console.error('Error in token search:', err)
        }
        responses = responses.filter(f => f?.value)
        
        const results = responses.filter(f => f.status === 'fulfilled').map(r => r.value.data).flat()
        const dupesRemoved = []
        results.forEach(fe => {
            if (defaultTokenInformation[fe.token.address.toLowerCase()]) return
            if (!dupesRemoved.some(s => s.token.address == fe.token.address)) {
                const totalValue = results.filter(f => f.token.address == fe.token.address).reduce((acc, curr) => acc + BigInt(curr.value), BigInt(0))
                dupesRemoved.push({...fe, value: totalValue.toString()})
            }
        })

        if (dupesRemoved.length > 0) {
            // Get clean addresses and filter out ones already in watchlist
            const cleanedAddresses = dupesRemoved
                .map(m => (m?.token?.address ?? '')?.toLowerCase())
                .filter(address => !watchlistAddresses.some(watchlistAddr => 
                    watchlistAddr.toLowerCase() === address.toLowerCase() || defaultTokenInformation[address.toLowerCase()]
                ))

            if (cleanedAddresses.length === 0) {
                setData([])
                setIsScanning(false)
                return
            }

            const lpData = await batchFindPulseXPairs(cleanedAddresses, 'mainnet', settings)
            
            const lpDataModified = lpData.map(m => {
                const tokenInfo = results.find(f => f?.token?.address?.toLowerCase() === m?.a?.toLowerCase())
                const isToken0 = m?.a?.toLowerCase() === m?.token0?.a?.toLowerCase()

                const wplsInfo = { ...defaultTokenInformation['0xa1077a294dde1b09bb078844df40758a5d0f9a27'], id: '0xa1077a294dde1b09bb078844df40758a5d0f9a27', derivedUSD: wplsPrice }
                
                // Get reserves and decimals
                const tokenReserves = isToken0 ? m.token0.reserves : m.token1.reserves
                const wplsReserves = isToken0 ? m.token1.reserves : m.token0.reserves
                const wplsNormalizedReserves = parseFloat(parseFloat(BigInt(isToken0 ? m.token1.reserves : m.token0.reserves ?? 0) / BigInt(10**14)) / 10**4 ).toFixed(4)
                const tokenDecimals = parseInt(tokenInfo?.token?.decimals ?? '18')
                const wplsDecimals = 18 // WPLS always has 18 decimals

                // Calculate price in WPLS
                let priceWpls = '0'
                try {
                    const adjustedTokenReserves = BigInt(tokenReserves) * BigInt(10 ** (18 - tokenDecimals))
                    const adjustedWplsReserves = BigInt(wplsReserves) * BigInt(10 ** (18 - wplsDecimals))
                    
                    if (adjustedTokenReserves > 0n) {
                        // Price = (WPLS_reserves * 10^18) / token_reserves
                        priceWpls = ((adjustedWplsReserves * BigInt(10 ** 18)) / adjustedTokenReserves).toString()
                    }
                } catch (err) {
                    console.error('Error calculating price:', err)
                }

                const normalizedPriceWpls = parseFloat(parseFloat( BigInt(priceWpls) / BigInt(10 ** 14) ) / 10**4).toFixed(4)
                const derivedUSD = normalizedPriceWpls * wplsPrice
                const reserveUSD = wplsNormalizedReserves * wplsPrice

                if (reserveUSD < 1_000) return undefined
                
                const value = tokenInfo?.value ? BigInt(tokenInfo.value) : BigInt(0);
                let balance = 0;
                if (value > BigInt(0)) {
                    try {
                        const scaledValue = Number(value / BigInt(10 ** (tokenDecimals - 2)));
                        const finalValue = scaledValue / 10 ** 2;
                        balance = (finalValue ?? 0).toFixed(2) * derivedUSD;
                    } catch (error) {
                        balance = 0;
                    }
                } else {
                    balance = 0;
                }

                const result = {
                    a: m?.a,
                    balance,
                    version: m?.version,
                    pairId: m?.pairId,
                    id: m?.pairId,
                    priceWpls: normalizedPriceWpls,
                    reserveUSD,
                    derivedUSD,
                    info: tokenInfo,
                    token0: isToken0 ? {
                        ...(m?.token0 ?? {}),
                        id: m?.token0?.a,
                        decimals: tokenDecimals,
                        total_supply: tokenInfo?.token?.total_supply,
                        name: tokenInfo?.token?.name,
                        symbol: tokenInfo?.token?.symbol,
                        derivedUSD
                    } : wplsInfo,
                    token1: isToken0 ? wplsInfo : {
                        ...(m?.token1 ?? {}),
                        id: m?.token1?.a,
                        decimals: tokenDecimals,
                        total_supply: tokenInfo?.token?.total_supply,
                        name: tokenInfo?.token?.name,
                        symbol: tokenInfo?.token?.symbol,
                        derivedUSD
                    }
                }

                return result
            }).filter(f => f !== undefined)
           
            setData(lpDataModified ?? [])
            
            setIsScanning(false)
            return
        } else {
            setData([])
            setIsScanning(false)
        }
    }

    useEffect(() => {
        const fetchResults = async () => {
            if (isLoading.current) return
            isLoading.current = true

            try {
                const query = getSearchQuery(searchTerm)
                
                // Query both APIs simultaneously
                const responses = await Promise.allSettled([
                    axios.post(GRAPHQL_PULSEX, { query }).then(res => ({ data: res.data, version: 'v1' })),
                    axios.post(GRAPHQL_PULSEX_V2, { query }).then(res => ({ data: res.data, version: 'v2' }))
                ])

                // Process results from both APIs
                const combinedPairs = responses.reduce((acc, response) => {
                    if (response.status === 'fulfilled' && !response.value?.data?.errors) {
                        const pairs = Array.isArray(response.value?.data?.data?.pairs) 
                            ? response.value?.data?.data?.pairs.map(pair => ({
                                ...pair,
                                version: response.value.version
                            }))
                            : []
                        return [...acc, ...pairs]
                    }
                    return acc
                }, [])

                if (combinedPairs.length > 0) {
                    let filteredPairs = combinedPairs

                    // Apply the filter if required
                    if (filter === true) {
                        filteredPairs = filteredPairs.filter((m) => {
                            const isToken0Wpls = m?.token0?.id === '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
                            const wplsLiquidity = isToken0Wpls ? Number(m?.reserve0 ?? 0) : Number(m?.reserve1 ?? 0)
                            return wplsLiquidity >= 10_000_000
                        })
                    }

                    if (filteredPairs.length === 0) {
                        setNoResults(true)
                    }
                    setData(filteredPairs)
                } else {
                    setNoResults(true)
                }
                
            } catch (err) {
                console.error('Error in token search:', err)
                setIsError(true)
            } finally {
                isLoading.current = false
            }
        }
    
        if (searchTerm && !isLoading.current) {
            setNoResults(false)
            if (isError) setIsError(false)
            if (data.length > 0) setData([])
            fetchResults()
        } else {
            if (data.length > 0) setData([])
            if (noResults) setNoResults(false)
            if (isLoading.current) isLoading.current = false
            if (isError) setIsError(false)
        }
    }, [searchTerm, filter])

    return { isLoading: isLoading.current || isScanning, isError, data, noResults, scanForTokens }
}