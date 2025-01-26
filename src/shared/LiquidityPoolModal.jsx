import { useAtom } from 'jotai'
import styled from 'styled-components'
import 'typeface-raleway'
import { dappModalAtom, liquidityPoolModalAtom, tokensModalAtom } from '../store'
import { icons_list } from '../config/icons'
import Button from '../components/Button'
import Icon from '../components/Icon'
import { useAppContext } from './AppContext'
import ImageContainer from '../components/ImageContainer'
import { shortenString } from '../lib/string'
import Tooltip from './Tooltip'
import { useDapp } from '../hooks/useDapp'
import { addCommasToNumber, formatNumber } from '../lib/numbers'
import { useCopyToClipboard } from '../hooks/useCopyToClipboard'
import { findPairVersion } from '../lib/web3'
import { useEffect, useRef } from 'react'

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

  .trash-button {
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
      color: rgb(250,200,200);
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

  overflow: hidden;
  color: white;

  .alert {
    border-bottom: 1px solid rgb(65, 65, 65);
    display: grid; 
    grid-template-columns: 50px 1fr 131px;
    padding-bottom: 15px;
  }

  .modal-header {
    padding: 20px 30px;
    border-bottom: 1px solid rgb(65, 65, 65);
    font-size: 20px;
    font-weight: 800;

    display: flex;
    align-items: center; /* Aligns items vertically */
    gap: 8px; /* Adds space between the icon and text */
    font-size: 20px; /* Adjust as needed for your text size */
  }
`

const RepoItem = styled.div`
  display: grid;
  grid-template-columns: 320px 150px;
  align-items: center; /* Aligns items vertically */
  gap: 8px; /* Adds space between the icon and text */
  font-size: 20px; /* Adjust as needed for your text size */
  white-space: normal; /* Allows text to wrap */
  word-wrap: break-word; /* Break long words if necessary */
  overflow-wrap: break-word; /* Ensures wrapping works for all cases */
  max-width: 100%; /* Optional: Restrict width */
`

function LiquidityPoolModal() {
  const [ modal, setModal ] = useAtom(liquidityPoolModalAtom)
  const [ tokensModal, setTokensModal ] = useAtom(tokensModalAtom)
  const context = useAppContext()
  const [ dappModal, setDappModal ] = useAtom(dappModalAtom)
  const { isInstalled, isLoading, launchDapp } = useDapp('pulsex')
  const { copyTextToClipboard } = useCopyToClipboard()  
  const handleCopy = (text) => {
    copyTextToClipboard(text, `${shortenString(text)} copied to clipboard`, 'Failed to copy')
  }

  
  
  
  const getImage = context?.getImage

  const { poolData, priceInfo0, priceInfo1, isLpwatchlist } = modal
  
  const version = useRef(!isLpwatchlist ? 'v1' : undefined)
  const fetchPairVersion = async (lpAddress) => {
    const pairVersion = await findPairVersion(priceInfo0?.a, priceInfo1?.a, 'mainnet', context?.settings)
    version.current = pairVersion
  }

  useEffect(() => {
    if (poolData?.lpAddress && isLpwatchlist) {
      fetchPairVersion()
    }
  }, [])


  const toggleWallet = context.toggleWallet;
  const wallets = context?.data?.wallets ?? {}

  const handleFetchToken = (address) => {
    setTokensModal({ searchTerm: address})
    setModal(false)
  }

  const t0 = poolData?.[isLpwatchlist?'token0Address':'token0'] ?? ''
  const t1 = poolData?.[isLpwatchlist?'token1Address':'token1'] ?? ''
  const lpId = { id: poolData?.lpAddress, token0: t0, token1: t1 } 

  const isToken0Wpls = t0?.toLowerCase() == '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
  const image0 = !isToken0Wpls ? getImage(t1?.toLowerCase()) : getImage(t0?.toLowerCase())
  const image1 = !isToken0Wpls ? getImage(t0?.toLowerCase()) : getImage(t1?.toLowerCase())
  const token0display = priceInfo0?.symbol ?? shortenString(t0 ?? '').toLowerCase()
  const token1display = priceInfo1?.symbol ?? shortenString(t1 ?? '').toLowerCase()

  const fetchMoreTokenInfo0 = <Button textAlign='center' onClick={() => handleFetchToken(t0.toLowerCase())}><div>Fetch Token Info</div></Button>
  const fetchMoreTokenInfo1 = <Button textAlign='center' onClick={() => handleFetchToken(t1.toLowerCase())}><div>Fetch Token Info</div></Button>

  return (
    <ModalWrapper>
      <ModalContent>
        <div style={{ overflowY: 'auto' }}>
          <div className="modal-header">
            <div style={{ display: 'inline-block', position: 'relative' }}>
              <div style={{ width: 35 }} />
                <div style={{ position: 'absolute', left: -15, top: -20 }}>
                    <ImageContainer source={image0} size={24} />
                </div>
                <div style={{ position: 'absolute', left: -2, top: -10, transform: 'scale(1)' }}>
                    <ImageContainer source={image1} size={28} />
                </div>
              </div>
              <div style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 20,whiteSpace: 'nowrap', position: 'relative' }}>
                {!isLpwatchlist ? <div style={{ width: 325 }}>
                  <Tooltip content="PulseX Farm"><span className="mute" style={{ marginRight: 5, color: 'rgb(50,200,50)' }}><Icon icon={icons_list.farm} size={20}/></span></Tooltip> {token0display} - {token1display}
                </div> : `${token0display} - ${token1display}`} 
                {isLpwatchlist ?
                    <button style={{ position: 'absolute', right: -4, top: -7, height: 20, width: 20 }} className="trash-button" onClick={() => {
                        context?.toggleLPWatchlist(lpId)
                        setModal(false)
                      }}>
                      <Tooltip content="Remove from List">
                        <Icon icon={icons_list.trash} size={20}/>
                      </Tooltip>
                    </button>
                 : ''}
            </div>
            <button className="close-button" onClick={() => setModal(false)}>
              X
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px 40px' }}>
            <div>
              {!priceInfo0 ? <div className="alert" >
                <div>ALERT</div>
                <div style={{ textAlign: 'center'}}>
                  Missing Token Info<br/>for {shortenString(t0.toLowerCase())}
                </div>
                {fetchMoreTokenInfo0}
              </div> : ''}
              {!priceInfo1 ? <div className="alert" >
                <div>ALERT</div>
                <div style={{ textAlign: 'center'}}>
                  Missing Token Info<br/>for {shortenString(t1.toLowerCase())}
                </div>
                {fetchMoreTokenInfo1}
              </div> : ''}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
              <div>
                <div style={{ minHeight: 90}}>
                  <div style={{ marginBottom: 10 }}>{token0display} Price</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>
                    {!priceInfo0?.priceUsd ? <div style={{ minHeight: 54 }}>
                      {fetchMoreTokenInfo0}</div> 
                      : <>$ {formatNumber(priceInfo0?.priceUsd ?? 0, true, true)}<br/><span style={{ fontSize: 14, fontWeight: 400 }}>{addCommasToNumber(parseFloat(priceInfo0?.priceWpls ?? 0).toFixed(Number(priceInfo0?.priceWpls ?? 0) < 2 ? 4 :0))} PLS</span></>}
                  </div>
                </div>
                <div style={{ marginTop: 40 }}>
                  <div>Token Address</div>
                  <div style={{ marginTop: 5}}><span style={{ cursor: 'pointer', marginRight: 5 }} onClick={() => handleCopy(t0)}><Icon icon={icons_list.copy} size={14}/></span>{shortenString(t0)}</div>
                </div>
              </div>
              
              <div style={{ marginBottom: 10 }}>
                <div style={{ minHeight: 90}}>
                  <div style={{ marginBottom: 10 }}>{token1display} Price</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>
                    {!priceInfo1?.priceUsd ? <div style={{ minHeight: 54 }}>{fetchMoreTokenInfo1}</div> : <>$ {formatNumber(priceInfo1?.priceUsd ?? 0, true, true)}<br/><span style={{ fontSize: 14, fontWeight: 400 }}>{addCommasToNumber(parseFloat(priceInfo1?.priceWpls ?? 0).toFixed(Number(priceInfo1?.priceWpls ?? 0) < 2 ? 4 :0))} PLS</span></>}
                  </div>
                </div>
                <div style={{ marginTop: 40 }}>
                  <div>Token Address</div>
                  <div style={{ marginTop: 5}}><span style={{ cursor: 'pointer', marginRight: 5 }} onClick={() => handleCopy(t1)}><Icon icon={icons_list.copy} size={14}/></span>{shortenString(t1)}</div>
                </div>
              </div>


            </div>
            <div style={{ marginBottom: 20 }}>
              <div>
              {token0display} - {token1display} Liquidity Pair
              </div>
              <div>
                <div style={{ marginTop: 5}}><span style={{ cursor: 'pointer', marginRight: 5 }} onClick={() => handleCopy(poolData?.lpAddress)}><Icon icon={icons_list.copy} size={14}/></span>{poolData?.lpAddress}</div>
              </div>
            </div>
            <div>
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
              : <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Button onClick={() => {
                      if(isInstalled) launchDapp(`#/info/${!version.current ? 'v2/' : version.current === 'v2' ? 'v2/' : ''}token/${t0}`)
                      if(!isInstalled) {
                        setDappModal(true)
                        setModal(false)
                      }
                    }} textAlign='center'>
                    {isLoading ? 'Loading...' : 
                      isInstalled ?  `View ${token0display} on PulseX` : 
                      `View ${token0display} on PulseX`}
                  </Button>
                  <Button onClick={() => {
                      if(isInstalled) launchDapp(`#/info/${!version.current ? 'v2/' : version.current === 'v2' ? 'v2/' : ''}token/${t1}`)
                      if(!isInstalled) {
                        setDappModal(true)
                        setModal(false)
                      }
                    }} textAlign='center'>
                    {isLoading ? 'Loading...' : 
                      isInstalled ?  `View ${token1display} on PulseX` : 
                      `View ${token1display} on PulseX`}
                  </Button>
                </div>
                <div style={{ marginTop: 10 }}>
                  <Button onClick={() => {
                      if(isInstalled) launchDapp(`#/info/${!version.current ? 'v2/' : version.current === 'v2' ? 'v2/' : ''}pool/${poolData?.lpAddress}`)
                      if(!isInstalled) {
                        setDappModal(true)
                        setModal(false)
                      }
                    }} textAlign='center'>
                    {isLoading ? 'Loading...' : 
                      isInstalled ? 'View Pair on PulseX' : 
                      'View Pair on PulseX'}
                  </Button>
                </div>

                {!isLpwatchlist ? <div style={{ marginTop: 10 }}>
                  <Button onClick={() => {
                      if(isInstalled) launchDapp(`#/farms`)
                      if(!isInstalled) {
                        setDappModal(true)
                        setModal(false)
                      }
                    }} textAlign='center'>
                    {isLoading ? 'Loading...' : 
                      isInstalled ? 'View Farms on PulseX' : 
                      'View Farms on PulseX'}
                  </Button>
                </div> : ''}

                {/* <div style={{ marginTop: 10 }}>
                  <div>
                    <Button style={{ textAlign: 'center', display: 'inline-block'}}
                      onClick={() => {
                          context?.toggleWatchlist(watchlistData)
                          setModal(null)
                        }}>
                        Remove from List
                    </Button>
                  </div>
                </div> */}

              </div>}
            </div>
          </div>
        </div>
      </ModalContent>
      <ModelOverLay onClick={() => setModal(false)}/>
    </ModalWrapper>
  )
}

export default LiquidityPoolModal