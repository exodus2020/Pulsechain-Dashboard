import { useAtom } from 'jotai'
import styled from 'styled-components'
import 'typeface-raleway'
import { dappModalAtom, tokenModalAtom } from '../store'
import { icons_list } from '../config/icons'
import Icon from '../components/Icon'
import Button from '../components/Button'
import { shortenString } from '../lib/string'
import { addCommasToNumber, formatNumber, fScientific, fUnitSub } from '../lib/numbers'
import { useAppContext } from './AppContext'
import ImageContainer from '../components/ImageContainer'
import { defaultTokenInformation } from '../lib/tokens'
import { useCopyToClipboard } from '../hooks/useCopyToClipboard'
import { useDapp } from '../hooks/useDapp'
import HistoryChart from '../components/HistoryChart'
import { useEffect, useRef } from 'react'
import { findPairVersion } from '../lib/web3'

const ModalWrapper = styled.div`
  position: absolute; top: 0; left: 0; height: 100vh; width: 100vw;
  user-select: none;
  z-index: 100;
  background: rgba(30,30,30, 0.9);
  backdrop-filter: blur(3px);
  overflow: hidden;

  .close-button {
    color: white;
    background: rgba(0,0,0,0);
    outline: none;
    border: none;
    position: absolute; right: 10px;
    cursor: pointer;

    padding: 10px 20px;
    color: rgb(240,240,240);
    transition: color 0.3s ease;
    cursor: pointer;
    &:hover {
      color: rgb(200,200,200);
    }
  }
`

const ModelOverLay = styled.div`
  position: fixed; top: 0; left: 0; height: 100vh; width: 100vw;
  z-index: 500;
  overflow: hidden;
`

const ModalContent = styled.div`
  position: absolute;
  top: 50%; left: 50%;
  transform: translateX(-50%) translateY(-50%);
  max-height: 80%; width: 500px;
  background: rgb(50,50,50);
  border-radius: 15px;
  z-index: 1000;

  overflow-x: hidden;
  color: white;

  .modal-header {
    padding: 20px 30px;
    border-bottom: 1px solid rgb(70, 70, 70);
    font-size: 20px;
    font-weight: 800;

    display: flex;
    align-items: center; /* Aligns items vertically */
    gap: 8px; /* Adds space between the icon and text */
    font-size: 20px; /* Adjust as needed for your text size */
  }
`

