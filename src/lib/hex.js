import Web3 from 'web3'
import { hexAbi } from './abi/hex-abi'
import { defaultSettings } from '../config/settings'

const HEX_CONTRACT = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39'
const BATCH_SIZE = 25

export const getHexCurrentDay = async (settings = defaultSettings) => {
    try {
        const web3 = new Web3(settings.rpcs.mainnet[0])
        const hexContract = new web3.eth.Contract(hexAbi, HEX_CONTRACT)
        const currentDay = await hexContract.methods.currentDay().call()
        return Number(currentDay)
    } catch (error) {
        console.error('Error fetching HEX current day:', error)
        return 0
    }
}

export const batchFetchHex = async (walletAddresses, currentDay, settings = defaultSettings) => {
    try {
        const web3 = new Web3(settings.rpcs.mainnet[0])
        const hexContract = new web3.eth.Contract(hexAbi, HEX_CONTRACT)

        // First batch: Get stake counts for all addresses
        const stakeCounts = await new Promise((resolve, reject) => {
            try {
                const batch = new web3.BatchRequest()
                const results = new Array(walletAddresses.length)
                let completed = 0

                walletAddresses.forEach((address, index) => {
                    batch.add(
                        hexContract.methods.stakeCount(address).call.request({}, (error, count) => {
                            if (error) {
                                console.error(`Error fetching stake count for ${address}:`, error)
                                results[index] = 0
                            } else {
                                results[index] = Number(count)
                            }
                            completed++
                            if (completed === walletAddresses.length) {
                                resolve(results)
                            }
                        })
                    )
                })

                batch.execute()
            } catch (e) {
                console.error('Error in stake count batch:', e)
                reject(e)
            }
        })

        // Prepare stake requests for all addresses
        const stakeRequests = walletAddresses.flatMap((address, addressIndex) => {
            const count = stakeCounts[addressIndex]
            return Array.from({ length: count }, (_, i) => ({
                address,
                stakeIndex: i
            }))
        })

        // Process stake requests in batches of BATCH_SIZE
        const results = {}
        for (let i = 0; i < stakeRequests.length; i += BATCH_SIZE) {
            const batch = stakeRequests.slice(i, i + BATCH_SIZE)
            const batchResults = await new Promise((resolve, reject) => {
                try {
                    const web3Batch = new web3.BatchRequest()
                    const batchData = []
                    let completed = 0

                    batch.forEach(({ address, stakeIndex }) => {
                        web3Batch.add(
                            hexContract.methods.stakeLists(address, stakeIndex).call.request({}, (error, stake) => {
                                if (error) {
                                    console.error(`Error fetching stake ${stakeIndex} for ${address}:`, error)
                                } else {
                                    const stakedHex = parseFloat( BigInt(stake.stakedHearts) / BigInt(10**4) ) / 10**4
                                    const daysRemaining =  Number(stake.unlockedDay) !== 0 
                                        ? (Number(stake.lockedDay) + Number(stake.stakedDays)) - Number(stake.unlockedDay)
                                        : (Number(stake.lockedDay) + Number(stake.stakedDays)) - currentDay

                                    const effectiveLateDays = daysRemaining < -14 ? daysRemaining + 14 : 0
                                    const effectivePenalty = stakedHex * effectiveLateDays / Number(stake.stakedDays) / 10

                                    batchData.push({
                                        address,
                                        stakeIndex,
                                        stake: {
                                            address: address,
                                            stakeId: stake.stakeId,
                                            stakedHearts: stake.stakedHearts,
                                            stakeShares: stake.stakeShares,
                                            lockedDay: Number(stake.lockedDay),
                                            stakedDays: Number(stake.stakedDays),
                                            unlockedDay: Number(stake.unlockedDay),
                                            isAutoStake: stake.isAutoStake,
                                            tShares: parseFloat( BigInt(stake.stakeShares) / BigInt(10**6)) / 10**6,
                                            stakedHex,
                                            daysRemaining,
                                            effectivePenalty
                                        }
                                    })
                                }
                                completed++
                                if (completed === batch.length) {
                                    resolve(batchData)
                                }
                            })
                        )
                    })

                    web3Batch.execute()
                } catch (e) {
                    console.error('Error in stakes batch:', e)
                    reject(e)
                }
            })

            // Organize results by address
            batchResults.forEach(({ address, stake }) => {
                if (!results[address]) {
                    results[address] = []
                }
                results[address].push(stake)
            })
        }

        return results

    } catch (error) {
        console.error('Error in batchFetchHex:', error)
        return {}
    }
} 

