import { useAtom } from 'jotai'
import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import 'typeface-raleway'
import { appSettingsAtom, tokensModalAtom } from '../store'
import { icons_list } from '../config/icons'
import Icon from '../components/Icon'
import Button from '../components/Button'
import { Input } from '../components/Input'
import useTokenSearch from '../hooks/useTokenSearch'
import { shortenString } from '../lib/string'
import { formatNumber, fScientific, fUnit } from '../lib/numbers'
import { useAppContext } from './AppContext'
import ImageContainer from '../components/ImageContainer'
import LoadingWave from '../components/LoadingWave'
import { liquidityPairs, wplsRawToNormalized } from '../lib/tokens'
import { fetchTokenInfo, findAndValidatePulseXPair, validateAndFetchLPInfo } from '../lib/web3'

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
  min-height: 40%; max-height: 70%; width: 500px;
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

function TokensModal({ wplsPrice }) {
  const [ modal, setModal ] = useAtom(tokensModalAtom)
  const { searchTerm: prefilledTerm } = modal
  const [ settings ] = useAtom(appSettingsAtom)

  const [ searchTerm, setSearchTerm ] = useState('')

  const isFetching = useRef(false)
  const context = useAppContext()
  const watchlistPairs = context?.data?.watchlist ?? {} 
  const watchlistAddresses = Object.keys(watchlistPairs).map(m => (watchlistPairs[m]?.token?.address ?? '').toLowerCase())

  const {isLoading, isError, data, noResults, scanForTokens } = useTokenSearch({ searchTerm, wallets: Object.keys(context?.data?.wallets ?? {}), watchlistAddresses, wplsPrice})
  const [ scanned, setScanned ] = useState(false)
  const [ showScanPrompt, setShowScanPrompt ] = useState(false)
  const [ allowOneTimeScan, setAllowOneTimeScan ] = useState(false)

  const [ results, setResults ] = useState([])
  const [ selectedTokens, setSelectedTokens ] = useState([])

  const handleSelectToken = (token) => {
    setSelectedTokens(prev => {
      if (prev.some(t => t?.id === token?.id)) {
        const newResult = prev.filter(t => t?.id !== token?.id)
        return newResult
      }
      const newResult = [...prev, token]
      return newResult
    })
  }

  useEffect(() => {
    if (prefilledTerm) {
      handleSubmit(prefilledTerm)
    }
  }, [prefilledTerm])

  useEffect(() => {
    setResults([])
  }, [searchTerm])
  
  useEffect(() => {
    if (Array.isArray(data) && data.length > 0) {
        // First sort by reserveUSD
        const sortByBalance = !isNaN(Number(data[0]?.balance))
        const sorted = data.sort((a, b) => sortByBalance ? Number(b.balance) - Number(a.balance) : Number(b.reserveUSD) - Number(a.reserveUSD))

        const filteredResults = []
        sorted.forEach(m => {
            if (filteredResults.some(f => f?.pairId == m?.pairId && f?.version == m?.version)) return
            filteredResults.push({...m})
        })

        setResults(filteredResults)
    }
  }, [data])

  const handleSubmit = async(inputValue) => {
    if(isLoading) return
    isFetching.current = true
    setResults([])

    let searchValue = inputValue
    try {
      const tokenInfo = await fetchTokenInfo(inputValue, 'mainnet', context?.settings)
      if ((tokenInfo?.name ?? '').startsWith('PulseX') && tokenInfo?.symbol === 'PLP') {
        isFetching.current = false
        setResults([]);
        return
      }
      
    } catch {

    }
    try {
      const pair = await findAndValidatePulseXPair({ tokenAddress: inputValue, version: 'v2' })
      if (pair?.token0?.id && pair?.token1?.id) {
        const isToken0Wpls = pair.token0?.id === '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
        const normalized = isToken0Wpls ? wplsRawToNormalized(pair?.reserve0) : wplsRawToNormalized(pair?.reserve1)
        const wplsReservesUsdValue = normalized * wplsPrice

        const otherTokenValueInWpls = !isToken0Wpls ? 
          (Number(pair?.reserve1) / Math.pow(10, Number(pair?.token1?.decimals))) / 
          (Number(pair?.reserve0) / Math.pow(10, Number(pair?.token0?.decimals)))
        : 
          (Number(pair?.reserve0) / Math.pow(10, Number(pair?.token0?.decimals))) / 
          (Number(pair?.reserve1) / Math.pow(10, Number(pair?.token1?.decimals)))

        const otherTokenValue = otherTokenValueInWpls * wplsPrice

        pair.token0.derivedUSD = isToken0Wpls ? wplsReservesUsdValue : otherTokenValue
        pair.token1.derivedUSD = !isToken0Wpls ? wplsReservesUsdValue : otherTokenValue
        pair.reserveUSD = !isNaN(Number(wplsReservesUsdValue)) && !isNaN(Number(otherTokenValue)) ? wplsReservesUsdValue + otherTokenValue : 0

        if (Number(wplsReservesUsdValue) > 1_000) {
          setResults([pair])
          isFetching.current = false
          return
        }
      }
    } catch {
      // Not a valid pair on V2
    }

    try {
      const pair = await findAndValidatePulseXPair({ tokenAddress: inputValue, version: 'v1' })
      if (pair?.token0?.id && pair?.token1?.id) {
        const isToken0Wpls = pair.token0?.id === '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
        const normalized = isToken0Wpls ? wplsRawToNormalized(pair?.reserve0) : wplsRawToNormalized(pair?.reserve1)
        const wplsReservesUsdValue = normalized * wplsPrice

        const otherTokenValueInWpls = !isToken0Wpls ? 
          (Number(pair?.reserve1) / Math.pow(10, Number(pair?.token1?.decimals))) / 
          (Number(pair?.reserve0) / Math.pow(10, Number(pair?.token0?.decimals)))
        : 
          (Number(pair?.reserve0) / Math.pow(10, Number(pair?.token0?.decimals))) / 
          (Number(pair?.reserve1) / Math.pow(10, Number(pair?.token1?.decimals)))

        const otherTokenValue = otherTokenValueInWpls * wplsPrice

        pair.token0.derivedUSD = isToken0Wpls ? wplsReservesUsdValue : otherTokenValue
        pair.token1.derivedUSD = !isToken0Wpls ? wplsReservesUsdValue : otherTokenValue
        pair.reserveUSD = !isNaN(Number(wplsReservesUsdValue)) && !isNaN(Number(otherTokenValue)) ? wplsReservesUsdValue + otherTokenValue : 0

        if (Number(wplsReservesUsdValue) > 1_000) {
          setResults([pair])
          isFetching.current = false
          return
        }
      }
    } catch {
      // Not a valid pair on V1
    }

    try {
      const lpInfo = await validateAndFetchLPInfo(inputValue)
      if (lpInfo?.token0?.id && lpInfo?.token1?.id) {
        const validWPLSLP = lpInfo?.token0?.id.toLowerCase() === '0xa1077a294dde1b09bb078844df40758a5d0f9a27' || lpInfo?.token1?.id.toLowerCase() === '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
        if (validWPLSLP) {
          setResults([lpInfo])
          isFetching.current = false
          return
        }
        searchValue = lpInfo?.token1?.id
      }
    } catch (err) {
      // Not valid LP
    }

    isFetching.current = false
    setSearchTerm(searchValue)
  }

  const diplayResult = (i) => {
    const isToken0Wpls = results[i]?.token0.id == '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
    const address = isToken0Wpls ? results[i]?.token1?.id : results[i]?.token0?.id
    const name = isToken0Wpls ? results[i]?.token1?.name : results[i]?.token0?.name
    const symbol = isToken0Wpls ? results[i]?.token1?.symbol : results[i]?.token0?.symbol
    const derivedUSD = isToken0Wpls ? results[i]?.token1?.derivedUSD : results[i]?.token0?.derivedUSD
    const reserveUSD = fScientific(Number(results[i]?.reserveUSD), 0)

    const info = results[i]?.info;
    const balance = results[i]?.balance ?? 0;
    
    if (liquidityPairs[results[i]?.id ?? '']) return null

    const isSelected = selectedTokens.some(t => t?.id === results[i]?.id)

    const image = context.getImage(address.toLowerCase())
    const baseStyle = { position: 'relative' }
    
    return <div style={isSelected ? { border: '1px solid white', background: 'rgb(40,40,40)'} : {}}>
    <Button style={isSelected ? {...baseStyle, background: 'rgb(40,40,40)', color: 'rgb(190,190,190)' } : baseStyle} onClick={()=> {
        const newItem = {...results[i], token: {
          address, name, symbol
        }, }
        handleSelectToken(newItem)
      }}>
      {image ? <div style={{ marginRight: 15 }}>
        <ImageContainer source={image}/>
      </div> : <div style={{ width: 40 }}/>
      }
      <div style={{textAlign: 'left' }}>
        <div>
          {name} ({symbol})
        </div>
        <div style={{paddingTop: 10}}>
          {shortenString(address)} {info ? `• $${formatNumber(derivedUSD, true, true)}` : ''}
        </div>
        <div style={{ position: 'absolute', top: 5, right: 5, textAlign: 'right'}}>
          <div style={{ letterSpacing: 1 }}>
            {info ? `Balance: $${fUnit(balance, 2)}`
              : `$ ${isNaN(Number(derivedUSD)) || derivedUSD == 0 ? '-' : formatNumber(parseFloat(derivedUSD).toFixed(16), true, true) }`
            }
            
          </div>
          <div style={{paddingTop: 10}}>
            {results[i]?.version?.toUpperCase()} Pool: $ <span style={{letterSpacing: 1}}>{reserveUSD}</span>
          </div>
        </div>
      </div>
    </Button>
    </div>
  }

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

  useEffect(() => {
    if (allowOneTimeScan && !showScanPrompt && !scanned) {
      handleScan()
    }
  }, [allowOneTimeScan, showScanPrompt])

  const handleToggleTokens = () => {
    context.massToggleWatchlist(selectedTokens)

    setModal(false)
  }

  if (showScanPrompt) {
    return (
      <ModalWrapper>
        <ModalContent>
          <div style={{ overflowY: 'auto' }}>
            <div className="modal-header">
                <Icon icon={icons_list.coin} size={24}/> Token Watchlist
                <button className="close-button" onClick={() => setModal(false)}>
                  X
                </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px 10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr .2fr', gap: '10px' }}>
                <Input defaultInput={prefilledTerm ?? searchTerm} onSubmit={handleSubmit} placeholder={"Search for a token symbol or address"} disabled={false} containerStyle={{ gridTemplateColumns: '1fr 100px'}}/>
                <Button onClick={handleScan} textAlign='center'
                    style={scanned ? { background: 'rgb(40,40,40)', color: 'rgb(100,100,100)' } : {}}
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
                    Scan for Tokens
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </ModalContent>
        <ModelOverLay onClick={() => setModal(false)}/>
      </ModalWrapper>
    )
  }

  return (
    <ModalWrapper>
      <ModalContent>
        <div style={{ overflowY: 'auto' }}>
          <div className="modal-header">
              <Icon icon={icons_list.coin} size={24}/> Token Watchlist
              <button className="close-button" onClick={() => setModal(false)}>
                X
              </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px 10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr .2fr', gap: '10px' }}>
              <Input defaultInput={prefilledTerm ?? searchTerm} onSubmit={handleSubmit} placeholder={"Search for a token symbol or address"} disabled={false} containerStyle={{ gridTemplateColumns: '1fr 100px'}}/>
              <Button onClick={handleScan} textAlign='center'
                  style={scanned ? { background: 'rgb(40,40,40)', color: 'rgb(100,100,100)' } : {}}
              >
                Scan
              </Button>
            </div>
            <div style={{ textAlign: 'center', fontSize: 12 }}>
              {results.length > 0 ? <Button onClick={handleToggleTokens} textAlign='center' style={{ width: 200, margin: 'auto' }}>
                Add Selected Tokens
              </Button> : 'Note: Tokens must have at sufficient liquidity in WPLS'}
            </div>
            <div>
              <div style={{ textAlign: 'center'}}>
                {data.length === 0 && isError ? 'Error, try a different search'
                  : isLoading || isFetching.current ? <div style={{ justifyContent: 'center', textAlign: 'middle'}}>
                      <div><div style={{ display: 'inline-block'}}><LoadingWave speed={100} numDots={8}/></div></div>
                      <div>Searching</div>
                    </div>
                  : data.length === 0 ? <div>
                    {noResults ? <div>No results found or not enough liquidity in WPLS.<br/><br/>Try searching for another symbol or contract address</div> :<div>Search for a symbol or contract address above</div>}
                    </div>
                  : data.length > 0 ? 'Click an address below to add to watchlist'
                  : ''
                }
              </div>
              {results.length > 1 ? <div>
                Top Result:<br/>
                <div style={{ marginTop: 10 }}>
                  {diplayResult(0)}
                </div>
              </div> : ''}
              {results.length > 0 ? <div style={{ marginTop: 10 }}>
                  Results: <br/>
                  {results.map((m, i) => {
                    if(results.length > 1 && i === 0) return null
                    return <div key={`ts-${i}`} style={{ marginTop: 10 }}>
                      {diplayResult(i)}
                    </div>
                })}
              </div> : '' }
            </div>
          </div>
        </div>
      </ModalContent>
      <ModelOverLay onClick={() => setModal(false)}/>
    </ModalWrapper>
  )
}

export default TokensModal