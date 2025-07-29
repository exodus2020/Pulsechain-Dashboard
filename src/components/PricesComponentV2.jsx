import { memo, useCallback, useMemo, useState } from "react"
import styled from "styled-components"

import ImageContainer from "./ImageContainer"
import ImgPLS from '../icons/pls.png'
import ImgPLSX from '../icons/plsx.png'
import ImgHEX from '../icons/hex.png'
import ImgINC from '../icons/inc.png'
import { formatNumber, fUnit } from "../lib/numbers"
import { Selector } from "./Selector"
import LoadingWave from "./LoadingWave"
import Tooltip from "../shared/Tooltip"
import { LoadingBar } from "./LoadingBar"
import { useAtom } from "jotai"
import { timeframeAtom, tokenModalAtom } from "../store"


const Wrapper = styled.div`
    position: relative;
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
    
    select {
        font-size: 12px;
        padding: 5px 15px;
    }

    .price-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        gap: 10px;
        background: rgb(0, 0, 0, 0.5);
        background: linear-gradient(to bottom, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.1));
        border-radius: 10px;
        box-shadow: 0 1px 4px rgba(255, 255, 255, 0.1);
    }

    .loading-container {
        position: absolute;
        right: 5px;
        top: -5px;
        height: 10px;
        .loading-bar-div {
            height: 16px;
            margin-top: 10px;
            width: 40px;
        }
    }

    @media (max-width: 650px) {
        min-width: calc( 100dvw - 40px );
        max-width: calc( 100dvw - 40px );
        .loading-container {
            position: absolute;
            left: 90px;
            top: -5px;
            height: 10px;
        }
        .price-grid {
            grid-template-columns: 1fr 1fr;
        }
    }

    @media (max-width: 375px) {
        .price-grid {
            min-width: calc( 100dvw + 50px );
            max-width: calc( 100dvw + 50px );
            grid-template-columns: 1fr 1fr;
            transform: scale(0.8) translateX( -40px );
        }
    }

    @media (max-width: 275px) {
        .price-grid {
            min-width: calc( 100dvw + 50px );
            max-width: calc( 100dvw + 50px );
            grid-template-columns: 1fr 1fr;
            transform: scale(0.8) translateX( -50px );
        }
    }
`

const Row = styled.div`
    box-shadow: 0 1px 4px rgba(255, 255, 255, 0.1);
    padding: 30px 20px 30px 30px;
    border-radius: 10px;
    position: relative;
    transition: all 0.3s ease-in-out;

    cursor: pointer;
    &:hover {
        background-color: rgba(255, 255, 255, 0.01);
        box-shadow: 0 1px 4px rgba(255, 255, 255, 0.1),
                    inset 0 0 10px 1px rgba(255, 255, 255, 0.05);
    }
`

