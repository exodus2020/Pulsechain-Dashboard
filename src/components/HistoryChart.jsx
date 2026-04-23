// HistoryChart.jsx
import { memo, useMemo, useState } from "react"
import BasicChart from "./BasicChart"
import Button from "./Button"
import LoadingWave from "./LoadingWave"
import { calculateScaledResultForChart } from "../lib/numbers"
import styled from "styled-components"
import { Selector } from "./Selector"
import { appSettingsAtom } from "../store"
import { useAtom } from "jotai"
// import { calculatePercentages } from "./PricesComponent"

const PercentChange = styled.div`
    font-weight: 600;
    display: inline-block;
    color: ${props => props.color};
    padding: 0 10px;

`

export default memo(HistoryChart)
function HistoryChart({ historyData, pairAddress, pairInfo, tokenAddress, bestStable }) {
    const { history, dailyCandles, getHistory, getChartHistory, fetchDailyCandles, fetchMore, isLoading, isError, progress, chartKeyPoints } = historyData
    const [ selected, setSelected ] = useState('USD')
    
    const stableLpAddress = bestStable?.pair
    const wplsHistory = dailyCandles?.[stableLpAddress] ?? []
    const pairDailyCandles = dailyCandles?.[pairAddress] ?? []
    const invert = bestStable?.invert ? true : false
    
    const isToken0Wpls = pairInfo?.token0?.id == '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
    const isWpls = tokenAddress == '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
    const isStable = ["0xefd766ccb38eaf1dfd701853bfce31359239f305","0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07","0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f"].includes(tokenAddress.toLowerCase())
    const invertReserves = isWpls ? false : pairInfo?.invertReserves === true ? true : false

    const pairHistoryData = chartKeyPoints?.[pairAddress] ?? history?.[pairAddress] ?? []

    const chartData = isWpls
        ? wplsHistory
        : (pairDailyCandles.length > 0 ? pairDailyCandles : pairHistoryData)
    const dataExists = chartData.length > 0
    const [settings] = useAtom(appSettingsAtom)

    const getClosestWplsUsdPrice = (timestamp) => {
        if (!Array.isArray(wplsHistory) || wplsHistory.length === 0) return null

        let closest = wplsHistory[0]
        let smallestDiff = Math.abs((wplsHistory[0]?.timestamp ?? 0) - timestamp)

        for (let i = 1; i < wplsHistory.length; i++) {
            const diff = Math.abs((wplsHistory[i]?.timestamp ?? 0) - timestamp)
            if (diff < smallestDiff) {
                smallestDiff = diff
                closest = wplsHistory[i]
            }
        }

        const value = Number(closest?.close ?? closest?.price ?? 0)
        return Number.isFinite(value) && value > 0 ? value : null
    }

    const handleLoadPriceChart = () => {
        if (isLoading || dataExists) return

        if (isWpls) {
            if (!stableLpAddress) return
            fetchDailyCandles(stableLpAddress)
            return
        }

        if (!pairAddress) return
        getHistory(pairAddress, true, settings)
    }

    const { formattedChartData, formattedPercentageChange } = useMemo(() => {
        const percChange = [...(chartKeyPoints?.[pairAddress] ?? [])].sort((a, b) => b.timestamp - a.timestamp)

        if (!dataExists || !chartData) {
            return {
                formattedChartData: [],
                formattedPercentageChange: percChange
            }
        }

        return {
            formattedChartData: chartData.map((item) => {
                try {
                    if (!item) return null

                    let priceToUse = 0

                    if (isWpls) {
                        priceToUse = selected === 'WPLS'
                            ? 1
                            : Number(item.close ?? item.price ?? 0)
                    } else if (pairDailyCandles.length > 0) {
                        const tokenUsd = Number(item.close ?? item.price ?? 0)

                        if (selected === 'USD') {
                            priceToUse = tokenUsd
                        } else {
                            const wplsUsd = getClosestWplsUsdPrice(item.timestamp)
                            priceToUse = wplsUsd && wplsUsd > 0 ? tokenUsd / wplsUsd : 0
                        }
                    } else {
                        priceToUse = Number(invertReserves ? (item.priceInverted ?? 0) : (item.price ?? 0))
                    }

                    if (!priceToUse || isNaN(priceToUse) || !isFinite(priceToUse)) return null

                    const priceDecimals = priceToUse < 0.0000001 ? 14 : 8

                    return {
                        ...item,
                        price: parseFloat(priceToUse).toFixed(priceDecimals)
                    }
                } catch (error) {
                    console.warn('Error processing chart data point:', error)
                    return null
                }
            }).filter(item => item !== null),
            formattedPercentageChange: percChange
        }
    }, [chartData, selected, chartKeyPoints, pairAddress, isWpls, invertReserves, pairDailyCandles.length, wplsHistory.length])

    const plsHistory = chartKeyPoints?.[bestStable?.pair] ?? []
    // const historyProperty = invert ? 'priceInverted' : 'price'

    // const plsLastPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - 1][historyProperty] : 0
    // const plsLastHourPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - 2][historyProperty] : 0
    // const plsLastSixHourPrice = plsHistory && plsHistory.length > 2 ? plsHistory[plsHistory.length - 3][historyProperty] : 0
    // const plsLastDayPrice = plsHistory && plsHistory.length > 3 ? plsHistory[plsHistory.length - 4][historyProperty] : 0
    // const plsSevenDayPrice = plsHistory && plsHistory.length > 4 ? plsHistory[plsHistory.length - 5][historyProperty] : 0
    // const plsAllTimeLowPrice = 0.000009536

    // const priceComparison = {
    //     plsLastDayPrice,
    //     plsSevenDayPrice,
    //     plsLastHourPrice,
    //     plsLastPrice,
    //     plsLastSixHourPrice,
    //     plsAllTimeLowPrice
    // }

    // const current = formattedPercentageChange?.[0]?.price ?? NaN
    // const h1 = formattedPercentageChange?.[1]?.price ?? NaN
    // const h6 = formattedPercentageChange?.[2]?.price ?? NaN
    // const d1 = formattedPercentageChange?.[3]?.price ?? NaN
    // const d7 = formattedPercentageChange?.[4]?.price ?? NaN

    // Disabled for now while stabilizing chart rendering.
    // const test = calculatePercentages(pairInfo, plsHistory, chartKeyPoints?.[pairAddress] ?? [], bestStable, isWpls)
    // const percentchanges = test?.[selected.toLowerCase()]?.token

    // const h1Percentage = percentchanges?.h1 ? (percentchanges?.h1?.percentChangeRaw ?? NaN) : NaN
    // const h6Percentage = percentchanges?.h6 ? (percentchanges?.h6?.percentChangeRaw ?? NaN) : NaN
    // const d1Percentage = percentchanges?.d1 ? (percentchanges?.d1?.percentChangeRaw ?? NaN) : NaN
    // const d7Percentage = percentchanges?.d7 ? (percentchanges?.d7?.percentChangeRaw ?? NaN) : NaN

    return (
        <div style={{ position: 'relative', paddingBottom: 35 }}>
            <div style={{ position: 'absolute', top: -20, right: 10, zIndex: 50 }}>
                <Selector options={['WPLS', 'USD']} value={selected} onChange={setSelected}/>
            </div>
            <BasicChart 
                data={formattedChartData}
                xKey="timestamp"
                yKey="price"
                width={700}
                height={400}
                lineColor="#00ff00"
                xInterval={Math.max(1, Number(2 * (calculateScaledResultForChart(chartData.length) ?? 5)) || 1)}
                yInterval={5}
                showDataLabels={false}
                dataLabelInterval={10}
                unit={isToken0Wpls || selected === 'USD' ? 'USD' : 'WPLS'}
            />
            {/* <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '40px', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                {!isWpls && !isStable && formattedPercentageChange.length > 1 ? <div style={{ position: 'absolute', width: '100%', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', display: 'flex', justifyContent: 'space-between' }}>
                    {formattedPercentageChange.length > 1 && !isNaN(h1Percentage) ? <PercentChange>
                        H1: {h1Percentage.toFixed(2)}%
                    </PercentChange> : ''}
                    {formattedPercentageChange.length > 1 && !isNaN(h6Percentage) ? <PercentChange>
                        H6: {h6Percentage.toFixed(2)}%
                    </PercentChange> : ''}
                    {formattedPercentageChange.length > 2 && !isNaN(d1Percentage) ? <PercentChange>
                        1D: {d1Percentage.toFixed(2)}%
                    </PercentChange> : ''}
                    {formattedPercentageChange.length > 3 && !isNaN(d7Percentage) ? <PercentChange>
                        7D: {d7Percentage.toFixed(2)}%
                    </PercentChange> : ''}
                </div> : ''}
            </div> */}
            {!dataExists ? <div style={{ width: 200, position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                <Button textAlign={'center'} onClick={handleLoadPriceChart}>
                    {isLoading ? <LoadingWave numDots={5} speed={100}/> : 'Load Price Chart'}
                </Button>
            </div> : ''}
        </div>
    )
}