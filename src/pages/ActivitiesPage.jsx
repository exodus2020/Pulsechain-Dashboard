import styled from "styled-components"
import Button from "../components/Button"
import Icon from "../components/Icon"
import ImageContainer from "../components/ImageContainer"
import { tokensModalAtom, walletsModalAtom, toastAtom, appSettingsAtom } from "../store"
import { useAtom } from "jotai"
import { useAppContext } from "../shared/AppContext"
import Tooltip from "../shared/Tooltip"
import { icons_list } from "../config/icons"
import React, { memo, useMemo, useState } from "react"
import { shortenString } from "../lib/string"
import LoadingWave from "../components/LoadingWave"
import useActivities from "../hooks/useActivies"
import { PULSECHAIN_FIRST_BLOCK } from "../lib/web3"
import { Dropdown } from "../components/Dropdown"
import { decodeTransaction } from "../lib/transactions"
import { copyToClipboard } from '../lib/utils'

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
    .price-button {
        display: grid;
        grid-template-columns: 50px 1fr;
        text-align: left;
        font-weight: 550;
        font-family: 'Robot', sans-serif;
    }
    
    select {
        font-size: 12px;
        padding: 5px 15px;
    }
`

export default memo(PageCheck)
function PageCheck (props) {
    const [ settings, setSettings ] = useAtom(appSettingsAtom)

    if (!settings.config.scanEnabled) {
        return <Wrapper>
            <div style={{ marginBottom: 15, position: 'relative', letterSpacing: 0.5 }}>
                Most Recent Activities
            </div>
            <div style={{ fontFamily: 'sans-serif' }}>
                This feature utilizes the PulseChain Explorer API.<br/>
                Temporarily enable external calls to the PulseChain Explorer API?
                <div style={{ fontSize: 14, paddingBottom: 10 }} className="mute">
                    Note: This can be permanently enabled in the settings menu.
                </div>
                <div style={{ width: 300, marginTop: 15 }}>
                    <Button onClick={() => setSettings(prev => ({ ...prev, config: { ...prev.config, scanEnabled: true } }))} text="Enable Explorer API" textAlign="center"/>
                </div>
            </div>
        </Wrapper>
    }

    return <ActivitiesPage {...props} />
}


function ActivitiesPage ({priceData, balanceData, farmData}) {
    const { pricePairs, prices, priceLastUpdated } = priceData
    const { balances, combinedBalances } = balanceData

    const [ tokenModal, setTokenModal ] = useAtom(tokensModalAtom)
    const [ walletModal, setWalletModal ] = useAtom(walletsModalAtom)
    const [ toast, setToast] = useAtom(toastAtom)

    const { data, getImage, getTokenInfo } = useAppContext()
    const wallets = Object.keys(data?.wallets ?? {}).map(m => m)

    const priceArray = Object.keys(prices)
    const pricesLoaded = priceArray.length > 0

    const { activities, loading } = useActivities(wallets)
    const [ filterFork, setFilterFork ] = useState(true)

    const [ filterWallet, setFilterWallet ] = useState('All')
    const handleFilterChange = (filterOn) => {
        setFilterWallet(filterOn)
    }

    const combinedActivities = Object.keys(activities).reduce((acc, i) => {
        return [...acc, ...activities[i]]
    }, [])

    const displayActivities = [...combinedActivities.filter(f => shortenString(f.originating_address) == filterWallet || filterWallet == 'All')]
    const { memoActivities } = useMemo(() => {
        return { memoActivities: displayActivities.sort((a, b) => b.block - a.block).filter((f,i) => i < 50) }
    }, [displayActivities, filterWallet, filterFork])
    const entriesPriorToFork = memoActivities.filter(f => f.block < PULSECHAIN_FIRST_BLOCK).length

    const handleCopy = async (hash) => {
        const success = await copyToClipboard(hash)
        if (success) {
            setToast(prev => ({
                messages: [...prev.messages, { id: prev.nextId, text: `Txn Hash Copied (${shortenString(hash)})` }],
                nextId: prev.nextId + 1
            }))
        }
    }

    return <Wrapper>
        <div style={{ marginBottom: 15, position: 'relative' }}>
            Most Recent Activities
            {loading === true ? <div style={{ display: 'inline-block', position: 'absolute', left: 100, top: -6 }}><LoadingWave numDots={8} speed={150}/></div> : ''}
            {wallets.length > 0 ? <div style ={{ position: 'absolute', right: -40, top: -15  }}>
                <Dropdown options={wallets.map(m => shortenString(m))} onChange={handleFilterChange} />    
            </div> : ''}
        </div>
        <div>
            {wallets.length === 0 ? <div>
                Add an address to get started<br/><br/>
                <Button onClick={() => setWalletModal(true)} text="Add Address" textAlign="center" style={{ width: 175 }}/>
            </div> : ''}
        </div>
        
        {memoActivities.filter(f => filterFork ? f.block >= PULSECHAIN_FIRST_BLOCK : true).map((activity, i) => {
            const isContractCall = activity.tx_types.includes('contract_call')
            const isFailedTx = activity.status === 'error'
            const isPriorToFork = activity.block < PULSECHAIN_FIRST_BLOCK
            
            const txMethod = isContractCall ? activity?.method : null
            const plsValue = parseFloat(BigInt(activity?.value ?? 0) / BigInt(10**16)) / 10**2
            
            const txDirection = activity.originating_address.toLowerCase() === activity.from.hash.toLowerCase() ? 'out' : 'in'
            const counterpartyAddress = txDirection === 'in' ? (activity?.from?.hash ?? '') : (activity.to?.hash ?? '')
            
            const decodedTx = decodeTransaction(activity)
            const isSwapTx = decodedTx?.type === 'swap'
            const isTransferTx = decodedTx?.type === 'transfer' || (!isContractCall && plsValue > 0)
            
            const plsTokenImage = !isPriorToFork ? getImage('0xa1077a294dde1b09bb078844df40758a5d0f9a27') : getImage('0x02DcdD04e3F455D838cd1249292C58f3B79e3C3C')
            

            const txAddyInName = decodedTx?.addressIn ? getTokenInfo(decodedTx?.addressIn)?.name : ''
            const txAddyOutName = decodedTx?.addressOut ? getTokenInfo(decodedTx?.addressOut)?.name : ''

            
            const txIcon = (() => {
                const isSimpleTransfer = (txDirection === 'out' && !activity?.to?.is_contract) || 
                                        (txDirection === 'in' && !activity?.from?.is_contract)
                if (isTransferTx && isSimpleTransfer) {
                    return plsTokenImage
                }
                return getImage(counterpartyAddress ?? '')
            })()
            
            const fromName = activity.from?.name ?? shortenString(activity.from.hash)
            const toName = activity.to?.name ?? shortenString(activity.to.hash)
            const displayName = txDirection === 'in' ? fromName : toName
            const displayNameTooltip =  txDirection === 'in' ? activity.from?.hash : activity.to?.hash
            const txDate = new Date(activity.timestamp)
            
            const DirectionIndicator = ({ direction }) => {
                const styles = {
                    background: direction === 'in' ? 'rgba(70,120,70,.6)' : 'rgba(150,140,25,.3)',
                    color: direction === 'in' ? 'rgba(120,180,120,1)' : 'rgba(200,170,25,1)',
                    padding: '5px 20px',
                    display: 'inline-block',
                    borderRadius: '5px'
                }
                return (
                    <div>
                        <div style={styles}>{direction.toUpperCase()}</div>
                    </div>
                )
            }

            const buttonStyle = isPriorToFork
                ? { background: 'rgb(20,20,20)', color: 'rgb(70,70,70)' }
                : isFailedTx
                ? { background: 'rgb(40,25,25)' }
                : {}

            return (
                <div key={i} style={{ color: 'white', marginBottom: 5 }}>
                    <Button 
                        onClick={() => {
                            handleCopy(activity.hash)
                        }} 
                        style={buttonStyle}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: '35px 45px 150px 150px 1fr 1fr', textAlign: 'center' }}>
                            {/* Icon Section */}
                            {isContractCall ? (
                                isTransferTx ? (
                                    <ImageContainer source={isPriorToFork ? getImage('') : txIcon} />
                                ) : isSwapTx ?(
                                    <Icon icon={icons_list.swap} />
                                ) : (
                                    <Icon icon={icons_list.contract} />
                                )
                            ) : (
                                isTransferTx ? (
                                    <ImageContainer source={plsTokenImage} />
                                ) : (
                                    <Icon icon={icons_list[txDirection === 'in' ? 'inward' : 'outward']} />
                                )
                            )}
                            
                            <div/> {/* Spacer */}
                            <div>
                                <Tooltip content={displayNameTooltip} placement="top">
                                    {displayName}
                                </Tooltip>
                            </div>
                            
                            {/* Method/Direction Section */}
                            <div>
                                {!isTransferTx && txMethod ? (
                                    txMethod
                                ) : (
                                    <Tooltip content={txMethod ?? 'transfer'} placement="top">
                                        <DirectionIndicator direction={txDirection} />
                                    </Tooltip>
                                )}
                            </div>
                            
                            {/* Status/Swap Section */}
                            <div>
                                {isFailedTx && <span style={{ color: 'rgb(170,90,90)' }}>Failed</span>}
                                {!isFailedTx && isSwapTx && (
                                    <>
                                        <Tooltip content={<div>{txAddyInName ? <>{txAddyInName}<br/></> : ''}{decodedTx?.addressIn}</div>} placement="top">
                                            <ImageContainer source={getImage(decodedTx?.addressIn)} size={20} />
                                        </Tooltip>
                                        <Icon icon={icons_list['arrow-forward']} size={18} />
                                        <Tooltip content={<div>{txAddyOutName ? <>{txAddyOutName}<br/></> : ''}{decodedTx?.addressOut}</div>} placement="top">
                                            <ImageContainer source={getImage(decodedTx?.addressOut)} size={20} />
                                        </Tooltip>
                                    </>
                                )}
                            </div>
                            
                            {/* Date Section */}
                            <div style={{ width: 125, textAlign: 'right', paddingTop: 5 }}>
                                {txDate.toLocaleDateString('en-US')}
                            </div>
                        </div>
                    </Button>
                </div>
            )
        })}
        <div onClick={() => setFilterFork(!filterFork)} style={{ textAlign: 'right' }}>
            {entriesPriorToFork === 0 ? '' 
                : entriesPriorToFork > 0 && filterFork ? <span className="tl">Show entries prior to fork</span>
                : <span className="tl">Hide entries prior to fork</span>}
        </div>
    </Wrapper>

}