export default memo(PricesComponentV2)
function PricesComponentV2 ({ historyData, priceData, getImage }) {
    const { history, resetHistory, chartKeyPoints } = historyData
    const { prices } = priceData
    // const getImageMemo = useCallback(getImage ?? (() => {}), []);

    const [selected, setSelected] = useAtom(timeframeAtom)
    const [selectedCurrency, setSelectedCurrency] = useState('USD')

    const plsPrice = prices?.['0xa1077a294dde1b09bb078844df40758a5d0f9a27']
    const plsxPrice = prices?.['0x95b303987a60c71504d99aa1b13b4da07b0790ab']
    const hexPrice = prices?.['0x2b591e99afe9f32eaa6214f7b7629768c40eeb39']
    const incPrice = prices?.['0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d']

    //const plsHistory = history?.[priceData?.bestStable?.pair] ?? []
    const plsHistory = chartKeyPoints?.[priceData?.bestStable?.pair] ?? []
    const invert = priceData?.bestStable?.invert ? true : false

    const displayArray = useMemo(() => [
        {
            'name': 'PLS',
            'price': plsPrice?.priceUsd,
            'priceWPLS': plsPrice?.priceWpls,
            'history': plsHistory,
            'tokenInfo': plsPrice,
            'lows': {
                'price': 0.00001654,
                'priceWPLS': 0.00001654,
            },
            'image': ImgPLS,
            'isPls': true,
            'bestStable': priceData?.bestStable,
            'invert': invert
        },    
        {
            'name': 'PLSX',
            'tokenInfo': plsxPrice,
            'price': plsxPrice?.priceUsd,
            'priceWPLS': plsxPrice?.priceWpls,
            'history': chartKeyPoints?.['0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9'] ?? [],
            'lows': {
                'price': 0.000008904 ,
                'priceWPLS': 0.2346,
            },
            'image': ImgPLSX,
            'bestStable': priceData?.bestStable
        },
        {
            'name': 'INC',
            'price': incPrice?.priceUsd,
            'priceWPLS': incPrice?.priceWpls,
            'history': chartKeyPoints?.['0xf808bb6265e9ca27002c0a04562bf50d4fe37eaa'] ?? [],
            'tokenInfo': incPrice,
            'lows': {
                'price': 0.3947,
                'priceWPLS': 8467.35,
            },
            'image': ImgINC,
            'bestStable': priceData?.bestStable
        },
        {
            'name': 'HEX',
            'price': hexPrice?.priceUsd,
            'priceWPLS': hexPrice?.priceWpls,
            'history': chartKeyPoints?.['0xf1f4ee610b2babb05c635f726ef8b0c568c8dc65'] ?? [],
            'tokenInfo': hexPrice,
            'lows': {
                'price': 0.003633,
                'priceWPLS': 80.3703,
            },
            'image': ImgHEX,
            'bestStable': priceData?.bestStable
        },
    ], [prices, history, getImage])

    const favoriteDisplayArray = []
    // const favoriteDisplayArray = useMemo(() => [
    //     "0x02dcdd04e3f455d838cd1249292c58f3b79e3c3c",
    // ].map(address => {
    //     const data = prices?.[address]
    //     if (!data) return null
    //     return {
    //         'name': data?.symbol,
    //         'price': data?.priceUsd,
    //         'priceWPLS': data?.priceWpls,
    //         'history': history?.[data?.pairId] ?? [],
    //         'tokenInfo': prices?.[address],
    //         'lows': {
    //             'price': parseFloat(data?.priceUsd).toFixed(7),
    //             'priceWPLS': parseFloat(data?.priceWpls).toFixed(7),
    //         },
    //         'image': getImageMemo(address)
    //     }
    // }), [prices, history, getImageMemo])
    
    const historyProperty = invert ? 'priceInverted' : 'price'

    // const plsLastPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - 1][historyProperty] : 0
    // const plsLastHourPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - 2][historyProperty] : 0
    // const plsLastSixHourPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - 6][historyProperty] : 0
    // const plsLastDayPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - 24][historyProperty] : 0
    // const plsSevenDayPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - (24 * 7)][historyProperty] : 0

    const plsLastPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - 1][historyProperty] : 0
    const plsLastHourPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - 2][historyProperty] : 0
    const plsLastSixHourPrice = plsHistory && plsHistory.length > 2 ? plsHistory[plsHistory.length - 3][historyProperty] : 0
    const plsLastDayPrice = plsHistory && plsHistory.length > 3 ? plsHistory[plsHistory.length - 4][historyProperty] : 0
    const plsSevenDayPrice = plsHistory && plsHistory.length > 4 ? plsHistory[plsHistory.length - 5][historyProperty] : 0
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

    // const test = calculatePercentages(plsxPrice, plsHistory, chartKeyPoints?.['0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9'] ?? [], priceData?.bestStable, false)
    // console.log(plsxPrice, plsHistory, chartKeyPoints?.['0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9'] ?? [], priceData?.bestStable, false)
    // console.log("PLSX", test)

    return <Wrapper>
        <div style={{position: 'absolute', top: -50, right: '50%', overflow: 'hidden', whiteSpace: 'nowrap', transform: 'scale(0.9) translateX( calc( 50% / 0.9 ) )'}} className="mobile-only">
            <Selector options={['1H', '6H', '24H', '7D','ATL']} value={selected} onChange={setSelected} />
            <Selector options={['WPLS', 'USD', 'X']} value={selectedCurrency} onChange={setSelectedCurrency} />
        </div>
        <div style={{marginBottom: 10, position: 'relative', marginTop: 40}}>
            <div style={{position: 'absolute', top: -50, right: 0}} className="desktop-only">
                <Selector options={['1H', '6H', '24H', '7D','ATL']} value={selected} onChange={setSelected} />
                <Selector options={['WPLS', 'USD', 'X']} value={selectedCurrency} onChange={setSelectedCurrency} />
            </div>
        </div>
        <div className="price-grid">
            {displayArray.map((item, index) => {
                return <PriceRow isLoading={isLoading} key={index} {...item} priceComparison={priceComparison} selected={selected} selectedCurrency={selectedCurrency} resetHistory={resetHistory}/>
            })}

            {favoriteDisplayArray.map((item, index) => {
                return <PriceRow isLoading={isLoading} key={index} {...item} priceComparison={priceComparison} selected={selected} selectedCurrency={selectedCurrency} resetHistory={resetHistory}/>
            })}
        </div>
    </Wrapper>
}

