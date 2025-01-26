import React, { memo } from "react";
import Button from "../Button";
import ImageContainer from "../ImageContainer";
import { useAtom } from "jotai";
import { liquidityPoolModalAtom, tokenModalAtom } from "../../store";
import LoadingWave from "../LoadingWave";
import { addCommasToNumber, fUnit } from "../../lib/numbers";
import { shortenString } from "../../lib/string";
import styled from "styled-components";
import Icon from "../Icon";
import { icons_list } from "../../config/icons";
import Tooltip from "../../shared/Tooltip";

const FarmListItemWrapper = styled.div`

`

export default memo(SingleFarmButton)
function SingleFarmButton ({ poolData, addressData, prices, getImage, priceArray }) {
    const [ liquidityPoolModal, setLiquidityPoolModal ] = useAtom(liquidityPoolModalAtom)

    const isToken0Wpls = poolData?.token0?.toLowerCase() == '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
    const image0 = !isToken0Wpls ? getImage(poolData?.token1?.toLowerCase()) : getImage(poolData?.token0?.toLowerCase())
    const image1 = !isToken0Wpls ? getImage(poolData?.token0?.toLowerCase()) : getImage(poolData?.token1?.toLowerCase())

    const priceInfo0 = prices?.[poolData?.token0?.toLowerCase()];
    const priceInfo1 = prices?.[poolData?.token1?.toLowerCase()]

    const token0display = priceInfo0?.symbol ?? shortenString(poolData?.token0 ?? '').toLowerCase()
    const token1display = priceInfo1?.symbol ?? shortenString(poolData?.token1 ?? '').toLowerCase()

    const totalUsd = Number(addressData?.token0?.usd ?? 0) + Number(addressData?.token1?.usd ?? 0) + Number(addressData?.rewards?.usd ?? 0)
    const inc = parseFloat(addressData?.rewards?.normalized ?? '0')
    const displayInc = inc === 0 ? '-' 
        : inc < 100_000 ? addCommasToNumber(inc.toFixed(2))
        : fUnit( parseFloat(addressData?.rewards?.normalized ?? '0'), 2 )

    return (
        <Button
            style={{
                marginTop: 5,
                padding: '15px 25px',
                position: 'relative',
            }}
            onClick={() => {
                setLiquidityPoolModal({
                    poolData, priceInfo0, priceInfo1
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
                        <Tooltip content="PulseX Farm"><span className="mute" style={{ marginRight: 5, color: 'rgb(50,200,50)' }}><Icon icon={icons_list.farm} size={20}/></span></Tooltip> {token0display} - {token1display} 
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
                            {/* PLP {addressData?.stakedTokens ?? 0} */}
                            <div>{token0display}</div>
                            <div>
                                {priceInfo0 ? fUnit(parseFloat(addressData?.token0?.normalized ?? '0'), 2 )
                                    : 'Unknown'}
                            </div>
                            <div>
                                {priceInfo0 ? '$ ' + fUnit(parseFloat(addressData?.token0?.usd ?? '0'), 2)
                                    : 'Click to Update'}
                            </div>
                            <div>{token1display}</div>
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
                        $ {addCommasToNumber( parseFloat(addressData?.rewards?.usd ?? '0').toFixed(2))}<br/>
                        INC: {displayInc}
                    </div>
                </div>
            </FarmListItemWrapper>
        </Button>
    )
}