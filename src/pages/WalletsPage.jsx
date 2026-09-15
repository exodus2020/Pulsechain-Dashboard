// WalletsPage.jsx
import styled from "styled-components"
import Button from "../components/Button"
import { defaultTokenInformation, liquidityPairs } from "../lib/tokens"
import { hiddenWalletsAtom, hideHexMinersAtom, hideZeroValueAtom, liquiditySearchModalAtom, tokensModalAtom, walletsModalAtom, timeframeAtom } from "../store"
import { useAtom } from "jotai"
import { useAppContext } from "../shared/AppContext"
import Tooltip from "../shared/Tooltip"
import React, { memo, useMemo, useEffect, useState } from "react"
import SingleTokenButton from "../components/PricePage/SingleTokenButton"
import LoadingWave from "../components/LoadingWave"
import PriceJumbo from "../components/PricePage/PriceJumbo"
import SingleLPButton from "../components/PricePage/SingleLPButton"
import { addCommasToNumber, fUnit } from "../lib/numbers"
import SingleFarmButton from "../components/PricePage/SingleFarmButton"
import { useWallets } from "../hooks/useWallets"
import { icons_list } from "../config/icons"
import Icon from "../components/Icon"
import { StakeComponent } from "../components/PricePage/StakeComponent"
import { parseHexStats } from "../lib/hex"
import useFilterBalance from "../hooks/useFilterBalance"
import PricesComponentV2 from "../components/PricesComponentV2"
import HexComponent from "../components/HexComponent"
import ScenarioPanel, { SCENARIO_CORE_TOKENS } from "../components/PricePage/ScenarioPanel"

