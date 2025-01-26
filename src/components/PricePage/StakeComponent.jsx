import styled from "styled-components"
import { addCommasToNumber, fUnit } from "../../lib/numbers"
import ImageContainer from "../ImageContainer"
import imgHex from '../../icons/hex.png'
import Icon from "../Icon"
import { icons_list } from "../../config/icons"
import { parseHexStats } from "../../lib/hex"
import Tooltip from "../../shared/Tooltip"
import { shortenString } from "../../lib/string"

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
`

const Row = styled.div`
    text-align: center;
    box-shadow: 0 1px 4px rgba(255, 255, 255, 0.1);
    padding: 30px 20px 45px 30px;
    border-radius: 10px;
    position: relative;
    min-height: 80px;
    .icon-mute {
        svg path {
            fill: rgb(120,120,120) !important;
        }
    }
`

export function StakeComponent({hexData, hexPrice, hiddenWallets, disabled}) {

    const formatTShares = (tShares) => hexData.stats.totalTShares < 100 ? tShares.toFixed(3) : `${fUnit(tShares, 2)}`
    const formatLength = (length) => length < 364 ? `${length}d` : `${parseFloat(length / 365).toFixed(2)}y`

    const red = 'rgb(255,130,130)'
    const warning = 'rgb(205,205,130)'

    const stakes = hexData?.combinedStakes?.filter(stake => !hiddenWallets.includes(stake?.address ?? ''))
    const stats = hiddenWallets.length > 0 ? parseHexStats(stakes) : hexData?.stats

    if (hexData?.combinedStakes?.length === 0) return ''
    
    const nextStakeAddress = stats?.nextStakeAddress ? shortenString(stats?.nextStakeAddress) : ''
    const totalStakes = stats?.totalStakes ?? 0
    const activeStakes = stats?.totalActiveStakes ?? 0
    
    const hexUsd = hexPrice?.priceUsd

    const effectivePenalty = stats?.totalEffectivePenalty ?? 0
    const penaltyHexUsd = effectivePenalty * hexUsd

    const hexYield = stats?.totalHexYield ?? 0
    const hexYieldUsd = hexYield * hexUsd

    const stakedHex = stats.totalStakedHex ?? 0
    const stakedHexUsd = stakedHex * hexUsd

    const hexBalance = stats?.totalFinalHex ?? 0
    const hexBalanceUsd = hexBalance * hexUsd

    const displayPenalty = (fUnit((Number(effectivePenalty) ?? 0) * -1, 3))
    

    return <Wrapper>
        <div style={disabled ? { color: 'rgb(120,120,120)', opacity: 0.5 } : {}}>
            {/* <div>
                Penalties {displayPenalty} <Icon icon={icons_list.hex} size={18} style={{marginLeft: 5}} />
                <br/>Total {fUnit(stats?.totalFinalHex?? 0, 3)}
            </div> */}
            <div style={{ position: 'relative', paddingBottom: 15, letterSpacing: 0.5}}>
                HEX Miners ({stats?.totalStakes ?? 0}) • <span style={{ letterSpacing: 1 }}> $ { addCommasToNumber(parseFloat( parseFloat(hexBalanceUsd ?? 0)).toFixed(2)) }</span>
                <div style={{ position: 'absolute', top: '0', right: '0' }} className="mute">
                    {totalStakes === 0 ? 'No Stakes' : activeStakes === 0 ? 'No Active Stakes' :(stats?.daysUntilNextStake ?? 0) < 0 
                        ? <span style={{ color: red }}>Late by: {Math.abs(stats?.daysUntilNextStake ?? 0)}d ({nextStakeAddress})</span>
                        : <span style={(stats?.daysUntilNextStake && stats?.daysUntilNextStake < 30) ? { color: warning } : {}}>Next Ending: {formatLength(stats?.daysUntilNextStake ?? 0)} ({nextStakeAddress})</span>
                    }
                </div>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px'}}>
                <Row>
                    <div style={{ fontSize: 20, position: 'absolute', top: 10, left: 15}}>Avg Length</div>
                    <div style={{ paddingTop: 30, fontSize: 28 }}>
                        {isNaN(stats?.averageStakeLength) ? '0' : formatLength(stats?.averageStakeLength ?? 0)}
                    </div>
                </Row>
                <Tooltip content={<div style={{ textAlign: 'center' }}>{addCommasToNumber(parseFloat(stats?.totalTShares ?? 0).toFixed(4))} T-Shares</div>}>
                    <Row>
                        <div style={{ fontSize: 20, position: 'absolute', top: 10, left: 15}}>T-Shares</div>
                        <div style={{ paddingTop: 30, fontSize: 28 }}>
                            { formatTShares(stats?.totalTShares ?? 0) }
                        </div>
                    </Row>
                </Tooltip>
                <Tooltip content={<div style={{ textAlign: 'center' }}>$ {addCommasToNumber(parseFloat(stakedHexUsd ?? 0).toFixed(2))}<br/><br/>{addCommasToNumber(parseFloat(stakedHex ?? 0).toFixed(0))} HEX</div>}>
                    <Row>
                        <div style={{ fontSize: 20, position: 'absolute', top: 10, left: 15}}>Principal</div>
                        <div style={{ alignItems: 'center', fontSize: 28, paddingTop: 30, position: 'relative' }}>
                            $ {fUnit( stakedHexUsd ?? 0, 1 )}
                            <div style={{ position: 'absolute', bottom: -18, right: 5}} className="icon-mute">
                                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle', paddingTop: 20, fontSize: 16}} className="mute">
                                    {fUnit( stakedHex ?? 0, 3 )} <Icon icon={icons_list.hex} size={18} style={{marginLeft: 5}} />
                                </div>
                            </div>
                        </div>
                    </Row>
                </Tooltip>
                <Tooltip content={<div style={{ textAlign: 'center' }}>$ {addCommasToNumber(parseFloat(hexYieldUsd ?? 0).toFixed(2))}<br/><br/>{addCommasToNumber(parseFloat(hexYield ?? 0).toFixed(0))} HEX</div>}>
                    <Row>
                        <div style={{ fontSize: 20, position: 'absolute', top: 10, left: 15}}>Mined</div>
                        <div style={{ alignItems: 'center', fontSize: 28, paddingTop: 30, position: 'relative' }}>
                                $ {fUnit( hexYieldUsd ?? 0, 1 )}
                            
                            <div style={{ position: 'absolute', bottom: -18, right: 5}} className="icon-mute">
                                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle', paddingTop: 20, fontSize: 16}} className="mute">
                                    {fUnit( hexYield ?? 0, 3 )} <Icon icon={icons_list.hex} size={18} style={{marginLeft: 5}} />
                                </div>
                            </div>
                        </div>
                    </Row>
                </Tooltip>
            </div>
        </div>
    </Wrapper>
}