export function calculatePercentages(tokenPrice, plsHistory, tokenHistory, bestStable, isTokenPls = false, lows = null) {
    if (!Array.isArray(plsHistory) || !Array.isArray(tokenHistory) || plsHistory.length === 0 || tokenHistory.length === 0) return null

    const usd = calculateTokenPrice(tokenPrice, plsHistory, tokenHistory, bestStable, 'USD', isTokenPls, lows)
    const wpls = calculateTokenPrice(tokenPrice, plsHistory, tokenHistory, bestStable, 'WPLS', isTokenPls, lows)
    const x = calculateTokenPrice(tokenPrice, plsHistory, tokenHistory, bestStable, 'X', isTokenPls, lows)

    return {
        usd,
        wpls,
        x
    }
}

function calculateTokenPrice (tokenPrice, plsHistory, tokenHistory, bestStable, selectedCurrency = "USD", isTokenPls = false, lows = null) {
    const invert = bestStable?.invert ? true : false
    const historyProperty = invert ? 'priceInverted' : 'price'
    const usdSelected = selectedCurrency == 'USD'

    const plsLastPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - 1][historyProperty] : 0
    const plsLastHourPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - 2][historyProperty] : 0
    const plsLastSixHourPrice = plsHistory && plsHistory.length > 2 ? plsHistory[plsHistory.length - 3][historyProperty] : 0
    const plsLastDayPrice = plsHistory && plsHistory.length > 3 ? plsHistory[plsHistory.length - 4][historyProperty] : 0
    const plsSevenDayPrice = plsHistory && plsHistory.length > 4 ? plsHistory[plsHistory.length - 5][historyProperty] : 0
    const plsAllTimeLowPrice = 0.000009536

    const plsPriceHistory = {
        plsLastDayPrice,
        plsSevenDayPrice,
        plsLastHourPrice,
        plsLastPrice,
        plsLastSixHourPrice,
        plsAllTimeLowPrice
    }
    
    const priceModifier = (property) => isTokenPls ? 1 : plsPriceHistory[property]

    const priceProperty = tokenPrice?.invertReserves ? 'priceInverted' : 'price'
    const invertReserves = tokenPrice?.invertReserves ? true : false
    const priceWpls = typeof tokenPrice?.priceWpls === 'number' ? tokenPrice?.priceWpls : parseFloat(tokenPrice?.priceWpls)
    const priceUsd = typeof tokenPrice?.priceUsd === 'number' ? tokenPrice?.priceUsd : parseFloat(tokenPrice?.priceUsd)

    const h1token = usdSelected 
        ? (tokenHistory && tokenHistory.length > 1 ? tokenHistory[tokenHistory.length - 2][priceProperty] * priceModifier('plsLastHourPrice') : '-')
        : (tokenHistory && tokenHistory.length > 1 ? tokenHistory[tokenHistory.length - 2][priceProperty] : '-')
    const h6token = usdSelected 
        ? (tokenHistory && tokenHistory.length > 2 ? tokenHistory[tokenHistory.length - 3][priceProperty] * priceModifier('plsLastSixHourPrice') : '-')
        : (tokenHistory && tokenHistory.length > 2 ? tokenHistory[tokenHistory.length - 3][priceProperty] : '-')
    const d1token = usdSelected 
        ? (tokenHistory && tokenHistory.length > 3 ? tokenHistory[tokenHistory.length - 4][priceProperty] * priceModifier('plsLastDayPrice') : '-')
        : (tokenHistory && tokenHistory.length > 3 ? tokenHistory[tokenHistory.length - 4][priceProperty] : '-')
    const d7token = usdSelected 
        ? (tokenHistory && tokenHistory.length > 4 ? tokenHistory[tokenHistory.length - 5][priceProperty] * priceModifier('plsSevenDayPrice') : '-')
        : (tokenHistory && tokenHistory.length > 4 ? tokenHistory[tokenHistory.length - 5][priceProperty] : '-')
    const allTimeLowPrice = !lows ? NaN : usdSelected ? lows?.price : lows?.priceWPLS

    const tokenPriceHistory = {
        h1token,
        h6token,
        d1token,
        d7token,
        allTimeLowPrice
    }

    //const lastPrice = isTokenPls ? (!invert ? 1 / priceWpls : priceUsd) : usdSelected ? (invert ? priceWpls : priceUsd) : (invert ? priceUsd : priceWpls)
    const lastPrice = isTokenPls 
        ? (!invert ? 1 / priceWpls : priceUsd)  // For PLS token
        : usdSelected 
            ? (invertReserves ? priceWpls : priceUsd)   // For USD display
            : (invertReserves ? priceUsd : priceWpls)   // For WPLS display
    
    const priceToUse = usdSelected ? priceUsd : priceWpls
    const displayPrice = priceToUse > 999_999 ? fUnit(priceToUse, 2) : formatNumber(priceToUse ?? 0, true, false)

    // if(selectedCurrency === 'USD') {
    //     console.log(
    //         tokenHistory[tokenHistory.length - 2][priceProperty] * priceModifier('plsLastHourPrice')
    //         ,'/',lastPrice
    //     )
    //     console.log( 'priceToUse', selectedCurrency, 'isUSD?',usdSelected, priceToUse)
    // }

    const getPercentChange = (selected) => {
        if (selected === 'ATL' && !lows) return undefined

        const changeDenominator = selected === '1H' ? h1token : selected === '6H' ? h6token : selected === '24H' ? d1token : selected === '7D' ? d7token : selected === 'ATL' ? allTimeLowPrice : lastPrice
        const percentPrice = selected === 'ATL' ? (usdSelected ? priceUsd : priceWpls) : lastPrice
        
        // const percentChangeRaw = 
        //     selectedCurrency === 'X' ? (percentPrice / changeDenominator)
        //     : (percentPrice / changeDenominator - 1) * 100
        const percentChangeRaw = 
            selectedCurrency === 'X' ? (percentPrice / changeDenominator)
            : ((percentPrice - changeDenominator) / changeDenominator) * 100
        const percentChange = percentChangeRaw < 0.05 && percentChangeRaw > -0.05 ? 0 : percentChangeRaw
        const isX = selectedCurrency === 'X'
        const percentChangeColor = (!isX && percentChange > 0.75) || (isX && percentChange > 1.03) ? 'rgb(130,255,130)' : (!isX && percentChange < -0.75) || (isX && percentChange < 0.97) ? 'rgb(255,130,130)' : 'rgb(170,170,170)'
        const percentageUnit = selectedCurrency === 'X' ? 'x' : '%'

        // if(selectedCurrency === 'USD') {
        //     // Issue with the stablle inverted for tether
        //     console.log(selectedCurrency, percentPrice ,'/',changeDenominator )
        // }
        

        const result = {
            percentChangeColor,
            percentChange,
            isX,
            percentageUnit,
            percentChangeRaw
        }
        return result
    }

    return {
        plsPriceHistory,
        tokenPriceHistory,
        token: {
            displayPrice,
            h1: getPercentChange('1H'),
            h6: getPercentChange('6H'),
            d1: getPercentChange('24H'),
            d7: getPercentChange('7D'),
            atl: getPercentChange('ATL')
        }
    }
}

