import React, { memo, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { countLeadingZerosAfterDecimal, fUnit, getNumberAfterLeadingZeros } from '../lib/numbers'

const ChartWrapper = styled.div`
    position: relative;
    width: 100%;
    height: 100%;
    color: white;
    font-family: inherit;

    canvas {
        background: rgba(20,20,20,0.5);
        border-radius: 8px;
        width: 100%;
        height: 100%;
    }

    .tooltip {
        position: absolute;
        background: rgba(0,0,0,0.8);
        padding: 8px;
        border-radius: 4px;
        font-size: 12px;
        font-family: inherit;
        pointer-events: none;
        transform: translate(-50%, -150%);
        z-index: 100;
        white-space: nowrap;
        border: 1px solid rgba(255,255,255,0.1);
    }

    .vertical-line {
        position: absolute;
        top: 20px;
        bottom: 30px;
        width: 1px;
        border-left: 1px dashed rgba(255,255,255,0.5);
        pointer-events: none;
        z-index: 90;
    }

    .y-axis {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 20px;
        width: 80px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        font-size: 12px;
        font-family: inherit;
        padding: 10px 0;

        div {
            padding-right: 10px;
            padding-left: 5px;
            text-align: left;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    }

    .x-axis {
        position: absolute;
        left: 80px;
        right: 10px;
        bottom: 0;
        height: 20px;
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        font-family: inherit;
    }
`

export default memo(BasicChart)
function BasicChart({ 
    data = [], 
    xKey = 'timestamp', 
    yKey = 'price',
    width = 800,
    height = 400,
    lineColor = '#00ff00',
    gridColor = 'rgba(255,255,255,0.1)',
    xAxisLabel,
    yAxisLabel,
    xInterval = 6,
    yInterval = 5,
    showDataLabels = false,
    dataLabelInterval = 10,
    unit = 'USD'
}) {
    const canvasRef = useRef(null)
    const animationRef = useRef(null)
    const [tooltipData, setTooltipData] = useState({ show: false, x: 0, y: 0, data: null })
    const [animationProgress, setAnimationProgress] = useState(0)
    const [pingRadius, setPingRadius] = useState(0)
    const [mouseX, setMouseX] = useState(null)

    // Mouse move handler for tooltips
    const handleMouseMove = (e) => {
        if (!canvasRef.current || !data.length) return

        const rect = canvasRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        const margin = { top: 20, right: 20, bottom: 30, left: 80 }
        const chartWidth = width - margin.left - margin.right
        
        // Keep x position within chart bounds
        const boundedX = Math.max(margin.left, Math.min(x, width - margin.right))
        setMouseX(boundedX)

        const xScale = (val) => {
            const xMin = data[0][xKey]
            const xMax = data[data.length - 1][xKey]
            return margin.left + ((val - xMin) / (xMax - xMin)) * chartWidth
        }

        const yScale = (val) => {
            const yValues = data.map(d => d[yKey])
            const minY = Math.min(...yValues)
            const maxY = Math.max(...yValues)
            const yRange = maxY - minY
            const chartHeight = height - margin.top - margin.bottom
            return height - margin.bottom - ((val - minY) / yRange) * chartHeight
        }

        // Find closest data point to mouse x position
        const closest = data.reduce((prev, curr) => {
            const prevX = xScale(prev[xKey])
            const currX = xScale(curr[xKey])
            return Math.abs(currX - boundedX) < Math.abs(prevX - boundedX) ? curr : prev
        })

        setTooltipData({
            show: true,
            x: boundedX,
            y: yScale(closest[yKey]),
            data: closest
        })
    }

    const handleMouseLeave = () => {
        setTooltipData({ show: false, x: 0, y: 0, data: null })
        setMouseX(null)
    }

    // Animation function
    const animate = (timestamp) => {
        if (!animationRef.current) {
            animationRef.current = timestamp
        }

        const progress = Math.min((timestamp - animationRef.current) / 1000, 1)
        setAnimationProgress(progress)

        if (progress < 1) {
            requestAnimationFrame(animate)
        } else {
            // Start ping animation
            animatePing()
        }
    }

    const animatePing = () => {
        const pingAnimation = (timestamp) => {
            const radius = (timestamp % 1000) / 1000 * 10
            setPingRadius(radius)
            requestAnimationFrame(pingAnimation)
        }
        requestAnimationFrame(pingAnimation)
    }

    useEffect(() => {
        if (!data.length || !canvasRef.current) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        
        canvas.width = width
        canvas.height = height
        ctx.clearRect(0, 0, width, height)

        const margin = { 
            top: 20, 
            right: 20, 
            bottom: 30, 
            left: 80
        }
        const chartWidth = width - margin.left - margin.right
        const chartHeight = height - margin.top - margin.bottom

        // Get min/max values
        const yValues = data.map(d => d[yKey])
        const minY = Math.min(...yValues)
        const maxY = Math.max(...yValues)
        const yRange = maxY === minY ? maxY * 0.1 : maxY - minY

        // Scale functions
        const scaleX = (x) => {
            const xMin = data[0][xKey]
            const xMax = data[data.length - 1][xKey]
            return margin.left + ((x - xMin) / (xMax - xMin)) * chartWidth
        }

        const scaleY = (y) => {
            if (maxY === minY) {
                const midPoint = height / 2
                return midPoint
            }
            return height - margin.bottom - ((y - minY) / yRange) * chartHeight
        }

        // Draw grid
        ctx.beginPath()
        ctx.strokeStyle = gridColor

        // Vertical grid lines
        for (let i = 0; i < data.length; i += xInterval) {
            const x = scaleX(data[i][xKey])
            ctx.moveTo(x, margin.top)
            ctx.lineTo(x, height - margin.bottom)
        }

        // Horizontal grid lines
        const yStep = yRange / yInterval
        for (let i = 0; i <= yInterval; i++) {
            const y = scaleY(minY + (i * yStep))
            ctx.moveTo(margin.left, y)
            ctx.lineTo(width - margin.right, y)
        }
        ctx.stroke()

        // Draw animated line
        ctx.beginPath()
        ctx.strokeStyle = lineColor
        ctx.lineWidth = 2

        const animatedLength = Math.floor(data.length * animationProgress)
        data.slice(0, animatedLength).forEach((point, i) => {
            const x = scaleX(point[xKey])
            const y = scaleY(point[yKey])
            if (i === 0) {
                ctx.moveTo(x, y)
            } else {
                ctx.lineTo(x, y)
            }
        })
        ctx.stroke()

        // Draw ping at end if animation complete
        if (animationProgress === 1 && data.length > 0) {
            const lastPoint = data[data.length - 1]
            const x = scaleX(lastPoint[xKey])
            const y = scaleY(lastPoint[yKey])

            ctx.beginPath()
            ctx.strokeStyle = `rgba(0, 255, 0, ${1 - (pingRadius / 10)})`
            ctx.arc(x, y, pingRadius * 5, 0, Math.PI * 2)
            ctx.stroke()
        }

        // Draw data labels if enabled
        if (showDataLabels && animationProgress === 1) {
            ctx.fillStyle = 'white'
            ctx.font = '10px Arial'
            data.forEach((point, i) => {
                if (i % dataLabelInterval === 0) {
                    const x = scaleX(point[xKey])
                    const y = scaleY(point[yKey].price)
                    ctx.fillText(formatPrice(point[yKey]), x, y - 5)
                }
            })
        }

        // Draw axes
        ctx.beginPath()
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 1
        // Y axis
        ctx.moveTo(margin.left, margin.top)
        ctx.lineTo(margin.left, height - margin.bottom)
        // X axis
        ctx.moveTo(margin.left, height - margin.bottom)
        ctx.lineTo(width - margin.right, height - margin.bottom)
        ctx.stroke()

    }, [data, width, height, xKey, yKey, animationProgress, pingRadius])

    // Start animation when data changes
    useEffect(() => {
        if (data.length) {
            animationRef.current = null
            setAnimationProgress(0)
            requestAnimationFrame(animate)
        }
    }, [data])

    // Format timestamp for x-axis labels
    const formatTime = (timestamp) => {
        const date = new Date(timestamp)
        return date.toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: '2-digit'
        })
    }

    // Format price for y-axis labels
    const formatPrice = (priceObj) => {
        // Price comes in as { price: number, priceInverted: number }
        const price = typeof priceObj === 'object' ? priceObj.price : priceObj

        if (isNaN(Number(price))) return price

        if (Number(price) > 0.98) return parseFloat(price).toFixed(2)
        if (Number(price) > 0.001) return parseFloat(price).toFixed(6)
        
        const leadingZeros = countLeadingZerosAfterDecimal(parseFloat(price).toFixed(10))
        const numberAfterZeros = getNumberAfterLeadingZeros(parseFloat(price).toFixed(10), 4)
        return <>0.0<sub>{leadingZeros}</sub>{numberAfterZeros}</>
    }

    // Calculate y-axis labels
    const yLabels = []
    if (data.length) {
        const yValues = data.map(d => d[yKey])
        const minY = Math.min(...yValues)
        const maxY = Math.max(...yValues)
        const yRange = maxY - minY
        const yStep = yRange / yInterval
        
        for (let i = 0; i <= yInterval; i++) {
            const formattedPrice = formatPrice(minY + (i * yStep))
            yLabels.push(
                formattedPrice > 1000 ? fUnit(formattedPrice, 2) : formattedPrice
            )
            // yLabels.push(formatPrice(minY + (i * yStep)))
            // d[yKey] > 1000 ? fUnit(d[yKey], 2) : 0
        }
    }

    // Calculate x-axis labels
    const xLabels = data
        .filter((_, i) => i % xInterval === 0)
        .map(d => formatTime(d[xKey]))

    return (
        <ChartWrapper
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <canvas ref={canvasRef} width={width} height={height} />
            {mouseX !== null && (
                <div 
                    className="vertical-line" 
                    style={{ left: mouseX }}
                />
            )}
            {tooltipData.show && tooltipData.data && (
                <div 
                    className="tooltip" 
                    style={{ 
                        left: tooltipData.x,
                        top: tooltipData.y - 20
                    }}
                >
                    <div>Date: {formatTime(tooltipData.data[xKey])}</div>
                    <div>Price: {unit === 'USD' ? '$ ' : ''}{formatPrice(tooltipData.data[yKey])}{unit !== 'USD' ? ` ${unit}` : ''}</div>
                </div>
            )}
            <div className="y-axis">
                {yLabels.reverse().map((label, i) => (
                    <div key={i}>{label}</div>
                ))}
                {yAxisLabel && <div className="axis-label">{yAxisLabel}</div>}
            </div>
            <div className="x-axis">
                {xLabels.map((label, i) => (
                    <div key={i}>{label}</div>
                ))}
                {xAxisLabel && <div className="axis-label">{xAxisLabel}</div>}
            </div>
        </ChartWrapper>
    )
} 