export const parseHexStats = (stakesArray = []) => {
    try {
        // Ensure we have an array to work with
        const stakes = Array.isArray(stakesArray) ? stakesArray : []
        const activeStakes = stakes.filter(f => Number(f?.unlockedDay) === 0)
        const gaStakes = stakes.filter(f => Number(f?.unlockedDay) !== 0)

        const daysUntilNextStake = activeStakes.length > 0 ? 
            Math.min(...activeStakes.map(stake => stake?.daysRemaining ?? 0)) : 
            0
        
        const totalStakedHex = stakes.reduce((acc, stake) => acc + (stake?.stakedHex ?? 0), 0)
        const totalHexYield = stakes.reduce((acc, stake) => acc + (stake?.stakeHexYield ?? 0), 0)
        const totalEffectivePenalty = stakes.reduce((acc, stake) => {
            const penalty = (stake?.effectivePenalty ?? 0)
            const totalHex = (stake?.stakeHexYield ?? 0) + (stake?.stakedHex ?? 0) - penalty
            return acc + (totalHex < 0 ? totalHex : penalty)}, 0
        )

        const result = {
            totalTShares: activeStakes.reduce((acc, stake) => acc + (stake?.tShares ?? 0), 0),
            totalStakedHex,
            totalHexYield,
            totalEffectivePenalty,
            totalFinalHex: totalStakedHex + totalHexYield + totalEffectivePenalty < 0 ? 0 : totalStakedHex + totalHexYield + totalEffectivePenalty,
            averageStakeLength: activeStakes.reduce((acc, stake) => acc + (stake?.stakedDays ?? 0), 0) / activeStakes.length,
            daysUntilNextStake: daysUntilNextStake,
            nextStakeAddress: activeStakes.length > 0 ? 
                activeStakes.find(stake => stake?.daysRemaining === daysUntilNextStake)?.address : 
                '',
            totalStakes: stakes.length,
            totalActiveStakes: activeStakes.length,
            totalGaStakes: gaStakes.length,
        }
        return result
    } catch (error) {
        console.error('Error in parseHexStats:', error)
        return {
            totalTShares: 0,
            totalStakedHex: 0,
            totalHexYield: 0,
            totalEffectivePenalty: 0,
            totalFinalHex: 0,
            averageStakeLength: 0,
            daysUntilNextStake: 0,
            daysUntilNextStakeAddress: '',
            totalStakes: 0,
            totalActiveStakes: 0,
            totalGaStakes: 0,
        }
    }
}

const HEART_UINT_SIZE = 72 // Size of uint72 in bits

export const parseDailyDataValue = (dailyDataValue) => {
    try {
        const value = BigInt(dailyDataValue)
        
        // Extract values using bitmasks
        // dayPayoutTotal (lowest 72 bits)
        const dayPayoutTotal = value & ((1n << 72n) - 1n)
        
        // dayStakeSharesTotal (middle 72 bits)
        const dayStakeSharesTotal = (value >> 72n) & ((1n << 72n) - 1n)

        const result ={
            dayPayoutTotal: dayPayoutTotal.toString(),
            dayStakeSharesTotal: dayStakeSharesTotal.toString(),
            payoutPerTShare: parseFloat( dayPayoutTotal * BigInt(10**8) / (dayStakeSharesTotal ?? BigInt(1)) ) / 10 ** 4
        }

        return result 
    } catch (error) {
        // console.error('Error parsing daily data value:', error)
        return {
            dayPayoutTotal: '0',
            dayStakeSharesTotal: '0',
            payoutPerTShare: '0.00'
        }
    }
}

export const getHexDailyData = async (currentDay, settings = defaultSettings) => {
    try {
        const web3 = new Web3(settings.rpcs.mainnet[0])
        const hexContract = new web3.eth.Contract(hexAbi, HEX_CONTRACT)
        const BATCH_SIZE = 2000
        const MAX_RETRIES = 3
        const allDailyData = []

        // Calculate number of batches needed
        const batchCount = Math.ceil(currentDay / BATCH_SIZE)

        // Process each batch
        for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
            const startDay = batchIndex * BATCH_SIZE
            const endDay = Math.min((batchIndex + 1) * BATCH_SIZE, currentDay)

            let retryCount = 0
            let success = false
            let lastError = null

            while (retryCount < MAX_RETRIES && !success) {
                try {
                    const dailyDataBatch = await hexContract.methods.dailyDataRange(startDay, endDay).call()
                    
                    // Process each day's data in the batch
                    dailyDataBatch.forEach((dayData, index) => {
                        const actualDay = startDay + index
                        const parsedData = parseDailyDataValue(dayData)
                        allDailyData[actualDay] = {
                            day: actualDay,
                            ...parsedData
                        }
                    })

                    success = true
                } catch (error) {
                    lastError = error
                    retryCount++
                    if (retryCount < MAX_RETRIES) {
                        console.warn(`Retry ${retryCount} for batch ${batchIndex} (days ${startDay}-${endDay})`)
                        // Add exponential backoff delay
                        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)))
                    }
                }
            }

            if (!success) {
                console.error(`Failed to fetch batch ${batchIndex} after ${MAX_RETRIES} retries:`, lastError)
                // Fill missing days with zero values
                for (let day = startDay; day < endDay; day++) {
                    allDailyData[day] = {
                        day,
                        dayPayoutTotal: '0',
                        dayStakeSharesTotal: '0',
                        payoutPerTShare: '0.00'
                    }
                }
            }
        }

        return allDailyData

    } catch (error) {
        console.error('Error in getHexDailyData:', error)
        return []
    }
}