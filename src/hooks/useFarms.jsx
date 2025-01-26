import { useState, useEffect, useRef } from 'react'
import { useAtom } from 'jotai'
import { appSettingsAtom } from '../store'
import { fetchPoolInfo, fetchFarmBalances, fetchPendingRewards } from '../lib/farms'

export default function useFarms({context, priceData}) {
    const [settings] = useAtom(appSettingsAtom)
    const [pools, setPools] = useState([])
    const [farmBalances, setFarmBalances] = useState({})
    const [combinedBalances, setCombinedBalances] = useState({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const wallets = context?.data?.wallets ?? {}

    const readyForFirst = Object.keys(wallets).length > 0 && pools.length > 0 && context.initialized && Object.keys(priceData.prices).length > 0

    const fetching = useRef(false)

    useEffect(() => {
        if(fetching.current || pools.length > 0) return
        fetching.current = true
        
        const fetchPools = async () => {
            try {
                setError(null)
                const poolsData = await fetchPoolInfo(settings)
                setPools(poolsData)
            } catch (err) {
                console.error('Error fetching pools:', err)
                setError(err)
            } finally {
                setLoading(false)
                fetching.current = false
            }
        }

        fetchPools()
    }, [])

    useEffect(() => {
        if(!readyForFirst) return
        fetchBalances(true)
    }, [readyForFirst])

    const walletsLength = useRef(Object.keys(wallets).length)
    const walletsLengthAtStart = useRef(Object.keys(wallets).length)
    useEffect(() => {
        if ((walletsLength.current > 0 && Object.keys(wallets).length === 0) || Object.keys(wallets).length === 0) {
            setFarmBalances({})
            setCombinedBalances({})
        } else {
            fetching.current = false
            fetchBalances(true)
        }
        walletsLength.current = Object.keys(wallets).length
    }, [Object.keys(wallets).length, priceData.refresh])

    const fetchBalances = async (useQuery = true) => {
        if(fetching.current) return

        const walletAddresses = Object.keys(wallets).filter(Boolean)
        if (walletAddresses.length === 0 || pools.length === 0) {
            return
        }
        
        try {
            if(useQuery) {
                walletsLengthAtStart.current = Object.keys(wallets).length
                fetching.current = true
                setLoading(true)
            }
            setError(null)

            const missingWallets = walletAddresses.filter(address => !farmBalances[address.toLowerCase()])

            if (missingWallets.length === 0) {
                useQuery = false
            }

            const balances = useQuery && missingWallets.length > 0 ? await fetchFarmBalances(missingWallets, pools.length, settings) : {} //farmBalances
            const currentFarmBalances = {...balances, ...farmBalances}

            const prices = priceData?.prices

            if (Object.keys(currentFarmBalances).length  === 0) return

            const formattedBalances = Object.keys(currentFarmBalances).reduce((acc, balanceAddress) => {
                const balance = balances?.[balanceAddress]
                
                const arrayToUse = balance?.farms ?? farmBalances?.[balanceAddress] ?? []

                const walletBalances = arrayToUse.map((farm, poolIndex) => {
                    const poolInfo = pools[poolIndex]
                    const stakedTokensBigInt = BigInt(farm.stakedTokensRaw)
                    const totalSupplyBigInt = BigInt(poolInfo.reserves.totalSupply) / BigInt(10**18)
                    
                    // Calculate user's share of the pool
                    const userShare = totalSupplyBigInt !== BigInt(0)
                        ? BigInt(stakedTokensBigInt * BigInt(1e18)) / BigInt(totalSupplyBigInt)
                        : BigInt(0)
                        
                    // Calculate token amounts 
                    const token0AmountRaw = BigInt(poolInfo?.reserves?.reserve0 ?? 0) * userShare / BigInt(1e18)
                    const token1AmountRaw = BigInt(poolInfo?.reserves?.reserve1 ?? 0) * userShare / BigInt(1e18)

                    const lpAddress = poolInfo?.lpAddress ?? ''
                    const token0Address = poolInfo?.token0 ?? ''
                    const token1Address = poolInfo?.token1 ?? ''
                    
                    const token0priceInfo = prices?.[token0Address.toLowerCase()]
                    const token0decimals = Number(token0priceInfo?.decimals ?? 18)
                    const token0priceUsd = Number(token0priceInfo?.priceUsd ?? 0)
                    const token0AmountNormalized = !token0priceInfo ? '0' : parseFloat( token0AmountRaw / BigInt(10**18) / BigInt(10**(token0decimals)))
                    const token0AmountUsd = !token0priceInfo ? '0' : parseFloat(token0AmountNormalized) * token0priceUsd

                    const token1priceInfo = prices?.[token1Address.toLowerCase()]
                    const token1decimals = Number(token1priceInfo?.decimals ?? 18)
                    const token1priceUsd = Number(token1priceInfo?.priceUsd ?? 0)
                    const token1AmountNormalized = !token1priceInfo ? '0' : parseFloat( token1AmountRaw / BigInt(10**18) / BigInt(10**(token1decimals)))
                    const token1AmountUsd = !token1priceInfo ? '0' : parseFloat(token1AmountNormalized) * token1priceUsd

                    const pendingInc = (parseFloat(BigInt(farm.pendingInc ?? 0) / BigInt(10**16)) / 10**2).toString()
                    const incPriceInfo = prices?.['0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d']
                    const incPriceUsd = Number(incPriceInfo?.priceUsd ?? 0)
                     
                    
                    return { 
                        ...farm,
                        pendingInc: farm.pendingInc, 
                        stakedTokensRaw: farm.stakedTokensRaw,
                        stakedTokens: (parseFloat(BigInt(farm.stakedTokensRaw ?? 0) / BigInt(10**16)) / 10**2).toString(),
                        lpAddress: lpAddress.toLowerCase(),
                        token0Address: token0Address.toLowerCase(),
                        token1Address: token1Address.toLowerCase(),
                        token0Amount: token0AmountRaw.toString(),
                        token1Amount: token1AmountRaw.toString(),
                        userShare: userShare.toString(),
                        token0: {
                            raw: token0AmountRaw,
                            normalized: token0AmountNormalized,
                            usd: token0AmountUsd
                        },
                        token1: {
                            raw: token1AmountRaw,
                            normalized: token1AmountNormalized,
                            usd: token1AmountUsd
                        },
                        rewards: {
                            raw: farm.pendingInc,
                            normalized: pendingInc,
                            usd: pendingInc * incPriceUsd
                        }
                    }
                })

                acc[balance?.address ?? balanceAddress] = walletBalances
                return acc
            }, {})

            const filterBalanceTemp = {...farmBalances, ...formattedBalances}
            const filteredBalances = Object.keys(filterBalanceTemp).reduce((acc, address) => {
                if (wallets[address.toLowerCase()]) {
                    acc[address] = filterBalanceTemp[address];
                }
                return acc;
            }, {});

            const combinedBalances = Object.values(filteredBalances)
                .flat()
                .reduce((acc, farm) => {
                    const lpAddress = farm.lpAddress
                    
                    if (!acc[lpAddress]) {
                        acc[lpAddress] = {
                            lpAddress,
                            token0Address: farm.token0Address,
                            token1Address: farm.token1Address,
                            pendingInc: "0",
                            stakedTokens: "0",
                            rewardDebt: "0",
                            userShare: "0",
                            token0Amount: "0",
                            token1Amount: "0",
                            token0: {
                                raw: "0",
                                normalized: "0",
                                usd: "0"
                            },
                            token1: {
                                raw: "0",
                                normalized: "0",
                                usd: "0"
                            },
                            rewards: {
                                raw: "0",
                                normalized: "0",
                                usd: "0"
                            }
                        }
                    }

                    acc[lpAddress].pendingInc = (parseFloat(acc[lpAddress].pendingInc) + parseFloat(farm.pendingInc)).toString()
                    acc[lpAddress].stakedTokens = (parseFloat(acc[lpAddress].stakedTokens) + parseFloat(farm.stakedTokens)).toString()
                    acc[lpAddress].rewardDebt = (BigInt(acc[lpAddress].rewardDebt) + BigInt(farm.rewardDebt)).toString()
                    acc[lpAddress].userShare = (BigInt(acc[lpAddress].userShare) + BigInt(farm.userShare)).toString()
                    acc[lpAddress].token0Amount = (BigInt(acc[lpAddress].token0Amount) + BigInt(farm.token0Amount)).toString()
                    acc[lpAddress].token1Amount = (BigInt(acc[lpAddress].token1Amount) + BigInt(farm.token1Amount)).toString()
                    acc[lpAddress].token0 = {
                        raw: (BigInt(acc[lpAddress].token0Amount) + BigInt(farm.token0Amount)).toString(),
                        normalized: Number(acc[lpAddress]?.token0?.normalized ?? 0) + Number(farm?.token0?.normalized ?? 0),
                        usd: Number(acc[lpAddress]?.token0?.usd ?? 0) + Number(farm?.token0?.usd ?? 0)
                    }
                    acc[lpAddress].token1 = {
                        raw: (BigInt(acc[lpAddress].token1Amount) + BigInt(farm.token1Amount)).toString(),
                        normalized: Number(acc[lpAddress]?.token1?.normalized ?? 0) + Number(farm?.token1?.normalized ?? 0),
                        usd: Number(acc[lpAddress]?.token1?.usd ?? 0) + Number(farm?.token1?.usd ?? 0)
                    }
                    acc[lpAddress].rewards = {
                        raw: (BigInt(acc[lpAddress]?.raw ?? 0) + BigInt(farm?.pendingInc ?? 0)).toString(),
                        normalized: Number(acc[lpAddress]?.rewards?.normalized ?? 0) + Number(farm?.rewards?.normalized ?? 0),
                        usd: Number(acc[lpAddress]?.rewards?.usd ?? 0) + Number(farm?.rewards?.usd ?? 0)
                    }
                    
                    return acc
                }, {}
            )

            if (useQuery && walletsLengthAtStart.current !== Object.keys(wallets).length) return
            
            setFarmBalances(filteredBalances)
            setCombinedBalances(combinedBalances)
        } catch (err) {
            console.error('Error fetching farm balances:', err)
            setError(err)
        } finally {
            setLoading(false)
            fetching.current = false
        }
    }
    
    const updateRewards = async () => {
        const walletAddresses = Object.keys(wallets).filter(Boolean)
        if (walletAddresses.length === 0 || pools.length === 0) return
        if (fetching.current) return
        fetching.current = true

        try {
            const pendingRewards = await fetchPendingRewards(
                walletAddresses, 
                pools.length, 
                settings,
                farmBalances
            )
            const prices = priceData?.prices
            const incPriceInfo = prices?.['0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d']
            const incPriceUsd = Number(incPriceInfo?.priceUsd ?? 0)

            // Update farmBalances
            setFarmBalances(prev => {
                const updated = {...prev}
                pendingRewards.forEach(({ address, rewards }) => {
                    if (updated[address]) {
                        rewards.forEach(({ poolIndex, pendingInc }) => {
                            if (updated[address][poolIndex]) {
                                const normalizedPending = (parseFloat(BigInt(pendingInc) / BigInt(10**16)) / 10**2).toString()
                                updated[address][poolIndex].pendingInc = pendingInc
                                updated[address][poolIndex].rewards = {
                                    raw: pendingInc,
                                    normalized: normalizedPending,
                                    usd: parseFloat(normalizedPending) * incPriceUsd
                                }
                            }
                        })
                    }
                })
                return updated
            })

            // Update combinedBalances
            setCombinedBalances(prev => {
                const updated = {...prev}
                Object.entries(updated).forEach(([lpAddress, lpData]) => {
                    const totalPending = Object.values(farmBalances)
                        .flat()
                        .filter(farm => farm.lpAddress === lpAddress)
                        .reduce((acc, farm) => acc + BigInt(farm.pendingInc), BigInt(0))
                    
                    const normalizedPending = (parseFloat(totalPending / BigInt(10**16)) / 10**2).toString()
                    updated[lpAddress].rewards = {
                        raw: totalPending.toString(),
                        normalized: normalizedPending,
                        usd: parseFloat(normalizedPending) * incPriceUsd
                    }
                })
                return updated
            })

        } catch (err) {
            console.error('Error updating rewards:', err)
        } finally {
            fetching.current = false
        }
    }

    // Add new useEffect for periodic rewards updates
    useEffect(() => {
        if (Object.keys(farmBalances).length === 0) return

        const interval = setInterval(updateRewards, 45_000) // Update every 45 seconds

        return () => clearInterval(interval)
    }, [Object.keys(farmBalances).length])

    return { pools, farmBalances, loading, error, combinedBalances }
}