import { memo, useMemo, useState } from "react"
import BasicChart from "./BasicChart"
import Button from "./Button"
import LoadingWave from "./LoadingWave"
import { calculateScaledResultForChart } from "../lib/numbers"
import styled from "styled-components"
import { Selector } from "./Selector"

const PercentChange = styled.div`
    font-weight: 600;
    display: inline-block;
    color: ${props => props.color};
    padding: 0 10px;

`

export default memo(HistoryChart)
function HistoryChart({ historyData, pairAddress, pairInfo, tokenAddress, bestStable }) { //, invert = false }) {
    const { history, getHistory, fetchMore, isLoading, isError, progress } = historyData
    const [ selected, setSelected ] = useState('WPLS')
    
    const stableLpAddress = bestStable?.pair
    const wplsHistory = history?.[stableLpAddress] ?? []
    const invert = bestStable?.invert ? true : false
    
    const isToken0Wpls = pairInfo?.token0?.id == '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
    const isWpls = tokenAddress == '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
    const invertReserves = isWpls ? false : pairInfo?.invertReserves === true ? true : false

    const token0Decimals = Number(pairInfo?.token0?.decimals ?? 18)
    const token1Decimals = Number(pairInfo?.token1?.decimals ?? 18)
    const tokenDecimals = isToken0Wpls ? 
        (invertReserves ? token0Decimals : token1Decimals) : 
        (invertReserves ? token1Decimals : token0Decimals)
    
    const decimals = tokenDecimals

    const chartData = history?.[pairAddress] ?? []
    const dataExists = chartData.length > 0

    const handleLoadPriceChart = () => {
        if(isLoading || dataExists || !pairAddress) return
        getHistory(pairAddress)
    }

    const formattedChartData = useMemo(() => {
        if (!dataExists) return []

        const getWplsPrice = (i) => invert ? (wplsHistory?.[i]?.priceInverted ?? 1) : (wplsHistory?.[i]?.price ?? 1)

        return chartData.map((item, i) => {
            const itemPrice = invertReserves ? item.priceInverted : item.price 
            const priceToUse = isWpls && selected === "WPLS" ? 1 : 
                             Number(itemPrice ?? 0) * (selected === "USD" && !isWpls ? getWplsPrice(i) : 1)
            const priceDemicals = priceToUse < 0.0000001 ? 14 : priceToUse < 10 ? 8 : 8

            return ({
                ...item,
                price: parseFloat(priceToUse).toFixed(priceDemicals)
            })
        })
    }, [chartData, selected, wplsHistory])

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
                xInterval={2 * calculateScaledResultForChart(chartData.length) ?? 10}
                yInterval={5}
                showDataLabels={true}
                dataLabelInterval={10}
                unit={isToken0Wpls || selected === 'USD' ? 'USD' : 'WPLS'}
            />
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '40px', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                {chartData.length > 0 ? <div style={{ position: 'absolute', width: '100%', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', display: 'flex', justifyContent: 'space-between' }}>
                    <PercentChange>
                        H1: {chartData.length - 2 > 0 ? parseFloat((chartData[chartData.length - 1]?.price / chartData[chartData.length - 2]?.price) * 100 - 100).toFixed(2) : ''}%
                    </PercentChange>
                    {chartData.length - 6 > 0 ? <PercentChange>
                        H6: {chartData.length - 6 > 0 ? parseFloat((chartData[chartData.length - 1]?.price / chartData[chartData.length - 6]?.price) * 100 - 100).toFixed(2) : ''}%
                    </PercentChange> : ''}
                    {chartData[chartData.length - 24] ? <PercentChange>
                        1D: {chartData.length - 24 > 0 ? parseFloat((chartData[chartData.length - 1]?.price / chartData[chartData.length - 24]?.price) * 100 - 100).toFixed(2) : ''}%
                    </PercentChange> : ''}
                    {chartData[chartData.length - (24 * 7)] ? <PercentChange>
                        7D: {chartData.length - 168 > 0 ? parseFloat((chartData[chartData.length - 1]?.price / chartData[chartData.length - (24 * 7)]?.price) * 100 - 100).toFixed(2) : ''}%
                    </PercentChange> : ''}
                </div> : ''}
            </div>
            {!dataExists ? <div style={{ width: 200, position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                <Button textAlign={'center'} onClick={handleLoadPriceChart}>
                    {isLoading ? <LoadingWave numDots={5} speed={100}/> : 'Load Price Chart'}
                </Button>
            </div> : ''}
        </div>
    )
}