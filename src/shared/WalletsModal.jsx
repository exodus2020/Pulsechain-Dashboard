import { useAtom } from 'jotai'
import styled from 'styled-components'
import 'typeface-raleway'
import { walletsModalAtom } from '../store'
import { icons_list } from '../config/icons'
import Button from '../components/Button'
import Icon from '../components/Icon'
import { Input } from '../components/Input'
import { useAppContext } from './AppContext'
import { isValidWalletAddress } from '../lib/web3'
import { fUnit } from '../lib/numbers'
import { useCopyToClipboard } from '../hooks/useCopyToClipboard'
import { shortenString } from '../lib/string'
import { useWallets } from '../hooks/useWallets'
import { parseHexStats } from '../lib/hex'

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
`

function WalletsModal({balanceData, farmData, lpData, prices, hexData}) {
  const [ modal, setModal ] = useAtom(walletsModalAtom)
  const context = useAppContext()
  const wallets = context?.data?.wallets ?? {}
  
  const { toggleWalletVisibility, visibleWallets, isHidden } = useWallets(wallets)
  const { copyTextToClipboard } = useCopyToClipboard()

  const hexPrice = prices?.['0x2b591e99afe9f32eaa6214f7b7629768c40eeb39']?.priceUsd ?? 0

  const handleCopy = (text) => {
    copyTextToClipboard(text, `${shortenString(text)} copied to clipboard`, 'Failed to copy')
  }

  const handleSubmit = (address) => {
    if (!address) return
    const isValid = isValidWalletAddress(address)
    if(isValid) context.toggleWallet?.(address.trim())
  }

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px 10px' }}>
            <div style={{ borderBottom: '1px solid rgb(65, 65, 65)', paddingBottom: 20 }}>
              <Input placeholder={'Add new address'} onSubmit={handleSubmit} clearOnSubmit={true} buttonText={"Add Address"}/>
            </div>
            <div style={{ padding: '0px 20px' }}>
              Current Addresses
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '20px 130px 1fr 1fr 1fr 50px', gap: '10px', marginBottom: 5, padding: '0px 10px' }}>
              <div/>
              <div>Address</div>
              <div>Tokens</div>
              <div>Liquidity</div>
              <div>HEX</div>
              <div/>

            </div>
            <div>
              {wallets ? Object.keys(wallets).map((m,i) => {
                const balancesObject = balanceData?.balances?.[m.toLowerCase()]?.balances ?? {}
                const balance = Object.keys(balancesObject).reduce((acc, key) => {
                  return acc + (balancesObject[key]?.usd ?? 0)
                }, 0)

                const farmArray = farmData?.farmBalances?.[m.toLowerCase()] ?? []
                const farmBalance = farmArray.reduce((acc, k) => {
                  return acc + Number(k?.rewards?.usd ?? 0) + Number(k?.token0?.usd ?? 0) + Number(k?.token1?.usd ?? 0)
                }, 0)

                const lpObject = lpData?.lpBalances?.[m.toLowerCase()] ?? []
                const lpBalance = Object.keys(lpObject).reduce((acc, key) => {
                  return acc + Number(lpObject[key]?.token0?.usd ?? 0) + Number(lpObject[key]?.token1?.usd ?? 0)
                }, 0)
                
                const hexBalance = (parseHexStats( (hexData?.combinedStakes ?? [])?.filter(f => f?.address?.toLowerCase() == m.toLowerCase())  ?? [] )?.totalFinalHex ?? 0) * hexPrice

                const walletIsHidden = isHidden(m)
                return <div key={`walleta=${i}`} style={{ display: 'grid', gridTemplateColumns: '22px 22px 100px 1fr 1fr 1fr 50px', gap: '10px', marginBottom: 5, padding: '0px 10px' }}>
                    <div style={{ marginTop: 6, cursor: 'pointer' }} className={`${walletIsHidden ? 'mute' :''}`} onClick={() => toggleWalletVisibility(m)}>
                        <Icon icon={walletIsHidden ? icons_list.hide : icons_list.show} size={20}/>
                    </div>
                    <div style={{ marginTop: 6, cursor: 'pointer' }} onClick={() => handleCopy(m)}>
                        <Icon icon={icons_list.copy} size={20}/>
                    </div>
                    <div style={{ marginTop: 8 }}>{wallets[m]?.name}</div>
                    <div style={{ marginTop: 8 }}>$ {fUnit(balance, 2)}</div>
                    <div style={{ marginTop: 8 }}>$ {fUnit(farmBalance + lpBalance, 2)}</div>
                    <div style={{ marginTop: 8 }}>$ {fUnit(hexBalance, 2)}</div>
                    <div style={{ textAlign: 'right' }}> 
                        <Button parentStyle={{ marginBottom: 5, width: 40, display: 'inline-block' }} style={{ padding: 0 }} onClick={() => {
                            context.toggleWallet(m)
                            setModal(false)
                          }} textAlign={'center'}>
                            <Icon icon={icons_list.trash} size={16}/>
                        </Button>
                    </div>
                </div>
              }) : 'No Addresses'}
            </div>
          </div>
        </div>
      </ModalContent>
      <ModelOverLay onClick={() => setModal(false)}/>
    </ModalWrapper>
  )
}

export default WalletsModal