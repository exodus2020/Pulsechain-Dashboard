// PriceJumbo.jsx
import { memo, useEffect, useState } from "react";
import styled from "styled-components"
import { addCommasToNumber } from "../../lib/numbers";
import LoadingWave from "../LoadingWave";
import Tooltip from "../../shared/Tooltip";
import Button from "../Button";
import { walletsModalAtom } from "../../store";
import { useAtom } from "jotai";
import ImageContainer from "../ImageContainer";
import ImgUSDC from '../../icons/usdc.png'
import ImgUSDT from '../../icons/usdt.png'
import ImgDAI from '../../icons/dai.png'

const Wrapper = styled.div`
    border: 1px solid ${props => props.$scenario ? 'rgba(227, 184, 92, .80)' : 'rgb(70,70,70)'};
    background: ${props => props.$scenario ? 'linear-gradient(to bottom, rgba(227, 184, 92, .10), rgb(15,15,15) 65%)' : 'rgb(15,15,15)'};
    padding: 25px;
    text-align: center;
    position: relative;
    min-height: 150px;

    .jumbo-header {
        padding-top: 15px;
        font-size: 24px;
        letter-spacing: 1px !important;
    }

    .jumbo-value-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        white-space: nowrap;
    }

    .jumbo-currency {
        font-family: 'Oswald', sans-serif;
        font-size: 62px;
        line-height: 1.08;
        font-weight: 600;
        color: rgb(235,235,235);
        flex: 0 0 auto;
    }

    .jumbo-price {
        font-family: 'Oswald', sans-serif;
        font-size: 75px;
        line-height: 1.08;
        display: inline-block;
        font-weight: 600;
    }

    .jumbo-loader {
        position: absolute;
        bottom: 0px; right: -40px;
    }

    .info-icon {
        width: 12px;
        font-size: 16px;

        &:hover {
            color: white;
        }
    }
    @keyframes digitReel {
        from { transform: translateY(0); }
        to { transform: translateY(calc(-1em * var(--digit-steps))); }
    }
    `

const RollingBalance = ({ value }) => {
    const formattedValue = addCommasToNumber(Number(value ?? 0).toFixed(2))
    const [previousValue, setPreviousValue] = useState(formattedValue)
    const [currentValue, setCurrentValue] = useState(formattedValue)
    const [rollingKey, setRollingKey] = useState(0)

    useEffect(() => {
        if (formattedValue === currentValue) return

        setPreviousValue(currentValue)
        setCurrentValue(formattedValue)
        setRollingKey(prev => prev + 1)
    }, [formattedValue, currentValue])

    const getDigitPath = (from, to) => {
        const start = Number(from)
        const end = Number(to)

        if (!Number.isFinite(start) || !Number.isFinite(end)) return [to]
        if (start === end) return [to]

        const direction = end > start ? 1 : -1
        const path = []

        for (let n = start; direction > 0 ? n <= end : n >= end; n += direction) {
            path.push(String(n))
        }

        return path
    }

    // Render only the width of the current value. Previously we padded both
    // values to the longer string, which could leave invisible leading spaces
    // between the $ sign and the number until the next price update.
    const maxLength = currentValue.length
    const oldText = previousValue.padStart(maxLength, ' ').slice(-maxLength)
    const newText = currentValue

    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            lineHeight: 1,
            letterSpacing: '0em'
        }}>
            {newText.split('').map((char, index) => {
                const oldChar = oldText[index]
                const isDigit = /\d/.test(char)
                const oldIsDigit = /\d/.test(oldChar)
                const changed = isDigit && oldIsDigit && oldChar !== char

                const baseStyle = {
                    width: isDigit ? '0.6em' : '0.35em',
                    height: '1em',
                    lineHeight: '1em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: changed ? 'hidden' : 'visible'
                }

                if (!isDigit || !changed) {
                    return (
                        <span key={index} style={baseStyle}>
                            {char}
                        </span>
                    )
                }

                const path = getDigitPath(oldChar, char)
                const steps = Math.max(0, path.length - 1)

                return (
                    <span key={`${rollingKey}-${index}`} style={baseStyle}>
                        <span
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: '100%',
                                '--digit-steps': steps,
                                animation: `digitReel 850ms cubic-bezier(0.22, 1, 0.36, 1) forwards`
                            }}
                        >
                            {path.map((digit, i) => (
                                <span
                                    key={`${digit}-${i}`}
                                    style={{
                                        height: '1em',
                                        lineHeight: '1em',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {digit}
                                </span>
                            ))}
                        </span>
                    </span>
                )
            })}
        </span>
    )
}

