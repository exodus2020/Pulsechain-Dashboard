import { useAtom } from 'jotai'
import styled from 'styled-components'
import 'typeface-raleway'
import { walletsModalAtom, walletSortAtom, walletSortDirectionAtom } from '../store'
import { icons_list } from '../config/icons'
import Icon from '../components/Icon'
import { Input } from '../components/Input'
import { useAppContext } from './AppContext'
import { isValidWalletAddress } from '../lib/web3'
import { useCopyToClipboard } from '../hooks/useCopyToClipboard'
import { useWallets } from '../hooks/useWallets'
import Tooltip from './Tooltip'
import SingleWallet from '../components/SingleWallet'
import { useState, useEffect, useRef, useMemo } from 'react'
import { DropdownV2 } from '../components/DropdownV2'
import { parseHexStats } from '../lib/hex'

const ModalWrapper = styled.div`
  position: absolute; top: 0; left: 0; height: 100vh; width: 100vw;
  user-select: none;
  z-index: 100;
  background: linear-gradient(to bottom, rgba(50, 50, 50, 0.6), rgba(0, 0, 0, 0.9));
  backdrop-filter: blur(6px);
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
  max-height: 80%; width: 550px;
  background: rgb(50,50,50);
  border-radius: 15px;
  z-index: 1000;

  overflow: hidden;
  color: white;

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

  .wallet-info-headers {
    display: grid;
    grid-template-columns: 20px 130px 1fr 1fr 1fr 50px;
    gap: 10px;
    margin-bottom: 5px;
    padding: 0px 10px;
  }

  .wallet-name {
    &:hover {
      svg path {
        fill: white !important;
      }
    }
  }

  .wallet-save-mobile {
    display: none;
  }
  .wallet-save-desktop {
    display: block;
  }

  .wallet-name-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 360px;
    transform: translateX(0px) translateY(-4px);
  }
  .wallet-total-value {
    padding: 0 15px;
    font-size: 16px;
    font-weight: 600;
    position: absolute;
    right: 5px;
    top: 6px;
    pointer-events: none;
  }

  .wallet-details {
    display: grid;
    grid-template-columns: 22px 22px 100px 1fr 1fr 1fr 50px;
    gap: 10px;
    margin-bottom: 5px;
    padding: 0px 10px;
  }
  
  @media (min-width: 650px) {
    .wallet-info-headers-mobile {
      display: none;
    }
  }

  .wallet-details-container {
    overflow-y: scroll;
    max-height: 100%;
    min-height: 100%;
  }

  @media (max-width: 650px) {
    width: 100dvw;
    max-width: 100dvw;
    min-width: 100dvw;
    top: 0px; transform: translateX(-50%) translateY(0%);
    min-height: 100vh;
    max-height: 100vh;
    overflow-y: scroll;

    .wallet-name-text {
      max-width: 300px;
      transform: translateX(5px) translateY(0px);
    }

    .wallet-info-headers {
      display: none;
    }
    .wallet-info-headers-mobile {
      display: grid;
      grid-template-columns: 20px 130px 1fr;
      font-size: 14px;
      text-align: center;
      gap: 10px;
      margin-bottom: 5px;
      padding: 0px 10px;
      width: 100%;
      background: rgb(50,50,50);
      position: relative;
    }
    .wallet-details {
      display: grid;
      grid-template-columns: 22px 22px 100px 1fr 1fr 1fr 50px;
      gap: 10px;
      margin-bottom: 5px;
      padding: 0px 10px;
    }

    .wallet-save-mobile {
      display: block;
      span:hover {
        cursor: pointer;
      }
    }
    .wallet-save-desktop {
      display: none;
    }
  }

  @media (max-width: 550px) {
    .wallet-name-text {
      max-width: 190px;
    }
  }

  @media (max-width: 450px) {
    .wallet-name-text {
      max-width: 135px;
      font-size: 13px;
      transform: translateX(5px) translateY(0px);
    }

    .wallet-total-value {
      right: -10px;
      top: 8px;
      font-size: 14px;
    }
  }

  @media (max-width: 350px) {
    .wallet-name-text {
      max-width: 115px;
      font-size: 13px;
      transform: translateX(-15px) translateY(0px) scale(0.7);
    }
  }
`

