import styled from 'styled-components'
import ImageContainer from '../components/ImageContainer'
import ImgPls from '../icons/pls.png'
import ImgPlsx from '../icons/plsx.png'
import ImgHex from '../icons/hex.png'
import ImgInc from '../icons/inc.png'
import { formatNumber, fUnit } from '../lib/numbers'
import { Selector } from '../components/Selector'
import { useCallback, useMemo, useState } from 'react'
import { useAtom } from 'jotai'
import { timeframeAtom } from '../store'
import { icons_list } from '../config/icons'
import Icon from '../components/Icon'

const Wrapper = styled.div`
    color: white;
    padding: 5px;

    .mini-button {
        position: absolute;
        top: 10px;
        right: 15px;
        width: 24px; height: 24px;
        border-radius: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgb(30,30,30);
        color: rgb(150,150,150);
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
            background: rgb(40,40,40);
            color: rgb(200,200,200);
        }
    }
`

const PriceWrapper = styled.div`
    display: inline-block;
    padding: 10px 15px;
    width: 90px;
    text-align: center;
`
 
export default function MiniPage({ priceData, historyData, bestStable, wplsPrice, getImage, toggleMode }) {
    const { prices } = priceData
    const { history } = historyData
    const [selected, setSelected] = useAtom(timeframeAtom)
    const getImageMemo = useCallback(getImage ?? (() => {}), []);

    const handleToggleMode = () => {
        toggleMode?.()
    }

    if (typeof prices !== 'object' || Object.keys(prices).length === 0) {
        return <div>
            Loading
        </div>
    }

    const plsHistory = history?.[bestStable?.pair ?? '0xa1077a294dde1b09bb078844df40758a5d0f9a27'] ?? []

    const invert = priceData?.bestStable?.invert ? true : false
    const historyProperty = invert ? 'priceInverted' : 'price'
    const plsAllTimeLowPrice = 0.000009536
    const plsLastPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - 1][historyProperty] : 0
    const plsLastHourPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - 2][historyProperty] : 0
    const plsLastSixHourPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - 6][historyProperty] : 0
    const plsLastDayPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - 24][historyProperty] : 0
    const plsSevenDayPrice = plsHistory && plsHistory.length > 1 ? plsHistory[plsHistory.length - (24 * 7)][historyProperty] : 0

    const priceComparison = {
        plsLastDayPrice,
        plsSevenDayPrice,
        plsLastHourPrice,
        plsLastPrice,
        plsLastSixHourPrice,
        plsAllTimeLowPrice
    }

    const items = [
        {
            invert,
            price: prices?.['0xa1077a294dde1b09bb078844df40758a5d0f9a27'],
            history: history?.[bestStable?.pair ?? '0xa1077a294dde1b09bb078844df40758a5d0f9a27'] ?? [],
            image: ImgPls,
            'lows': {
                'price': 0.00001654,
                'priceWPLS': 0.00001654,
            },
        },
        {
            price: prices?.['0x95b303987a60c71504d99aa1b13b4da07b0790ab'],
            history: history?.[prices?.['0x95b303987a60c71504d99aa1b13b4da07b0790ab'].pairId] ?? [],
            image: ImgPlsx,
            'lows': {
                'price': 0.000008904 ,
                'priceWPLS': 0.2346,
            },
        },
        {
            price: prices?.['0x2b591e99afe9f32eaa6214f7b7629768c40eeb39'],
            history: history?.[prices?.['0x2b591e99afe9f32eaa6214f7b7629768c40eeb39'].pairId] ?? [],
            image: ImgHex,
            'lows': {
                'price': 0.003633,
                'priceWPLS': 80.3703,
            },
        },
        {
            price: prices?.['0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d'],
            history: history?.[prices?.['0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d'].pairId] ?? [], 
            image: ImgInc,
            'lows': {
                'price': 0.3947,
                'priceWPLS': 8467.35,
            },            
        }
    ]

    const favoriteDisplayArray = []
    // const favoriteDisplayArray = useMemo(() => [
    //     "0x02dcdd04e3f455d838cd1249292c58f3b79e3c3c",
    // ].map(address => {
    //     const data = prices?.[address]
    //     if (!data) return null
    //     return {
    //         'name': data?.symbol,
    //         'price': data,
    //         //'priceWPLS': data?.priceWpls,
    //         'history': history?.[data?.pairId] ?? [],
    //         'lows': {
    //             'price': parseFloat(data?.priceUsd).toFixed(7),
    //             'priceWPLS': parseFloat(data?.priceWpls).toFixed(7),
    //         },
    //         'image': getImageMemo(address)
    //     }
    // }), [prices, history, getImageMemo])
    
    return <Wrapper>
        <div>
            <div>
                <Selector options={['1H', '6H', '24H', '7D','ATL']} value={selected} onChange={setSelected} />
                <div className='mini-button' onClick={handleToggleMode}>
                    <Icon icon={icons_list['pip-out']} size={20}/>
                </div>
            </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', alignItems: 'center' }}>
            {items.map((m, i) => {
                return <PriceItem {...m} key={`p-${i}`} priceComparison={priceComparison} priceWPLS={wplsPrice} selected={selected} />
            })}
            {favoriteDisplayArray.map((m, i) => {
                return <PriceItem {...m} key={`p-${i}`} priceComparison={priceComparison} priceWPLS={wplsPrice} selected={selected} fav={true} />
            })}
        </div>
    </Wrapper> 
 }

 function PriceItem ({price, image, priceComparison, invert = false, priceWPLS, lows, history, selected, fav = false }) {


    const priceRaw = parseFloat(price?.priceUsd ?? 0)
    // const decimals = priceRaw > 0.98 ? 2 : 7
    // const displayPrice =  priceRaw > 0.98 ? fUnit(priceRaw, decimals) : parseFloat(priceRaw).toFixed(decimals)
    const isPls = price?.symbol === 'WPLS'
    const selectedCurrency = 'USD'

    const priceModifier = (property) => isPls ? 1 : priceComparison[property]

    const priceProperty = invert ? 'priceInverted' : 'price'
    const usdSelected = selectedCurrency === 'USD' || selectedCurrency === 'X'

    const lastPrice = isPls ? (invert ? price.priceUsd : price?.priceUsd)
        : usdSelected ? (invert ? priceWPLS : price?.priceUsd) : (invert ? price?.priceUsd : priceWPLS)
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

    const priceToUse = usdSelected ? price?.priceUsd : priceWPLS
    const displayPrice = priceToUse > 999_999 ? fUnit(priceToUse, 2) : formatNumber(priceToUse ?? 0, true, false)

    const changeDenominator = selected === '1H' ? lastHourPrice : selected === '6H' ? lastSixHourPrice : selected === '24H' ? lastDayPrice : selected === '7D' ? sevenDayPrice : selected === 'ATL' ? allTimeLowPrice : lastPrice
    const percentPrice = selected === 'ATL' ? (usdSelected ? price?.priceUsd : priceWPLS) : lastPrice
    const percentChangeRaw = 
        selectedCurrency === 'X' ? (percentPrice / changeDenominator)
        : (percentPrice / changeDenominator - 1) * 100
    const percentChange = percentChangeRaw < 0.05 && percentChangeRaw > -0.05 ? 0 : percentChangeRaw
    const isX = selectedCurrency === 'X'
    const percentChangeColor = (!isX && percentChange > 0.75) || (isX && percentChange > 1.03) ? 'rgb(130,255,130)' : (!isX && percentChange < -0.75) || (isX && percentChange < 0.97) ? 'rgb(255,130,130)' : 'rgb(170,170,170)'
    const percentageUnit = selectedCurrency === 'X' ? 'x' : '%'

    const percentDisplay = parseFloat(percentChange).toFixed(1)

    return <PriceWrapper>
        <div style={{  textAlign: 'center', position: 'relative', height: 27 }}>
            <div style={{ display: 'inline-block', position: 'absolute', top: 0, left: 0 }}>
                <ImageContainer source={image} />
            </div>
            <div style={{ display: 'inline-block', color: percentChangeColor, top: 3, left: 35, position: 'absolute', textAlign: 'left'}}>
                {fav && selected === 'ATL' ? '-' : `${percentDisplay} %`}
            </div>
        </div>
        <div style={{ textAlign: 'left' }}>
            $ {displayPrice}
        </div>
    </PriceWrapper>
 }