export default memo(PriceJumbo)
function PriceJumbo ({ balance = 0, liveBalance = 0, scenarioEnabled = false, wallets = {}, loading = false, isFiltered = false, loadingStatuses = {}, bestStable = null }) {
    const [ walletModal, setWalletModal ] = useAtom(walletsModalAtom)
    
    const balancesLoading = loading

    const noAddresses = Object.keys(wallets).length === 0

    const tooltipContent = <div>
        {Object.keys(loadingStatuses).map(key => {
            if (!loadingStatuses?.[key]) return null

            return <div key={key}>
                {loadingStatuses[key] ? `Updating ${key}` : ''}
            </div>
        }).filter(Boolean)}
    </div>

    const bestStableImage = !bestStable?.symbol ? undefined : bestStable?.symbol === 'USDC' ? ImgUSDC : bestStable?.symbol === 'USDT' ? ImgUSDT : bestStable?.symbol === 'DAI' ? ImgDAI : null

    if (noAddresses) return <Wrapper $scenario={false}>
        <div className="jumbo-header">
            <div style={{ fontSize: 12, fontFamily: 'sans-serif', color: 'rgb(120,120,120)', position: 'absolute', top: 10, right: 15 }}>
                <Tooltip content={<div style={{ textAlign: 'center' }}>
                    All prices and percentages are approximations<br/>based off the value of {bestStable?.name ?? 'DAI'} from Ethereum</div>
                } placement="left">
                    <div className="info-icon">
                        {bestStableImage ? <ImageContainer source={bestStableImage} style={{ marginRight: 15, filter: 'grayscale(.3)', padding: 0 }} size={20}/> : 'i'} 
                    </div>
                </Tooltip>
            </div>
            Add an address to get started
            <div>
                <Button parentStyle={{display: 'inline-block', marginTop: 30, width: '200px'}} textAlign={'center'} onClick={() => setWalletModal(true)}>
                    Add Address
                </Button>
            </div>
        </div>
    </Wrapper>

    return <Wrapper $scenario={scenarioEnabled}>
        <div style={{ fontSize: 12, fontFamily: 'sans-serif', color: 'rgb(120,120,120)', position: 'absolute', top: 10, right: 15 }}>
            <Tooltip content={<div style={{ textAlign: 'center' }}>
                All prices and percentages are approximations<br/>based off the value of {bestStable?.name ?? 'DAI'} from Ethereum</div>
            } placement="left">
                <div className="info-icon">
                    {bestStableImage ? <ImageContainer source={bestStableImage} style={{ marginRight: 15, filter: 'grayscale(.3)', padding: 0 }} size={20}/> : 'i'} 
                </div>
            </Tooltip>
        </div>
        
        <div className="jumbo-header">
            {scenarioEnabled ? 'Scenario Portfolio' : (isFiltered ? 'Filtered Addresses' : 'All Addresses')}
            {scenarioEnabled ? <span style={{ marginLeft: 9, padding: '2px 6px', border: '1px solid rgba(227,184,92,.65)', borderRadius: 3, fontFamily: 'sans-serif', fontSize: 9, color: 'rgb(240,205,130)', verticalAlign: 'middle' }}>SCENARIO</span> : null}
        </div>
        <div className="jumbo-value-row">
            <span className="jumbo-currency" style={scenarioEnabled ? { color: 'rgb(240,205,130)' } : undefined}>
                $
            </span>
            <span className="jumbo-price" style={scenarioEnabled ? { color: 'rgb(240,205,130)' } : undefined}>
                <RollingBalance value={balance} />
            </span>
        </div>
        {balancesLoading ? <div className="jumbo-loader">
            <Tooltip content={tooltipContent} placement="top">
                <LoadingWave numDots={8} speed={100} />
            </Tooltip>
        </div> : ''}
    </Wrapper>
}