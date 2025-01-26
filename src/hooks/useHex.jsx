import { useAtom } from "jotai"
import { useState, useEffect, useRef } from "react"
import { appSettingsAtom } from "../store"
import { batchFetchHex, getHexCurrentDay, getHexDailyData, parseHexStats } from "../lib/hex"

export default function useHex({ wallets }) {
    const [hexStakes, setHexStakes] = useState({})
    const [combinedStakes, setCombinedStakes] = useState([])
    const [currentDay, setCurrentDay] = useState(0)
    const currentDayRef = useRef(undefined)
    const [settings] = useAtom(appSettingsAtom)
    const interval = useRef(null)
    const fetching = useRef(false)
    const [ dailyData, setDailyData ] = useState([])
    const walletLength = useRef(Object.keys(wallets).length)

    const fetchHexStakes = async () => {
        if (fetching.current) return
        fetching.current = true
        
        let newDailyData = [...dailyData]
        if (currentDayRef.current !== currentDay || dailyData.length === 0) {
            try {
                newDailyData = await getHexDailyData(currentDay)
            } catch (e) {
                console.error('Error fetching daily data:', e)
            }
        }

        const addresses = Object.keys(wallets)
        const hexStakeWallets = Object.keys(hexStakes)
        const missingAddresses = addresses.filter(f => !hexStakeWallets.includes(f))

        let walletStakes = Object.keys(hexStakes).reduce((acc, address) => {
            if (!wallets?.[address]) return acc
            return { ...acc, [address]: hexStakes[address] }
        }, {})

        if (missingAddresses.length > 0) {
            console.log('fetching stakes')
            const stakes = await batchFetchHex(missingAddresses, currentDay, settings)
            walletStakes = {...walletStakes, ...stakes}
        }
        addresses.forEach(a => walletStakes[a] = !walletStakes?.[a] ? [] : walletStakes[a])
        
        fetching.current = false
        setHexStakes(walletStakes)
        
        const combined = Object.keys(walletStakes).map(address => ( walletStakes[address])).flat().sort((a, b) => a.daysRemaining - b.daysRemaining)
        if (newDailyData.length === 0) {
            setCombinedStakes(combined)
            return
        }

        try{
            const parsedHexYield = combined.map( stake => {

                const dayEndInterest = stake.lockedDay + stake.stakedDays
                const days = newDailyData.filter( day => day.day > stake.lockedDay && day.day <= dayEndInterest)
                const stakeHexYield = days.reduce( (acc, day) => {
                    const tshares = stake.tShares
                    const payout = day.payoutPerTShare * tshares + (day.day == 356 ? stake.tShares * 3643 : 0)
                    return acc + payout
                }, 0)

                return {
                    ...stake,
                    stakeHexYield
                }
            })
            setCombinedStakes(parsedHexYield)    
        } catch(e) {
            setCombinedStakes(combined)
        }
        
        setDailyData(newDailyData)
    }

    const removeMissingWallets = () => {
        let updatedHexObject = {}

        setHexStakes(prev => {
            const newHexStakes = Object.keys(prev).reduce((acc, address) => {
                if (!wallets?.[address]) return acc
                return { ...acc, [address]: prev[address] }
            }, {})

            updatedHexObject = {...newHexStakes}
            return newHexStakes
        })
        updateCombinedStakes(updatedHexObject, dailyData)
    }

    const updateCombinedStakes = (hexStakesObject, dailyData) => {
        const combined = Object.keys(hexStakesObject).map(address => ( hexStakesObject[address])).flat().sort((a, b) => a.daysRemaining - b.daysRemaining)
        if (dailyData.length === 0) {
            setCombinedStakes(combined)
            return
        }

        try{
            const parsedHexYield = combined.map( stake => {
                const dayEndInterest = stake.lockedDay + stake.stakedDays
                const days = dailyData.filter( day => day.day > stake.lockedDay && day.day <= dayEndInterest)
                const stakeHexYield = days.reduce( (acc, day) => {
                    const tshares = stake.tShares
                    const payout = day.payoutPerTShare * tshares + (day.day == 356 ? stake.tShares * 3643 : 0)
                    return acc + payout
                }, 0)

                return {
                    ...stake,
                    stakeHexYield
                }
            })
            setCombinedStakes(parsedHexYield, dailyData)    
        } catch(e) {
            setCombinedStakes(combined)
        }
    }

    useEffect(() => {
        if (Object.keys(wallets).length === 0) {
            if (Object.keys(hexStakes).length > 0) setHexStakes({})
            if (Object.keys(combinedStakes).length > 0) setCombinedStakes({})
            return
        }

        const walletsChanged = Object.keys(wallets).length - walletLength.current

        // Check wallet updates if wallet is removed or added, but only when stakes have already been fetched
        if (Object.keys(hexStakes).length > 0) {
            if (walletsChanged > 0) {
                fetchHexStakes()
                walletLength.current = Object.keys(wallets).length
            } else if (walletsChanged < 0) {
                removeMissingWallets()
                walletLength.current = Object.keys(wallets).length
            }
        }

        if (currentDay === 0 || (currentDayRef.current === currentDay && Object.keys(hexStakes).length === Object.keys(wallets).length)) return
        
        
        if (Object.keys(hexStakes).length !== Object.keys(wallets).length) {
            fetchHexStakes()
        }
        currentDayRef.current = currentDay
    }, [Object.keys(wallets).length, settings, currentDay])

    useEffect(() => {
        const getCurrentDay = async () => {
            const newCurrentDay = await getHexCurrentDay()
            if(currentDay !== newCurrentDay) setCurrentDay(newCurrentDay)
        }

        interval.current = setInterval(getCurrentDay, 900_000) // Refresh every 15 minutes

        getCurrentDay()
        return () => clearInterval(interval.current)
    }, [hexStakes])

    const stats = parseHexStats(combinedStakes)

    return {
        hexStakes,
        combinedStakes,
        stats
    }
}