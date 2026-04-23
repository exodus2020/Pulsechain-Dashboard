// BasicChart.jsx
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
    const drawFrameRef = useRef(null)
    const pingFrameRef = useRef(null)
    const [tooltipData, setTooltipData] = useState({ show: false, x: 0, y: 0, data: null })
    const [animationProgress, setAnimationProgress] = useState(0)
    const [pingRadius, setPingRadius] = useState(0)
    const [mouseX, setMouseX] = useState(null)

    // Mouse move handler for tooltips
    const handleMouseMove = (e) => {
        if (!canvasRef.current || !data.length) return

        const rect = canvasRef.current.getBoundingClientRect()
        const displayWidth = rect.width || width
        const displayHeight = rect.height || height

        const x = e.clientX - rect.left

        const margin = { top: 20, right: 20, bottom: 30, left: 80 }
        const chartWidth = displayWidth - margin.left - margin.right
        const chartHeight = displayHeight - margin.top - margin.bottom

        const boundedX = Math.max(margin.left, Math.min(x, displayWidth - margin.right))
        setMouseX(boundedX)

        const xMin = data[0][xKey]
        const xMax = data[data.length - 1][xKey]
        const xRange = Math.max(1, xMax - xMin)

        const xScale = (val) => {
            return margin.left + ((val - xMin) / xRange) * chartWidth
        }

        const yValues = data
            .map(d => Number(d[yKey]))
            .filter(val => !isNaN(val) && isFinite(val))

        if (!yValues.length) return

        const minY = Math.min(...yValues)
        const maxY = Math.max(...yValues)

        const yScale = (val) => {
            const numericVal = Number(val)

            if (!isFinite(numericVal)) {
                return displayHeight - margin.bottom
            }

            if (maxY === minY) {
                return margin.top + (chartHeight / 2)
            }

            const yPadding = (maxY - minY) * 0.1
            const yRange = (maxY - minY) + yPadding

            return displayHeight - margin.bottom - ((numericVal - minY) / yRange) * chartHeight
        }

        const closest = data.reduce((prev, curr) => {
            const prevX = xScale(prev[xKey])
            const currX = xScale(curr[xKey])
            return Math.abs(currX - boundedX) < Math.abs(prevX - boundedX) ? curr : prev
        })

        const snappedX = xScale(closest[xKey])
        const snappedY = yScale(closest[yKey])

        setMouseX(snappedX)

        setTooltipData({
            show: true,
            x: snappedX,
            y: isFinite(snappedY) ? snappedY : (margin.top + chartHeight / 2),
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
            drawFrameRef.current = requestAnimationFrame(animate)
        } else {
            animatePing()
        }
    }

    const animatePing = () => {
        if (pingFrameRef.current) {
            cancelAnimationFrame(pingFrameRef.current)
        }

        const pingAnimation = (timestamp) => {
            const radius = (timestamp % 1000) / 1000 * 10
            setPingRadius(radius)
            pingFrameRef.current = requestAnimationFrame(pingAnimation)
        }

        pingFrameRef.current = requestAnimationFrame(pingAnimation)
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

        // Get min/max values with safety checks
        const yValues = data.map(d => Number(d[yKey])).filter(val => !isNaN(val) && isFinite(val))
        if (yValues.length === 0) return  // Exit if no valid values

        const minY = Math.min(...yValues)
        const maxY = Math.max(...yValues)
        // Add padding to range to prevent flat line
        const yPadding = (maxY - minY) * 0.1
        const yRange = maxY === minY ? maxY : (maxY - minY) + yPadding

        // Scale functions with safety checks
        const scaleX = (x) => {
            try {
                const xMin = data[0][xKey]
                const xMax = data[data.length - 1][xKey]
                // If timespan is less than an hour, adjust the scale
                const timeSpan = xMax - xMin
                const hourInMs = 3600000
                const scaleFactor = timeSpan < hourInMs ? hourInMs / timeSpan : 1
                return margin.left + ((x - xMin) / ((xMax - xMin) * scaleFactor)) * chartWidth
            } catch (error) {
                console.warn('Error in scaleX:', error)
                return margin.left
            }
        }

        const scaleY = (y) => {
            try {
                if (maxY === minY) {
                    // If all values are the same, create artificial range
                    const midPoint = height / 2
                    const range = maxY * 0.1 // 10% of the value
                    return midPoint + ((y - maxY) / range) * (chartHeight / 2)
                }
                return height - margin.bottom - ((y - minY) / yRange) * chartHeight
            } catch (error) {
                console.warn('Error in scaleY:', error)
                return height - margin.bottom
            }
        }

        // Draw grid with safety checks
        ctx.beginPath()
        ctx.strokeStyle = gridColor

        // Adjust x interval based on data range
        const timeSpan = data[data.length - 1][xKey] - data[0][xKey]
        const hourInMs = 3600000
        const adjustedXInterval = timeSpan < hourInMs * 24
            ? Math.max(1, Math.floor(data.length / 6))
            : Math.max(1, Number(xInterval) || 1)

        // Vertical grid lines
        for (let i = 0; i < data.length; i += adjustedXInterval) {
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

        // Draw animated line with safety checks
        ctx.beginPath()
        ctx.strokeStyle = lineColor
        ctx.lineWidth = 2

        const animatedLength = data.length
        let hasStarted = false

        data.slice(0, animatedLength).forEach((point, i) => {
            try {
                const x = scaleX(point[xKey])
                const y = scaleY(point[yKey])
                
                if (isNaN(x) || isNaN(y)) return
                
                if (!hasStarted) {
                    ctx.moveTo(x, y)
                    hasStarted = true
                } else {
                    ctx.lineTo(x, y)
                }
            } catch (error) {
                console.warn('Error drawing line segment:', error)
            }
        })
        ctx.stroke()

        // Ping animation disabled while stabilizing renderer

        // Data labels disabled while stabilizing renderer

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

    // Animation disabled while stabilizing renderer
    useEffect(() => {
        if (drawFrameRef.current) {
            cancelAnimationFrame(drawFrameRef.current)
            drawFrameRef.current = null
        }

        if (pingFrameRef.current) {
            cancelAnimationFrame(pingFrameRef.current)
            pingFrameRef.current = null
        }

        animationRef.current = null
        setAnimationProgress(1)
        setPingRadius(0)

        return () => {
            if (drawFrameRef.current) {
                cancelAnimationFrame(drawFrameRef.current)
                drawFrameRef.current = null
            }

            if (pingFrameRef.current) {
                cancelAnimationFrame(pingFrameRef.current)
                pingFrameRef.current = null
            }
        }
    }, [data])

        useEffect(() => {
        return () => {
            if (drawFrameRef.current) {
                cancelAnimationFrame(drawFrameRef.current)
            }
            if (pingFrameRef.current) {
                cancelAnimationFrame(pingFrameRef.current)
            }
        }
    }, [])

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
                        top: Number.isFinite(tooltipData.y) ? tooltipData.y - 20 : 40
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