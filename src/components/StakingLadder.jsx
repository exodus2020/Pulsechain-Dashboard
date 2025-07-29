import { memo, useMemo, useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import styled from 'styled-components'

const ChartContainer = styled.div`
    width: calc( 100% - 40px );
    height: 250px;
    background: rgb(0, 0, 0, 0.5);
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.5), rgba(50, 50, 50, 0.1));
    border-radius: 10px;
    padding: 20px;
    // margin: 20px 0;
    color: white;
    font-family: 'Oswald', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

    @media (max-width: 650px) {
        width: calc( 100dvw - 80px );
    }
`

const CustomTooltip = styled.div`
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 12px;
    color: white;
    font-size: 14px;
    
    .label {
        font-weight: bold;
        margin-bottom: 8px;
        color: #00ff88;
    }
    
    .value {
        margin: 4px 0;
    }
`

export default memo(StakingLadder)
function StakingLadder(props) {
    if (!props?.stakes || props?.stakes.length === 0) return <></>
    return <StakingLadderChart {...props}/>
}
function StakingLadderChart({ stakes }) { 
    const [windowWidth, setWindowWidth] = useState(window.innerWidth)
    
    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth)
        }
        
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])
    
    if (!stakes || stakes.length === 0) {
        return (
            <ChartContainer>
                <div style={{ textAlign: 'center', padding: '50px 0' }}>
                    No stakes data available
                </div>
            </ChartContainer>
        )
    }

    // Create data points for 10-day buckets between min and max days remaining
    const createDailyData = () => {
        // Sort stakes by daysRemaining first
        const sortedStakes = [...stakes].sort((a, b) => {
            const daysA = Math.max(0, Math.min(5555, Math.floor(a.daysRemaining)))
            const daysB = Math.max(0, Math.min(5555, Math.floor(b.daysRemaining)))
            return daysA - daysB
        })
        
        // Find min and max days remaining
        let minDays = Infinity
        let maxDays = -Infinity
        
        sortedStakes.forEach(stake => {
            const daysRemaining = Math.max(0, Math.min(5555, Math.floor(stake.daysRemaining)))
            minDays = Math.min(minDays, daysRemaining)
            maxDays = Math.max(maxDays, daysRemaining)
        })
        
        // Ensure we have at least some range
        if (minDays === Infinity) {
            minDays = 0
            maxDays = 0
        }
        
        // Round to nearest integers
        minDays = Math.floor(minDays)
        maxDays = Math.ceil(maxDays)
        
        // Create 30-day buckets
        const dayRange = maxDays - minDays
        console.log(dayRange)
        // const bucketSize = dayRange > 2500 ? 90 : dayRange > 2000 ? 60 : 30
        const bucketSize = 30
        const minBucket = Math.floor(minDays / bucketSize)
        const maxBucket = Math.floor(maxDays / bucketSize)
        
        const bucketData = []
        for (let bucketIndex = minBucket; bucketIndex <= maxBucket; bucketIndex++) {
            const bucketStart = bucketIndex * bucketSize
            const bucketEnd = bucketStart + bucketSize - 1
            bucketData.push({
                daysRemaining: bucketStart + bucketSize / 2, // Use middle of bucket for x-axis
                bucketRange: `${bucketStart}-${bucketEnd}`,
                totalShares: 0,
                stakeCount: 0
            })
        }
        
        // Populate with actual stake data (combining stakes in same 10-day bucket)
        sortedStakes.forEach(stake => {
            const daysRemaining = Math.max(0, Math.min(5555, Math.floor(stake.daysRemaining)))
            const bucketIndex = Math.floor(daysRemaining / bucketSize)
            const dataIndex = bucketIndex - minBucket
            
            if (dataIndex >= 0 && dataIndex < bucketData.length) {
                bucketData[dataIndex].totalShares += stake.tShares || 0
                bucketData[dataIndex].stakeCount += 1
            }
        })
        
        // Set minimum value for logarithmic scale (instead of filtering out zeros)
        bucketData.forEach(bucket => {
            if (bucket.totalShares === 0) {
                bucket.totalShares = 0.001 // Small positive value for log scale
            }
        })
        
        return bucketData
    }

    const chartData = useMemo(() => {
        return createDailyData()
    }, [stakes, windowWidth])

    const CustomTooltipContent = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload
            const sharesDisplay = data.totalShares === 0.1 ? '0' : data.totalShares.toFixed(2)
            const dateRange = getDateRange(data.daysRemaining - 15, 30) // 30-day bucket, centered
            
            return (
                <CustomTooltip>
                    <div className="label">Days Remaining: {data.bucketRange}</div>
                    <div className="value">Dates: {dateRange}</div>
                    <div className="value">Total Shares: {sharesDisplay}</div>
                    <div className="value">Stake Count: {data.stakeCount}</div>
                </CustomTooltip>
            )
        }
        return null
    }

    // Calculate smart tick intervals for 30-day buckets with responsive design
    const getTickInterval = () => {
        if (chartData.length === 0) return 1
        
        const bucketCount = chartData.length
        const isMobile = windowWidth <= 650

        if (isMobile) {
            // Mobile: fewer ticks to prevent overlap
            if (bucketCount <= 5) return 0        // Show every bucket
            if (bucketCount <= 10) return 1       // Show every other bucket
            if (bucketCount <= 20) return 2       // Show every third bucket
            if (bucketCount <= 40) return 3       // Show every fourth bucket
            return Math.ceil(bucketCount / 6)    // Show ~10 ticks max
        } else {
            console.log(bucketCount)
            // Desktop: use original logic
            if (bucketCount <= 10) return 0        // Show every bucket for small datasets
            if (bucketCount <= 20) return 4        // Show every other bucket
            if (bucketCount <= 50) return 6        // Show every third bucket
            if (bucketCount <= 100) return 8       // Show every fifth bucket
            if (bucketCount <= 150) return 10       // Show every fifth bucket
            return Math.ceil(bucketCount / 12)     // Show ~20 ticks for large datasets
        }
    }

    // Calculate date range for a given days remaining
    const getDateRange = (daysRemaining, bucketSize) => {
        const today = new Date()
        const startDate = new Date(today)
        startDate.setDate(today.getDate() + daysRemaining)
        
        const endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + bucketSize - 1)
        
        const formatDate = (date) => {
            return date.toISOString().split('T')[0].replace(/-/g, '/')
        }
        
        return `${formatDate(startDate)} - ${formatDate(endDate)}`
    }

    return (
        <ChartContainer>
            <h3 style={{ margin: '0 0 20px 0', textAlign: 'center' }}>Staking Ladder</h3>
            <ResponsiveContainer width="100%" height="90%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                    <XAxis 
                        dataKey="daysRemaining" 
                        label={{ value: 'Days Remaining', position: 'insideBottom', offset: -5 }}
                        tick={{ fill: 'white', fontSize: 12 }}
                        axisLine={{ stroke: 'rgba(255, 255, 255, 0.3)' }}
                        tickLine={{ stroke: 'rgba(255, 255, 255, 0.3)' }}
                        interval={getTickInterval() - 1}
                    />
                    <YAxis 
                        label={{ value: 'T Shares', angle: -90, position: 'insideLeft', offset: 0 }}
                        tick={{ fill: 'white', fontSize: 12 }}
                        axisLine={{ stroke: 'rgba(255, 255, 255, 0.3)' }}
                        tickLine={{ stroke: 'rgba(255, 255, 255, 0.3)' }}
                        scale="log"
                        domain={['auto', 'auto']}
                        allowDataOverflow={false}
                    />
                    <Tooltip content={<CustomTooltipContent />} />
                    <Bar 
                        dataKey="totalShares" 
                        fill="#00ff88" 
                        radius={[4, 4, 0, 0]}
                        stroke="#00cc6a"
                        strokeWidth={1}
                    />
                </BarChart>
            </ResponsiveContainer>
        </ChartContainer>
    )
}