const Wrapper = styled.div`
    color: white;
    min-width: 825px;
    max-width: 825px;
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

    @media (max-width: 825px) {
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
function getDailyCandleCloseNearDaysAgo(candles, daysAgo) {
    if (!Array.isArray(candles) || candles.length === 0) return 0

    const targetTime = Date.now() - (daysAgo * 24 * 60 * 60 * 1000)

    const valid = candles.filter(c => Number(c.timestamp) <= targetTime)

    if (valid.length === 0) return 0

    const closest = valid.reduce((prev, curr) => {
        return (targetTime - curr.timestamp) < (targetTime - prev.timestamp)
            ? curr
            : prev
    })

    const close = Number(closest?.close)
    return Number.isFinite(close) && close > 0 ? close : 0
}

function getHourlyCandleCloseNearHoursAgo(candles, hoursAgo) {
    if (!Array.isArray(candles) || candles.length === 0) return 0

    const targetTime = Date.now() - (hoursAgo * 60 * 60 * 1000)

    // ONLY allow candles BEFORE target time
    const valid = candles.filter(c => Number(c.timestamp) <= targetTime)

    if (valid.length === 0) return 0

    // take closest BEFORE (not absolute closest)
    const closest = valid.reduce((prev, curr) => {
        return (targetTime - curr.timestamp) < (targetTime - prev.timestamp)
            ? curr
            : prev
    })

    const close = Number(closest?.close)
    return Number.isFinite(close) && close > 0 ? close : 0
}

export default memo(WalletsPage)
function WalletsPage ({
    priceData,
    balanceData,
    farmData,
    lpData,
    historyData,
    hexData,
    hexDcaData,
    tokenPnlData
}) {
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
    const [ selectedTimeframe ] = useAtom(timeframeAtom)
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
            if (!['PLS', 'WPLS', 'PLSX', 'INC', 'HEX', 'PRVX'].includes(symbol)) return acc

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

    const [ scenarioEnabled, setScenarioEnabled ] = useState(false)
    const [ scenarioMultiplier, setScenarioMultiplier ] = useState('')
    const [ scenarioManualPrices, setScenarioManualPrices ] = useState({})

    // Built-in, read-only scenario shipped with the app. These are USD all-time-high
    // prices recorded for the PulseChain versions of the core assets. Keeping this
    // scenario in code guarantees every install has it, even after localStorage is
    // cleared, while user-created scenarios remain local and editable.
    const ATH_SCENARIO = {
        name: 'ATH',
        multiplier: '',
        locked: true,
        builtIn: true,
        targetPrices: {
            '0xa1077a294dde1b09bb078844df40758a5d0f9a27': '0.0003206',
            '0x95b303987a60c71504d99aa1b13b4da07b0790ab': '0.0001392',
            '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39': '0.04079',
            '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d': '10.19',
            '0xf6f8db0aba00007681f8faf16a0fda1c9b030b11': '0.0001384'
        }
    }

    const [ savedScenarios, setSavedScenarios ] = useState(() => {
        try {
            const parsed = JSON.parse(localStorage.getItem('pulseSavedScenarios') || '[]')
            const userScenarios = (Array.isArray(parsed) ? parsed : [])
                .filter(item => String(item?.name ?? '').toLowerCase() !== 'ath')
            return [ATH_SCENARIO, ...userScenarios]
        } catch {
            return [ATH_SCENARIO]
        }
    })

    useEffect(() => {
        try {
            localStorage.setItem('pulseSavedScenarios', JSON.stringify(savedScenarios))
        } catch {}
    }, [savedScenarios])

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
    const incPerDay = Object.values(farm ?? {}).reduce(
        (total, farmPosition) =>
            total + Number(farmPosition?.incPerDay ?? 0),
        0
    )


    const walletAddresses = Object.keys(data?.wallets ?? {})
        .map(address => address.toLowerCase())

    const hiddenWalletAddresses = new Set(
        (hiddenWallets ?? []).map(address => address.toLowerCase())
    )

    const allWalletsHidden =
        walletAddresses.length > 0 &&
        walletAddresses.every(address =>
            hiddenWalletAddresses.has(address)
        )

    const calculatedGrandTotal =
        parseFloat(hideHexMiners ? 0 : stakesUsdValue) +
        parseFloat(addressBalances ?? 0) +
        parseFloat(addressFarms ?? 0) +
        parseFloat(addressLps ?? 0)

    const grandTotal = allWalletsHidden
        ? '0.00'
        : parseFloat(calculatedGrandTotal).toFixed(2)

    const scenarioPriceFor = (address) => {
        const key = String(address ?? '').toLowerCase()
        const livePrice = Number(prices?.[key]?.priceUsd ?? prices?.[address]?.priceUsd ?? 0)
        if (!scenarioEnabled || !Number.isFinite(livePrice) || livePrice <= 0) return livePrice

        const manual = Number(scenarioManualPrices?.[key])
        if (String(scenarioManualPrices?.[key] ?? '').trim() !== '' && Number.isFinite(manual) && manual >= 0) {
            return manual
        }

        const multiplier = Number(scenarioMultiplier)
        if (String(scenarioMultiplier ?? '').trim() !== '' && Number.isFinite(multiplier) && multiplier >= 0) {
            return livePrice * multiplier
        }

        return livePrice
    }

    const isScenarioCoreToken = (address) => {
        const key = String(address ?? '').toLowerCase()
        return SCENARIO_CORE_TOKENS.some(token => token.address === key)
    }

    const incUsdPerDay = incPerDay * (scenarioEnabled ? scenarioPriceFor('0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d') : incPriceUsd)

    const scenarioPositionUsd = (position, token0Address, token1Address, includeRewards = false) => {
        const tokenValue = (leg, address) => {
            const liveUsd = Number(leg?.usd ?? 0)
            const units = Number(leg?.normalized ?? 0)
            const key = String(address ?? '').toLowerCase()
            if (!scenarioEnabled || !isScenarioCoreToken(key)) return liveUsd
            const simulated = Number(scenarioPriceFor(key))
            return Number.isFinite(units) && Number.isFinite(simulated) ? units * simulated : liveUsd
        }

        let total = tokenValue(position?.token0, token0Address) + tokenValue(position?.token1, token1Address)
        if (includeRewards) {
            const incAddress = '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d'
            const rewardUnits = Number(position?.rewards?.normalized ?? 0)
            const rewardLiveUsd = Number(position?.rewards?.usd ?? 0)
            const rewardPrice = Number(scenarioPriceFor(incAddress))
            total += scenarioEnabled && Number.isFinite(rewardUnits) && Number.isFinite(rewardPrice)
                ? rewardUnits * rewardPrice
                : rewardLiveUsd
        }
        return total
    }

    const scenarioAddressBalances = useMemo(() => {
        if (!scenarioEnabled) return Number(addressBalances ?? 0)

        // Rebuild the liquid-token total directly from the visible token positions.
        // Do not start with addressBalances and apply a price delta: addressBalances.usd
        // can briefly reflect an older price refresh than the live `prices` object. When
        // changing from a high scenario multiple to a lower one that mismatch caused a
        // transient double-count/overshoot in the jumbo portfolio total. Core tokens are
        // valued directly at their scenario target price; every other token keeps its
        // already-computed live USD value.
        const total = Object.entries(addressData ?? {}).reduce((sum, [address, position]) => {
            const key = String(address ?? '').toLowerCase()
            const liveUsd = Number(position?.usd ?? 0)

            if (!isScenarioCoreToken(key)) {
                return sum + (Number.isFinite(liveUsd) ? liveUsd : 0)
            }

            const units = Number(position?.normalized ?? 0)
            const simulatedPrice = Number(scenarioPriceFor(key))
            const scenarioUsd = Number.isFinite(units) && Number.isFinite(simulatedPrice)
                ? units * simulatedPrice
                : liveUsd

            return sum + (Number.isFinite(scenarioUsd) ? scenarioUsd : 0)
        }, 0)

        return Math.max(0, total)
    }, [scenarioEnabled, scenarioMultiplier, scenarioManualPrices, addressBalances, addressData, prices])

    const scenarioHexPriceUsd = scenarioEnabled
        ? scenarioPriceFor('0x2b591e99afe9f32eaa6214f7b7629768c40eeb39')
        : hexPrice

    const scenarioStakesUsdValue = Number(stakeStats?.totalFinalHex ?? 0) * Number(scenarioHexPriceUsd ?? 0)

    const scenarioAddressFarms = useMemo(() => {
        if (!scenarioEnabled) return Number(addressFarms ?? 0)
        return Object.values(farm ?? {}).reduce((total, position) => {
            return total + scenarioPositionUsd(position, position?.token0Address, position?.token1Address, true)
        }, 0)
    }, [scenarioEnabled, scenarioMultiplier, scenarioManualPrices, addressFarms, farm, prices])

    const scenarioAddressLps = useMemo(() => {
        if (!scenarioEnabled) return Number(addressLps ?? 0)
        return Object.values(lps ?? {}).reduce((total, position) => {
            return total + scenarioPositionUsd(position, position?.token0Address, position?.token1Address, false)
        }, 0)
    }, [scenarioEnabled, scenarioMultiplier, scenarioManualPrices, addressLps, lps, prices])

    const scenarioGrandTotal = scenarioEnabled
        ? (allWalletsHidden
            ? 0
            : Math.max(0,
                Number(hideHexMiners ? 0 : scenarioStakesUsdValue) +
                Number(scenarioAddressBalances ?? 0) +
                Number(scenarioAddressFarms ?? 0) +
                Number(scenarioAddressLps ?? 0)
            ))
        : Number(grandTotal ?? 0)

    const resetScenario = () => {
        setScenarioMultiplier('')
        setScenarioManualPrices({})
    }

    const saveScenario = (name, targetPrices, multiplier = '') => {
        const trimmedName = String(name ?? '').trim()
        if (!trimmedName) return false
        // ATH is a protected built-in preset and cannot be overwritten.
        if (trimmedName.toLowerCase() === 'ath') return false

        const normalizedTargets = SCENARIO_CORE_TOKENS.reduce((acc, { address }) => {
            const value = Number(targetPrices?.[address])
            if (Number.isFinite(value) && value >= 0) acc[address] = String(value)
            return acc
        }, {})

        const nextScenario = {
            name: trimmedName,
            multiplier: String(multiplier ?? ''),
            targetPrices: normalizedTargets,
            updatedAt: Date.now()
        }

        setSavedScenarios(prev => {
            const withoutSameName = (prev ?? []).filter(item => String(item?.name ?? '').toLowerCase() !== trimmedName.toLowerCase())
            return [...withoutSameName, nextScenario].sort((a, b) => String(a.name).localeCompare(String(b.name)))
        })
        return true
    }

    const loadScenario = (name) => {
        const found = (savedScenarios ?? []).find(item => item?.name === name)
        if (!found) return false
        setScenarioMultiplier(String(found?.multiplier ?? ''))
        setScenarioManualPrices({ ...(found?.targetPrices ?? {}) })
        setScenarioEnabled(true)
        return true
    }

    const deleteScenario = (name) => {
        setSavedScenarios(prev => {
            const target = (prev ?? []).find(item => item?.name === name)
            if (target?.locked || String(name ?? '').toLowerCase() === 'ath') return prev
            return (prev ?? []).filter(item => item?.name !== name)
        })
    }

    const tokenUsdValue = (address) => {
        const key = address.toLowerCase()
        const amount = Number(addressData?.[key]?.normalized ?? addressData?.[address]?.normalized ?? 0)
        const priceUsd = Number(prices?.[key]?.priceUsd ?? prices?.[address]?.priceUsd ?? 0)

        return amount * priceUsd
    }

    const walletChange = useMemo(() => {
        const { dailyCandles, hourlyCandles } = historyData || {}

        if (!prices) {
            return { percent: 0, usd: 0 }
        }

        const getHistoricalPrice = (pairId, currentPriceUsd) => {
            if (!pairId || !currentPriceUsd || currentPriceUsd <= 0) return 0

            const candles = dailyCandles?.[pairId]
            const hourly = hourlyCandles?.[pairId]

            if (selectedTimeframe === '1H') {
                return hourly?.length ? getHourlyCandleCloseNearHoursAgo(hourly, 1) : 0
            }

            if (selectedTimeframe === '6H') {
                return hourly?.length ? getHourlyCandleCloseNearHoursAgo(hourly, 6) : 0
            }

            if (selectedTimeframe === '24H') {
                return hourly?.length
                    ? getHourlyCandleCloseNearHoursAgo(hourly, 24)
                    : candles?.length
                        ? getDailyCandleCloseNearDaysAgo(candles, 1)
                        : 0
            }

            if (selectedTimeframe === '7D') {
                return candles?.length ? getDailyCandleCloseNearDaysAgo(candles, 7) : 0
            }

            if (selectedTimeframe === '30D') {
                return candles?.length ? getDailyCandleCloseNearDaysAgo(candles, 30) : 0
            }

            return 0
        }

        const getPulsePercentForAddress = (address) => {
            const key = address?.toLowerCase?.()

            const symbolByAddress = {
                '0xa1077a294dde1b09bb078844df40758a5d0f9a27': 'PLS',
                '0x95b303987a60c71504d99aa1b13b4da07b0790ab': 'PLSX',
                '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d': 'INC',
                '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39': 'HEX',
                '0xf6f8db0aba00007681f8faf16a0fda1c9b030b11': 'PRVX'
            }

            const symbol = symbolByAddress[key]
            if (!symbol) return null

            const value = Number(cachedPulseOverrides?.[symbol]?.[selectedTimeframe])

            return Number.isFinite(value) ? value : null
        }

        const getPreviousUsdFromCurrent = (currentUsd, currentPriceUsd, pairId, tokenAddress) => {
            if (!currentUsd || currentUsd <= 0) return 0

            const pulsePercent = getPulsePercentForAddress(tokenAddress)

            if (pulsePercent !== null) {
                return currentUsd / (1 + (pulsePercent / 100))
            }

            const historicalPrice = getHistoricalPrice(pairId, currentPriceUsd)

            if (!historicalPrice || historicalPrice <= 0 || !currentPriceUsd || currentPriceUsd <= 0) {
                return currentUsd
            }

            return currentUsd * (historicalPrice / currentPriceUsd)
        }

        let currentTotal = 0
        let previousTotal = 0

        Object.keys(addressData ?? {}).forEach(address => {
            const token = addressData[address]
            const normalized = Number(token?.normalized ?? 0)
            if (!normalized || normalized <= 0) return

            const key = address.toLowerCase()
            const priceInfo = prices?.[key]
            const priceUsd = Number(priceInfo?.priceUsd ?? 0)
            const pairId = priceInfo?.pairId

            if (!priceUsd || priceUsd <= 0) return

            const currentUsd = normalized * priceUsd
            const previousUsd = getPreviousUsdFromCurrent(currentUsd, priceUsd, pairId, key)

            currentTotal += currentUsd
            previousTotal += previousUsd
        })

        // HEX stakes/miners: calculate historical value using HEX historical price
        if (!hideHexMiners && stakesUsdValue > 0) {
            const hexPriceInfo = prices?.['0x2b591e99afe9f32eaa6214f7b7629768c40eeb39']
            const currentHexPrice = Number(hexPriceInfo?.priceUsd ?? 0)
            const hexPairId = hexPriceInfo?.pairId

            currentTotal += stakesUsdValue
            previousTotal += getPreviousUsdFromCurrent(
            stakesUsdValue,
            currentHexPrice,
            hexPairId,
            '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39'
        )
        }

        // LPs and farms: estimate historical value by repricing token0/token1/rewards
        // using each asset's historical USD price.
        // include them in both totals so the percentage denominator matches the big wallet total.
        // This prevents token-only math from overstating/understating the full-wallet percentage.
        // LPs (unstaked)
        const findPoolInfo = (lpAddress) => {
            const key = lpAddress?.toLowerCase?.()
            if (!key) return {}

            return (
                (farmData?.pools ?? []).find(pool => pool?.lpAddress?.toLowerCase?.() === key) ??
                (lpData?.pools ?? []).find(pool => pool?.lpAddress?.toLowerCase?.() === key) ??
                liquidityPairs?.[key] ??
                {}
            )
        }

        // LPs
        Object.entries(lps ?? {}).forEach(([lpAddress, lp]) => {
            const poolInfo = findPoolInfo(lpAddress)

            const token0Address =
                poolInfo?.token0Address?.toLowerCase?.() ??
                poolInfo?.token0?.id?.toLowerCase?.()

            const token1Address =
                poolInfo?.token1Address?.toLowerCase?.() ??
                poolInfo?.token1?.id?.toLowerCase?.()

            const token0Usd = Number(lp?.token0?.usd ?? 0)
            const token1Usd = Number(lp?.token1?.usd ?? 0)

            const priceInfo0 = token0Address ? prices?.[token0Address] : undefined
            const priceInfo1 = token1Address ? prices?.[token1Address] : undefined

            currentTotal += token0Usd + token1Usd
            previousTotal +=
                getPreviousUsdFromCurrent(token0Usd, Number(priceInfo0?.priceUsd ?? 0), priceInfo0?.pairId, token0Address) +
                getPreviousUsdFromCurrent(token1Usd, Number(priceInfo1?.priceUsd ?? 0), priceInfo1?.pairId, token1Address)
        })

        // Farms
        Object.entries(farm ?? {}).forEach(([lpAddress, f]) => {
            const poolInfo = findPoolInfo(lpAddress)

            const token0Address =
                poolInfo?.token0Address?.toLowerCase?.() ??
                poolInfo?.token0?.id?.toLowerCase?.()

            const token1Address =
                poolInfo?.token1Address?.toLowerCase?.() ??
                poolInfo?.token1?.id?.toLowerCase?.()

            const token0Usd = Number(f?.token0?.usd ?? 0)
            const token1Usd = Number(f?.token1?.usd ?? 0)
            const rewardsUsd = Number(f?.rewards?.usd ?? 0)

            const priceInfo0 = token0Address ? prices?.[token0Address] : undefined
            const priceInfo1 = token1Address ? prices?.[token1Address] : undefined

            const incInfo = prices?.['0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d']

            currentTotal += token0Usd + token1Usd + rewardsUsd

            previousTotal +=
                getPreviousUsdFromCurrent(token0Usd, Number(priceInfo0?.priceUsd ?? 0), priceInfo0?.pairId, token0Address) +
                getPreviousUsdFromCurrent(token1Usd, Number(priceInfo1?.priceUsd ?? 0), priceInfo1?.pairId, token1Address) +
                getPreviousUsdFromCurrent(rewardsUsd, Number(incInfo?.priceUsd ?? 0), incInfo?.pairId, '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d')
        })

        if (!previousTotal || previousTotal <= 0) {
            return { percent: 0, usd: 0 }
        }

        const usdChange = currentTotal - previousTotal
        const percent = (usdChange / previousTotal) * 100

        return {
            percent,
            usd: usdChange
        }
    }, [
        addressData,
        prices,
        historyData,
        selectedTimeframe,
        hideHexMiners,
        stakesUsdValue,
        lps,
        farm,
        farmData?.pools,
        lpData?.pools
    ])
    const loading = balanceData?.loading || farmData?.loading || lpData?.loading
    const loadingStatuses = {
        Balances: balanceData?.loading,
        Farms: farmData?.loading,
        'Liquidity Pools': lpData?.loading
    }

    useEffect(() => {
        const fetchPulseMetrics = async () => {
            try {
                const raw = await window.electron.getFile("https://pulsecoinlist.com/stats")

                const payload =
                    typeof raw === 'string'
                        ? JSON.parse(raw)
                        : raw

                const rows =
                    Array.isArray(payload?.props?.pageProps?.topCoinsMetrics) ? payload.props.pageProps.topCoinsMetrics :
                    Array.isArray(payload?.pageProps?.topCoinsMetrics) ? payload.pageProps.topCoinsMetrics :
                    Array.isArray(payload?.topCoinsMetrics) ? payload.topCoinsMetrics :
                    Array.isArray(payload) ? payload :
                    []

                if (Array.isArray(rows) && rows.length > 0) {
                    setPulseMetrics(rows)

                    const mapped = rows.reduce((acc, coin) => {
                    const symbol = coin?.symbol
                    if (!['PLS', 'WPLS', 'PLSX', 'INC', 'HEX', 'PRVX'].includes(symbol)) return acc

                    if (symbol === 'WPLS' && acc.PLS) {
                        return acc
                    }

                    const normalizedSymbol = symbol === 'WPLS' ? 'PLS' : symbol

                    acc[normalizedSymbol] = {
                        '1H': Number(coin?.percent1h) * 100,
                        '6H': Number(coin?.percent6h) * 100,
                        '24H': Number(coin?.percent24h) * 100,
                        '7D': Number(coin?.percent7d) * 100,
                        '30D': Number(coin?.percent30d) * 100
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
                    // PulseCoinList occasionally returns empty rows.
                    // Keep cached values silently so the console stays clean.
                    setPulseMetrics(prev => Array.isArray(prev) ? prev : [])
                }
            } catch (err) {
                console.error("PulseCoinList fetch failed", err)
                setPulseMetrics(prev => Array.isArray(prev) ? prev : [])
            }
        }

        fetchPulseMetrics()
    }, [selectedTimeframe])

const incRewards =
    addressFarmRewards?.normalized &&
    addressFarmRewards?.normalized > 0.01

const hasIncFarmActivity =
    Boolean(incRewards) || incPerDay > 0
const hasHexStakes = hexData?.combinedStakes.length > 0

    return <Wrapper>
        {pricesLoaded ? <div>
            <div style={{ position: 'relative' }}>
                <PriceJumbo
                    key={`jumbo-${hiddenWallets.join('-')}-${hideHexMiners}`}
                    balance={scenarioEnabled ? scenarioGrandTotal : grandTotal}
                    liveBalance={grandTotal}
                    scenarioEnabled={scenarioEnabled}
                    wallets={data?.wallets} 
                    loading={loading} 
                    isFiltered={hiddenWallets.length > 0} 
                    loadingStatuses={loadingStatuses} 
                    bestStable={priceData?.bestStable}
                />

                {!allWalletsHidden && !scenarioEnabled && (
                    <div style={{
                        textAlign: 'center',
                        marginTop: -32,
                        marginBottom: 38,
                        position: 'relative',
                        zIndex: 5,
                        minHeight: 22,
                        lineHeight: '22px',
                        whiteSpace: 'nowrap',
                        fontSize: 18,
                        fontWeight: 700,
                        color: walletChange.usd > 0
                            ? 'rgb(130,255,130)'
                            : walletChange.usd < 0
                                ? 'rgb(255,130,130)'
                                : 'rgb(170,170,170)'
                    }}>
                        {walletChange.percent >= 0 ? '+' : ''}
                        {walletChange.percent.toFixed(1)}%
                        {' '}
                        (
                        {walletChange.usd >= 0 ? '+$' : '-$'}
                        {addCommasToNumber(Math.abs(walletChange.usd).toFixed(2))}
                        {' '}USD
                        )
                    </div>
                )}
            </div>
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
                <Tooltip content={scenarioEnabled ? 'Exit Scenario Mode' : 'Test hypothetical token prices'}>
                    <Button
                        parentStyle={{ width: 110, display: 'inline-block', marginRight: 5 }}
                        textAlign={'center'}
                        onClick={() => setScenarioEnabled(!scenarioEnabled)}
                        style={scenarioEnabled ? {
                            border: '1px solid rgba(227, 184, 92, .85)',
                            background: 'rgba(227, 184, 92, .12)',
                            color: 'rgb(240,205,130)'
                        } : undefined}
                    >
                        {scenarioEnabled ? 'Scenario ON' : 'Scenario'}
                    </Button>
                </Tooltip>
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
            {scenarioEnabled && (
                <ScenarioPanel
                    multiplier={scenarioMultiplier}
                    setMultiplier={setScenarioMultiplier}
                    manualPrices={scenarioManualPrices}
                    setManualPrices={setScenarioManualPrices}
                    prices={prices}
                    onReset={resetScenario}
                    savedScenarios={savedScenarios}
                    onSaveScenario={saveScenario}
                    onLoadScenario={loadScenario}
                    onDeleteScenario={deleteScenario}
                />
            )}
            <div style={{ marginTop: scenarioEnabled ? 58 : 70, marginBottom: 50 }}>
                <PricesComponentV2
                    historyData={historyData}
                    priceData={priceData}
                    getImage={getImage}
                    pulseMetrics={cachedPulseOverrides}
                />
            </div>
            {hasHexStakes ? <div>
                <StakeComponent visibleWallets={visibleWallets} disabled={hideHexMiners} hexData={hexData} hexDcaData={hexDcaData} hexTokenPnl={tokenPnlData?.positions?.['0x2b591e99afe9f32eaa6214f7b7629768c40eeb39']} hexWalletPositions={tokenPnlData?.walletPositions ?? {}} walletBalances={balances ?? {}} hexPrice={{ ...(prices?.['0x2b591e99afe9f32eaa6214f7b7629768c40eeb39'] ?? {}), priceUsd: scenarioHexPriceUsd }} hiddenWallets={hiddenWallets} liquidHexUnits={Number(addressData?.['0x2b591e99afe9f32eaa6214f7b7629768c40eeb39']?.normalized ?? 0)} scenarioEnabled={scenarioEnabled}/>

                {!hideHexMiners && <HexComponent hexData={hexData} visibleWallets={visibleWallets} hexPrice={{ ...(prices?.['0x2b591e99afe9f32eaa6214f7b7629768c40eeb39'] ?? {}), priceUsd: scenarioHexPriceUsd }} aliases={data?.aliases ?? {}} scenarioEnabled={scenarioEnabled}/>} 
            </div> : ''}
            <div>
                <div style={{ position: 'relative', minHeight: tokenPnlData?.loading ? 76 : 28, width: '100%', marginTop: 40 }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, letterSpacing: 0.5 }} >
                        Token Watchlist • <span style={{ letterSpacing: 1, color: scenarioEnabled ? 'rgb(240,205,130)' : undefined }}> $ { addCommasToNumber(parseFloat(scenarioEnabled ? scenarioAddressBalances : addressBalances ?? 0).toFixed(2)) }</span>{scenarioEnabled ? <span style={{ marginLeft: 8, fontSize: 10, color: 'rgb(240,205,130)', letterSpacing: .5 }}>SCENARIO</span> : null}
                    </div>
                    <div
                        className="desktop-only mute"
                        style={{
                            position: 'absolute',
                            right: 155,
                            top: 0,
                            width: 125,
                            textAlign: 'right',
                            fontSize: 12,
                            letterSpacing: 0.5
                        }}
                    >
                        Value
                    </div>
                    <div
                        className="desktop-only mute"
                        style={{
                            position: 'absolute',
                            right: 20,
                            top: 0,
                            width: 125,
                            textAlign: 'right',
                            fontSize: 12,
                            letterSpacing: 0.5
                        }}
                    >
                        P&amp;L
                    </div>
                    {balanceData?.loading === true? <div style={{ position: 'absolute', right: -40, top: -20}}>
                        <Tooltip content="Retrieving Updated Balances">
                            <LoadingWave speed={100} numDots={8}/>
                        </Tooltip>
                    </div> : ''}
                    {tokenPnlData?.loading === true && (() => {
                        const total = Math.max(0, Number(tokenPnlData?.progress?.total ?? 0))
                        const current = Math.max(0, Math.min(Number(tokenPnlData?.progress?.current ?? 0), total || 0))
                        const percent = total > 0 ? Math.max(2, Math.min(100, (current / total) * 100)) : 8
                        const activeLabels = (tokenPnlData?.activeTokens ?? []).map(address => {
                            const key = address?.toLowerCase()
                            return prices?.[key]?.symbol ?? watchlist?.[key]?.token?.symbol ?? key?.slice(0, 8)
                        })
                        const statusText = activeLabels.length > 0
                            ? `Calculating P&L: ${activeLabels.join(' + ')}${total > 0 ? ` • ${current}/${total} complete` : ''}`
                            : tokenPnlData?.progress?.stage === 'transfers'
                                ? 'Preparing wallet history for P&L…'
                                : 'Updating cached P&L…'
                        return (
                            <div style={{ position: 'absolute', left: 0, top: 28, width: '100%' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                    minHeight: 24,
                                    padding: '4px 8px',
                                    border: '1px solid rgba(255,255,255,0.10)',
                                    borderRadius: 6,
                                    background: 'rgba(255,255,255,0.035)',
                                    fontSize: 12,
                                    letterSpacing: 0.35
                                }}>
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{statusText}</span>
                                    <span className="mute" style={{ whiteSpace: 'nowrap' }}>{total > 0 ? `${Math.round((current / total) * 100)}%` : 'Working…'}</span>
                                </div>
                                <div style={{
                                    width: '100%',
                                    height: 4,
                                    marginTop: 5,
                                    borderRadius: 99,
                                    overflow: 'hidden',
                                    background: 'rgba(255,255,255,0.08)'
                                }}>
                                    <div style={{
                                        width: `${percent}%`,
                                        height: '100%',
                                        borderRadius: 99,
                                        background: 'currentColor',
                                        opacity: 0.8,
                                        transition: 'width 180ms ease'
                                    }}/>
                                </div>
                            </div>
                        )
                    })()}
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
                            tokenPnl={tokenPnlData?.positions?.[tokenAddress?.toLowerCase()]}
                            tokenPnlLoading={tokenPnlData?.loading === true && (tokenPnlData?.activeTokens ?? []).includes(tokenAddress?.toLowerCase())}
                            scenarioEnabled={scenarioEnabled}
                            scenarioPriceUsd={scenarioPriceFor(tokenAddress)}
                            scenarioAffected={scenarioEnabled && SCENARIO_CORE_TOKENS.some(({ address }) => address === tokenAddress?.toLowerCase())}
                        />
                    })}
                </div>

                <div>
                    <div style={{ position: 'relative', marginTop: 50, minHeight: 5 }}>
                        <div style={{ position: 'absolute', left: 0, top: -35, width: '100%', letterSpacing: 0.5 }}>
                            Liquidity Pools • {farmData?.loading === true || lpData?.loading === true ? 'Loading' : <span style={{ letterSpacing: 1, color: scenarioEnabled ? 'rgb(240,205,130)' : undefined }}>$ { addCommasToNumber( parseFloat(scenarioEnabled ? Number(scenarioAddressFarms ?? 0) + Number(scenarioAddressLps ?? 0) : Number(addressFarms ?? 0) + Number(addressLps ?? 0)).toFixed(2) ) }</span>}{scenarioEnabled ? <span style={{ marginLeft: 8, fontSize: 10, color: 'rgb(240,205,130)', letterSpacing: .5 }}>SCENARIO</span> : null}
                            {farmData?.loading === true || lpData?.loading === true ? <div style={{ position: 'absolute', right: hasIncFarmActivity ? 50: -40, top: -5}}>
                                <Tooltip content="Retrieving PulseX Farm Data">
                                    <LoadingWave speed={100} numDots={8}/>
                                </Tooltip>
                            </div> : ''}
                            <div style={{ position: 'absolute', right: 0, bottom: 0, fontSize: 15 }} className="mute">
                                {hasIncFarmActivity ? <div>
                                    {incRewards && (
                                        <Tooltip content="PulseX Farm Rewards">
                                            {addressFarmRewards?.normalized < 100_000 
                                                ? addCommasToNumber(parseFloat(addressFarmRewards?.normalized).toFixed(3))
                                                : fUnit(parseFloat(addressFarmRewards?.normalized), 3)
                                            } <Icon icon={icons_list.farm} size={15}/>
                                        </Tooltip>
                                    )}

                                    <div style={{ fontSize: 12, opacity: 0.8, color: scenarioEnabled ? 'rgb(240,205,130)' : undefined }}>
                                        ~ {Number.isFinite(incPerDay)
                                            ? addCommasToNumber(incPerDay.toFixed(2))
                                            : '0.00'} INC/day
                                        {' '}
                                        ($ {Number.isFinite(incUsdPerDay)
                                            ? addCommasToNumber(incUsdPerDay.toFixed(2))
                                            : '0.00'}/day)
                                        {scenarioEnabled ? <span style={{ marginLeft: 6, fontSize: 10, letterSpacing: .5 }}>SCENARIO</span> : null}
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
                                priceArray,
                                scenarioEnabled,
                                scenarioPriceFor,
                                isScenarioCoreToken
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