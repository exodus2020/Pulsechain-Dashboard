import { useEffect, useState } from "react"
import { batchFetchTokenInfo, batchQueryLPs } from "../lib/web3"
import { defaultSettings } from "../config/settings"
import { appSettingsAtom } from "../store"
import { useAtom } from "jotai"
import axios from "axios"
import { useSettings } from "./useSettings"

export default function useLiquiditySearch({ searchTerm, wallets, lpAddresses = [] }) {
    const [noResults, setNoResults] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isError, setIsError] = useState(false)
    const [data, setData] = useState([])
    const { scan, settings } = useSettings({network: 'mainnet'})
    
    const scanForTokens = async () => {
        setIsLoading(true)
        const promises = wallets.map(m => axios.get(`${scan[0]}/v2/addresses/${m}/token-balances`))
        const responses = await Promise.all(promises)
        
        const results = responses.filter(f => f.status === 200).map(r => r.data).flat()

        const potentialLps = results.filter(f => (f?.token?.name ?? '').startsWith('PulseX') && (f?.token?.symbol ?? '') == 'PLP' && (f?.token?.value !== "0"))
        if (potentialLps.length > 0) {
            // Get clean addresses and filter out ones already in watchlist
            const cleanedAddresses = potentialLps
                .map(m => (m?.token?.address ?? '')?.toLowerCase())
                .filter(address => !lpAddresses.some(watchlistAddr => 
                    watchlistAddr.toLowerCase() === address.toLowerCase()
                ))


            if (cleanedAddresses.length === 0) {
                setData([])
                setIsLoading(false)
                return
            }

            const lpData = await batchQueryLPs(cleanedAddresses, 'mainnet', settings)
            
            const lpDataArray = Object.keys(lpData ?? {}).length > 0 ? Object.keys(lpData).reduce((acc, key) => {
                acc.push({
                    ...lpData[key]
                    , id: key
                })
                return acc
            }, []) : []

            // Filter out null/undefined values and collect unique token addresses
            const tokenAddresses = lpDataArray.reduce((acc, lp) => {
                if (lp?.token0) acc.add(lp.token0.toLowerCase())
                if (lp?.token1) acc.add(lp.token1.toLowerCase())
                return acc
            }, new Set())

            const tokenArray = Array.from(tokenAddresses)

            if (tokenArray.length > 0) {
                const tokensInfo = await batchFetchTokenInfo(tokenArray, 'mainnet', settings)
                
                const lpResultsArray = lpDataArray.map(m => ({
                    ...m
                    , token0: tokensInfo?.[m?.token0?.toLowerCase()]
                    , token1: tokensInfo?.[m?.token1?.toLowerCase()]
                }))
                setData(lpResultsArray ?? [])
            } else {
                setData([])
            }
            
            setIsLoading(false)
            return
        } else {
            setData([])
            setIsLoading(false)
        }
    }

    useEffect(() => {
        const fetchResults = async () => {
            try {
                setIsLoading(true)
                setIsError(null)

                // Clean and validate search term
                const cleanedAddress = searchTerm.toLowerCase().trim()
                if (!cleanedAddress || cleanedAddress.length !== 42) {
                    setIsError(true)
                    return
                }

                // Query the LP contract
                const lpData = await batchQueryLPs([cleanedAddress], 'mainnet', defaultSettings)
                
                if (!lpData || !lpData[cleanedAddress]) {
                    setNoResults(true)
                    setData([])
                    return
                }

                // Format data similar to useTokenSearch response
                const lpInfo = lpData[cleanedAddress]
                const formattedData = [{
                    id: cleanedAddress,
                    token0: {
                        id: lpInfo.token0,
                        name: '', // These will be filled by the parent component
                        symbol: '',
                        derivedUSD: '0'
                    },
                    token1: {
                        id: lpInfo.token1,
                        name: '',
                        symbol: '',
                        derivedUSD: '0'
                    },
                    reserve0: lpInfo.reserve0,
                    reserve1: lpInfo.reserve1,
                    reserveUSD: '0', // This will be calculated by parent if needed
                    totalSupply: lpInfo.totalSupply
                }]

                setData(formattedData)
                setNoResults(false)

            } catch (err) {
                console.error('Error in useLiquiditySearch:', err)
                setIsError(true)
                setData([])
            } finally {
                setIsLoading(false)
            }
        }

        if (searchTerm && !isLoading) {
            setIsLoading(true)
            setNoResults(false)
            if (isError) setIsError(false)
            if (data.length > 0) setData([])
            fetchResults()
        } else {
            if (data.length > 0) setData([])
            if (noResults) setNoResults(false)
            if (isLoading) setIsLoading(false)
            if (isError) setIsError(false)
        }
    }, [searchTerm])

    return { isLoading, isError, data, noResults, scanForTokens }
} 