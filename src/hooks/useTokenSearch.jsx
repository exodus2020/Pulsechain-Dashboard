//useTokenSearch.jsx
import axios from "axios"
import { useEffect, useRef, useState } from "react"
import { getSearchQuery, GRAPHQL_PULSEX, GRAPHQL_PULSEX_V2 } from "../lib/graphiql"
import { appSettingsAtom } from "../store"
import { useAtom } from "jotai"
import { batchFetchTokenInfo, batchFindPulseXPairs, findAndValidatePulseXPair } from "../lib/web3"
import {
    defaultTokenInformation,
    liquidityPairs
} from "../lib/tokens"
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
            const tokenAddress = fe?.token?.address?.toLowerCase()
            if (!tokenAddress) return

            if (!dupesRemoved.some(s =>
                s?.token?.address?.toLowerCase() === tokenAddress
            )) {
                const totalValue = results
                    .filter(f =>
                        f?.token?.address?.toLowerCase() === tokenAddress
                    )
                    .reduce(
                        (acc, curr) => acc + BigInt(curr?.value ?? 0),
                        0n
                    )

                dupesRemoved.push({
                    ...fe,
                    value: totalValue.toString()
                })
            }
        })

        {
            // Get clean addresses and filter out ones already in watchlist
            // Get clean addresses and filter out ones already in watchlist
            const cleanedAddresses = dupesRemoved
                .map(m => (m?.token?.address ?? '').toLowerCase())
                .filter(Boolean)
                .filter(address =>
                    !(watchlistAddresses ?? []).some(
                        watchlistAddr => watchlistAddr.toLowerCase() === address
                    )
                )

            const selectableDefaultAddresses = [
                '0xefd766ccb38eaf1dfd701853bfce31359239f305', // DAI
                '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07', // USDC
                '0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f', // USDT
                '0x02dcdd04e3f455d838cd1249292c58f3b79e3c3c', // WETH
                '0xb17d901469b9208b17d916112988a3fed19b5ca1'  // WBTC
            ]

            const availableDefaultAddresses =
                selectableDefaultAddresses.filter(address =>
                    !(watchlistAddresses ?? []).some(
                        watchlistAddress =>
                            watchlistAddress.toLowerCase() === address
                    )
                )

            if (
                cleanedAddresses.length === 0 &&
                availableDefaultAddresses.length === 0
            ) {
                setData([])
                setIsScanning(false)
                return
            }

            const lpData = cleanedAddresses.length > 0
                ? await batchFindPulseXPairs(
                    cleanedAddresses,
                    'mainnet',
                    settings
                )
                : []

            const selectableDefaultPairs = Object.values(liquidityPairs)
                .filter(pair => {
                    const tokenAddress = pair?.a?.toLowerCase()

                    return availableDefaultAddresses.includes(tokenAddress)
                })
                .map(pair => ({
                    ...pair,
                    pairId: pair.id,
                    version: 'default',
                    isSelectableDefault: true,
                    token0: {
                        ...pair.token0,
                        a: pair.token0?.id,
                        reserves: pair.reserve0 ?? '0'
                    },
                    token1: {
                        ...pair.token1,
                        a: pair.token1?.id,
                        reserves: pair.reserve1 ?? '0'
                    }
                }))

            const combinedLpData = [
                ...(lpData ?? []).filter(pair =>
                    !availableDefaultAddresses.includes(
                        pair?.a?.toLowerCase()
                    )
                ),
                ...selectableDefaultPairs
            ]
            
            const lpDataModified = combinedLpData.map(m => {
                const tokenAddress = m?.a?.toLowerCase()

                const tokenInfo = results.find(
                    item =>
                        item?.token?.address?.toLowerCase() === tokenAddress
                )

                const defaultInfo =
                    defaultTokenInformation[tokenAddress] ?? {}

                const isToken0 =
                    tokenAddress === m?.token0?.a?.toLowerCase()

                const wplsInfo = {
                    ...defaultTokenInformation[
                        '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
                    ],
                    id: '0xa1077a294dde1b09bb078844df40758a5d0f9a27',
                    derivedUSD: wplsPrice
                }
                
                // Get reserves and decimals
                const tokenReserves = isToken0 ? m.token0.reserves : m.token1.reserves
                const wplsReserves = isToken0 ? m.token1.reserves : m.token0.reserves
                const wplsNormalizedReserves = parseFloat(parseFloat(BigInt(isToken0 ? m.token1.reserves : m.token0.reserves ?? 0) / BigInt(10**14)) / 10**4 ).toFixed(4)
                const tokenDecimals = parseInt(
                    tokenInfo?.token?.decimals ??
                    defaultInfo?.decimals ??
                    '18'
                )
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

                if (!m?.isSelectableDefault && reserveUSD < 1_000) {
                    return undefined
                }
                
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

                const tokenName =
                    tokenInfo?.token?.name ??
                    defaultInfo?.name ??
                    'Unknown Token'

                const tokenSymbol =
                    tokenInfo?.token?.symbol ??
                    defaultInfo?.symbol ??
                    '???'

                const tokenResultInfo = tokenInfo ?? {
                    token: {
                        address: tokenAddress,
                        name: tokenName,
                        symbol: tokenSymbol,
                        decimals: String(tokenDecimals)
                    },
                    value: '0'
                }

                const tokenSide = {
                    ...(isToken0 ? m?.token0 : m?.token1),
                    id: tokenAddress,
                    a: tokenAddress,
                    decimals: tokenDecimals,
                    total_supply: tokenInfo?.token?.total_supply,
                    name: tokenName,
                    symbol: tokenSymbol,
                    derivedUSD
                }

                const result = {
                    a: tokenAddress,
                    balance,
                    version: m?.version,
                    pairId: m?.pairId,
                    id: m?.pairId,
                    priceWpls: normalizedPriceWpls,
                    reserveUSD,
                    derivedUSD,
                    info: tokenResultInfo,
                    isSelectableDefault: m?.isSelectableDefault === true,
                    token0: isToken0
                        ? tokenSide
                        : wplsInfo,
                    token1: isToken0
                        ? wplsInfo
                        : tokenSide
                }

                return result
            }).filter(f => f !== undefined)
           
            // A token can have more than one PulseX pair (for example a WPLS
            // pair plus another routing/liquidity pair). The watchlist represents
            // tokens, not pools, so collapse search results to one row per token
            // contract. Prefer the deepest WPLS pair when more than one exists.
            const uniqueTokenResults = Array.from(
                (lpDataModified ?? []).reduce((byToken, item) => {
                    const tokenAddress = String(item?.a ?? '').toLowerCase()
                    if (!tokenAddress) return byToken

                    const current = byToken.get(tokenAddress)
                    if (!current || Number(item?.reserveUSD ?? 0) > Number(current?.reserveUSD ?? 0)) {
                        byToken.set(tokenAddress, item)
                    }
                    return byToken
                }, new Map()).values()
            )

            setData(uniqueTokenResults)

            setIsScanning(false)
            return
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

    return {
        isLoading: isLoading.current || isScanning,
        isError,
        data,
        noResults,
        scanForTokens
    }
    }