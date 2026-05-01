// StakingPie.jsx
import { memo, useMemo, useState, useEffect, useRef } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, Sector } from 'recharts'
import styled from 'styled-components'
import { fUnit } from '../lib/numbers'
import { shortenString } from '../lib/string'
import { rgbStringToHex } from '../lib/utils'
import Button from './Button'
import { icons_list } from '../config/icons'
import Icon from './Icon'

const ChartContainer = styled.div`
    width: calc( 100% - 40px );
    height: 275px;
    background: rgb(0, 0, 0, 0.5);
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.5), rgba(30, 30, 30, 0.1));
    border-radius: 10px;
    padding: 20px 20px 50px 20px;
    // margin: 20px 0;
    color: white;
    font-family: 'Oswald', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    border-bottom: 1px solid rgb(50,50,50);

    /* Prevent focus outline on chart elements */
    outline: none;
    
    /* Prevent focus outline on all child elements */
    * {
        outline: none !important;
    }
    
    /* Specifically target SVG elements */
    svg {
        outline: none !important;
    }
    
    /* Target recharts specific elements */
    .recharts-wrapper,
    .recharts-surface,
    .recharts-pie {
        outline: none !important;
    }

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

export default memo(StakingPie)
function StakingPie(props) {
    if (!props?.stakes || props?.stakes.length === 0) return <></>

    return <StakingPieChart {...props}/>
}
function StakingPieChart({ stakes, showBy = 'Shares', hexUsd = 0, handleShowByToggle, aliases = {} }) {
    const [hovered, setHovered] = useState(false)
    const variables = useRef(null)
    
    const [windowWidth, setWindowWidth] = useState(window.innerWidth)
    const [activeIndex, setActiveIndex] = useState(0)
    
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

    // Create pie chart data grouped by parent address
    const createPieData = () => {
        const parentData = {}
        stakes.forEach(stake => {
            const parent = stake.parent || 'Unknown'
            
            if (!parentData[parent]) {
                parentData[parent] = {
                    parent: parent,
                    tShares: 0,
                    stakedHex: 0,
                    stakeHexYield: 0,
                    effectivePenalty: 0,
                    stakeCount: 0
                }
            }
            
            parentData[parent].tShares += stake.tShares || 0
            parentData[parent].stakedHex += stake.stakedHex || 0
            parentData[parent].stakeHexYield += stake.stakeHexYield || 0
            parentData[parent].effectivePenalty += stake.effectivePenalty || 0
            parentData[parent].stakeCount += 1
        })
        
        // Convert to array and calculate total values
        const pieData = Object.values(parentData).map(item => {
            const totalHex = Math.max(0, item.stakedHex + item.stakeHexYield + item.effectivePenalty)
            const totalUsd = hexUsd * totalHex
            
            return {
                ...item,
                totalHex,
                totalUsd,
                value: showBy === 'Value' ? totalHex : item.tShares
            }
        })
        
        // Sort by the selected value
        const sortedData = pieData.sort((a, b) => b.value - a.value)
        
        // Calculate total for percentage calculation
        const totalValue = sortedData.reduce((sum, item) => sum + item.value, 0)
        
        // Separate large and small segments
        const threshold = 0.02 // 2% threshold
        const largeSegments = []
        const smallSegments = []
        
        sortedData.forEach(item => {
            const percentage = item.value / totalValue
            if (percentage >= threshold) {
                largeSegments.push(item)
            } else {
                smallSegments.push(item)
            }
        })
        
        // Create "Other" category from small segments if any exist
        if (smallSegments.length > 0) {
            const otherCategory = {
                parent: 'Others',
                tShares: smallSegments.reduce((sum, item) => sum + item.tShares, 0),
                stakedHex: smallSegments.reduce((sum, item) => sum + item.stakedHex, 0),
                stakeHexYield: smallSegments.reduce((sum, item) => sum + item.stakeHexYield, 0),
                effectivePenalty: smallSegments.reduce((sum, item) => sum + item.effectivePenalty, 0),
                stakeCount: smallSegments.reduce((sum, item) => sum + item.stakeCount, 0),
                totalHex: smallSegments.reduce((sum, item) => sum + item.totalHex, 0),
                totalUsd: smallSegments.reduce((sum, item) => sum + item.totalUsd, 0),
                value: smallSegments.reduce((sum, item) => sum + item.value, 0)
            }
            
            return [...largeSegments, otherCategory]
        }
        
        return largeSegments
    }

    const chartData = useMemo(() => {
        return createPieData()
    }, [stakes, showBy, hexUsd])

    const CustomTooltipContent = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload
            
            return (
                <CustomTooltip>
                    <div className="label">Wallet: {aliases[data.parent.toLowerCase()] ?? shortenString(data.parent)}</div>
                    <div className="value">T Shares: {fUnit(parseFloat(data.tShares), 2)}</div>
                    <div className="value">Principal: {fUnit(parseFloat(data.stakedHex), 2)}</div>
                    <div className="value">Yield: {fUnit(parseFloat(data.stakeHexYield), 2)}</div>
                    <div className="value">Penalty: {fUnit(parseFloat(data.effectivePenalty), 2)}</div>
                    <div className="value">Total Staked HEX: {fUnit(parseFloat(data.totalHex), 2)}</div>
                    {hexUsd > 0 && (
                        <div className="value">Total USD: ${fUnit(parseFloat(data.totalUsd), 2)}</div>
                    )}
                    <div className="value">Stake Count: {data.stakeCount}</div>
                </CustomTooltip>
            )
        }
        return null
    }

    // Generate colors from gradient based on number of wallets
    const generateGradientColors = (count) => {
        if (count <= 1) return ['#ffdb01']
        
        const gradientStops = [
            { pos: 0, color: '#00ff88' },    // 0%
            // { pos: 30, color: rgbStringToHex('rgb(103, 29, 163)') },  // 30%
            // { pos: 52, color: rgbStringToHex('rgb(179, 31, 31)') },   // 52%
            // { pos: 70, color: rgbStringToHex('rgb(111, 15, 255)') },  // 70%
            { pos: 100, color: rgbStringToHex('rgb(59, 78, 161)') }   // 100%
        ]
        
        const colors = []
        for (let i = 0; i < count; i++) {
            // Use the full gradient range for all segments
            const position = (i / (count - 1)) * 100 // Evenly distribute positions
            
            // Find the two gradient stops to interpolate between
            let startStop = gradientStops[0]
            let endStop = gradientStops[gradientStops.length - 1]
            
            for (let j = 0; j < gradientStops.length - 1; j++) {
                if (position >= gradientStops[j].pos && position <= gradientStops[j + 1].pos) {
                    startStop = gradientStops[j]
                    endStop = gradientStops[j + 1]
                    break
                }
            }
            
            // Interpolate between the two colors
            const ratio = (position - startStop.pos) / (endStop.pos - startStop.pos)
            const color = interpolateColor(startStop.color, endStop.color, ratio)
            colors.push(color)
        }
        
        return colors
    }
    
    // Helper function to interpolate between two hex colors
    const interpolateColor = (color1, color2, ratio) => {
        const r1 = parseInt(color1.slice(1, 3), 16)
        const g1 = parseInt(color1.slice(3, 5), 16)
        const b1 = parseInt(color1.slice(5, 7), 16)
        
        const r2 = parseInt(color2.slice(1, 3), 16)
        const g2 = parseInt(color2.slice(3, 5), 16)
        const b2 = parseInt(color2.slice(5, 7), 16)
        
        const r = Math.round(r1 + (r2 - r1) * ratio)
        const g = Math.round(g1 + (g2 - g1) * ratio)
        const b = Math.round(b1 + (b2 - b1) * ratio)
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }
    
    const getColor = (index) => {
        if (chartData.length === 1) return '#00ff88'
        const colors = generateGradientColors(chartData.length)
        return colors[index] || colors[0]
    }

    // Calculate combined totals for all stakes
    const getCombinedTotals = () => {
        const combined = chartData.reduce((acc, item) => {
            acc.tShares += item.tShares || 0
            acc.stakedHex += item.stakedHex || 0
            acc.stakeHexYield += item.stakeHexYield || 0
            acc.effectivePenalty += item.effectivePenalty || 0
            acc.totalHex += item.totalHex || 0
            acc.totalUsd += item.totalUsd || 0
            acc.value += item.value || 0
            acc.stakeCount += item.stakeCount || 0
            return acc
        }, {
            tShares: 0,
            stakedHex: 0,
            stakeHexYield: 0,
            effectivePenalty: 0,
            totalHex: 0,
            totalUsd: 0,
            value: 0,
            stakeCount: 0
        })
        return combined
    }

    const activeShape = useMemo(() => {
        return renderActiveShape
    }, [stakes, showBy, hexUsd, activeIndex, hovered])

    function renderActiveShape (props) {
        const RADIAN = Math.PI / 180;
        const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
        const sin = Math.sin(-RADIAN * midAngle);
        const cos = Math.cos(-RADIAN * midAngle);
        const sx = cx + (outerRadius + 10) * cos;
        const sy = cy + (outerRadius + 10) * sin;
        const mx = cx + (outerRadius + 30) * cos;
        const my = cy + (outerRadius + 30) * sin;
        const ex = mx + (cos >= 0 ? 1 : -1) * 22;
        const ey = my;
        const textAnchor = cos >= 0 ? 'start' : 'end';

        variables.current = props

        const displayData = payload;
        const displayValue = value;
        const displayPercent = percent; 

        if(windowWidth < 650) {
            return (
                <g>
                <text x={cx} y={cy} dy={-18} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
                    {aliases?.[payload?.parent?.toLowerCase() ?? ''] ? shortenString(aliases[payload.parent.toLowerCase()], 10, true) : shortenString(payload.parent)}
                </text>
                {/* <text x={cx} y={cy} dy={-0} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
                    {payload.stakeCount} Stakes
                </text> */}
                {showBy === 'Value' && <text x={cx} y={cy} dy={16} textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">
                    {`$${fUnit(parseFloat(displayData.totalUsd), 2)}`}
                </text>}
                {showBy !== 'Value' && <text x={cx} y={cy} dy={10} textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">
                    {`${fUnit(parseFloat(displayData.tShares), 2)}`}
                </text>}
                {showBy !== 'Value' && <text x={cx} y={cy} dy={32} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
                    T-Shares
                </text>}
                <Sector
                    cx={cx}
                    cy={cy}
                    innerRadius={innerRadius}
                    outerRadius={outerRadius}
                    startAngle={startAngle}
                    endAngle={endAngle}
                    fill={fill}
                />
                <Sector
                    cx={cx}
                    cy={cy}
                    startAngle={startAngle}
                    endAngle={endAngle}
                    innerRadius={outerRadius + 6}
                    outerRadius={outerRadius + 10}
                    fill={fill}
                />
            </g>
            )
        }
        

        return (
            <g>
                <text x={cx} y={cy} dy={-18} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
                    {aliases?.[payload?.parent?.toLowerCase() ?? ''] ? shortenString(aliases[payload.parent.toLowerCase()], 10, true) : shortenString(payload.parent)}
                </text>
                {/* <text x={cx} y={cy} dy={-0} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
                    {payload.stakeCount} Stakes
                </text> */}
                {showBy === 'Value' && <text x={cx} y={cy} dy={16} textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">
                    {`$${fUnit(parseFloat(displayData.totalUsd), 2)}`}
                </text>}
                {showBy !== 'Value' && <text x={cx} y={cy} dy={10} textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">
                    {`${fUnit(parseFloat(displayData.tShares), 2)}`}
                </text>}
                {showBy !== 'Value' && <text x={cx} y={cy} dy={32} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
                    T-Shares
                </text>}
                <Sector
                    cx={cx}
                    cy={cy}
                    innerRadius={innerRadius}
                    outerRadius={outerRadius}
                    startAngle={startAngle}
                    endAngle={endAngle}
                    fill={fill}
                />
                <Sector
                    cx={cx}
                    cy={cy}
                    startAngle={startAngle}
                    endAngle={endAngle}
                    innerRadius={outerRadius + 6}
                    outerRadius={outerRadius + 10}
                    fill={fill}
                />
                <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={2} />
                <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
                <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="white" fontSize="12">
                    {`${fUnit(displayValue, 2)}`} {(showBy === 'Value' ? 'HEX' : 'T-Shares')}
                </text>
                {showBy !== 'Value' && displayData?.totalUsd && <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#ccc" fontSize="12">
                    $ {fUnit(parseFloat(displayData.totalUsd), 2)} {activeIndex === 0 ? '' : `(${(displayPercent * 100).toFixed(1)}%)`}
                </text>}
                {showBy === 'Value' && <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#ccc" fontSize="12">
                    {fUnit(parseFloat(displayData.tShares), 2)} T-Shares {activeIndex === 0 ? '' : `(${(displayPercent * 100).toFixed(1)}%)`}
                </text>}

                {!displayData?.totalUsd && <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18 * 2} textAnchor={textAnchor} fill="#ccc" fontSize="10">
                    {activeIndex === 0 ? '' : `(${(displayPercent * 100).toFixed(1)}%)`}
                </text>}
            </g>
        );
    };

    const displayCombined = useMemo(() => getCombinedTotals(), [stakes])
    return (
        <ChartContainer>
            <h3 style={{ margin: '0 0 10px 0', textAlign: 'center' }}>
                {/* Staking Distribution */}
                {/* <div style={{ display: 'inline-block', margin: '0 10px' }}>
                    <Button style={{ width: 100, fontSize: 14, margin: 'auto' }} textAlign="center" onClick={handleShowByToggle}>
                        By {showBy}
                    </Button> 
                </div> */}
                TOTAL:
                <div style={{ display: 'inline-block', margin: '0 10px' }}>
                    {`$${fUnit(parseFloat(displayCombined.totalUsd), 1)}`}
                </div>
                <div style={{ display: 'inline-block', margin: '0 10px' }}>
                    {`${fUnit(parseFloat(displayCombined.totalHex), 1)}`} <Icon icon={icons_list.hex} size={16}/>
                </div>
                <div style={{ display: 'inline-block', margin: '0 10px' }}>
                    {`${fUnit(parseFloat(displayCombined.tShares), 0)}`} T-Shares
                </div>
                {/* {showBy === 'Value' ? ' by Value' : ' by Shares'} */}
                <div style={{ textAlign: 'center'}}>
                    <Button style={{ fontSize: 12, width: 100, margin: 'auto', marginTop: 10 }} textAlign="center" onClick={handleShowByToggle}>
                        {showBy}
                    </Button>
                </div>
            </h3>
            <div style={{ width: '100%', height: 220, marginTop: -20 }}>
                <PieChart width={windowWidth <= 650 ? Math.max(300, windowWidth - 100) : 560} height={220}>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        minAngle={3}
                        activeIndex={activeIndex}
                        activeShape={activeShape}
                        onMouseEnter={(_, index) => {
                            setActiveIndex(index)
                            setHovered(true)
                        }}
                        onMouseLeave={() => {
                            setActiveIndex(0)
                            setHovered(false)
                        }}
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getColor(index)} />
                        ))}
                    </Pie>
                    {/* {inactiveShape} */}
                    {/* <Tooltip content={<CustomTooltipContent />} /> */}
                    <Legend 
                        layout="vertical" 
                        verticalAlign="middle" 
                        align="right"
                        wrapperStyle={{ color: 'white', fontSize: '12px' }}
                        formatter={(value, entry) => {
                            if (!entry || !entry?.payload?.parent) return 'Unknown'
                            return `${aliases[entry?.payload?.parent.toLowerCase()] ? shortenString(aliases[entry?.payload?.parent.toLowerCase()], 10, true) : shortenString(entry?.payload?.parent)}`
                        }}
                    />
                </PieChart>
            </div>
        </ChartContainer>
    )
}