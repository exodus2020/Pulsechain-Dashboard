// HexComponent.jsx
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import styled from "styled-components"
import { shortenString } from "../lib/string"
import { formatNumber, fUnit } from "../lib/numbers"

// import ImageContainer from "./ImageContainer"
// import ImgHEX from '../icons/hex.png'
import Icon from "./Icon"
import { icons_list } from "../config/icons"
import Button from "./Button"
import { Selector } from "./Selector"
import { DropdownV2 } from "./DropdownV2"
import StakingLadder from "./StakingLadder"
import StakingPie from "./StakingPie"
import Input from "./Input"


const Wrapper = styled.div`
    position: relative;
    color: white;
    min-width: 650px;
    max-width: 650px;
    justify-self: center;
    font-family: 'Oswald', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 30px 0;

    button {
        &:hover {
            transform: scale(1);
        }
    }

    .hex-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;

        @media (max-width: 650px) {
            display: grid;
            grid-template-columns: 1fr;
            max-width: calc( 100dvw - 40px );
        }
    }
    input {
        padding: 4px 12px !important;
    }

    .hex-controls {
        text-align: right;
        margin-bottom: 10px;
        font-size: 14px;
        padding-right: 10px;
        position: relative;


        .hex-controls-dropdown {
            position: absolute;
            left: 10px;
            top: 0;
        }

        @media (max-width: 650px) {
            // display: flex;
            // flex-direction: column;
            // align-items: flex-end;
            text-align: center;
            max-width: calc( 100dvw - 40px );

            .hex-controls-dropdown {
                position: relative;
                padding-top: 10px;
            }
        }
    }

    @media (max-width: 650px) {
        min-width: 100dvw;
    }
`

const HexCard = styled.div`
    background: rgb(0, 0, 0, 0.5);
    border-radius: 10px;
    box-shadow: 0 1px 4px rgba(255, 255, 255, 0.1);
    padding: 10px 20px;
    position: relative;
    
    .hex-addy {
        font-size: 1.2rem;
        font-weight: bold;
    }
    .hex-type {
        font-size: 12px;
        color: rgb(180,180,180);
        padding-top: 1px;
    }
    .hex-id {
        font-size: 1rem;
    }
    .hex-shares {
        font-size: 1rem;
        position: absolute;
        top: 12px;
        right: 20px;
        .hex-share-unit {
            font-size: 16px;
            // color: rgb(200,200,200);
        }
    }
    .hex-days {
        font-size: 1rem;
        margin-top: 10px;
        .progress-bar-container {            
            width: 100%;
            height: 4px;
            background-color: rgb(30,30,30);
            border-radius: 5px;
        }
        .hex-days-remaining {
            font-size: 16px;
            letter-spacing: 1px;
            color: rgb(180,180,180);
            margin-top: 5px;
        }
    }
    .hex-data {
        // position: absolute;
        // bottom: 10px;
        // right: 20px;
        text-align: right;
        margin-top: 5px;
    }
    .hex-staked {
        font-size: 1rem;
    }
    .hex-yield {
        font-size: 1rem;
    }
    .hex-progress {
        font-size: 1rem;
    }
`

export default memo(HexComponentWrapper)

function HexComponentWrapper (props) {
    const [hide, setHide] = useState(true)

    if (hide) return <div style={{ textAlign: 'right' }}>
        <div style={{ width: '75px', display: 'inline-block'}} onClick={() => setHide(false)}>
            <Button textAlign="center">
                Details
            </Button>
        </div>
    </div>

    return <div style={{ position: 'relative' }}>
        <HexComponent {...props} setHide={setHide}/>
    </div>
}

