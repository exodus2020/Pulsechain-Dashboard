// PricesComponentV2.jsx
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import styled from "styled-components"

import ImageContainer from "./ImageContainer"
import ImgPLS from '../icons/pls.png'
import ImgPLSX from '../icons/plsx.png'
import ImgHEX from '../icons/hex.png'
import ImgINC from '../icons/inc.png'
import ImgPRVX from '../icons/prvx.png'
import { formatNumber, fUnit } from "../lib/numbers"
import { Selector } from "./Selector"
import Tooltip from "../shared/Tooltip"
import { LoadingBar } from "./LoadingBar"
import { useAtom } from "jotai"
import { timeframeAtom, tokenModalAtom } from "../store"


const Wrapper = styled.div`
    position: relative;
    color: white;
    min-width: auto;
    max-width: fit-content;
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
        display: flex;
        justify-content: center;
        gap: 45px;
        padding-right: 45px;
        background: rgb(0, 0, 0, 0.5);
        background: linear-gradient(to bottom, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.1));
        border-radius: 10px;
        box-shadow: 0 1px 4px rgba(255, 255, 255, 0.1);
    }

    .loading-bar-div {
        display: inline-flex;
        align-items: center;
        height: 12px;
        width: 36px;
        transform: translateY(-5px);
    }

    @media (max-width: 650px) {
        min-width: calc( 100dvw - 40px );
        max-width: calc( 100dvw - 40px );
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
function PricesComponentV2 ({ historyData, priceData, statsData, getImage, pulseMetrics }) {
    const { history, resetHistory, chartKeyPoints, dailyCandles, hourlyCandles } = historyData
    const { prices } = priceData
    // const getImageMemo = useCallback(getImage ?? (() => {}), []);

    const [selected, setSelected] = useAtom(timeframeAtom)
    const [selectedCurrency, setSelectedCurrency] = useState('USD')

    const plsPrice = prices?.['0xa1077a294dde1b09bb078844df40758a5d0f9a27']
    const plsxPrice = prices?.['0x95b303987a60c71504d99aa1b13b4da07b0790ab']
    const hexPrice = prices?.['0x2b591e99afe9f32eaa6214f7b7629768c40eeb39']
    const incPrice = prices?.['0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d']
    const prvxPrice = prices?.['0xf6f8db0aba00007681f8faf16a0fda1c9b030b11']

    const plsFullHistory = history?.[priceData?.bestStable?.pair] ?? []
    const plsShortHistory = chartKeyPoints?.[priceData?.bestStable?.pair] ?? []

    const plsIntradayHistory = plsShortHistory?.length ? plsShortHistory : plsFullHistory
    const plsLongRangeHistory = plsFullHistory ?? []
    
    const invert = priceData?.bestStable?.invert ? true : false

    const displayArray = useMemo(() => [
        {
            name: 'PLS',
            price: plsPrice?.priceUsd,
            priceWPLS: plsPrice?.priceWpls,
            history: plsIntradayHistory,
            longHistory: plsLongRangeHistory,
            candleKey: priceData?.bestStable?.pair,
            tokenInfo: plsPrice,
            lows: {
                price: 0.000009536,
                priceWPLS: 0.000009536,
            },
            image: ImgPLS,
            isPls: true,
            bestStable: priceData?.bestStable,
            invert: invert
        },
        {
            name: 'PLSX',
            tokenInfo: plsxPrice,
            candleKey: '0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9',
            price: plsxPrice?.priceUsd,
            priceWPLS: plsxPrice?.priceWpls,
            history: chartKeyPoints?.['0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9'] ?? [],
            lows: {
                price: 0.000008904,
                priceWPLS: 0.2346,
            },
            image: ImgPLSX,
            bestStable: priceData?.bestStable
        },
        {
            name: 'INC',
            price: incPrice?.priceUsd,
            priceWPLS: incPrice?.priceWpls,
            history: chartKeyPoints?.['0xf808bb6265e9ca27002c0a04562bf50d4fe37eaa'] ?? [],
            candleKey: '0xf808bb6265e9ca27002c0a04562bf50d4fe37eaa',
            tokenInfo: incPrice,
            lows: {
                price: 0.3947,
                priceWPLS: 8467.35,
            },
            image: ImgINC,
            bestStable: priceData?.bestStable
        },
        {
            name: 'HEX',
            price: hexPrice?.priceUsd,
            priceWPLS: hexPrice?.priceWpls,
            history: chartKeyPoints?.[hexPrice?.pairId] ?? [],
            candleKey: hexPrice?.pairId,
            tokenInfo: hexPrice,
            lows: {
                price: 0.003633,
                priceWPLS: 80.3703,
            },
            image: ImgHEX,
            bestStable: priceData?.bestStable
        },
        {
            name: 'PRVX',
            price: prvxPrice?.priceUsd,
            priceWPLS: prvxPrice?.priceWpls,
            history: chartKeyPoints?.[prvxPrice?.pairId] ?? [],
            candleKey: prvxPrice?.pairId,
            tokenInfo: prvxPrice,
            lows: {
                price: 0,
                priceWPLS: 0,
            },
            image: ImgPRVX,
            bestStable: priceData?.bestStable
        },
    ], [
        prices,
        history,
        chartKeyPoints,
        plsPrice,
        plsxPrice,
        hexPrice,
        incPrice,
        prvxPrice,
        priceData?.bestStable,
        plsIntradayHistory,
        plsLongRangeHistory,
        invert
    ])

    const favoriteDisplayArray = []

    const pulseCoinListPercents = useMemo(() => {
        if (!pulseMetrics) return {}

        if (!Array.isArray(pulseMetrics) && typeof pulseMetrics === 'object') {
            return pulseMetrics
        }

        const metrics = pulseMetrics ?? []
        const wantedSymbols = new Set(['PLS', 'WPLS', 'PLSX', 'INC', 'HEX', 'PRVX'])

        const mapped = metrics.reduce((acc, coin) => {
        const symbol = coin?.symbol
        if (!wantedSymbols.has(symbol)) return acc

        if (symbol === 'WPLS' && acc.PLS) {
            return acc
        }

        const normalizedSymbol = symbol === 'WPLS' ? 'PLS' : symbol

        acc[normalizedSymbol] = {
            '1H': Number(coin?.percent1h),
            '6H': Number(coin?.percent6h),
            '24H': Number(coin?.percent24h),
            '7D': Number(coin?.percent7d),
            '30D': Number(coin?.percent30d)
        }

        return acc
    }, {})

        return mapped
    }, [pulseMetrics])
    
    const lastGoodPercentOverridesRef = useRef({})

    useEffect(() => {
        if (Object.keys(pulseCoinListPercents).length > 0) {
            lastGoodPercentOverridesRef.current = pulseCoinListPercents
        }
    }, [pulseCoinListPercents])

    const effectivePercentOverrides =
        Object.keys(pulseCoinListPercents).length > 0
            ? pulseCoinListPercents
            : lastGoodPercentOverridesRef.current

    const historyProperty = invert ? 'priceInverted' : 'price'
    const plsHistoryProperty = (() => {
    const latest = plsIntradayHistory?.[plsIntradayHistory.length - 1]
    const current = Number(plsPrice?.priceUsd)

    const direct = Number(latest?.price)
    const inverted = Number(latest?.priceInverted)

    const directDiff =
        Number.isFinite(direct) && direct > 0 && Number.isFinite(current) && current > 0
            ? Math.abs(Math.log(direct / current))
            : Infinity

    const invertedDiff =
        Number.isFinite(inverted) && inverted > 0 && Number.isFinite(current) && current > 0
            ? Math.abs(Math.log(inverted / current))
            : Infinity

    return directDiff <= invertedDiff ? 'price' : 'priceInverted'
})()

    const plsWplsHistoryProperty = plsHistoryProperty

    const plsLastPrice = plsIntradayHistory && plsIntradayHistory.length > 1 ? plsIntradayHistory[plsIntradayHistory.length - 1][plsHistoryProperty] : 0
    const plsLastHourPrice = getHistoryValueNearHoursAgo(
        plsIntradayHistory,
        plsHistoryProperty,
        1,
        false,
        1
    )

    const plsLastSixHourPrice = getHistoryValueNearHoursAgo(
        plsIntradayHistory,
        plsHistoryProperty,
        6,
        false,
        1
    )

    const plsLastDayPrice = getHistoryValueNearHoursAgo(
        plsIntradayHistory,
        plsHistoryProperty,
        24,
        false,
        1
    )

    const plsSevenDayPrice = getHistoryValueNearDaysAgo(
        plsIntradayHistory,
        plsHistoryProperty,
        7,
        false,
        1
    )

    const plsThirtyDayPrice = getHistoryValueNearDaysAgo(
        plsLongRangeHistory,
        plsHistoryProperty,
        30,
        false,
        1
    )

    const plsThirtyDayAnchorPrice = getHistoryValueNearDaysAgo(
        plsIntradayHistory,
        plsHistoryProperty,
        30,
        false,
        1
    )

    const plsAllTimeLowPrice = 0.000009536

    const priceComparison = {
        plsLastDayPrice,
        plsSevenDayPrice,
        plsLastHourPrice,
        plsLastPrice,
        plsLastSixHourPrice,
        plsThirtyDayPrice: plsThirtyDayPrice || plsThirtyDayAnchorPrice,
        plsAllTimeLowPrice
    }

    const isLoading = false

    // const test = calculatePercentages(plsxPrice, plsHistory, chartKeyPoints?.['0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9'] ?? [], priceData?.bestStable, false)
    // console.log(plsxPrice, plsHistory, chartKeyPoints?.['0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9'] ?? [], priceData?.bestStable, false)
    // console.log("PLSX", test)

    return <Wrapper>
        <div style={{position: 'absolute', top: -50, right: '50%', overflow: 'hidden', whiteSpace: 'nowrap', transform: 'scale(0.9) translateX( calc( 50% / 0.9 ) )'}} className="mobile-only">
            <Selector options={['1H', '6H', '24H', '7D','30D']} value={selected} onChange={setSelected} />
            <Selector options={['WPLS', 'USD', 'X']} value={selectedCurrency} onChange={setSelectedCurrency} />
        </div>
        <div style={{marginBottom: 10, position: 'relative', marginTop: 40}}>
            <div style={{
                position: 'absolute',
                top: -50,
                left: '50%',
                transform: 'translateX(-50%)'
            }} className="desktop-only">
                <Selector options={['1H', '6H', '24H', '7D','30D']} value={selected} onChange={setSelected} />
                <Selector options={['WPLS', 'USD', 'X']} value={selectedCurrency} onChange={setSelectedCurrency} />
            </div>
        </div>
        <div className="price-grid">
            {displayArray.map((item, index) => {
            return <PriceRow 
                isLoading={isLoading}
                key={index}
                {...item}
                longHistory={item.longHistory}
                statsData={statsData}
                priceComparison={priceComparison}
                selected={selected}
                selectedCurrency={selectedCurrency}
                resetHistory={resetHistory}
                dailyCandles={dailyCandles}
                hourlyCandles={hourlyCandles}
                historyPropertyOverride={
                    item.name === 'PLS'
                        ? (selectedCurrency === 'WPLS' ? plsWplsHistoryProperty : plsHistoryProperty)
                        : undefined
                }
                percentOverrides={effectivePercentOverrides?.[item.name] ?? null}
            />
        })}

            {favoriteDisplayArray.map((item, index) => {
                return <PriceRow 
                    isLoading={isLoading}
                    key={index}
                    {...item}
                    longHistory={item.longHistory}
                    statsData={statsData}
                    priceComparison={priceComparison}
                    selected={selected}
                    selectedCurrency={selectedCurrency}
                    resetHistory={resetHistory}
                    dailyCandles={dailyCandles}
                    hourlyCandles={hourlyCandles}
                    historyPropertyOverride={
                        item.name === 'PLS'
                            ? (selectedCurrency === 'WPLS' ? plsWplsHistoryProperty : plsHistoryProperty)
                            : undefined
                    }
                    percentOverrides={effectivePercentOverrides?.[item.name] ?? null}
                />
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
    const plsLastHourPrice = getHistoryValueNearHoursAgo(
        plsHistory,
        historyProperty,
        1,
        false,
        1
    )

    const plsLastSixHourPrice = getHistoryValueNearHoursAgo(
        plsHistory,
        historyProperty,
        6,
        false,
        1
    )

    const plsLastDayPrice = getHistoryValueNearHoursAgo(
        plsHistory,
        historyProperty,
        24,
        false,
        1
    )

    const plsSevenDayPrice = getHistoryValueNearDaysAgo(
        plsHistory,
        historyProperty,
        7,
        false,
        1
    )

    const plsThirtyDayPrice = getHistoryValueNearDaysAgo(
        plsHistory,
        historyProperty,
        30,
        false,
        1
    )

    const plsAllTimeLowPrice = 0.000009536

    const plsPriceHistory = {
        plsLastDayPrice,
        plsSevenDayPrice,
        plsLastHourPrice,
        plsLastPrice,
        plsLastSixHourPrice,
        plsThirtyDayPrice,
        plsAllTimeLowPrice
}
    
    const priceModifier = (property) => isTokenPls ? 1 : plsPriceHistory[property]

    const priceProperty = tokenPrice?.invertReserves ? 'priceInverted' : 'price'
    const invertReserves = tokenPrice?.invertReserves ? true : false
    const priceWpls = typeof tokenPrice?.priceWpls === 'number' ? tokenPrice?.priceWpls : parseFloat(tokenPrice?.priceWpls)
    const priceUsd = typeof tokenPrice?.priceUsd === 'number' ? tokenPrice?.priceUsd : parseFloat(tokenPrice?.priceUsd)

    const h1token = getHistoryValueNearHoursAgo(
        tokenHistory,
        priceProperty,
        1,
        usdSelected,
        usdSelected ? priceModifier('plsLastHourPrice') : 1
    )

    const h6token = getHistoryValueNearHoursAgo(
    tokenHistory,
    priceProperty,
    6,
    usdSelected,
    usdSelected ? priceModifier('plsLastSixHourPrice') : 1
)

    const d1token = getHistoryValueNearHoursAgo(
    tokenHistory,
    priceProperty,
    24,
    usdSelected,
    usdSelected ? priceModifier('plsLastDayPrice') : 1
)
    const d7token = getHistoryValueNearDaysAgo(
        tokenHistory,
        priceProperty,
        7,
        usdSelected,
        usdSelected ? priceModifier('plsSevenDayPrice') : 1
    )
    const d30token = getHistoryValueNearDaysAgo(
        tokenHistory,
        priceProperty,
        30,
        usdSelected,
        priceModifier('plsThirtyDayPrice')
    )
    const tokenPriceHistory = {
        h1token,
        h6token,
        d1token,
        d7token,
        d30token
    }

    //const lastPrice = isTokenPls ? (!invert ? 1 / priceWpls : priceUsd) : usdSelected ? (invert ? priceWpls : priceUsd) : (invert ? priceUsd : priceWpls)
    const lastPrice = isTokenPls
        ? (usdSelected ? priceUsd : priceWpls)
        : usdSelected
            ? (invertReserves ? priceWpls : priceUsd) // For USD display
            : (invertReserves ? priceUsd : priceWpls) // For WPLS display
    
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
        const changeDenominator =
            selected === '1H' ? h1token :
            selected === '6H' ? h6token :
            selected === '24H' ? d1token :
            selected === '7D' ? d7token :
            selected === '30D' ? d30token :
            lastPrice

        const percentPrice = lastPrice
        
        // const percentChangeRaw = 
        //     selectedCurrency === 'X' ? (percentPrice / changeDenominator)
        //     : (percentPrice / changeDenominator - 1) * 100
        const percentChangeRaw =
            selectedCurrency === 'X'
                ? (percentPrice / changeDenominator)
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
            d30: getPercentChange('30D')
        }
    }
}
function getDailyCandleCloseNearDaysAgo(candles, daysAgo) {
    if (!Array.isArray(candles) || candles.length === 0) return 0

    const latestTimestamp = Number(candles[candles.length - 1]?.timestamp)
    if (!Number.isFinite(latestTimestamp) || latestTimestamp <= 0) return 0

    const targetTime = latestTimestamp - (daysAgo * 24 * 60 * 60 * 1000)

    let closest = null
    let smallestDiff = Infinity

    for (const item of candles) {
        const ts = Number(item?.timestamp)
        if (!Number.isFinite(ts) || ts <= 0) continue

        const diff = Math.abs(ts - targetTime)
        if (diff < smallestDiff) {
            smallestDiff = diff
            closest = item
        }
    }

    const close = Number(closest?.close)
    return Number.isFinite(close) && close > 0 ? close : 0
}
function getHourlyCandleCloseNearHoursAgo(candles, hoursAgo) {
    if (!Array.isArray(candles) || candles.length === 0) return 0

    const latestTimestamp = Number(candles[candles.length - 1]?.timestamp)
    if (!Number.isFinite(latestTimestamp) || latestTimestamp <= 0) return 0

    const targetTime = latestTimestamp - (hoursAgo * 60 * 60 * 1000)

    let closest = null
    let smallestDiff = Infinity

    for (const item of candles) {
        const ts = Number(item?.timestamp)
        if (!Number.isFinite(ts) || ts <= 0) continue

        const diff = Math.abs(ts - targetTime)
        if (diff < smallestDiff) {
            smallestDiff = diff
            closest = item
        }
    }

    const close = Number(closest?.close)
    return Number.isFinite(close) && close > 0 ? close : 0
}
function getHistoryValueNearDaysAgo(history, priceProperty, daysAgo, usdSelected, priceModifier) {
    if (!Array.isArray(history) || history.length === 0) return 0

    const latestTimestamp = Number(history[history.length - 1]?.timestamp)
    if (!Number.isFinite(latestTimestamp) || latestTimestamp <= 0) return 0

    const targetTime = latestTimestamp - (daysAgo * 24 * 60 * 60 * 1000)

    let closest = null
    let smallestDiff = Infinity

    for (const item of history) {
        if (!item?.timestamp) continue

        const diff = Math.abs(item.timestamp - targetTime)

        if (diff < smallestDiff) {
            smallestDiff = diff
            closest = item
        }
    }

    if (!closest) return 0

    const raw =
        Number(closest?.[priceProperty]) ||
        Number(closest?.value) ||
        Number(closest?.close) ||
        0

    if (!Number.isFinite(raw) || raw <= 0) return 0

    return usdSelected ? raw * priceModifier : raw
}
function getHistoryValueNearHoursAgo(history, priceProperty, hoursAgo, usdSelected, priceModifier) {
    if (!Array.isArray(history) || history.length === 0) return 0

    const anchor = Number(history[history.length - 1]?.timestamp)
    if (!Number.isFinite(anchor)) return 0

    const targetTime = anchor - (hoursAgo * 60 * 60 * 1000)

    let closest = null
    let smallestDiff = Infinity

    for (const item of history) {
        if (!item?.timestamp) continue

        const diff = Math.abs(item.timestamp - targetTime)

        if (diff < smallestDiff) {
            smallestDiff = diff
            closest = item
        }
    }

    if (!closest) return 0

    const raw =
        Number(closest?.[priceProperty]) ||
        Number(closest?.value) ||
        Number(closest?.close) ||
        0

    if (!Number.isFinite(raw) || raw <= 0) return 0

    return usdSelected ? raw * priceModifier : raw
}
function PriceRow({ tokenInfo, resetHistory, isLoading, statsData, invert = false, name, price, priceWPLS, history, longHistory, priceComparison, image, isPls = false, selected, selectedCurrency, lows, bestStable, dailyCandles, hourlyCandles, candleKey, historyPropertyOverride, percentOverrides }) {
    const frozenDenominatorRef = useRef({})    
    const priceModifier = (property) => isPls ? 1 : priceComparison[property]
    const isUsdPair = tokenInfo?.isUsdPair === true

    const priceProperty = (() => {
        if (isPls) {
            return historyPropertyOverride ?? (invert ? 'priceInverted' : 'price')
        }

        if (!isUsdPair) {
            return tokenInfo?.invertReserves ? 'priceInverted' : 'price'
        }

        const latest = history?.[history.length - 1]
        const current = Number(price)

        const direct = Number(latest?.price)
        const inverted = Number(latest?.priceInverted)

        const directDiff =
            Number.isFinite(direct) && direct > 0 && Number.isFinite(current) && current > 0
                ? Math.abs(Math.log(direct / current))
                : Infinity

        const invertedDiff =
            Number.isFinite(inverted) && inverted > 0 && Number.isFinite(current) && current > 0
                ? Math.abs(Math.log(inverted / current))
                : Infinity

        return directDiff <= invertedDiff ? 'price' : 'priceInverted'
    })()

    const usdSelected = selectedCurrency === 'USD' || selectedCurrency === 'X'
    const isPlsWplsMode = isPls && selectedCurrency === 'WPLS'
    const isX = selectedCurrency === 'X'
    const bestStableToken = bestStable?.symbol ?? ''

    const lastPrice = isPlsWplsMode
        ? 1
        : isPls
            ? price
            : usdSelected
                ? price
                : priceWPLS

    // ✅ MOVE THIS UP HERE (BEFORE usage)
    const candleData = dailyCandles?.[candleKey]
    const hourlyCandleData = hourlyCandles?.[candleKey]

    const rawOneDayPrice =
        candleData?.length
            ? getDailyCandleCloseNearDaysAgo(candleData, 1)
            : 0

    const rawSevenDayPrice =
        candleData?.length
            ? getDailyCandleCloseNearDaysAgo(candleData, 7)
            : 0

    // ✅ NOW SAFE TO USE
    const rawOneHourPrice =
    hourlyCandleData?.length
        ? getHourlyCandleCloseNearHoursAgo(hourlyCandleData, 1)
        : 0

    const rawSixHourPrice =
        hourlyCandleData?.length
            ? getHourlyCandleCloseNearHoursAgo(hourlyCandleData, 6)
            : 0
    const rawOneHourPriceWpls =
        rawOneHourPrice > 0 && priceComparison?.plsLastHourPrice > 0
            ? rawOneHourPrice / priceComparison.plsLastHourPrice
            : 0

    const rawSixHourPriceWpls =
        rawSixHourPrice > 0 && priceComparison?.plsLastSixHourPrice > 0
            ? rawSixHourPrice / priceComparison.plsLastSixHourPrice
            : 0

    const rawOneDayPriceWpls =
        rawOneDayPrice > 0 && priceComparison?.plsLastDayPrice > 0
            ? rawOneDayPrice / priceComparison.plsLastDayPrice
            : 0
            
    const lastHourPrice = isPlsWplsMode
        ? 1
        : usdSelected && rawOneHourPrice > 0
        ? rawOneHourPrice
        : isUsdPair && rawOneHourPriceWpls > 0
            ? rawOneHourPriceWpls
            : getHistoryValueNearHoursAgo(
                history,
                priceProperty,
                1,
                usdSelected,
                usdSelected ? (isUsdPair ? 1 : priceModifier('plsLastHourPrice')) : 1
            )

    const lastSixHourPrice = isPlsWplsMode
        ? 1
        : usdSelected && rawSixHourPrice > 0
        ? rawSixHourPrice
        : isUsdPair && rawSixHourPriceWpls > 0
            ? rawSixHourPriceWpls
            : getHistoryValueNearHoursAgo(
                history,
                priceProperty,
                6,
                usdSelected,
                usdSelected ? (isUsdPair ? 1 : priceModifier('plsLastSixHourPrice')) : 1
            )

    const lastDayPrice = isPlsWplsMode
        ? 1
        : usdSelected && rawOneDayPrice > 0
        ? rawOneDayPrice
        : isUsdPair && rawOneDayPriceWpls > 0
            ? rawOneDayPriceWpls
            : getHistoryValueNearHoursAgo(
                history,
                priceProperty,
                24,
                usdSelected,
                usdSelected ? (isUsdPair ? 1 : priceModifier('plsLastDayPrice')) : 1
            )
            
    const longRangeSource = longHistory?.length ? longHistory : history

    const sevenDaySource = isPls ? history : longRangeSource

    const historySevenDayPrice = isPlsWplsMode
        ? 1
        : getHistoryValueNearDaysAgo(
            sevenDaySource,
            priceProperty,
            7,
            usdSelected,
            usdSelected ? (isUsdPair ? 1 : priceModifier('plsSevenDayPrice')) : 1
        )

    const historyThirtyDayPrice = isPlsWplsMode
        ? 1
        : getHistoryValueNearDaysAgo(
            longRangeSource,
            priceProperty,
            30,
            usdSelected,
            usdSelected ? (isUsdPair ? 1 : priceModifier('plsThirtyDayPrice')) : 1
        )

    const rawThirtyDayPrice =
        candleData?.length
            ? getDailyCandleCloseNearDaysAgo(candleData, 30)
            : 0

    const hasDistinctRawThirtyDayPrice =
        Number.isFinite(rawThirtyDayPrice) &&
        rawThirtyDayPrice > 0 &&
        Number.isFinite(rawSevenDayPrice) &&
        Math.abs(rawThirtyDayPrice - rawSevenDayPrice) > 1e-12

    const coinStats = statsData?.pageProps?.topCoinsMetrics?.find(c => c.symbol === name)

    const percent7dFromStats = Number(coinStats?.percent7d)
    const percent30dFromStats = Number(coinStats?.percent30d)

    const fallbackSevenDayPriceUsd =
        Number.isFinite(percent7dFromStats) && percent7dFromStats !== 0
            ? price / (1 + percent7dFromStats)
            : rawSevenDayPrice

    const fallbackThirtyDayPriceUsd =
        Number.isFinite(percent30dFromStats) && percent30dFromStats !== 0
            ? price / (1 + percent30dFromStats)
            : rawThirtyDayPrice

    const fallbackSevenDayPriceWpls =
        Number.isFinite(fallbackSevenDayPriceUsd) &&
        fallbackSevenDayPriceUsd > 0 &&
        Number.isFinite(priceComparison?.plsSevenDayPrice) &&
        priceComparison.plsSevenDayPrice > 0
            ? fallbackSevenDayPriceUsd / priceComparison.plsSevenDayPrice
            : 0

    const fallbackThirtyDayPriceWpls =
        Number.isFinite(fallbackThirtyDayPriceUsd) &&
        fallbackThirtyDayPriceUsd > 0 &&
        Number.isFinite(priceComparison?.plsThirtyDayPrice) &&
        priceComparison.plsThirtyDayPrice > 0
            ? fallbackThirtyDayPriceUsd / priceComparison.plsThirtyDayPrice
            : 0

    const sevenDayPrice = isPlsWplsMode
        ? 1
        : isPls
            ? (
                usdSelected
                    ? (rawSevenDayPrice || historySevenDayPrice || 0)
                    : (historySevenDayPrice || 1)
            )
            : (usdSelected
                ? (rawSevenDayPrice || fallbackSevenDayPriceUsd || historySevenDayPrice || 0)
                : (fallbackSevenDayPriceWpls || historySevenDayPrice || 0))

    const plsHasDistinct30DayHistory =
        Number.isFinite(historyThirtyDayPrice) &&
        historyThirtyDayPrice > 0 &&
        Number.isFinite(historySevenDayPrice) &&
        Math.abs(historyThirtyDayPrice - historySevenDayPrice) > 1e-12

    const thirtyDayPrice = isPlsWplsMode
        ? 1
        : isPls
            ? (
                usdSelected
                    ? (rawThirtyDayPrice || rawSevenDayPrice || historyThirtyDayPrice || historySevenDayPrice || 0)
                    : (historyThirtyDayPrice || historySevenDayPrice || 1)
            )
            : (usdSelected
                ? (rawThirtyDayPrice || fallbackThirtyDayPriceUsd || historyThirtyDayPrice || 0)
                : (fallbackThirtyDayPriceWpls || historyThirtyDayPrice || 0))
    // removed PLS LONG RANGE DEBUG log


    const priceToUse = isPlsWplsMode ? 1 : (usdSelected ? price : priceWPLS)
    const displayPrice = priceToUse > 999_999 ? fUnit(priceToUse, 2) : formatNumber(priceToUse ?? 0, true, false)

    const overridePercentValue =
        selectedCurrency === 'USD' && !isX && name !== 'PRVX'
            ? percentOverrides?.[selected]
            : undefined

    const overridePercentRaw = Number(overridePercentValue)

    const hasOverridePercent =
        overridePercentValue !== undefined &&
        overridePercentValue !== null &&
        Number.isFinite(overridePercentRaw) &&
        !(
            isPls &&
            (selected === '7D' || selected === '30D') &&
            overridePercentRaw <= -0.995
        )

    const rawChangeDenominator =
        hasOverridePercent
            ? lastPrice / (1 + overridePercentRaw)
            : (
                selected === '1H' ? lastHourPrice :
                selected === '6H' ? lastSixHourPrice :
                selected === '24H' ? lastDayPrice :
                selected === '7D' ? sevenDayPrice :
                selected === '30D' ? thirtyDayPrice :
                lastPrice
            )

    const rawPercentPrice = Number(lastPrice)

    const freezeKey = `${name}|${selected}|${selectedCurrency}`

    const rawDenominator = Number(rawChangeDenominator)

    if (
        Number.isFinite(rawDenominator) &&
        rawDenominator > 0 &&
        frozenDenominatorRef.current[freezeKey] == null
    ) {
        frozenDenominatorRef.current[freezeKey] = rawDenominator
    }

    const shouldBypassFrozenDenominator =
        isPls && (selected === '7D' || selected === '30D')

    const denominator = shouldBypassFrozenDenominator
        ? rawDenominator
        : (frozenDenominatorRef.current[freezeKey] ?? rawDenominator)

    const percentPrice = rawPercentPrice

    const requiredAnchorProperty =
        selected === '1H' ? 'plsLastHourPrice' :
        selected === '6H' ? 'plsLastSixHourPrice' :
        selected === '24H' ? 'plsLastDayPrice' :
        selected === '7D' ? 'plsSevenDayPrice' :
        selected === '30D' ? 'plsThirtyDayPrice' :
        'plsLastPrice'

    const requiredAnchorValue = Number(priceComparison?.[requiredAnchorProperty])

    const hasCandleBackedPercent =
        selected === '1H' ? rawOneHourPrice > 0 :
        selected === '6H' ? rawSixHourPrice > 0 :
        selected === '24H' ? rawOneDayPrice > 0 :
        selected === '7D' ? rawSevenDayPrice > 0 :
        selected === '30D' ? rawThirtyDayPrice > 0 :
        false

    const anchorMissingForUsd =
        usdSelected &&
        !isPls &&
        !isUsdPair &&
        !hasCandleBackedPercent &&
        !hasOverridePercent &&
        (!Number.isFinite(requiredAnchorValue) || requiredAnchorValue <= 0)

    const intradayUsdPairWithoutOverride = false

    const invalidDenominator =
        anchorMissingForUsd ||
        intradayUsdPairWithoutOverride ||
        (!history?.length && !hasCandleBackedPercent && !hasOverridePercent) ||
        !Number.isFinite(denominator) || denominator <= 0 ||
        !Number.isFinite(percentPrice) || percentPrice <= 0

    const percentChangeRaw = invalidDenominator
        ? NaN
        : isX
            ? (percentPrice / denominator)
            : ((percentPrice - denominator) / denominator) * 100
        
    const showMissingLongRange =
        selected === '30D' &&
        !isPlsWplsMode &&
        !hasOverridePercent &&
        isPls &&
        !plsHasDistinct30DayHistory &&
        rawThirtyDayPrice <= 0 &&
        (
            !Number.isFinite(denominator) ||
            denominator <= 0
        )

    const percentChange =
        Number.isFinite(percentChangeRaw) && percentChangeRaw < 0.05 && percentChangeRaw > -0.05
            ? 0
            : percentChangeRaw

    const percentChangeColor =
        (!isX && percentChange > 0.75) || (isX && percentChange > 1.03)
            ? 'rgb(130,255,130)'
            : (!isX && percentChange < -0.75) || (isX && percentChange < 0.97)
                ? 'rgb(255,130,130)'
                : 'rgb(170,170,170)'

    const percentageUnit = isX ? 'x' : '%'

    // removed ROW OVERRIDE DEBUG log

    const rawDisplayPercentValue = hasOverridePercent ? (overridePercentRaw * 100) : percentChange

    const displayPercentValue = rawDisplayPercentValue

    const displayPercentColor =
        hasOverridePercent
            ? (displayPercentValue > 0.75
                ? 'rgb(130,255,130)'
                : displayPercentValue < -0.75
                    ? 'rgb(255,130,130)'
                    : 'rgb(170,170,170)')
            : percentChangeColor

    const percentIsReady =
        hasOverridePercent || Number.isFinite(displayPercentValue)

    const rowIsLoading = !percentIsReady

    const shouldShowPercent =
        percentIsReady || selected === '30D' || selected === '7D'

    useEffect(() => {
        frozenDenominatorRef.current = {}
    }, [selectedCurrency, selected])
    const hidePercentForPls = false

    return <>
        <div style={{
            padding: '15px 10px',
            borderRadius: 10,
            width: '100px'
        }}>
            <div style={{ position: 'relative' }}>
                <div>
                    <ImageContainer source={image} alt={name} size={40}/>
                </div>
                <div style={{ position: 'absolute', left: 50, top: 0 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {name}
                        {rowIsLoading ? (
                            <Tooltip content="Loading Historical Data...">
                                <span className="loading-bar-div">
                                    <LoadingBar estTime={13} completed={!rowIsLoading}/>
                                </span>
                            </Tooltip>
                        ) : null}
                    </span>
                    {!hidePercentForPls && shouldShowPercent ? (
                        <div style={{ position: 'absolute', right: -10, top: 0, transform: 'translateX(100%)' }}>
                            <span style={{ color: displayPercentColor }}>
                                {rowIsLoading
                                    ? ''
                                    : showMissingLongRange
                                        ? '--'
                                        : Number.isFinite(displayPercentValue)
                                            ? `${displayPercentValue.toFixed(isX ? 2 : 1)}${percentageUnit}`
                                            : ''}
                            </span>
                        </div>
                    ) : null}
                </div>
                    <></>
                <div style={{ position: 'absolute', left: 50, bottom: 0 }}>
                    <div>
                        <span style={{ fontSize: 15, letterSpacing: 1, whiteSpace: 'nowrap' }}>
                            {usdSelected ? <span style={{ fontSize: 14 }}>$ </span> : ''}
                            {displayPrice ?? '-'}
                            {usdSelected ? '' : <span style={{ fontSize: 12 }}> {isPls ? 'WPLS' : 'WPLS'}</span>}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </>
}