function PriceRow({ tokenInfo, resetHistory, isLoading, invert = false, name, price, priceWPLS, history, priceComparison, image, isPls = false, selected, selectedCurrency, lows, bestStable }) {
    const [ singleTokenModal, setSingleTokenModal ] = useAtom(tokenModalAtom)
    const priceModifier = (property) => isPls ? 1 : priceComparison[property]

    const priceProperty = invert ? 'priceInverted' : 'price'
    const usdSelected = selectedCurrency === 'USD' || selectedCurrency === 'X'

    const bestStableToken = bestStable?.symbol ?? ''

    const lastPrice = isPls ? (!invert ? 1 / priceWPLS : price)
        : usdSelected ? (invert ? priceWPLS : price) : (invert ? price : priceWPLS)
    const lastHourPrice = usdSelected 
        ? (history && history.length > 1 ? history[history.length - 2][priceProperty] * priceModifier('plsLastHourPrice') : '-')
        : (history && history.length > 1 ? history[history.length - 2][priceProperty] : '-')
    const lastSixHourPrice = usdSelected 
        ? (history && history.length > 2 ? history[history.length - 3][priceProperty] * priceModifier('plsLastSixHourPrice') : '-')
        : (history && history.length > 2 ? history[history.length - 3][priceProperty] : '-')
    const lastDayPrice = usdSelected 
        ? (history && history.length > 3 ? history[history.length - 4][priceProperty] * priceModifier('plsLastDayPrice') : '-')
        : (history && history.length > 3 ? history[history.length - 4][priceProperty] : '-')
    const sevenDayPrice = usdSelected 
        ? (history && history.length > 4 ? history[history.length - 5][priceProperty] * priceModifier('plsSevenDayPrice') : '-')
        : (history && history.length > 4 ? history[history.length - 5][priceProperty] : '-')
    const allTimeLowPrice = usdSelected ? lows?.price : lows?.priceWPLS

    const priceToUse = usdSelected ? price : priceWPLS
    const displayPrice = priceToUse > 999_999 ? fUnit(priceToUse, 2) : formatNumber(priceToUse ?? 0, true, false)

    const changeDenominator = selected === '1H' ? lastHourPrice : selected === '6H' ? lastSixHourPrice : selected === '24H' ? lastDayPrice : selected === '7D' ? sevenDayPrice : selected === 'ATL' ? allTimeLowPrice : lastPrice
    const percentPrice = selected === 'ATL' ? (usdSelected ? price : priceWPLS) : lastPrice
    const percentChangeRaw = 
        selectedCurrency === 'X' ? (percentPrice / changeDenominator)
        : (percentPrice / changeDenominator - 1) * 100
    const percentChange = percentChangeRaw < 0.05 && percentChangeRaw > -0.05 ? 0 : percentChangeRaw
    const isX = selectedCurrency === 'X'
    const percentChangeColor = (!isX && percentChange > 0.75) || (isX && percentChange > 1.03) ? 'rgb(130,255,130)' : (!isX && percentChange < -0.75) || (isX && percentChange < 0.97) ? 'rgb(255,130,130)' : 'rgb(170,170,170)'
    const percentageUnit = selectedCurrency === 'X' ? 'x' : '%'

    return <>
        <div style={{ padding: '20px 5px 20px 15px', borderRadius: 10 }}>
            <div style={{ position: 'relative' }}>
                <div>
                    <ImageContainer source={image} alt={name} size={40}/>
                </div>
                <div style={{ position: 'absolute', left: 50, top: 0 }}>
                    {name}
                    {!isLoading || selected === 'ATL'? <div style={{ position: 'absolute', right: -10, top: 0, transform: 'translateX(100%)' }}>
                        <span style={{ color: percentChangeColor }}>
                            {isPls && selected === 'WPLS' ? <></> 
                                : !isPls || (isPls && usdSelected) ? `${percentChange.toFixed( isX ? 2 : 1 )}${percentageUnit}` : ''}
                        </span>
                    </div> : <></>}
                </div>
                {isLoading && selected !== 'ATL' ? <div className="loading-container">
                    <Tooltip content="Loading Historical Data...">
                        <div className='loading-bar-div'>
                            <LoadingBar estTime={30} completed={!isLoading}/>
                        </div>
                    </Tooltip>
                </div> : <></>}
                <div style={{ position: 'absolute', left: 50, bottom: 0 }}>
                    <div>
                        <span style={{ fontSize: 15, letterSpacing: 1, whiteSpace: 'nowrap' }}>
                            {usdSelected ? <span style={{ fontSize: 14 }}>$ </span> : ''}{displayPrice ?? '-'}{usdSelected ? '' : <span style={{ fontSize: 12 }}> {isPls ? '/ '+bestStableToken : 'WPLS'}</span>}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </>
    
    return <>
        <Row onClick={() => {
            if (tokenInfo) {
                setSingleTokenModal(tokenInfo);
            }
        }} className="desktop-only">
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
        <Row onClick={() => {
            if (tokenInfo) {
                setSingleTokenModal(tokenInfo);
            }
        }} className="mobile-only">
            <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 1fr', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <ImageContainer source={image} alt={name} size={40}/><br/>
                    {name}
                </div>
                <div style={{ textAlign: 'center', paddingTop: 10, transform: 'scale(0.9)' }}>
                    <span style={{ fontSize: 24, letterSpacing: 1, whiteSpace: 'nowrap' }}>
                        {usdSelected ? <span style={{ fontSize: 14 }}>$ </span> : ''}{displayPrice ?? '-'}{usdSelected ? '' : <span style={{ fontSize: 12 }}> WPLS / DAI</span>}
                    </span>
                </div>

                <div style={{ textAlign: 'center', paddingTop: 0, fontSize: 24 }}>
                    {isLoading && selected !== 'ATL' ? <span>
                            <Tooltip content="Loading Historical Data...">
                                <div style={{ fontSize: 15, fontFamily: 'sans-serif' }}>
                                    Loading...
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
    </>
}
