import { useState, useEffect, useRef } from "react"
import { useAtom } from "jotai"
import { appSettingsAtom } from "../store"
import { batchQueryLPs } from "../lib/web3"
import { liquidityPairs } from "../lib/tokens"

export default function useLPs({ context, priceData }) {
    const [settings] = useAtom(appSettingsAtom)
    const [lpBalances, setLpBalances] = useState({})
    const [combinedBalances, setCombinedBalances] = useState({})
    const [error, setError] = useState(null)
    const [wasUpdated, setWasUpdated] = useState(0)
    
    // Replace loading state with ref
    const isLoading = useRef(false)
    const processingBalances = useRef(false)

    const watchlist = context?.data?.lpWatchlist ?? {}
    const wallets = context?.data?.wallets ?? {}
    const contextInitialized = context?.initialized

    const readyForFirst = Object.keys(wallets).length > 0 && context.initialized && Object.keys(priceData.prices).length > 0
    const fetching = useRef(false)

    useEffect(() => {
        if(!readyForFirst) return

        processLPBalances(true)
    }, [readyForFirst])

    const walletsLength = useRef(Object.keys(wallets).length)
    const walletsLengthAtStart = useRef(Object.keys(wallets).length)

    useEffect(() => {
        if (walletsLength.current > 0 && Object.keys(wallets).length === 0) {
            setLpBalances({})
            setCombinedBalances({})
        } else {
            if (walletsLength.current !== Object.keys(wallets).length) {
                processLPBalances(true)
            } else {
                processLPBalances(false)
            }
        }
        walletsLength.current = Object.keys(wallets).length
    }, [Object.keys(wallets).length, Object.keys(watchlist).length])


    const processLPBalances = async (useQuery = true) => {
        const walletAddresses = Object.keys(wallets).filter(Boolean)
        const priceDataInitialized = priceData?.initialized
        if (walletAddresses.length === 0 || !priceDataInitialized) return
        if (processingBalances.current) return

        try {
            if (useQuery) {
                walletsLengthAtStart.current = Object.keys(wallets).length
                isLoading.current = true
                processingBalances.current = true
            }
            setError(null)

            const missingWallets = walletAddresses.filter(address => !lpBalances[address.toLowerCase()])
            
            if (missingWallets.length === 0) {
                useQuery = false
            }

            // Get LP pair addresses
            const lpAddresses = Object.keys(liquidityPairs)
                .filter(Boolean)

            const watchlistAddresses = Object.keys(watchlist)
                .filter(Boolean)

            const totalAddresses = [...lpAddresses, ...watchlistAddresses]
            
            if (totalAddresses.length === 0) return

            // Fetch all LP data in one call
            const lpData = await batchQueryLPs(totalAddresses, 'mainnet', {
                ...settings,
                wallets
            })

            const prices = priceData?.prices

            // Process balances for each wallet
            const formattedBalances = Object.entries(wallets).reduce((acc, [walletAddress, _]) => {
                const walletBalances = Object.entries(lpData).reduce((lpAcc, [lpAddress, lpInfo]) => {
                    // const pairInfo = liquidityPairs[lpAddress] ?? watchlist[lpAddress]
                    // if (!pairInfo) return lpAcc

                    const userBalance = BigInt(lpInfo.balances[walletAddress.toLowerCase()] ?? '0')
                    const totalSupply = BigInt(lpInfo.totalSupply)

                    if (totalSupply === BigInt(0)) return lpAcc

                    // Calculate user's share
                    const userShare = userBalance * BigInt(1e18) / totalSupply

                    // Calculate token amounts
                    const token0AmountRaw = BigInt(lpInfo.reserve0) * userShare / BigInt(1e18)
                    const token1AmountRaw = BigInt(lpInfo.reserve1) * userShare / BigInt(1e18)

                    // Process tokens same as before
                    const token0Address = lpInfo.token0.toLowerCase()
                    const token1Address = lpInfo.token1.toLowerCase()

                    // Process token0
                    const token0PriceInfo = prices?.[token0Address]
                    const token0Decimals = Number(token0PriceInfo?.decimals ?? 18)
                    const token0PriceUsd = Number(token0PriceInfo?.priceUsd ?? 0)
                    const token0AmountNormalized = Number(token0AmountRaw) / 10 ** token0Decimals
                    const token0AmountUsd = token0AmountNormalized * token0PriceUsd

                    // Process token1
                    const token1PriceInfo = prices?.[token1Address]
                    const token1Decimals = Number(token1PriceInfo?.decimals ?? 18)
                    const token1PriceUsd = Number(token1PriceInfo?.priceUsd ?? 0)
                    const token1AmountNormalized = Number(token1AmountRaw) / 10 ** token1Decimals
                    const token1AmountUsd = token1AmountNormalized * token1PriceUsd

                    lpAcc[lpAddress] = {
                        lpAddress,
                        lpTokenBalanceRaw: userBalance,
                        lpTokenBalance: parseFloat( userBalance / BigInt(10**16) ) / 10**2 ,
                        token0Address,
                        token1Address,
                        token0Amount: token0AmountRaw.toString(),
                        token1Amount: token1AmountRaw.toString(),
                        token0: {
                            raw: token0AmountRaw.toString(),
                            normalized: token0AmountNormalized,
                            usd: token0AmountUsd
                        },
                        token1: {
                            raw: token1AmountRaw.toString(),
                            normalized: token1AmountNormalized,
                            usd: token1AmountUsd
                        }
                    }
                    return lpAcc
                }, {})

                acc[walletAddress] = walletBalances
                return acc
            }, {})

            // Calculate combined balances
            const combined = Object.values(formattedBalances)
                .reduce((acc, walletBalances) => {
                    Object.entries(walletBalances).forEach(([lpAddress, lpData]) => {
                        if (!acc[lpAddress]) {
                            // Initialize with the first wallet's data
                            acc[lpAddress] = {
                                lpAddress,
                                lpTokenBalanceRaw: lpData.lpTokenBalanceRaw,
                                lpTokenBalance: lpData.lpTokenBalance,
                                token0Address: lpData.token0Address,
                                token1Address: lpData.token1Address,
                                token0Amount: lpData.token0Amount,
                                token1Amount: lpData.token1Amount,
                                token0: { ...lpData.token0 },
                                token1: { ...lpData.token1 }
                            }
                        } else {
                            // Add subsequent wallet balances
                            acc[lpAddress].lpTokenBalanceRaw = (BigInt(acc[lpAddress].lpTokenBalanceRaw) + BigInt(lpData.lpTokenBalanceRaw)).toString()
                            acc[lpAddress].lpTokenBalance = (parseFloat(BigInt(acc[lpAddress].lpTokenBalanceRaw) / BigInt(10**16)) / 10**2).toString()
                            acc[lpAddress].token0Amount = (BigInt(acc[lpAddress].token0Amount) + BigInt(lpData.token0Amount)).toString()
                            acc[lpAddress].token1Amount = (BigInt(acc[lpAddress].token1Amount) + BigInt(lpData.token1Amount)).toString()
                            acc[lpAddress].token0 = {
                                raw: (BigInt(acc[lpAddress].token0Amount)).toString(),
                                normalized: acc[lpAddress].token0.normalized + lpData.token0.normalized,
                                usd: acc[lpAddress].token0.usd + lpData.token0.usd
                            }
                            acc[lpAddress].token1 = {
                                raw: (BigInt(acc[lpAddress].token1Amount)).toString(),
                                normalized: acc[lpAddress].token1.normalized + lpData.token1.normalized,
                                usd: acc[lpAddress].token1.usd + lpData.token1.usd
                            }
                        }
                    })
                    return acc
                }, {})

            if (useQuery && walletsLengthAtStart.current !== Object.keys(wallets).length) {
                processingBalances.current = false
                return
            }

            setLpBalances(formattedBalances)
            setCombinedBalances(combined)
            setWasUpdated(prev => prev + 1)
        } catch (err) {
            console.error('Error processing LP balances:', err)
            setError(err)
        } finally {
            isLoading.current = false
            processingBalances.current = false
        }
    }

    const updatePrices = () => {
        if (Object.keys(lpBalances).length === 0) return

        try {
            const prices = priceData?.prices
            
            // Update individual wallet balances
            const updatedBalances = Object.entries(lpBalances).reduce((acc, [walletAddress, walletLPs]) => {
                acc[walletAddress] = Object.entries(walletLPs).reduce((lpAcc, [lpAddress, lpInfo]) => {
                    // Process token0
                    const token0PriceInfo = prices?.[lpInfo.token0Address]
                    const token0Decimals = Number(token0PriceInfo?.decimals ?? 18)
                    const token0PriceUsd = Number(token0PriceInfo?.priceUsd ?? 0)
                    const token0AmountNormalized = Number(lpInfo.token0Amount) / 10 ** token0Decimals
                    const token0AmountUsd = token0AmountNormalized * token0PriceUsd

                    // Process token1
                    const token1PriceInfo = prices?.[lpInfo.token1Address]
                    const token1Decimals = Number(token1PriceInfo?.decimals ?? 18)
                    const token1PriceUsd = Number(token1PriceInfo?.priceUsd ?? 0)
                    const token1AmountNormalized = Number(lpInfo.token1Amount) / 10 ** token1Decimals
                    const token1AmountUsd = token1AmountNormalized * token1PriceUsd

                    lpAcc[lpAddress] = {
                        ...lpInfo,
                        token0: {
                            raw: lpInfo.token0Amount,
                            normalized: token0AmountNormalized,
                            usd: token0AmountUsd
                        },
                        token1: {
                            raw: lpInfo.token1Amount,
                            normalized: token1AmountNormalized,
                            usd: token1AmountUsd
                        }
                    }
                    return lpAcc
                }, {})
                return acc
            }, {})

            // Update combined balances
            const updatedCombined = Object.entries(combinedBalances).reduce((acc, [lpAddress, lpInfo]) => {
                // Process token0
                const token0PriceInfo = prices?.[lpInfo.token0Address]
                const token0Decimals = Number(token0PriceInfo?.decimals ?? 18)
                const token0PriceUsd = Number(token0PriceInfo?.priceUsd ?? 0)
                const token0AmountNormalized = Number(lpInfo.token0Amount) / 10 ** token0Decimals
                const token0AmountUsd = token0AmountNormalized * token0PriceUsd

                // Process token1
                const token1PriceInfo = prices?.[lpInfo.token1Address]
                const token1Decimals = Number(token1PriceInfo?.decimals ?? 18)
                const token1PriceUsd = Number(token1PriceInfo?.priceUsd ?? 0)
                const token1AmountNormalized = Number(lpInfo.token1Amount) / 10 ** token1Decimals
                const token1AmountUsd = token1AmountNormalized * token1PriceUsd

                acc[lpAddress] = {
                    ...lpInfo,
                    token0: {
                        raw: lpInfo.token0Amount,
                        normalized: token0AmountNormalized,
                        usd: token0AmountUsd
                    },
                    token1: {
                        raw: lpInfo.token1Amount,
                        normalized: token1AmountNormalized,
                        usd: token1AmountUsd
                    }
                }
                return acc
            }, {})

            setLpBalances(updatedBalances)
            setCombinedBalances(updatedCombined)
            setWasUpdated(prev => prev + 1)
        } catch (err) {
            console.error('Error updating LP prices:', err)
            setError(err)
        }
    }

    // Add new useEffect for price updates
    useEffect(() => {
        if (
            Object.keys(lpBalances).length > 0 && 
            Object.keys(priceData?.prices ?? {}).length > 0 &&
            !isLoading.current
        ) {
            updatePrices()
        }
    }, [priceData.refresh])

    return { 
        lpBalances, 
        combinedBalances, 
        loading: isLoading.current, 
        error, 
        wasUpdated 
    }
}