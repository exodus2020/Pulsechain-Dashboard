import { memo, useEffect, useState } from "react"
import styled from "styled-components"

import ImageContainer from "./ImageContainer"
import ImgPLS from '../icons/pls.png'
import ImgPLSX from '../icons/plsx.png'
import ImgHEX from '../icons/hex.png'
import ImgINC from '../icons/inc.png'
import { addCommasToNumber, countLeadingZerosAfterDecimal, formatNumber, fUnit, getNumberAfterLeadingZeros } from "../lib/numbers"
import { Selector } from "./Selector"
import LoadingWave from "./LoadingWave"
import Tooltip from "../shared/Tooltip"
import { LoadingBar } from "./LoadingBar"


const Wrapper = styled.div`
    color: white;
    min-width: 650px;
    max-width: 650px;
    justify-self: center;
    font-family: 'Oswald', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

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
    
    select {
        font-size: 12px;
        padding: 5px 15px;
    }
`

const Row = styled.div`
    // border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 1px 4px rgba(255, 255, 255, 0.1);
    padding: 30px 20px 30px 30px;
    border-radius: 10px;
    position: relative;
`

export default memo(PricesComponent)
function PricesComponent ({ historyData, priceData }) {
    const { history, resetHistory } = historyData
    const { prices } = priceData

    const [selected, setSelected] = useState('7D')
    const [selectedCurrency, setSelectedCurrency] = useState('USD')

    const plsPrice = prices?.['0xa1077a294dde1b09bb078844df40758a5d0f9a27']
    const plsxPrice = prices?.['0x95b303987a60c71504d99aa1b13b4da07b0790ab']
    const hexPrice = prices?.['0x2b591e99afe9f32eaa6214f7b7629768c40eeb39']
    const incPrice = prices?.['0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d']

    const plsHistory = history?.[priceData?.bestStable?.pair] ?? []
    const invert = priceData?.bestStable?.invert ? true : false

    const pls = {
        'name': 'PLS',
        'price': plsPrice?.priceUsd,
        'priceWPLS': plsPrice?.priceWpls,
        'history': plsHistory,
        'lows': {
            'price': 0.00003305,
            'priceWPLS': 0.00003305,
        },
        'image': ImgPLS
    }

    const displayArray = [
        {
            'name': 'PLSX',
            'price': plsxPrice?.priceUsd,
            'priceWPLS': plsxPrice?.priceWpls,
            'history': history?.['0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9'] ?? [],
            'lows': {
                'price': 0.000008904 ,
                'priceWPLS': 0.2346,
            },
            'image': ImgPLSX
        },
        {
            'name': 'INC',
            'price': incPrice?.priceUsd,
            'priceWPLS': incPrice?.priceWpls,
            'history': history?.['0xf808bb6265e9ca27002c0a04562bf50d4fe37eaa'] ?? [],
            'lows': {
                'price': 0.3947,
                'priceWPLS': 8467.35,
            },
            'image': ImgINC
        },
        {
            'name': 'HEX',
            'price': hexPrice?.priceUsd,
            'priceWPLS': hexPrice?.priceWpls,
            'history': history?.['0xf1f4ee610b2babb05c635f726ef8b0c568c8dc65'] ?? [],
            'lows': {
                'price': 0.003633,
                'priceWPLS': 80.3703,
            },
            'image': ImgHEX
        }
    ]
    
    const historyProperty = invert ? 'priceInverted' : 'price'
    // const plsHistory = bestStable//history?.['0xe56043671df55de5cdf8459710433c10324de0ae'] ?? []
    const plsLastPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - 1][historyProperty] : 0
    const plsLastHourPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - 2][historyProperty] : 0
    const plsLastSixHourPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - 6][historyProperty] : 0
    const plsLastDayPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - 24][historyProperty] : 0
    const plsSevenDayPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - (24 * 7)][historyProperty] : 0
    const plsAllTimeLowPrice = 0.000009536

    const priceComparison = {
        plsLastDayPrice,
        plsSevenDayPrice,
        plsLastHourPrice,
        plsLastPrice,
        plsLastSixHourPrice,
        plsAllTimeLowPrice
    }

    const isLoading = plsHistory.length === 0

    return <Wrapper>      
        <div style={{marginBottom: 10, position: 'relative', marginTop: 40}}>
            <div style={{position: 'absolute', top: -50, right: 0}}>
                <Selector options={['1H', '6H', '24H', '7D','ATL']} value={selected} onChange={setSelected} />
                <Selector options={['WPLS', 'USD', 'X']} value={selectedCurrency} onChange={setSelectedCurrency} />
            </div>            
            <PriceRow isLoading={isLoading} invert={invert} {...pls} priceComparison={priceComparison} isPls={true} selected={selected} selectedCurrency={selectedCurrency} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            {displayArray.map((item, index) => {
                return <PriceRow isLoading={isLoading} key={index} {...item} priceComparison={priceComparison} selected={selected} selectedCurrency={selectedCurrency} resetHistory={resetHistory}/>
            })}
        </div>
    </Wrapper>
}