function TokenModal({ historyData, bestStable }) {
  const [ m, setModal ] = useAtom(tokenModalAtom)
  const [ dappModal, setDappModal ] = useAtom(dappModalAtom)
  const { isInstalled, isLoading, launchDapp } = useDapp('pulsex')

  const { copyTextToClipboard } = useCopyToClipboard()  
  const handleCopy = (text) => {
    copyTextToClipboard(text, `${shortenString(text)} copied to clipboard`, 'Failed to copy')
  }

  const context = useAppContext()

  const isToken0Wpls = m?.a == '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
  const address = (isToken0Wpls ? m?.token1?.id : m?.token0?.id).toLowerCase()
  const name = isToken0Wpls ? m?.token1?.name : m?.token0?.name
  const symbol = isToken0Wpls ? m?.token1?.symbol : m?.token0?.symbol
  const derivedUSD = isToken0Wpls ? m?.token1?.derivedUSD : m?.token0?.derivedUSD
  const reserveUSD = fScientific(Number(m?.reserveUSD), 0)
  
  const image = context.getImage(address.toLowerCase())

  const token0reserves = Number(m.reserve0) / 10**Number(m.token0.decimals)
  const token1reserves = Number(m.reserve1) / 10**Number(m.token1.decimals)

  const isDefaultToken = defaultTokenInformation?.[address.toLowerCase()] ? true : false;
  const watchlistData = context?.data?.watchlist?.[m.pairId.toLowerCase()]

  const displayPriceUsd = formatNumber(m?.priceUsd ?? 0, true, true)

  const version = useRef(undefined)
  const fetchPairVersion = async () => {
    const pairVersion = await findPairVersion(m?.token1?.id, m?.token0?.id, 'mainnet', context?.settings)
    version.current = pairVersion
  }

  useEffect(() => {
    if (m?.token1?.id && m?.token0?.id) {
      fetchPairVersion()
    }
  }, [])
  
  return (
    <ModalWrapper>
      <ModalContent>
        <div style={{ overflowY: 'auto' }}>
          <div className="modal-header">
              <ImageContainer source={image} size={24}/> {name}
              <button className="close-button" onClick={() => setModal(null)}>
                X
              </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px 40px' }}>
            <div>
              <div style={{ marginBottom: 40 }}>
                <div style={{ marginBottom: 10 }}>Price</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>
                  $ {displayPriceUsd}
                  {/* {m.priceUsd > 0.98 ? parseFloat(m.priceUsd).toFixed(2) : m.priceUsd} */}
                  <br/><span style={{ fontSize: 14, fontWeight: 400 }}>{addCommasToNumber(parseFloat(m.priceWpls).toFixed(Number(m.priceWpls) < 2 ? 4 :0))} PLS</span>
                </div>
              </div>

              <div style={{ marginTop: -30, marginBottom: 20 }}>
                <HistoryChart historyData={historyData} tokenAddress={address} pairAddress={m.pairId} pairInfo={m} bestStable={bestStable}/>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div>Token Address</div>
                <div style={{ marginTop: 5}}>
                  <div style={{ display: 'inline-block', width: 20, cursor: 'pointer' }} onClick={() => handleCopy(address)}>
                    <Icon icon={icons_list.copy} size={14}/>
                  </div>
                  {address}
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div>WPLS - {symbol} Liquidity Pair</div>
                <div style={{ marginTop: 5}}>
                  <div style={{ display: 'inline-block', width: 20, cursor: 'pointer' }} onClick={() => handleCopy(m.pairId)}>
                    <Icon icon={icons_list.copy} size={14}/>
                  </div>
                  {m.pairId}
                </div>
              </div>
              
              <div style={{ marginTop: 40,marginBottom: 10 }}/>
              {!isInstalled ?<div style={{ textAlign: 'center' }}>
                <div>PulseX has not been downloaded.</div>
                <div style={{ marginBottom: 10, marginTop: 10 }}>Download PulseX to view this token locally</div>
                <Button onClick={() => {
                  setDappModal(true)
                  setModal(false)
                }} textAlign='center'>
                  Download PulseX
                </Button>
              </div> 
                : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Button onClick={() => {
                    if(isInstalled) launchDapp(`#/info/${!version.current ? 'v2/' : version.current === 'v2' ? 'v2/' : ''}token/${address}`)
                    if(!isInstalled) {
                      setDappModal(true)
                      setModal(false)
                    }
                  }} textAlign='center'>
                  {isLoading ? 'Loading...' : 
                   isInstalled ? 'View Token on PulseX' : 
                   'View Token on PulseX'}
                </Button>
                <Button onClick={() => {
                    if(isInstalled) launchDapp(`#/info/${!version.current ? 'v2/' : version.current === 'v2' ? 'v2/' : ''}pool/${m.pairId}`)
                    if(!isInstalled) {
                      setDappModal(true)
                      setModal(false)
                    }
                  }} textAlign='center'>
                  {isLoading ? 'Loading...' : 
                   isInstalled ? 'View Pair on PulseX' : 
                   'View Pair on PulseX'}
                </Button>
              </div>}
              {watchlistData ? <div style={{ marginTop: 10 }}>
              <Button style={{ width: 180, textAlign: 'center', display: 'inline-block'}}
                onClick={() => {
                    context?.toggleWatchlist(watchlistData)
                    setModal(null)
                  }}>
                  Remove from List
              </Button>
            </div> : ''}
            </div>
          </div>
        </div>
      </ModalContent>
      <ModelOverLay onClick={() => setModal(false)}/>
    </ModalWrapper>
  )
}

export default TokenModal