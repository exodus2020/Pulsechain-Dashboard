import React, { useMemo } from "react"
import { hiddenWalletsAtom } from "../store"
import { defaultTokenInformation, liquidityPairs } from "../lib/tokens"


export default function useFilterBalance({ balanceData, farmData, lpData, hiddenWallets, visibleWallets, hideZeroValue, data }) {
    const watchlist = data?.watchlist ?? {}

    const { 
        addressFarmRewards, 
        lps, 
        farm, 
        addressData, 
        displayLps, 
        addressLps, 
        displayFarms, 
        addressFarms, 
        addressBalances, 
        displayDefaultTokens, 
        displayLiquidityPools 
    } = useMemo(() => {
        // use balances instead of combinedBalances when filtering
        const addressData = Object.keys(hiddenWallets).length === 0 
        ? balanceData?.combinedBalances 
        : Object.keys(visibleWallets).reduce((acc, walletAddress) => {
            const walletBalances = balanceData?.balances?.[walletAddress]?.balances ?? {}
            Object.entries(walletBalances).forEach(([tokenAddress, balance]) => {
                if (!acc[tokenAddress]) {
                    acc[tokenAddress] = { ...balance }
                } else {
                    // Add values instead of overwriting
                    acc[tokenAddress].usd = Number(acc[tokenAddress].usd || 0) + Number(balance.usd || 0)
                    acc[tokenAddress].normalized = Number(acc[tokenAddress].normalized || 0) + Number(balance.normalized || 0)
                    acc[tokenAddress].raw = (BigInt(acc[tokenAddress].raw || 0) + BigInt(balance.raw || 0)).toString()
                }
            })
            return acc
        }, {})
    const addressBalances = Object.keys(addressData).reduce((acc, i) => {
        return acc + (addressData[i]?.usd ?? 0);
    }, 0);
        // use farmBalances instead of combinedBalances when filtering
        const farm = Object.keys(hiddenWallets).length === 0 
        ? farmData?.combinedBalances ?? {}
        : Object.entries(farmData?.farmBalances ?? {}).reduce((acc, [walletAddress, walletFarms]) => {
            // Skip if wallet is hidden
            if (!visibleWallets[walletAddress]) return acc

            walletFarms.forEach((farm) => {
                const lpAddress = farm.lpAddress.toLowerCase()
                if (!acc[lpAddress]) {
                    acc[lpAddress] = {
                        ...farm,
                        stakedTokens: farm.stakedTokens,
                        lpAddress: farm.lpAddress,
                        token0: { ...farm.token0 },
                        token1: { ...farm.token1 },
                        rewards: { ...farm.rewards }
                    }
                } else {
                    // Add stakedTokens
                    try {
                        acc[lpAddress].stakedTokens = (BigInt(acc[lpAddress].stakedTokens || 0) + BigInt(farm.stakedTokens || 0)).toString()
                    } catch {
                        acc[lpAddress].stakedTokens = (parseFloat(acc[lpAddress].stakedTokens || 0) + parseFloat(farm.stakedTokens || 0)).toString()
                    }
                    
                    // Add token0 values
                    acc[lpAddress].token0.usd = Number(acc[lpAddress].token0.usd || 0) + Number(farm.token0.usd || 0)
                    acc[lpAddress].token0.normalized = Number(acc[lpAddress].token0.normalized || 0) + Number(farm.token0.normalized || 0)
                    acc[lpAddress].token0.raw = (BigInt(acc[lpAddress].token0.raw || 0) + BigInt(farm.token0.raw || 0)).toString()

                    // Add token1 values
                    acc[lpAddress].token1.usd = Number(acc[lpAddress].token1.usd || 0) + Number(farm.token1.usd || 0)
                    acc[lpAddress].token1.normalized = Number(acc[lpAddress].token1.normalized || 0) + Number(farm.token1.normalized || 0)
                    acc[lpAddress].token1.raw = (BigInt(acc[lpAddress].token1.raw || 0) + BigInt(farm.token1.raw || 0)).toString()

                    // Add rewards values
                    acc[lpAddress].rewards.usd = Number(acc[lpAddress].rewards.usd || 0) + Number(farm.rewards.usd || 0)
                    acc[lpAddress].rewards.normalized = Number(acc[lpAddress].rewards.normalized || 0) + Number(farm.rewards.normalized || 0)
                    acc[lpAddress].rewards.raw = (BigInt(acc[lpAddress].rewards.raw || 0) + BigInt(farm.rewards.raw || 0)).toString()
                }
            })
            return acc
        }, {})

        const addressFarms = Object.values(farm ?? {}).reduce((acc, farm) => {
            return acc + Number(farm?.token0?.usd ?? 0) + Number(farm?.token1?.usd ?? 0) + Number(farm?.rewards?.usd ?? 0)
        }, 0)

        const addressFarmRewards = Object.values(farm ?? {}).reduce((acc, farm) => {
            acc.usd = (acc?.usd ?? 0) + (farm?.rewards?.usd ?? 0)
            acc.normalized = parseFloat((acc?.normalized ?? 0)) + parseFloat((farm?.rewards?.normalized ?? 0))

            return acc
        }, {})
    
        const displayFarms = (farmData?.pools ?? []).filter(poolData => {
            const addressData = farmData?.combinedBalances?.[poolData?.lpAddress]
            if (!addressData || parseFloat(addressData?.stakedTokens) < 1) return false
            return true
        }).sort((a, b) => {
            const aBalance = (farm?.[a?.lpAddress]?.token0?.usd ?? 0) + (farm?.[a?.lpAddress]?.token1?.usd ?? 0) + (farm?.[a?.lpAddress]?.rewards?.usd ?? 0)
            const bBalance = (farm?.[b?.lpAddress]?.token0?.usd ?? 0) + (farm?.[b?.lpAddress]?.token1?.usd ?? 0) + (farm?.[b?.lpAddress]?.rewards?.usd ?? 0)
            return bBalance - aBalance
        })
    
        // Filter LP balances for visible wallets
        const lps = Object.keys(hiddenWallets).length === 0 
            ? lpData?.combinedBalances ?? {}
            : Object.entries(lpData?.lpBalances ?? {}).reduce((acc, [walletAddress, walletLPs]) => {
                // Skip if wallet is hidden
                if (!visibleWallets[walletAddress]) return acc
    
                Object.entries(walletLPs).forEach(([lpAddress, lp]) => {
                    lpAddress = lpAddress.toLowerCase()
                    if (!acc[lpAddress]) {
                        acc[lpAddress] = {
                            ...lp,
                            lpAddress,
                            lpTokenBalance: lp.lpTokenBalance,
                            token0: { ...lp.token0 },
                            token1: { ...lp.token1 },
                            totalSupply: lp.totalSupply,
                            reserve0: lp.reserve0,
                            reserve1: lp.reserve1
                        }
                    } else {
                        // Add lpTokenBalance
                        try {
                            acc[lpAddress].lpTokenBalance = (BigInt(acc[lpAddress].lpTokenBalance || 0) + BigInt(lp.lpTokenBalance || 0)).toString()
                        } catch {
                            acc[lpAddress].lpTokenBalance = (parseFloat(acc[lpAddress].lpTokenBalance || 0) + parseFloat(lp.lpTokenBalance || 0)).toString()
                        }
    
                        // Add token0 values
                        acc[lpAddress].token0.usd = Number(acc[lpAddress].token0.usd || 0) + Number(lp.token0.usd || 0)
                        acc[lpAddress].token0.normalized = Number(acc[lpAddress].token0.normalized || 0) + Number(lp.token0.normalized || 0)
                        acc[lpAddress].token0.raw = (BigInt(acc[lpAddress].token0.raw || 0) + BigInt(lp.token0.raw || 0)).toString()
    
                        // Add token1 values
                        acc[lpAddress].token1.usd = Number(acc[lpAddress].token1.usd || 0) + Number(lp.token1.usd || 0)
                        acc[lpAddress].token1.normalized = Number(acc[lpAddress].token1.normalized || 0) + Number(lp.token1.normalized || 0)
                        acc[lpAddress].token1.raw = (BigInt(acc[lpAddress].token1.raw || 0) + BigInt(lp.token1.raw || 0)).toString()
                    }
                })
                return acc
            }, {})

        const addressLps = Object.values(lps ?? {}).reduce((acc, lp) => {
            return acc + Number(lp?.token0?.usd ?? 0) + Number(lp?.token1?.usd ?? 0)
        }, 0)
    
        // Display LPs that have a balance
        const displayLps = Object.entries(lps).filter(([lpAddress, lpInfo]) => {
            const isWatchlistItem = data?.lpWatchlist?.[lpAddress] ? true : false
            const isDefaultPair = liquidityPairs?.[lpAddress] ? true : false
            const hasTokenBalance = Number(lpInfo?.token0?.normalized ?? 0) + Number(lpInfo?.token1?.normalized ?? 0) >= 1

            if (!isWatchlistItem && !isDefaultPair) return false

            if (!hideZeroValue && hasTokenBalance) return true

            // Always hide default pairs when 0 balances
            if (isDefaultPair && !hasTokenBalance) return false
            if (isWatchlistItem && hideZeroValue && !hasTokenBalance) return false

            return true

            //return hideZeroValue && true ? Number(lpInfo?.token0?.normalized ?? 0) + Number(lpInfo?.token1?.normalized ?? 0) >= 1 : true
        }).map(([lpAddress, lpInfo]) => ({
            lpAddress,
            ...lpInfo
        }))


        const displayDefaultTokens = [...Object.keys(defaultTokenInformation), ...Object.keys(watchlist)].sort((a, b) => {
            const watchlistItemA = watchlist?.[a]?.token?.address ? watchlist[a].token.address : undefined
            const watchlistItemB = watchlist?.[b]?.token?.address ? watchlist[b].token.address : undefined

            const aBalance = addressData?.[watchlistItemA ?? a]?.usd ?? 0
            const bBalance = addressData?.[watchlistItemB ?? b]?.usd ?? 0
            
            return bBalance - aBalance
        })

        const displayLiquidityPools = [...displayLps.map(m => ({...m, type: 'lp'})), ...displayFarms.map(m => ({...m, type: 'farm'}))]
        displayLiquidityPools.sort((a, b) => {

            const aData = (a.type === 'lp' ? a : farm?.[a.lpAddress]) ?? {}
            const bData = (b.type === 'lp' ? b : farm?.[b.lpAddress]) ?? {}

            const aBalance = a.type === 'lp' ? Number(aData.token0?.usd ?? 0) + Number(aData.token1?.usd ?? 0) : Number(aData.token0?.usd ?? 0) + Number(aData.token1?.usd ?? 0) + Number(aData.rewards?.usd ?? 0)
            const bBalance = b.type === 'lp' ? Number(bData.token0?.usd ?? 0) + Number(bData.token1?.usd ?? 0) : Number(bData.token0?.usd ?? 0) + Number(bData.token1?.usd ?? 0) + Number(bData.rewards?.usd ?? 0)
            return bBalance - aBalance
        })

        return {
            addressFarmRewards, lps, farm, displayLps, addressLps, displayFarms, addressFarms, addressData, addressBalances, displayDefaultTokens, displayLiquidityPools
        }
    }, [balanceData, farmData, lpData, hiddenWallets, hideZeroValue, data?.lpWatchlist])

    return {
        addressFarmRewards, lps, farm, displayLps, addressLps, displayFarms, addressFarms, addressData, addressBalances, displayDefaultTokens, displayLiquidityPools
    }
}
