import styled from "styled-components"
import useHistory from "../hooks/useHistory"
import { useEffect, useState } from "react"
import BasicChart from "../components/BasicChart"
import LoadingWave from "../components/LoadingWave"
import { calculateScaledResultForChart } from "../lib/numbers"

const Wrapper = styled.div`
    color: white;
    min-width: 650px;
    max-width: 650px;
    justify-self: center;

    button {
        &:hover {
            transform: scale(1);
        }
    }
    .price-button {
        display: grid;
        grid-template-columns: 50px 1fr;
        text-align: left;
        font-weight: 550;
        font-family: 'Robot', sans-serif;
    }
`

export default function HistoriesPage({ historyData }) {
    const { history, getHistory, fetchMore, isLoading, isError, progress } = historyData

    const [ chartData, setChartData ] = useState([])
    const [ chartDataInverted, setChartDataInverted ] = useState([])

    const tokenToUse = '0xe56043671df55de5cdf8459710433c10324de0ae'

    useEffect(() => {
        if (history[tokenToUse]) {
            setChartData(history[tokenToUse].map(m => ({
                blockNumber: m.blockNumber,
                timestamp: m.timestamp,
                price: m.price
            })))
            setChartDataInverted(history[tokenToUse].map(m => ({
                blockNumber: m.blockNumber,
                timestamp: m.timestamp,
                price: m.priceInverted
            })))
        }
    }, [history])

    useEffect(() => {
        if (!history[tokenToUse]) {
            getHistory(tokenToUse)
        }
    }, [])

    

    return (
        <Wrapper>
            <h1>Histories Page</h1>
            {isLoading ? <div>
                <LoadingWave numDots={10} speed={100}/>
            </div> : ''}
            {history?.[tokenToUse]?.length > 0 ? <div>
                <div>
                    <div>
                        7D: {chartData.length - (24*7) > 0 ? parseFloat((chartData[chartData.length - 1]?.price / chartData[chartData.length - (24*7)]?.price) * 100 - 100).toFixed(2) : ''} % <br/>
                        24H: {chartData.length - 24 > 0 ? parseFloat((chartData[chartData.length - 1]?.price / chartData[chartData.length - 24]?.price) * 100 - 100).toFixed(2) : ''} % <br/>
                        1H: {chartData.length - 1 > 0 ? parseFloat((chartData[chartData.length - 1]?.price / chartData[chartData.length - 2]?.price) * 100 - 100).toFixed(2) : ''} % <br/>
                        Load Time: {(Number(progress.end) - Number(progress.start)) / 1_000} s<br/>
                        Length: {chartData.length} ({Math.floor(chartData.length / 24)} days)
                        <button 
                            onClick={() => fetchMore(tokenToUse)}
                            disabled={isLoading}
                            style={{ marginLeft: '10px' }}
                        >
                            Load More
                        </button>
                    </div>
                    <BasicChart 
                        data={chartData} 
                        xKey="timestamp"
                        yKey="price"
                        width={800}
                        height={400}
                        lineColor="#00ff00"
                        xInterval={calculateScaledResultForChart(chartData.length) ?? 10}
                        yInterval={5}
                        showDataLabels={true}
                        dataLabelInterval={10}
                    />
                </div>
            </div> : ''}
            
        </Wrapper>
    )
}

