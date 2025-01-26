import styled from "styled-components"
import Button from "../components/Button"
import { defaultTokenInformation, liquidityPairs } from "../lib/tokens"
import { formatDatetime } from "../lib/date"
import { hiddenWalletsAtom, hideHexMinersAtom, hideZeroValueAtom, liquiditySearchModalAtom, tokensModalAtom, walletsModalAtom } from "../store"
import { useAtom } from "jotai"
import { useAppContext } from "../shared/AppContext"
import Tooltip from "../shared/Tooltip"
import React, { memo, useMemo } from "react"
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

    const priceArray = Object.keys(prices)
    const pricesLoaded = priceArray.length > 0

    const { addressFarmRewards, lps, farm, addressData, displayLps, addressLps, displayFarms, addressFarms, addressBalances, displayDefaultTokens, displayLiquidityPools } = useMemo(() => {
        // use balances instead of combinedBalances when filtering
        const addressData = Object.keys(hiddenWallets).length === 0 
        ? balanceData?.combinedBalances 
        : Object.keys(visibleWallets).reduce((acc, walletAddress) => {
            const walletBalances = balanceData?.balances?.[walletAddress]?.balances ?? {}
            Object.entries(walletBalances).forEach(([tokenAddress, balance]) => {
                if (!acc[tokenAddress]) {
                    acc[tokenAddress] = { ...balance }
                } else {
                    // Add values instead of overwriting
                    acc[tokenAddress].usd = Number(acc[tokenAddress].usd || 0) + Number(balance.usd || 0)
                    acc[tokenAddress].normalized = Number(acc[tokenAddress].normalized || 0) + Number(balance.normalized || 0)
                    acc[tokenAddress].raw = (BigInt(acc[tokenAddress].raw || 0) + BigInt(balance.raw || 0)).toString()
                }
            })
            return acc
        }, {})
    const addressBalances = Object.keys(addressData).reduce((acc, i) => {
        return acc + (addressData[i]?.usd ?? 0);
    }, 0);
        // use farmBalances instead of combinedBalances when filtering
        const farm = Object.keys(hiddenWallets).length === 0 
        ? farmData?.combinedBalances ?? {}
        : Object.entries(farmData?.farmBalances ?? {}).reduce((acc, [walletAddress, walletFarms]) => {
            // Skip if wallet is hidden
            if (!visibleWallets[walletAddress]) return acc

            walletFarms.forEach((farm) => {
                const lpAddress = farm.lpAddress.toLowerCase()
                if (!acc[lpAddress]) {
                    acc[lpAddress] = {
                        ...farm,
                        stakedTokens: farm.stakedTokens,
                        lpAddress: farm.lpAddress,
                        token0: { ...farm.token0 },
                        token1: { ...farm.token1 },
                        rewards: { ...farm.rewards }
                    }
                } else {
                    // Add stakedTokens
                    try {
                        acc[lpAddress].stakedTokens = (BigInt(acc[lpAddress].stakedTokens || 0) + BigInt(farm.stakedTokens || 0)).toString()
                    } catch {
                        acc[lpAddress].stakedTokens = (parseFloat(acc[lpAddress].stakedTokens || 0) + parseFloat(farm.stakedTokens || 0)).toString()
                    }
                    
                    // Add token0 values
                    acc[lpAddress].token0.usd = Number(acc[lpAddress].token0.usd || 0) + Number(farm.token0.usd || 0)
                    acc[lpAddress].token0.normalized = Number(acc[lpAddress].token0.normalized || 0) + Number(farm.token0.normalized || 0)
                    acc[lpAddress].token0.raw = (BigInt(acc[lpAddress].token0.raw || 0) + BigInt(farm.token0.raw || 0)).toString()

                    // Add token1 values
                    acc[lpAddress].token1.usd = Number(acc[lpAddress].token1.usd || 0) + Number(farm.token1.usd || 0)
                    acc[lpAddress].token1.normalized = Number(acc[lpAddress].token1.normalized || 0) + Number(farm.token1.normalized || 0)
                    acc[lpAddress].token1.raw = (BigInt(acc[lpAddress].token1.raw || 0) + BigInt(farm.token1.raw || 0)).toString()

                    // Add rewards values
                    acc[lpAddress].rewards.usd = Number(acc[lpAddress].rewards.usd || 0) + Number(farm.rewards.usd || 0)
                    acc[lpAddress].rewards.normalized = Number(acc[lpAddress].rewards.normalized || 0) + Number(farm.rewards.normalized || 0)
                    acc[lpAddress].rewards.raw = (BigInt(acc[lpAddress].rewards.raw || 0) + BigInt(farm.rewards.raw || 0)).toString()
                }
            })
            return acc
        }, {})

        const addressFarms = Object.values(farm ?? {}).reduce((acc, farm) => {
            return acc + Number(farm?.token0?.usd ?? 0) + Number(farm?.token1?.usd ?? 0) + Number(farm?.rewards?.usd ?? 0)
        }, 0)

        const addressFarmRewards = Object.values(farm ?? {}).reduce((acc, farm) => {
            acc.usd = (acc?.usd ?? 0) + (farm?.rewards?.usd ?? 0)
            acc.normalized = parseFloat((acc?.normalized ?? 0)) + parseFloat((farm?.rewards?.normalized ?? 0))

            return acc
        }, {})
    
        const displayFarms = (farmData?.pools ?? []).filter(poolData => {
            const addressData = farmData?.combinedBalances?.[poolData?.lpAddress]
            if (!addressData || parseFloat(addressData?.stakedTokens) < 1) return false
            return true
        }).sort((a, b) => {
            const aBalance = (farm?.[a?.lpAddress]?.token0?.usd ?? 0) + (farm?.[a?.lpAddress]?.token1?.usd ?? 0) + (farm?.[a?.lpAddress]?.rewards?.usd ?? 0)
            const bBalance = (farm?.[b?.lpAddress]?.token0?.usd ?? 0) + (farm?.[b?.lpAddress]?.token1?.usd ?? 0) + (farm?.[b?.lpAddress]?.rewards?.usd ?? 0)
            return bBalance - aBalance
        })
    
        // Filter LP balances for visible wallets
        const lps = Object.keys(hiddenWallets).length === 0 
            ? lpData?.combinedBalances ?? {}
            : Object.entries(lpData?.lpBalances ?? {}).reduce((acc, [walletAddress, walletLPs]) => {
                // Skip if wallet is hidden
                if (!visibleWallets[walletAddress]) return acc
    
                Object.entries(walletLPs).forEach(([lpAddress, lp]) => {
                    lpAddress = lpAddress.toLowerCase()
                    if (!acc[lpAddress]) {
                        acc[lpAddress] = {
                            ...lp,
                            lpAddress,
                            lpTokenBalance: lp.lpTokenBalance,
                            token0: { ...lp.token0 },
                            token1: { ...lp.token1 },
                            totalSupply: lp.totalSupply,
                            reserve0: lp.reserve0,
                            reserve1: lp.reserve1
                        }
                    } else {
                        // Add lpTokenBalance
                        try {
                            acc[lpAddress].lpTokenBalance = (BigInt(acc[lpAddress].lpTokenBalance || 0) + BigInt(lp.lpTokenBalance || 0)).toString()
                        } catch {
                            acc[lpAddress].lpTokenBalance = (parseFloat(acc[lpAddress].lpTokenBalance || 0) + parseFloat(lp.lpTokenBalance || 0)).toString()
                        }
    
                        // Add token0 values
                        acc[lpAddress].token0.usd = Number(acc[lpAddress].token0.usd || 0) + Number(lp.token0.usd || 0)
                        acc[lpAddress].token0.normalized = Number(acc[lpAddress].token0.normalized || 0) + Number(lp.token0.normalized || 0)
                        acc[lpAddress].token0.raw = (BigInt(acc[lpAddress].token0.raw || 0) + BigInt(lp.token0.raw || 0)).toString()
    
                        // Add token1 values
                        acc[lpAddress].token1.usd = Number(acc[lpAddress].token1.usd || 0) + Number(lp.token1.usd || 0)
                        acc[lpAddress].token1.normalized = Number(acc[lpAddress].token1.normalized || 0) + Number(lp.token1.normalized || 0)
                        acc[lpAddress].token1.raw = (BigInt(acc[lpAddress].token1.raw || 0) + BigInt(lp.token1.raw || 0)).toString()
                    }
                })
                return acc
            }, {})

        const addressLps = Object.values(lps ?? {}).reduce((acc, lp) => {
            return acc + Number(lp?.token0?.usd ?? 0) + Number(lp?.token1?.usd ?? 0)
        }, 0)
    
        // Display LPs that have a balance
        const displayLps = Object.entries(lps).filter(([lpAddress, lpInfo]) => {
            const isWatchlistItem = data?.lpWatchlist?.[lpAddress] ? true : false
            const isDefaultPair = liquidityPairs?.[lpAddress] ? true : false
            const hasTokenBalance = Number(lpInfo?.token0?.normalized ?? 0) + Number(lpInfo?.token1?.normalized ?? 0) >= 1

            if (!isWatchlistItem && !isDefaultPair) return false

            if (!hideZeroValue && hasTokenBalance) return true

            // Always hide default pairs when 0 balances
            if (isDefaultPair && !hasTokenBalance) return false
            if (isWatchlistItem && hideZeroValue && !hasTokenBalance) return false

            return true

            //return hideZeroValue && true ? Number(lpInfo?.token0?.normalized ?? 0) + Number(lpInfo?.token1?.normalized ?? 0) >= 1 : true
        }).map(([lpAddress, lpInfo]) => ({
            lpAddress,
            ...lpInfo
        }))


        const displayDefaultTokens = [...Object.keys(defaultTokenInformation), ...Object.keys(watchlist)].sort((a, b) => {
            const watchlistItemA = watchlist?.[a]?.token?.address ? watchlist[a].token.address : undefined
            const watchlistItemB = watchlist?.[b]?.token?.address ? watchlist[b].token.address : undefined

            const aBalance = addressData?.[watchlistItemA ?? a]?.usd ?? 0
            const bBalance = addressData?.[watchlistItemB ?? b]?.usd ?? 0
            
            return bBalance - aBalance
        })

        const displayLiquidityPools = [...displayLps.map(m => ({...m, type: 'lp'})), ...displayFarms.map(m => ({...m, type: 'farm'}))]
        displayLiquidityPools.sort((a, b) => {

            const aData = (a.type === 'lp' ? a : farm?.[a.lpAddress]) ?? {}
            const bData = (b.type === 'lp' ? b : farm?.[b.lpAddress]) ?? {}

            const aBalance = a.type === 'lp' ? Number(aData.token0?.usd ?? 0) + Number(aData.token1?.usd ?? 0) : Number(aData.token0?.usd ?? 0) + Number(aData.token1?.usd ?? 0) + Number(aData.rewards?.usd ?? 0)
            const bBalance = b.type === 'lp' ? Number(bData.token0?.usd ?? 0) + Number(bData.token1?.usd ?? 0) : Number(bData.token0?.usd ?? 0) + Number(bData.token1?.usd ?? 0) + Number(bData.rewards?.usd ?? 0)
            return bBalance - aBalance
        })

        return {
            addressFarmRewards, lps, farm, displayLps, addressLps, displayFarms, addressFarms, addressData, addressBalances, displayDefaultTokens, displayLiquidityPools
        }
    }, [balanceData, farmData, lpData, hiddenWallets, hideZeroValue, data?.lpWatchlist])

    const stakes = Array.isArray(hexData?.combinedStakes) ? (hexData?.combinedStakes ?? []).filter( f => f?.address && !(hiddenWallets ?? []).includes(f.address.toLowerCase())) : []
    const stakeStats = parseHexStats(stakes)

    const hexPrice = (prices?.['0x2b591e99afe9f32eaa6214f7b7629768c40eeb39']?.priceUsd ?? 0)
    const stakesUsdValue = (stakeStats?.totalFinalHex ?? 0) * hexPrice

    const grandTotal = parseFloat(parseFloat(hideHexMiners ? 0 : stakesUsdValue) + parseFloat(addressBalances ?? 0) + parseFloat(addressFarms ?? 0) + parseFloat(addressLps ?? 0) ).toFixed(2)
    const loading = balanceData?.loading || farmData?.loading || lpData?.loading
    const loadingStatuses = {
        Balances: balanceData?.loading,
        Farms: farmData?.loading,
        'Liquidity Pools': lpData?.loading
    }

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
                <PricesComponent historyData={historyData} priceData={priceData}/>
                {/* <div style={{ position: 'relative', height: 16, width: '100%' }} className="mute">
                    <div style={{ position: 'absolute', right: 0, bottom: -5, fontSize: 12}}>
                        {formatDatetime(priceLastUpdated)}
                    </div>
                </div> */}
            </div>
            {hasHexStakes ? <div>
                <StakeComponent disabled={hideHexMiners} hexData={hexData} hexPrice={prices?.['0x2b591e99afe9f32eaa6214f7b7629768c40eeb39']} hiddenWallets={hiddenWallets}/>
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
                                            ? addCommasToNumber(parseFloat(addressFarmRewards?.normalized).toFixed(2))
                                            : fUnit( parseFloat(addressFarmRewards?.normalized), 2)
                                        } <Icon icon={icons_list.farm} size={15}/>
                                    </Tooltip>
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