function PriceRow({ resetHistory, isLoading, invert = false, name, price, priceWPLS, history, priceComparison, image, isPls = false, selected, selectedCurrency, lows }) {
    
    const priceModifier = (property) => isPls ? 1 : priceComparison[property]

    const priceProperty = invert ? 'priceInverted' : 'price'
    const usdSelected = selectedCurrency === 'USD' || selectedCurrency === 'X'

    const lastPrice = usdSelected 
        ? (history && history.length > 1 ? history[history.length - 1][priceProperty] * priceModifier('plsLastPrice') : '-')
        : (history && history.length > 1 ? history[history.length - 1][priceProperty] : '-')
    const lastHourPrice = usdSelected 
        ? (history && history.length > 1 ? history[history.length - 2][priceProperty] * priceModifier('plsLastHourPrice') : '-')
        : (history && history.length > 1 ? history[history.length - 2][priceProperty] : '-')
    const lastSixHourPrice = usdSelected 
        ? (history && history.length > 1 ? history[history.length - 6][priceProperty] * priceModifier('plsLastSixHourPrice') : '-')
        : (history && history.length > 1 ? history[history.length - 6][priceProperty] : '-')
    const lastDayPrice = usdSelected 
        ? (history && history.length > 1 ? history[history.length - 24][priceProperty] * priceModifier('plsLastDayPrice') : '-')
        : (history && history.length > 1 ? history[history.length - 24][priceProperty] : '-')
    const sevenDayPrice = usdSelected 
        ? (history && history.length > 1 ? history[history.length - (24 * 7)][priceProperty] * priceModifier('plsSevenDayPrice') : '-')
        : (history && history.length > 1 ? history[history.length - (24 * 7)][priceProperty] : '-')
    const allTimeLowPrice = usdSelected ? lows?.price : lows?.priceWPLS

    const priceToUse = usdSelected ? price : priceWPLS
    const displayPrice = formatNumber(priceToUse ?? 0, true, false)

    const changeDenominator = selected === '1H' ? lastHourPrice : selected === '6H' ? lastSixHourPrice : selected === '24H' ? lastDayPrice : selected === '7D' ? sevenDayPrice : selected === 'ATL' ? allTimeLowPrice : lastPrice
    const percentPrice = selected === 'ATL' ? (usdSelected ? price : priceWPLS) : lastPrice
    const percentChangeRaw = 
        selectedCurrency === 'X' ? (percentPrice / changeDenominator)
        : (percentPrice / changeDenominator - 1) * 100
    const percentChange = percentChangeRaw < 0.05 && percentChangeRaw > -0.05 ? 0 : percentChangeRaw
    const isX = selectedCurrency === 'X'
    const percentChangeColor = (!isX && percentChange > 0.75) || (isX && percentChange > 1.03) ? 'rgb(130,255,130)' : (!isX && percentChange < -0.75) || (isX && percentChange < 0.97) ? 'rgb(255,130,130)' : 'rgb(170,170,170)'
    const percentageUnit = selectedCurrency === 'X' ? 'x' : '%'
    useEffect(() => {
        // Happened only in debugging, but if percentChanges don't make sense, hard reset history
        if (selected !== 'ATL' && (percentChange > 1_000_000 || percentChange < -95)) {
            resetHistory?.()
        }
    }, [percentChange])

    if (isPls) {
        return <Row>
            <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 1fr', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <ImageContainer source={image} alt={name} size={40}/><br/>
                    {name}
                </div>
                <div style={{ textAlign: 'center', paddingTop: 10 }}>
                    <span style={{ fontSize: 24, letterSpacing: 1 }}>
                        {usdSelected ? <span style={{ fontSize: 14 }}>$ </span> : ''}{displayPrice ?? '-'}{usdSelected ? '' : <span style={{ fontSize: 12 }}> WPLS / DAI</span>}
                    </span>
                </div>

                <div style={{ textAlign: 'center', paddingTop: 0, fontSize: 24 }}>
                    {isLoading && selected !== 'ATL' ? <span>
                            <Tooltip content="Loading Historical Data...">
                                <div style={{ fontSize: 15, fontFamily: 'sans-serif' }}>
                                    Loading history from blockchain...<br/>This may take up to 30~60s
                                </div>
                                <div style={{ position: 'position', height: 16, marginTop: 10 }}>
                                    <LoadingBar estTime={30} completed={!isLoading}/>
                                </div>
                                {/* <LoadingWave numDots={8} speed={100}/> */}
                            </Tooltip>
                        </span> : <span style={{ color: percentChangeColor }}>
                            {usdSelected ? `${percentChange.toFixed( isX ? 2 : 1 )}${percentageUnit}` : ''}
                        </span>
                    }
                </div>
            </div>
        </Row>    
    }
    return <Row>
        <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
                <ImageContainer source={image} alt={name} size={40}/><br/>
                {name}
            </div>
            <div style={{ textAlign: 'right', fontSize: 20 }}>
                {isLoading && selected !== 'ATL' ? <span style={{ position: 'absolute', top: 50, right: -20 }}>
                        <Tooltip content="Loading Historical Data...">
                            <LoadingWave numDots={8} speed={100}/>
                        </Tooltip>
                    </span> : <span style={{ color: percentChangeColor }}>
                        {percentChange.toFixed( isX ? 2 : 1 )}{percentageUnit}
                    </span>
                }
            </div>
        </div>
        <div style={{marginTop: 10}}>
            <span style={{ fontSize: 24, letterSpacing: 1 }}>
                {usdSelected ? <span style={{ fontSize: 14 }}>$</span> : ''}
                {displayPrice}
                {usdSelected ? '' : <span style={{ fontSize: 12 }}> WPLS</span>}
                <br/>
            </span>
        </div>
    </Row>
}