function HexComponent ({
    hexData,
    visibleWallets,
    hexPrice,
    setHide,
    aliases = {}
    // historyData, priceData, getImage
}) {
    const hexUsd = hexPrice?.priceUsd
    const [page, setPage] = useState(0)
    const [pageSize, setPageSize] = useState(10)
    const sortOptions = ['Time Remaining', 'Shares', 'HEX Value', 'USD Value' ]
    const [filter, setFilter] = useState('')
    const [sortType, setSortType] = useState(sortOptions[0])
    const [sort, setSort] = useState('Ascending')

    const showByOptions = ['Shares', 'Value']
    const [showBy, setShowBy] = useState(showByOptions[0])
    const prevStakes = useRef(0)

    const handleSort = (stakeArray) => {
        if (sortType === 'Time Remaining') {
            return stakeArray.sort((a, b) => {
                const aGoodAccounted = a.unlockedDay > 0
                const bGoodAccounted = b.unlockedDay > 0
                const daysRemainingA = aGoodAccounted ? 0 : a.daysRemaining
                const daysRemainingB = bGoodAccounted ? 0 : b.daysRemaining

                if (sort === 'Ascending') {
                    return daysRemainingA - daysRemainingB
                } else {
                    return daysRemainingB - daysRemainingA
                }
            })
        } else if (sortType === 'Shares') {
            return stakeArray.sort((a, b) => {
                if (sort === 'Ascending') {
                    return a.tShares - b.tShares
                } else {
                    return b.tShares - a.tShares
                }
            })
        } else if (sortType === 'HEX Value') {
            return stakeArray.sort((a, b) => {
                if (sort === 'Ascending') {
                    return a.stakedHex + a.stakeHexYield + a.effectivePenalty - (b.stakedHex + b.stakeHexYield + b.effectivePenalty)
                } else {
                    return b.stakedHex + b.stakeHexYield + b.effectivePenalty - (a.stakedHex + a.stakeHexYield + a.effectivePenalty)
                }
            })
        } else if (sortType === 'USD Value') {
            return stakeArray.sort((a, b) => {
                if (sort === 'Ascending') {
                    return hexUsd * (a.stakedHex + a.stakeHexYield + a.effectivePenalty) - hexUsd * (b.stakedHex + b.stakeHexYield + b.effectivePenalty)
                } else {
                    return hexUsd * (b.stakedHex + b.stakeHexYield + b.effectivePenalty) - hexUsd * (a.stakedHex + a.stakeHexYield + a.effectivePenalty)
                }
            })
        }
    }

    const handleFilter = (input) => {
        if (input.length > 0) {
            setFilter(input)
        } else {
            setFilter('')
        }
    }

    const {displayStakes, rawStakes, totalStakes, totalPages} = useMemo(() => {
        let pageToShow = page
        if (!hexData?.combinedStakes) {
            prevStakes.current = 0
            if (page !== 0) setPage(0)
            return {displayStakes: [], totalStakes: 0, totalPages: 0}
        }

        const walletsVisible = Object.keys(visibleWallets ?? {}).map(key => key.toLowerCase())
        const walletsToShow = filter ? walletsVisible.filter(wallet => wallet.toLowerCase().includes(filter.toLowerCase()) || aliases?.[wallet?.toLowerCase() ?? '']?.toLowerCase().includes(filter.toLowerCase())) : walletsVisible
        const stakesToShow = []; 

        Object.keys(hexData.combinedStakes ?? {}).forEach(key => {
            const stake = hexData.combinedStakes[key]
            if (walletsToShow.includes(stake.parent.toLowerCase())) {
                stakesToShow.push(stake)
            }
        })

        if (stakesToShow.length === 0) {
            prevStakes.current = 0
            if (page !== 0) setPage(0)
            return {displayStakes: [], totalStakes: 0, totalPages: 0}
        }

        const totalPages = Math.ceil(stakesToShow.length / pageSize) - 1
        if (page > totalPages) {
            pageToShow = 0
            prevStakes.current = stakesToShow.length
        }

        const sortedStakes = handleSort([...stakesToShow])
        const paginatedStakes = sortedStakes.slice(pageToShow * pageSize, (pageToShow + 1) * pageSize)

        if (page !== pageToShow) setPage(pageToShow)

        return {
            rawStakes: stakesToShow,
            displayStakes: paginatedStakes,
            totalStakes: stakesToShow.length,
            totalPages: totalPages
        }
    }, [visibleWallets, page, sortType, sort, prevStakes.current, filter])

    const handlePageBack = () => {
        if (page > 0) setPage(page - 1)
    }

    const handlePageForward = () => {
        if (page < totalPages) setPage(page + 1)
    }

    const handleFirstPage = () => {
        if (page > 0) setPage(0)
    }

    const handleLastPage = () => {
        if (page < totalPages) setPage(totalPages)
    }

    const handleShowByToggle = () => {
        if (showBy === showByOptions[0]) {
            setShowBy(showByOptions[1])
        } else {
            setShowBy(showByOptions[0])
        }
    }

    return <>
        <div style={{ textAlign: 'right' }}>
            <div style={{ width: '75px', display: 'inline-block'}} onClick={() => setHide(true)}>
                <Button textAlign="center">
                    Details
                </Button>
            </div>
        </div>
        <Wrapper>
            <div>
                <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid rgb(50,50,50)', position: 'relative'}}>
                    {/* <div className="show-by-toggle">
                        <Button onClick={handleShowByToggle}>{showBy}</Button>
                    </div> */}
                    <div style={{ display: 'inline-block', marginBottom: 10 }}>
                        <Input placeholder="Filter stakes by alias or address" defaultInput={filter} onChange={handleFilter} style={{ width: 200 }} hideSubmit={true} />
                    </div>
                    <StakingPie stakes={rawStakes} showBy={showBy} hexUsd={hexUsd} handleShowByToggle={handleShowByToggle} aliases={aliases}/>
                    <StakingLadder stakes={rawStakes} />
                </div>
                <div className="hex-controls">
                    <span className={page === 0 ? 'mute' : 'tl'} onClick={handleFirstPage} style={{ marginRight: 10 }}> {' << '}</span>
                    <span className={page === 0 ? 'mute' : 'tl'} onClick={handlePageBack} style={{ marginRight: 15 }}>Prev</span>
                    <span style={{ marginRight: 15 }}>
                        {page + 1} / {totalPages + 1}
                    </span>
                    <span className={page === totalPages ? 'mute' : 'tl'} onClick={handlePageForward}>Next</span>
                    <span className={page === totalPages ? 'mute' : 'tl'} onClick={handleLastPage} style={{ marginLeft: 10 }}> {' >> '}</span>
                    <div className="hex-controls-dropdown">
                        <div style={{ display: 'inline-block' }}>
                            <DropdownV2 defaultOption={sortOptions[0]} options={sortOptions} selected={sortType} onChange={setSortType} />
                        </div>
                        <div style={{ display: 'inline-block', marginLeft: -20 }}>
                            <DropdownV2 defaultOption='Ascending' options={['Ascending', 'Descending']} selected={sort} onChange={setSort} />
                        </div>
                    </div>
                </div>
                <div className="hex-container">
                    {totalStakes == 0 ? <div style={{ paddingLeft: 15, paddingTop: 15, fontSize: 16, color: 'rgb(180,180,180)' }}>
                            No stakes found
                        </div> 
                        : <></>}
                    {displayStakes.map((m,i) => {
                        const displayShareUnit = m.tShares < 0.0001 ? 'M' : m.tShares < 1 ? 'B' : 'T'
                        const displayShares = m.tShares < 0.0001 ? parseFloat(m.tShares * 1000000).toFixed(2) : m.tShares < 1 ? parseFloat(m.tShares * 1000).toFixed(2) : fUnit(m.tShares, 2, 2)
                        const progress = (m.stakedDays - m.daysRemaining) / m.stakedDays * 100
                        const goodAccounted = m.unlockedDay > 0

                        const progressColor = 
                            goodAccounted ? 'rgb(50,200,50)' :
                            m.daysRemaining < -14 ? 'red' :
                            m.daysRemaining < -8 ? 'orange' :
                            m.daysRemaining < -0 ? 'yellow' :
                            m.daysRemaining < 3 ? 'rgb(50,200,50)' :
                            m.daysRemaining < 30 ? '#00ff88' :
                            '#00ff88'

                        const totalHexRaw = m.stakedHex + m.stakeHexYield + m.effectivePenalty
                        const totalHex = fUnit(totalHexRaw, 2)
                        const totalHexUsd = hexUsd * totalHexRaw < 0 ? 0 : hexUsd * totalHexRaw

                        return <HexCard key={`stake-${m.stakeId}-${i}`}>
                            <div className="hex-addy">{aliases?.[m?.parent?.toLowerCase() ?? ''] ? shortenString(aliases[m.parent.toLowerCase()], 18, true) : shortenString(m.parent)}</div>
                            <div className="hex-type">
                                <div className="hex-days-remaining">
                                    {goodAccounted ? 'Good Accounted' : <>
                                        {m.daysRemaining}<span style={{ fontSize: 12 }}> Days</span> {m.daysRemaining < 0 ? 'Late' : m.daysRemaining < 30 ? 'Get Ready!' : ''}
                                    </>}
                                </div>
                            </div>
                            <div className="hex-shares" style={{ textAlign: 'right' }}>
                                <div>
                                    {displayShares} <span className="hex-share-unit" style={{ marginLeft: 10 }}>{displayShareUnit}</span><span style={{ fontSize: 12, color: 'rgb(180,180,180)'}}> shares</span>
                                </div>
                                <div className="hex-type">
                                    {m.parent.toLowerCase() !== m.address.toLowerCase() ? '(HSI)' : ''} Id: {m.stakeId}
                                </div>
                            </div>
                            <div className="hex-days">
                                <div className="progress-bar-container">
                                    <div className="progress-bar" style={{ width: `${progress > 100 ? 100 : progress}%`, background: progressColor, height: '100%' }}></div>
                                </div>
                            </div>
                            <div className="hex-data">
                                <div className="hex-total">
                                    <Icon icon={icons_list.hex} size={12} style={{marginRight: 5, filter: 'grayscale(100%)' }}/>
                                    {totalHex}
                                    <span style={{ marginLeft: 10}}>
                                        <span style={{ fontSize: 12, color: 'rgb(180,180,180)', marginRight: 5 }}>$</span>{fUnit(totalHexUsd, 0)}
                                    </span>
                                </div>
                                {/* <div className="hex-staked">{m.stakedHex} HEX</div>
                                <div className="hex-yield">{m.stakeHexYield} Yield</div> */}
                            </div>
                        </HexCard>
                    })}
                </div>
            </div>
        </Wrapper>
    </>
}