function WalletsModal({balanceData, farmData, lpData, prices, hexData}) {
  const [ modal, setModal ] = useAtom(walletsModalAtom)
  const context = useAppContext()
  const wallets = context?.data?.wallets ?? {}
  
  // const { toggleWalletVisibility, visibleWallets, isHidden } = useWallets(wallets)
  const useWalletData = useWallets(wallets)
  const { copyTextToClipboard } = useCopyToClipboard()

  const hexPrice = prices?.['0x2b591e99afe9f32eaa6214f7b7629768c40eeb39']?.priceUsd ?? 0


  const [ error, setError ] = useState(null)
  const handleChange = (address) => {
    if(Object.keys(wallets).includes(address.toLowerCase())) {
      setError('This address already exists. Clicking "Add Address" will remove it.')
    } else {
      setError(null)
    }
  }

  const handleSubmit = (address) => {
    if (!address) return
    const isValid = isValidWalletAddress(address)
    if(isValid) context.toggleWallet?.(address.trim())
  }

  const [isEditing, setIsEditing] = useState('')
  const sortOptions = ['Name', 'Total Value', 'Held Balance', 'PulseX Farms', 'Liquidity Pools', 'Stakes']
  const [sort, setSort] = useAtom(walletSortAtom)
  const sortDirectionOptions = ['Descending', 'Ascending']
  const [sortDirection, setSortDirection] = useAtom(walletSortDirectionAtom)
  
  
  const displayWallets = useMemo(() => {

    const sortedWallets = Object.keys(wallets).sort((a, b) => {

      if (sort === 'Name') {
        const aliasA = context?.data?.aliases?.[a.toLowerCase()] ?? a.toLowerCase()
        const aliasB = context?.data?.aliases?.[b.toLowerCase()] ?? b.toLowerCase()

        if (sortDirection === 'Ascending') {
          return aliasA.localeCompare(aliasB)
        } else {
          return aliasB.localeCompare(aliasA)
        }
      } 
      if (sort === 'Held Balance') {
        const balancesObject = balanceData?.balances?.[a.toLowerCase()]?.balances ?? {}
        const balanceA = Object.keys(balancesObject).reduce((acc, key) => {
          return acc + (balancesObject[key]?.usd ?? 0)
        }, 0)

        const balancesObjectB = balanceData?.balances?.[b.toLowerCase()]?.balances ?? {}
        const balanceB = Object.keys(balancesObjectB).reduce((acc, key) => {
          return acc + (balancesObjectB[key]?.usd ?? 0)
        }, 0)

        if (sortDirection === 'Ascending') {
          return balanceA - balanceB
        } else {
          return balanceB - balanceA
        }
      }

      if (sort === 'PulseX Farms') {
        const farmArrayA = farmData?.farmBalances?.[a.toLowerCase()] ?? []
        const farmBalanceA = farmArrayA.reduce((acc, k) => {
          return acc + Number(k?.rewards?.usd ?? 0) + Number(k?.token0?.usd ?? 0) + Number(k?.token1?.usd ?? 0)
        }, 0)

        const farmArrayB = farmData?.farmBalances?.[b.toLowerCase()] ?? []
        const farmBalanceB = farmArrayB.reduce((acc, k) => {
          return acc + Number(k?.rewards?.usd ?? 0) + Number(k?.token0?.usd ?? 0) + Number(k?.token1?.usd ?? 0)
        }, 0)
        if (sortDirection === 'Ascending') {
        return farmBalanceA - farmBalanceB
        } else {
          return farmBalanceB - farmBalanceA
        }
      }

      if (sort === 'Liquidity Pools') {
        const lpObjectA = lpData?.lpBalances?.[a.toLowerCase()] ?? []
        const lpBalanceA = Object.keys(lpObjectA).reduce((acc, key) => {
          return acc + Number(lpObjectA[key]?.token0?.usd ?? 0) + Number(lpObjectA[key]?.token1?.usd ?? 0)
        }, 0)

        const lpObjectB = lpData?.lpBalances?.[b.toLowerCase()] ?? []
        const lpBalanceB = Object.keys(lpObjectB).reduce((acc, key) => {
          return acc + Number(lpObjectB[key]?.token0?.usd ?? 0) + Number(lpObjectB[key]?.token1?.usd ?? 0)
        }, 0)

        if (sortDirection === 'Ascending') {
          return lpBalanceA - lpBalanceB
        } else {
          return lpBalanceB - lpBalanceA
        }
      }
      if (sort === 'Stakes') {
        const hexBalanceA = (parseHexStats( (hexData?.combinedStakes ?? [])?.filter(f => f?.address?.toLowerCase() == a.toLowerCase())  ?? [] )?.totalFinalHex ?? 0) * hexPrice
        const hexBalanceB = (parseHexStats( (hexData?.combinedStakes ?? [])?.filter(f => f?.address?.toLowerCase() == b.toLowerCase())  ?? [] )?.totalFinalHex ?? 0) * hexPrice
        if (sortDirection === 'Ascending') {
          return hexBalanceA - hexBalanceB
        } else {
          return hexBalanceB - hexBalanceA
        }
      }

      if (sort === 'Total Value') {
        const balancesObject = balanceData?.balances?.[a.toLowerCase()]?.balances ?? {}
        const balanceA = Object.keys(balancesObject).reduce((acc, key) => {
          return acc + (balancesObject[key]?.usd ?? 0)
        }, 0)
        const balancesObjectB = balanceData?.balances?.[b.toLowerCase()]?.balances ?? {}
        const balanceB = Object.keys(balancesObjectB).reduce((acc, key) => {
          return acc + (balancesObjectB[key]?.usd ?? 0)
        }, 0)
        const farmArrayA = farmData?.farmBalances?.[a.toLowerCase()] ?? []
        const farmBalanceA = farmArrayA.reduce((acc, k) => {
          return acc + Number(k?.rewards?.usd ?? 0) + Number(k?.token0?.usd ?? 0) + Number(k?.token1?.usd ?? 0)
        }, 0)

        const farmArrayB = farmData?.farmBalances?.[b.toLowerCase()] ?? []
        const farmBalanceB = farmArrayB.reduce((acc, k) => {
          return acc + Number(k?.rewards?.usd ?? 0) + Number(k?.token0?.usd ?? 0) + Number(k?.token1?.usd ?? 0)
        }, 0)

        const lpObjectA = lpData?.lpBalances?.[a.toLowerCase()] ?? []
        const lpBalanceA = Object.keys(lpObjectA).reduce((acc, key) => {
          return acc + Number(lpObjectA[key]?.token0?.usd ?? 0) + Number(lpObjectA[key]?.token1?.usd ?? 0)
        }, 0)

        const lpObjectB = lpData?.lpBalances?.[b.toLowerCase()] ?? []
        const lpBalanceB = Object.keys(lpObjectB).reduce((acc, key) => {
          return acc + Number(lpObjectB[key]?.token0?.usd ?? 0) + Number(lpObjectB[key]?.token1?.usd ?? 0)
        }, 0)

        const hexBalanceA = (parseHexStats( (hexData?.combinedStakes ?? [])?.filter(f => f?.address?.toLowerCase() == a.toLowerCase())  ?? [] )?.totalFinalHex ?? 0) * hexPrice
        const hexBalanceB = (parseHexStats( (hexData?.combinedStakes ?? [])?.filter(f => f?.address?.toLowerCase() == b.toLowerCase())  ?? [] )?.totalFinalHex ?? 0) * hexPrice

        const totalValueA = balanceA + farmBalanceA + lpBalanceA + hexBalanceA
        const totalValueB = balanceB + farmBalanceB + lpBalanceB + hexBalanceB

        if (sortDirection === 'Ascending') {
          return totalValueA - totalValueB
        } else {
          return totalValueB - totalValueA
        }
      }
    })
    
    return sortedWallets
  }, [wallets, sort, sortDirection, context?.data?.aliases])

  return (
    <ModalWrapper>
      <ModalContent>
        <div style={{ overflowY: 'auto' }}>
          <div className="modal-header">
              <Icon icon={icons_list.wallet} size={24}/> Wallet Addresses
              <button className="close-button" onClick={() => setModal(false)}>
                X
              </button>
          </div>
          <div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px 10px' }}>
            <div style={{ borderBottom: '1px solid rgb(65, 65, 65)', paddingBottom: 20 }}>
              <Input placeholder={'Add new address'} onSubmit={handleSubmit} onChange={handleChange} clearOnSubmit={true} buttonText={"Add Address"}/>
                {error && <label style={{ paddingLeft: 10, fontSize: 12, color: 'rgb(250,150,150)', marginTop: 5 }}>
                  {error}
                </label>}
            </div>
            <div>
              <div>
                {displayWallets.length} Addresses:
              </div>
              <div>
                <div style={{ display: 'inline-block', width: 150 }}>
                  <DropdownV2 options={sortOptions} onChange={setSort} defaultOption={sort}/>
                </div>
                <div style={{ display: 'inline-block', width: 145, marginLeft: -20 }}>
                  <DropdownV2 options={sortDirectionOptions} onChange={setSortDirection} defaultOption={sortDirection}/>
                </div>
              </div>
            </div>
            <div style={{ maxHeight: 'calc( 50dvh )', overflowY: 'scroll'}}>
              {wallets ? displayWallets.map((m,i) => {
                const alias = context?.data?.aliases?.[m.toLowerCase()]
                return <SingleWallet key={`wallet-${m}-${i}`} alias={alias} updateAliases={context?.updateAliases} i={i} isEditing={m.toLowerCase() === isEditing} setIsEditing={setIsEditing} setModal={setModal} useWalletData={useWalletData} toggleWallet={context.toggleWallet} m={m} balanceData={balanceData} farmData={farmData} lpData={lpData} hexData={hexData} hexPrice={hexPrice}/>
              }) : <>No Addresses</>}
          </div>
        </div></div>
      </ModalContent>
      <ModelOverLay onClick={() => setModal(false)}/>
    </ModalWrapper>
  )
}

export default WalletsModal