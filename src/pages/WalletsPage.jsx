// WalletsPage.jsx
import styled from "styled-components"
import Button from "../components/Button"
import { defaultTokenInformation, liquidityPairs } from "../lib/tokens"
import { formatDatetime } from "../lib/date"
import { hiddenWalletsAtom, hideHexMinersAtom, hideZeroValueAtom, liquiditySearchModalAtom, tokensModalAtom, walletsModalAtom } from "../store"
import { useAtom } from "jotai"
import { useAppContext } from "../shared/AppContext"
import Tooltip from "../shared/Tooltip"
import React, { memo, useMemo, useEffect, useRef, useState } from "react"
import SingleTokenButton from "../components/PricePage/SingleTokenButton"
import LoadingWave from "../components/LoadingWave"
import PriceJumbo from "../components/PricePage/PriceJumbo"
import SingleLPButton from "../components/PricePage/SingleLPButton"
import { addCommasToNumber, fUnit } from "../lib/numbers"
import SingleFarmButton from "../components/PricePage/SingleFarmButton"
import { useWallets } from "../hooks/useWallets"
import { icons_list } from "../config/icons"
import Icon from "../components/Icon"
import PricesComponent from "../components/PricesComponent"
import { StakeComponent } from "../components/PricePage/StakeComponent"
import { parseHexStats } from "../lib/hex"
import { LoadingBar } from "../components/LoadingBar"
import useFilterBalance from "../hooks/useFilterBalance"
import PricesComponentV2 from "../components/PricesComponentV2"
import HexComponent from "../components/HexComponent"

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
    .hex-icon-off {
        svg path {
            fill: #808080;
        }
    }
    .hex-icon-on {
        svg {
            filter: grayscale(.5);
            fill: white;
        }
    }

    // @media (min-width: 650px) {
    //     .mobile-only {
    //         display: none;
    //     }
    // }

    @media (max-width: 650px) {
        min-width: calc( 100dvw - 40px );
        max-width: calc( 100dvw - 40px );
        // min-width: calc( 100dvw );
        // max-width: calc( 100dvw );
        .price-name {
            font-size: 14px !important;
            max-width: 150px;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .price-balance {
            font-size: 16px !important;
        }
        
        // .desktop-only {
        //     display: none;
        // }
    }
`
export default memo(WalletsPage)
function WalletsPage ({priceData, balanceData, farmData, lpData, historyData, hexData}) {
    const { pricePairs, prices, priceLastUpdated } = priceData
    const { balances, combinedBalances } = balanceData
    const { data, getImage } = useAppContext()

    const [ tokenModal, setTokenModal ] = useAtom(tokensModalAtom)
    const [ liquiditySearchModal, setLiquiditySearchModal ] = useAtom(liquiditySearchModalAtom)
    const [ walletModal, setWalletModal ] = useAtom(walletsModalAtom)

    const [ hiddenWallets ] = useAtom(hiddenWalletsAtom)
    const { toggleWalletVisibility, visibleWallets, isHidden } = useWallets(data?.wallets)

    const watchlist = data?.watchlist ?? {}
    const [ hideZeroValue, setHideZeroValue ] = useAtom(hideZeroValueAtom)
    const [ hideHexMiners, setHideHexMiners ] = useAtom(hideHexMinersAtom)
    const [ pulseMetrics, setPulseMetrics ] = useState([])
    const [ cachedPulseOverrides, setCachedPulseOverrides ] = useState(() => {
        try {
            const cachedOverrides = localStorage.getItem('pulsePercentOverrides')
            const parsedOverrides = cachedOverrides ? JSON.parse(cachedOverrides) : {}

            if (parsedOverrides?.WPLS && !parsedOverrides?.PLS) {
                parsedOverrides.PLS = parsedOverrides.WPLS
            }

            if (parsedOverrides?.PLS) {
                return parsedOverrides
            }

            const cachedRowsRaw = localStorage.getItem('pulseMetrics')
            const cachedRows = cachedRowsRaw ? JSON.parse(cachedRowsRaw) : []

            if (!Array.isArray(cachedRows) || cachedRows.length === 0) {
                return parsedOverrides
            }

            const rebuilt = cachedRows.reduce((acc, coin) => {
            const symbol = coin?.symbol
            if (!['PLS', 'WPLS', 'PLSX', 'INC', 'HEX'].includes(symbol)) return acc

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

            if (rebuilt?.PLS) {
                try {
                    localStorage.setItem('pulsePercentOverrides', JSON.stringify(rebuilt))
                } catch {}
            }

            return Object.keys(rebuilt).length > 0 ? rebuilt : parsedOverrides
        } catch {
            return {}
        }
    })

    const priceArray = Object.keys(prices)
    const pricesLoaded = priceArray.length > 0

    const { 
        addressFarmRewards, 
        lps, 
        farm, 
        addressData, 
        displayLps, 
        addressLps, 
        displayFarms, 
        addressFarms, 
        addressBalances, 
        displayDefaultTokens, 
        displayLiquidityPools 
    } = useFilterBalance({ balanceData, farmData, lpData, hiddenWallets, visibleWallets, hideZeroValue, data })

    const stakes = Array.isArray(hexData?.combinedStakes) ? (hexData?.combinedStakes ?? []).filter( f => f?.address && !(hiddenWallets ?? []).includes(f.address.toLowerCase())) : []
    const stakeStats = parseHexStats(stakes)

    const hexPrice = (prices?.['0x2b591e99afe9f32eaa6214f7b7629768c40eeb39']?.priceUsd ?? 0)
    const stakesUsdValue = (stakeStats?.totalFinalHex ?? 0) * hexPrice
    const incPriceUsd = Number(prices?.['0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d']?.priceUsd ?? 0)

    const grandTotal = parseFloat(parseFloat(hideHexMiners ? 0 : stakesUsdValue) + parseFloat(addressBalances ?? 0) + parseFloat(addressFarms ?? 0) + parseFloat(addressLps ?? 0) ).toFixed(2)
    const loading = balanceData?.loading || farmData?.loading || lpData?.loading
    const loadingStatuses = {
        Balances: balanceData?.loading,
        Farms: farmData?.loading,
        'Liquidity Pools': lpData?.loading
    }
    const [incPerDay, setIncPerDay] = useState(() => {
    return Number(localStorage.getItem('incPerDay') ?? 0)
    })

    useEffect(() => {
        const fetchPulseMetrics = async () => {
            try {
                const raw = await window.electron.getFile("https://pulsecoinlist.com/stats")

                const payload =
                    typeof raw === 'string'
                        ? JSON.parse(raw)
                        : raw

                const rows =
                    Array.isArray(payload?.pageProps?.topCoinsMetrics) ? payload.pageProps.topCoinsMetrics :
                    Array.isArray(payload?.topCoinsMetrics) ? payload.topCoinsMetrics :
                    Array.isArray(payload) ? payload :
                    []

                console.log("PULSE METRICS NORMALIZED:", rows)

                console.log(
                    "PULSE METRICS SYMBOLS:",
                    rows.map(r => r.symbol)
                    )

                if (Array.isArray(rows) && rows.length > 0) {
                    setPulseMetrics(rows)

                    const mapped = rows.reduce((acc, coin) => {
                    const symbol = coin?.symbol
                    if (!['PLS', 'WPLS', 'PLSX', 'INC', 'HEX'].includes(symbol)) return acc

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

                    setCachedPulseOverrides(mapped)

                    try {
                        localStorage.setItem('pulseMetrics', JSON.stringify(rows))
                        localStorage.setItem('pulsePercentOverrides', JSON.stringify(mapped))
                    } catch (err) {
                        console.warn('Failed to cache pulse metrics', err)
                    }
                } else {
                    console.warn('Pulse metrics fetch returned empty rows, keeping cached values')
                }
            } catch (err) {
                console.error("PulseCoinList fetch failed", err)
                setPulseMetrics(prev => Array.isArray(prev) ? prev : [])
            }
        }

        fetchPulseMetrics()
    }, [])

    const incUsdPerDay = incPerDay * incPriceUsd
    const prevIncRef = useRef(
    Number(localStorage.getItem('prevInc') ?? null)
    )

    const prevTimeRef = useRef(
    Number(localStorage.getItem('prevTime') ?? null)
    )

    useEffect(() => {
    if (!addressFarmRewards?.raw) return

  const currentInc = Number(addressFarmRewards.normalized ?? 0)
  const now = Date.now()

  if (prevIncRef.current !== null && prevTimeRef.current !== null) {
  const deltaInc = currentInc - prevIncRef.current
  const deltaTime = (now - prevTimeRef.current) / 1000

  if (deltaTime >= 300 && deltaInc > 0) {
    const perSecond = deltaInc / deltaTime
    const perDay = perSecond * 86400

    setIncPerDay(prev => {
      const newValue = prev === 0 ? perDay : (prev * 0.8 + perDay * 0.2)
  localStorage.setItem('incPerDay', Number(newValue.toFixed(6)))
  return newValue
})

    prevIncRef.current = currentInc
    prevTimeRef.current = now
    localStorage.setItem('prevInc', currentInc)
    localStorage.setItem('prevTime', now)
  }
} else {
  prevIncRef.current = currentInc
  prevTimeRef.current = now
  localStorage.setItem('prevInc', currentInc)
  localStorage.setItem('prevTime', now)
}
}, [addressFarmRewards?.raw])
const incRewards = addressFarmRewards?.normalized && addressFarmRewards?.normalized > 0.01
const hasHexStakes = hexData?.combinedStakes.length > 0

    return <Wrapper>
        {pricesLoaded ? <div>
            <PriceJumbo balance={grandTotal} wallets={data?.wallets} loading={loading} isFiltered={hiddenWallets.length > 0} loadingStatuses={loadingStatuses} bestStable={priceData?.bestStable}/>
            <div style={{ textAlign: 'right', position: 'relative'}}> 
                <div style={{ position: 'absolute', left: 0, display: 'inline-block'}}>
                    <Tooltip content={hideZeroValue ? 'Show All Tokens' : 'Hide Tokens Not Held'}>
                        <Button parentStyle={{ width: 50, display: 'inline-block', marginRight: 5 }} textAlign={'center'} onClick={() => setHideZeroValue(!hideZeroValue)}>
                            <Icon icon={icons_list?.[hideZeroValue ? 'no-circle' : 'circle']} size={15}/> 
                        </Button>
                    </Tooltip>
                    {hasHexStakes && <Tooltip content={hideHexMiners ? 'Show Hex Miners' : 'Hide Hex Miners'}>
                        <Button parentStyle={{ width: 50, display: 'inline-block', marginRight: 5 }} textAlign={'center'} onClick={() => setHideHexMiners(!hideHexMiners)} customClass={`${hideHexMiners ? 'hex-icon-off' : 'hex-icon-on'}`}>
                            <Icon icon={icons_list?.['hex']} size={15}/> 
                        </Button>
                    </Tooltip>}
                </div>
                <Tooltip content="Manage Wallet Addresses">
                    <Button parentStyle={{ width: 75, display: 'inline-block', marginRight: 5 }} textAlign={'center'} onClick={() => setWalletModal(true)}>
                        Wallets
                    </Button>
                </Tooltip>
                <Tooltip content="Manage Token Watchlist">
                    <Button parentStyle={{ width: 75, display: 'inline-block', marginRight: 5 }} textAlign={'center'} onClick={() => setTokenModal(true)}>
                        Tokens
                    </Button>
                </Tooltip>
                <Tooltip content="Manage Liquidity Watchlist">
                    <Button parentStyle={{ width: 75, display: 'inline-block' }} textAlign={'center'} onClick={() => setLiquiditySearchModal(true)}>
                        Liquidity
                    </Button>
                </Tooltip>
            </div>
            <div style={{ marginTop: 70, marginBottom: 50 }}>
                <PricesComponentV2
                    historyData={historyData}
                    priceData={priceData}
                    getImage={getImage}
                    pulseMetrics={Array.isArray(pulseMetrics) && pulseMetrics.length > 0 ? pulseMetrics : cachedPulseOverrides}
                />
            </div>
            {hasHexStakes ? <div>
                <StakeComponent visibleWallets={visibleWallets} disabled={hideHexMiners} hexData={hexData} hexPrice={prices?.['0x2b591e99afe9f32eaa6214f7b7629768c40eeb39']} hiddenWallets={hiddenWallets}/>

                {!hideHexMiners && <HexComponent hexData={hexData} visibleWallets={visibleWallets} hexPrice={prices?.['0x2b591e99afe9f32eaa6214f7b7629768c40eeb39']} aliases={data?.aliases ?? {}}/>}
            </div> : ''}
            <div>
                <div style={{ position: 'relative', height: 16, width: '100%', marginTop: 40 }}>
                    <div style={{ position: 'absolute', left: 0, bottom: 10, letterSpacing: 0.5 }} >
                        Token Watchlist • <span style={{ letterSpacing: 1 }}> $ { addCommasToNumber(parseFloat(addressBalances ?? 0 ).toFixed(2)) }</span>
                    </div>
                    {balanceData?.loading === true? <div style={{ position: 'absolute', right: -40, top: -20}}>
                        <Tooltip content="Retrieving Updated Balances">
                            <LoadingWave speed={100} numDots={8}/>
                        </Tooltip>
                    </div> : ''}
                </div>
    
                <div>
                    {displayDefaultTokens.map((token, i) => {                    
                        const watchlistData = watchlist?.[token]
                        const pairId = watchlistData ? token 
                            : token == '0xa1077a294dde1b09bb078844df40758a5d0f9a27' ? '0xe56043671df55de5cdf8459710433c10324de0ae'
                            : Object.keys(liquidityPairs).find(pairId => liquidityPairs[pairId]?.token0?.id.toLowerCase() === token.toLowerCase() || liquidityPairs[pairId]?.token1?.id.toLowerCase() === token.toLowerCase())
                        const tokenAddress = watchlistData ? watchlistData?.token?.address : token

                        const hide = (parseFloat(addressData?.[tokenAddress]?.normalized ?? 0) < .001) && hideZeroValue 
                        
                        if (hide) return null 

                        return <SingleTokenButton 
                            balances={addressData}
                            tokenAddress={tokenAddress}
                            key={`${pairId}-${i}`}
                            watchlistData={watchlistData} 
                            pairId={pairId} 
                            prices={prices} 
                            getImage={getImage} 
                            priceArray={priceArray} 
                        />
                    })}
                </div>

                <div>
                    <div style={{ position: 'relative', marginTop: 50, minHeight: 5 }}>
                        <div style={{ position: 'absolute', left: 0, top: -35, width: '100%', letterSpacing: 0.5 }}>
                            Liquidity Pools • {farmData?.loading === true || lpData?.loading === true ? 'Loading' : <span style={{ letterSpacing: 1 }}>$ { addCommasToNumber( parseFloat(parseFloat(addressFarms ?? 0 ) + parseFloat(addressLps ?? 0)).toFixed(2) ) }</span>}
                            {farmData?.loading === true || lpData?.loading === true ? <div style={{ position: 'absolute', right: incRewards ? 50: -40, top: -5}}>
                                <Tooltip content="Retrieving PulseX Farm Data">
                                    <LoadingWave speed={100} numDots={8}/>
                                </Tooltip>
                            </div> : ''}
                            <div style={{ position: 'absolute', right: 0, bottom: 0, fontSize: 15 }} className="mute">
                                {incRewards ? <div>
                                    <Tooltip content="PulseX Farm Rewards">
                                        {addressFarmRewards?.normalized < 100_000 
                                            ? addCommasToNumber(parseFloat(addressFarmRewards?.normalized).toFixed(3))
                                            : fUnit( parseFloat(addressFarmRewards?.normalized), 3)
                                        } <Icon icon={icons_list.farm} size={15}/>
                                    </Tooltip>
                                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                                            ~ {Number.isFinite(incPerDay) ? incPerDay.toFixed(2) : '0.00'} INC/day
                                            {' '}
                                            ($ {Number.isFinite(incUsdPerDay) ? addCommasToNumber(incUsdPerDay.toFixed(2)) : '0.00'}/day)
                                    </div>
                                </div> : ''}
                            <div/>
                        </div>
                        </div>
                        {displayLiquidityPools.map((poolData, i) => {

                            const props = {
                                poolData,
                                addressData: poolData.type === 'lp' ? lps?.[poolData?.lpAddress] : farm?.[poolData?.lpAddress],
                                prices,
                                getImage,
                                priceArray
                            }
                            return poolData.type === 'lp' ? <SingleLPButton key={`dlp-${i}`} {...props}/> : <SingleFarmButton key={`dfarm-${i}`} {...props}/>
                        })}
                    </div>
                </div>
            </div>
        </div> 
        : <div style={{ textAlign: 'center', position: 'absolute', left: '50%', top: '45%', transform: 'translateX(-50%) translateY(-50%)' }}>
            <div style={{ display: "inline-block"}}>            
                <LoadingWave speed={100} numDots={8}/>
                <br/>Retrieving Latest Prices<br/>
            </div>
        </div>}
    </Wrapper>
}