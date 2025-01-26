import { useState, useEffect, useRef, useCallback } from "react"
import { useAtom } from "jotai"
import { appSettingsAtom } from "../store"
import { batchQueryBalances } from "../lib/web3"
import { defaultTokenInformation } from "../lib/tokens"
import { useAppContext } from "../shared/AppContext"

export default function useGetBalance(priceData) {
    const [settings] = useAtom(appSettingsAtom)
    const [wasUpdated, setWasUpdated] = useState(0)
    const [balances, setBalances] = useState({})
    const [combinedBalances, setCombinedBalances] = useState({})
    const fetching = useRef(false)
    const loading = fetching.current

    const context = useAppContext()
    const watchlist = context?.data?.watchlist ?? {}
    const wallets = context?.data?.wallets ?? {}

    const { prices, refresh } = priceData 
    const readyForFirstUpdate = priceData.initialized && Object.keys(priceData.prices).length > 0

    const fetchBalances = useCallback(async () => {
        if (fetching.current === true) return
        fetching.current = true
        
        try {
            const walletAddresses = Object.keys(wallets)
                .filter(Boolean)

            const baseTokens = Object.keys(defaultTokenInformation)
                .filter(Boolean)

            const watchlistPairs = Object.keys(watchlist)
                .filter(Boolean)

            const watchlistTokens = watchlistPairs.map(m => (watchlist[m]?.token?.address ?? '').toLowerCase())
            const tokenAddresses = [...new Set([...baseTokens, ...watchlistTokens])]

            if (tokenAddresses.length === 0 || walletAddresses.length === 0) {
                fetching.current = false
                return
            }

            const rawWalletBalances = await batchQueryBalances(wallets, tokenAddresses, 'mainnet', settings)

            const processedWalletBalances = Object.entries(rawWalletBalances).reduce((acc, [walletAddress, walletData]) => {
                const processedBalances = Object.entries(walletData.balances).reduce((balanceAcc, [tokenAddress, balance]) => {
                    balanceAcc[tokenAddress] = processBalance(balance, tokenAddress)
                    return balanceAcc
                }, {})

                acc[walletAddress] = {
                    ...walletData,
                    balances: processedBalances
                }
                return acc
            }, {})

            setBalances(processedWalletBalances)
            setCombinedBalances(calculateCombinedBalances(processedWalletBalances, tokenAddresses))
            setWasUpdated(prev => prev + 1)
        } catch (error) {
            console.error('Error fetching balances:', error)
        } finally {
            fetching.current = false
        }
    }, [wallets, watchlist, settings, prices])

    // Track changes to trigger updates
    useEffect(() => {
        if (!readyForFirstUpdate) return
        
        if (Object.keys(wallets).length === 0) {
            setBalances({})
            setCombinedBalances({})
            setWasUpdated(prev => prev + 1)
            return
        }

        fetchBalances()
    }, [
        Object.keys(watchlist).length,
        Object.keys(wallets).length,
        refresh,
        fetchBalances,
        readyForFirstUpdate
    ])

    // Set up polling interval
    useEffect(() => {
        if (!readyForFirstUpdate) return
        
        const interval = setInterval(fetchBalances, 30_000)
        return () => clearInterval(interval)
    }, [readyForFirstUpdate, fetchBalances])

    // Process raw balance into normalized and USD values
    const processBalance = (rawBalance, tokenAddress) => {
        const decimals = tokenAddress == 'PLS' ? 9 : Number(prices?.[tokenAddress]?.decimals ?? 18)
        const priceUsd = Number(prices?.[tokenAddress]?.priceUsd ?? 0)
        
        // Calculate normalized balance
        const intermediaryValue = BigInt(rawBalance ?? 0) * BigInt(10**2) / BigInt(10**(decimals))
        const normalizedBalance = parseFloat(intermediaryValue) / (10**2)
        
        // Calculate USD value
        const usdValue = normalizedBalance * priceUsd

        return {
            raw: rawBalance,
            normalized: normalizedBalance,
            usd: usdValue
        }
    }

    const calculateCombinedBalances = (walletBalances, tokenAddresses) => {
        const combined = Array.from(tokenAddresses).reduce((acc, tokenAddress) => {
            let totalNormalized = 0
            let totalUsd = 0
            let totalRaw = BigInt(0)
    
            Object.values(walletBalances).forEach(wallet => {
                const walletBalance = wallet.balances?.[tokenAddress] || '0'
                
                totalRaw += BigInt(walletBalance?.raw ?? 0)
                totalNormalized += walletBalance?.normalized ?? 0
                totalUsd += walletBalance?.usd ?? 0
            })
    
            acc[tokenAddress] = {
                raw: totalRaw.toString(),
                normalized: totalNormalized,
                usd: totalUsd
            }
            return acc
        }, {})
        return combined
    }

    return { balances, combinedBalances, wasUpdated, loading }
}