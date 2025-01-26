import { useAtom } from 'jotai'
import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import 'typeface-raleway'
import { appSettingsAtom, liquiditySearchModalAtom } from '../store'
import { icons_list } from '../config/icons'
import Icon from '../components/Icon'
import Button from '../components/Button'
import { Input } from '../components/Input'
import useLiquiditySearch from '../hooks/useLiquiditySearch'
import { shortenString } from '../lib/string'
import { useAppContext } from './AppContext'
import ImageContainer from '../components/ImageContainer'
import LoadingWave from '../components/LoadingWave'
import { liquidityPairs } from '../lib/tokens'
import { validateAndFetchLPInfo } from '../lib/web3'

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
  min-height: 40%; max-height: 50%; width: 500px;
  background: rgb(50,50,50);
  border-radius: 15px;
  z-index: 1000;
  overflow-x: hidden;
  color: white;

  .modal-header {
    padding: 20px 30px;
    border-bottom: 1px solid rgb(50, 50, 50);
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

function LiquiditySearchModal() {
  const [ modal, setModal ] = useAtom(liquiditySearchModalAtom)
  const { searchTerm: prefilledTerm } = modal

  const [ searchTerm, setSearchTerm ] = useState(prefilledTerm ?? '')
  const [ settings ] = useAtom(appSettingsAtom)
  const [ scanned, setScanned ] = useState(false)
  const [ showScanPrompt, setShowScanPrompt ] = useState(false)
  const [ allowOneTimeScan, setAllowOneTimeScan ] = useState(false)

  const { toggleLPWatchlist, getImage, data: context, massToggleLPWatchlist } = useAppContext()
  const lps = [...Object.keys(context?.lpWatchlist ?? {}), ...Object.keys(liquidityPairs ?? {})]
  const { isLoading, isError, data, noResults, scanForTokens } = useLiquiditySearch({ searchTerm, wallets: Object.keys(context?.wallets ?? {}), lpAddresses: lps ?? [] })


  const handleScanApproval = () => {
    setAllowOneTimeScan(true)
    setShowScanPrompt(false)
  }

  const handleScan = async () => {
    if (scanned) return
    
    // If scan not enabled and not yet allowed one-time, show prompt
    if (!settings?.config?.scanEnabled && !allowOneTimeScan) {
      setShowScanPrompt(true)
      return
    }

    setScanned(true)
    try {
      await scanForTokens()
    } catch (err) {
      console.log('Unable to scan for tokens')
    }
  }

  const handleSubmit = async (inputValue) => {
    if(isLoading) return

    try {
      const lpInfo = await validateAndFetchLPInfo(inputValue)
      if (lpInfo?.token0?.id && lpInfo?.token1?.id) {
        const validWPLSLP = lpInfo?.token0?.id.toLowerCase() === '0xa1077a294dde1b09bb078844df40758a5d0f9a27' || lpInfo?.token1?.id.toLowerCase() === '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
        if (validWPLSLP) {
          setResults([lpInfo])
          return
        }
      }
    } catch (err) {
      // Not valid LP
    }

    setSearchTerm(inputValue)
  }

  useEffect(() => {
    if (allowOneTimeScan && !showScanPrompt && !scanned) {
      handleScan()
    }
  }, [allowOneTimeScan, showScanPrompt])

  const validLPs = (data ?? []).filter(lp => lp?.token0?.id && lp?.token1?.id && lp?.token0?.name !== 'PulseX LP' && lp?.token1?.name !== 'PulseX LP')

  // Show scan prompt modal if needed
  if (showScanPrompt) {
    return <ModalWrapper>
      <ModalContent>
        <div style={{ overflowY: 'auto' }}>
          <div className="modal-header">
            <Icon icon={icons_list.coin} size={24}/> PulseX Liquidity (PLP) Watchlist
            <button className="close-button" onClick={() => setModal(false)}>
              X
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px 10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr .2fr', gap: '10px' }}>
              <Input 
                defaultInput={searchTerm} 
                onSubmit={handleSubmit} 
                placeholder="Enter PLP token address" 
                disabled={isLoading} 
                buttonText={isLoading ? 'Searching...' : 'Search'}
              />
              <Button textAlign='center'
                style={{ background: 'rgb(40,40,40)', color: 'rgb(100,100,100)' }}
              >
                Scan
              </Button>
            </div>
            <div style={{ textAlign: 'center', fontSize: 14 }}>
              Scan utilizes the PulseChain Explorer Scan API.<br/><br/>
              Would you like to temporarily enable this feature and scan?
              <br/><br/>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', textAlign: 'center' }}>
                <Button 
                  style={{ width: '200px'}} 
                  textAlign='center' 
                  parentStyle={{ width: '200px' }}
                  onClick={handleScanApproval}
                >
                  Scan for PLP Tokens
                </Button>
              </div>
            </div>
          </div>
        </div>
      </ModalContent>
      <ModelOverLay onClick={() => setModal(false)}/>
    </ModalWrapper>
  }

  return (
    <ModalWrapper>
      <ModalContent>
        <div style={{ overflowY: 'auto' }}>
          <div className="modal-header">
            <Icon icon={icons_list.coin} size={24}/> PulseX Liquidity (PLP) Watchlist
            <button className="close-button" onClick={() => setModal(false)}>
              X
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px 10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr .2fr', gap: '10px' }}>
              <Input 
                defaultInput={searchTerm} 
                onSubmit={handleSubmit} 
                placeholder="Enter PLP token address" 
                disabled={isLoading} 
                buttonText={isLoading ? 'Searching...' : 'Search'}
              />
              <Button onClick={handleScan} textAlign='center'
                style={scanned ? { background: 'rgb(40,40,40)', color: 'rgb(100,100,100)' } : {}}
              >
                Scan
              </Button>
            </div>
            {data.length === 0 ? <div style={{ textAlign: 'center', fontSize: 12 }}>
              Note: Enter valid PLP (PulseX Liquidity Pool) token addresses only
            </div> : ''}
            <div>
              <div style={{ textAlign: 'center'}}>
                {data.length === 0 && isError ? 'Invalid PLP token address'
                  : isLoading ? <div style={{ justifyContent: 'center', textAlign: 'middle'}}>
                      <div><div style={{ display: 'inline-block'}}><LoadingWave speed={100} numDots={8}/></div></div>
                      <div>Searching</div>
                    </div>
                  : data.length === 0 || (data.length > 0 && validLPs.length === 0) ? <div>
                    {noResults || (data.length > 0 && validLPs.length === 0) ? <div>No PLP token found at this address.<br/><br/>Try another address</div> 
                      : <div>Enter an PLP token address above</div>}
                  </div>
                  : data.length > 0 && !liquidityPairs[searchTerm.toLowerCase()] ? <div>
                      Click below to add to watchlist
                      {data.length > 1 && !liquidityPairs[searchTerm.toLowerCase()] ? 
                          <Button 
                              textAlign={'center'} 
                              style={{ marginTop: 15 }} 
                              onClick={() => {
                                  massToggleLPWatchlist(validLPs)
                                  setModal(false)
                              }}
                          >
                              Add All
                          </Button> 
                          : ''
                      }
                    
                    </div>
                  : ''
                }
              </div>
              {validLPs.map((lpInfo, i) => {
                if (!lpInfo?.id) return null
                if (liquidityPairs[searchTerm.toLowerCase()]) return <div style={{ textAlign: 'center', marginTop: 10 }}>
                  {liquidityPairs[searchTerm.toLowerCase()].name}<br/>Already in Watchlist
                </div>


                const token0Address = lpInfo.token0.id
                const token1Address = lpInfo.token1.id

                const isToken0Wpls = lpInfo.token0.id.toLowerCase() === '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
                const token0Image = getImage(isToken0Wpls ? token0Address : token1Address)
                const token1Image = getImage(isToken0Wpls ? token1Address : token0Address)

                return (
                  <div style={{ marginTop: 10 }} key={`lp-${i}`}>
                    <Button 
                      style={{ position: 'relative' }} 
                      onClick={() => {
                        toggleLPWatchlist(lpInfo)
                        setModal(false)
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '75px 1fr 1fr'}}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
                          <div style={{ position: 'absolute', top: 0, left: 0 }}>
                            <ImageContainer source={token0Image} size={24}/>
                          </div>
                          <div style={{ position: 'absolute', top: 5, left: 10 }}>
                            <ImageContainer source={token1Image} size={28}/>
                          </div>
                        </div>
                        <div style={{textAlign: 'left', marginLeft: '15px'}}>
                          <div style={{paddingTop: 10}}>
                            {shortenString(lpInfo.id)}
                          </div>
                        </div>
                        <div>
                          <div style={{paddingTop: 5}}>
                            Token0: {shortenString(token0Address)}<br/>
                            Token1: {shortenString(token1Address)}
                          </div>
                        </div>
                      </div>
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </ModalContent>
      <ModelOverLay onClick={() => setModal(false)}/>
    </ModalWrapper>
  )
}

export default LiquiditySearchModal