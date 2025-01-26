import React, { memo } from "react";
import Button from "../Button";
import ImageContainer from "../ImageContainer";
import { useAtom } from "jotai";
import { tokenModalAtom } from "../../store";
import LoadingWave from "../LoadingWave";
import { addCommasToNumber, formatNumber, fUnit, fUnitSub } from "../../lib/numbers";

export default memo(SingleTokenButton)
function SingleTokenButton ({ balances, prices, getImage, pairId, priceArray, watchlistData, token = undefined, tokenAddress = undefined }) {
    const [ singleTokenModal, setSingleTokenModal ] = useAtom(tokenModalAtom)
    const tokenAddresses = token ? [token] :priceArray.filter(f => prices[f]?.pairId === pairId);

    if (tokenAddresses.length === 0 && watchlistData?.id) {
        const isToken0Wpls = watchlistData?.token0?.id == '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
        const tokenToUse = isToken0Wpls ? watchlistData?.token1 : watchlistData?.token0

        const image = getImage((tokenToUse?.id ?? '')?.toLowerCase())
        return <Button
            key={`p-${pairId}-${tokenToUse?.id}`}
            style={{
                marginTop: 5,
                padding: '15px 25px',
                position: 'relative',
            }}
        >
            <div className="price-button" style={{ position: 'relative' }}>
                <div style={{ width: 35 }}/>
                <div style={{ position: 'absolute', left: -5 }}>
                    <ImageContainer source={image} size={35}/>
                </div>
                <div>
                    <div style={{ fontSize: 18 }}>{tokenToUse?.name}</div>
                    <div
                        style={{
                            fontSize: 14,
                            marginTop: 5,
                            fontWeight: 400,
                        }}
                        className="mute"
                    >
                        {tokenToUse?.symbol ? `${tokenToUse?.symbol} • Updating Price...` : 'Fetching data...'}
                    </div>
                </div>
            </div>
            <div
                style={{
                    textAlign: 'right',
                    width: 125,
                    position: 'absolute',
                    right: 0,
                }}
            >
                <LoadingWave speed={100} numDots={8}/>
            </div>
        </Button>
    }

    if (tokenAddresses.length === 0) {
        return null
    }

    const image = getImage(tokenAddress?.toLowerCase());
    const priceInfo = prices?.[tokenAddress];
    const isLoading = !priceInfo
    const balanceUsdRaw = parseFloat(balances?.[tokenAddress.toLowerCase()]?.usd ?? 0)
    const balanceUsd = addCommasToNumber( balanceUsdRaw.toFixed(2) )
    const balanceTokens = ( parseFloat( balances?.[tokenAddress.toLowerCase()]?.normalized ?? 0 ).toFixed(2) )
    const displayPriceUsd = formatNumber(priceInfo?.priceUsd ?? 0, true, true)

    if (isLoading) {
        return <Button
            key={`p-${pairId}-${tokenAddress}`}
            style={{
                marginTop: 5,
                padding: '15px 25px',
                position: 'relative',
            }}
            onClick={() => {
                setSingleTokenModal(priceInfo);
            }}
        >
            <div className="price-button">
                <ImageContainer source={image} size={35} />
                <div style={{
                        textAlign: 'right',
                        width: 125,
                        position: 'absolute',
                        right: 0,
                    }}>
                    <LoadingWave speed={100} numDots={8}/>
                </div>
            </div>
        </Button>
    }

    return (
        <React.Fragment key={pairId}>
            <Button
                key={`p-${pairId}-${tokenAddress}`}
                style={{
                    marginTop: 5,
                    padding: '15px 25px',
                    position: 'relative',
                }}
                onClick={() => {
                    setSingleTokenModal(priceInfo);
                }}
            >
                <div className="price-button" >
                    <div style={{ width: 35 }}/>
                    <div style={{ position: 'absolute', left: 15 }}>
                        <ImageContainer source={image} size={35}/>
                    </div>
                    <div>
                        <div style={{ fontSize: 18, width: 325 }}>{priceInfo.name}</div>
                        <div
                            style={{
                                fontSize: 14,
                                marginTop: 5,
                                fontWeight: 400,
                                width: 325,
                                overflow: 'hidden',
                            }}
                            className="mute"
                        >
                            {priceInfo.symbol} • $
                            <span style={{ letterSpacing: 1 }}>
                                {displayPriceUsd || '-'}
                            </span>
                        </div>
                    </div>
                    <div
                        style={{
                            textAlign: 'right',
                            width: 225,
                            position: 'absolute',
                            right: 20,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 18,
                                letterSpacing: 1,
                            }}
                        >
                            <span style={{ color: 'rgb(200,200,200)' }}>$</span>{' '}
                            <span style={{ fontFamily: "'Oswald', sans-serif"}}>
                                {priceInfo.otherValue || balanceUsd}
                            </span>
                        </div>
                        <div
                            style={{
                                fontSize: 14,
                                marginTop: 5,
                                letterSpacing: 1,
                                fontWeight: 400
                            }}
                            className="mute"
                        >
                            {fUnit(parseFloat(priceInfo.otherValue || balanceTokens || 0), 2)}
                        </div>
                    </div>
                </div>
            </Button>
        </React.Fragment>
    );
}