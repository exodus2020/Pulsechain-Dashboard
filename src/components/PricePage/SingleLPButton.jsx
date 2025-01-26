import React, { memo } from "react";
import Button from "../Button";
import ImageContainer from "../ImageContainer";
import { useAtom } from "jotai";
import { liquidityPoolModalAtom, tokenModalAtom } from "../../store";
import LoadingWave from "../LoadingWave";
import { addCommasToNumber, fUnit } from "../../lib/numbers";
import { shortenString } from "../../lib/string";
import styled from "styled-components";
import Tooltip from "../../shared/Tooltip";

const FarmListItemWrapper = styled.div`

`

export default memo(SingleLPButton)
function SingleLPButton ({ poolData, addressData, prices, getImage, priceArray }) {
    const [ liquidityPoolModal, setLiquidityPoolModal ] = useAtom(liquidityPoolModalAtom)

    const isToken0Wpls = poolData?.token0Address?.toLowerCase() == '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
    const image0 = !isToken0Wpls ? getImage(poolData?.token1Address?.toLowerCase()) : getImage(poolData?.token0Address?.toLowerCase())
    const image1 = !isToken0Wpls ? getImage(poolData?.token0Address?.toLowerCase()) : getImage(poolData?.token1Address?.toLowerCase())

    const priceInfo0 = prices?.[poolData?.token0Address?.toLowerCase()];
    const priceInfo1 = prices?.[poolData?.token1Address?.toLowerCase()]

    const token0display = priceInfo0?.symbol ?? shortenString(poolData?.token0Address ?? '').toLowerCase()
    const token1display = priceInfo1?.symbol ?? shortenString(poolData?.token1Address ?? '').toLowerCase()

    const totalUsd = Number(addressData?.token0?.usd ?? 0) + Number(addressData?.token1?.usd ?? 0) + Number(addressData?.rewards?.usd ?? 0)

    const alert = !priceInfo1 || !priceInfo0

    return (
        <Button
            style={ !alert ? {
                marginTop: 5,
                padding: '15px 25px',
                position: 'relative',
            } : {
                marginTop: 5,
                padding: '15px 25px',
                position: 'relative',
                backgroundColor: 'rgb(35,30,30)',
            }}
            parentStyle={ !alert ? {} : {
                boxShadow: '0 0 10px 1px rgba(255,0,0,0.2)'
            }}
            onClick={() => {
                setLiquidityPoolModal({
                    poolData, priceInfo0, priceInfo1, isLpwatchlist: true
                });
            }}
        >
            <FarmListItemWrapper className="price-button">
                <div style={{ position: 'relative'}}>
                    <div style={{ position: 'absolute', left: -15, top: 5 }}>
                        <ImageContainer source={image0} size={30} />
                    </div>
                    <div style={{ position: 'absolute', left: 0, top: 15, transform: 'scale(1)' }}>
                        <ImageContainer source={image1} size={35} />
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: 18, width: 325 }}>
                        {token0display} - {token1display}
                    </div>
                    <div
                        style={{
                            fontSize: 14,
                            marginTop: 5,
                            fontWeight: 400,
                            width: 325,
                            overflow: 'hidden'
                        }}
                        className="mute"
                    >
                        {/* pair symbols • PLP */}
                        <div style={{ letterSpacing: 1, display: 'grid', gridTemplateColumns: '110px 85px 1fr'}}>
                            <Tooltip content={token0display}>
                                <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'}}>
                                    {token0display}
                                </div>
                            </Tooltip>
                            <div>
                                {priceInfo0 ? fUnit(parseFloat(addressData?.token0?.normalized ?? '0'), 2 )
                                    : 'Unknown'}
                            </div>
                            <div>
                                {priceInfo0 ? '$ ' + fUnit(parseFloat(addressData?.token0?.usd ?? '0'), 2)
                                    : 'Click to Update'}
                            </div>
                            <Tooltip content={token1display}>
                                <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'}}>
                                        {token1display}
                                    
                                </div>
                            </Tooltip>
                            <div>
                                {priceInfo1 ? fUnit(parseFloat(addressData?.token1?.normalized ?? '0'), 2 )
                                    : 'Unknown'}
                            </div>
                            <div>
                                {priceInfo1 ? '$ ' + fUnit(parseFloat(addressData?.token1?.usd ?? '0'), 2)
                                    : 'Click to Update'}
                            </div>
                        </div>
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
                            {addCommasToNumber(parseFloat(totalUsd).toFixed(2)) || '-'}
                        </span>
                    </div>
                    <div
                        style={{
                            fontSize: 14,
                            marginTop: 5,
                            letterSpacing: 1,
                            fontWeight: 400,
                        }}
                        className="mute"
                    >
                        {fUnit( parseFloat(addressData?.lpTokenBalance ?? '0'), 2 )}<br/>
                    </div>
                </div>
            </FarmListItemWrapper>
        </Button>
    )
}