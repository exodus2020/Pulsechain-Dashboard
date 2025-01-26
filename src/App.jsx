import { useCallback, useEffect, useRef } from 'react'
import 'typeface-raleway'
import Layout from './shared/Layout'
import { appPageAtom, dappModalAtom, keyAtom, liquidityPoolModalAtom, settingsModalAtom, tokenModalAtom, tokensModalAtom, walletsModalAtom, toastAtom, appSettingsAtom, liquiditySearchModalAtom, deleteDataModalAtom } from './store'
import { useAtom } from 'jotai'
import DappModal from './shared/DappModal'
import styled from 'styled-components'
import TokensModal from './shared/TokensModal'
import { AppContextComponent, useAppContext } from './shared/AppContext'
import TokenModal from './shared/TokenModal'
import WalletsModal from './shared/WalletsModal'
import usePrice from './hooks/usePrice'
import useGetBalance from './hooks/useGetBalance'
import OswaldReg from "./fonts/Oswald-Regular.ttf"
import SettingsModal from './shared/SettingsModal'
import LockPage from './pages/LockPage'
import useFarms from './hooks/useFarms'
import LiquidityPoolModal from './shared/LiquidityPoolModal'
import ActivitiesPage from './pages/ActivitiesPage'
import { Toast } from './components/Toast'
import { createGlobalStyle } from 'styled-components'
import useLPs from './hooks/useLPs'
import LiquiditySearchModal from './shared/LiquiditySearchModal'
import useHistory from './hooks/useHistory'
import WalletsPage from './pages/WalletsPage'
import useHex from './hooks/useHex'
import DeleteDataModal from './shared/DeleteDataModal'
import Button from './components/Button'
import Icon from './components/Icon'
import { icons_list } from './config/icons'
import useUpdateSettings from './hooks/useUpdateSettings'
import useCommunityDapp from './hooks/useCommunityDapp'

const GlobalStyle = createGlobalStyle`
  @font-face {
    font-family: 'Oswald';
    src: url('${OswaldReg}') format('truetype');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
`

const AppWrapper = styled.div`
  height: 100vh; width: 100vw;
  position: absolute; top: 0; left: 0; overflow: hidden;
  background: black;
  background-image: linear-gradient(to top, rgba(19, 21, 25, 0), rgb(19, 21, 25)) !important;
  user-select: none;

  .tl {
    text-decoration: underline;
    color: rgb(240,240,240);
    transition: color 0.3s ease;
    cursor: pointer;
    &:hover {
      color: rgb(200,200,200);
    }
  }

  .ht {
    background: rgb(30,30,30);
    color: rgba(220,220,220, 0.8);
    font-style: italic;
    padding: 2px 10px;
    margin: 0 5px;
  }
  
  .mute {
    color: rgb(130,130,130);
  }

  div {
    scrollbar-width: none; // Firefox
    -ms-overflow-style: none; // Internet Explorer 10+
    &::-webkit-scrollbar {
      display: none; // Chrome, Safari, and Edge
    }
  }

  .lock-settings {
    svg path {
      fill: rgb(80,80,80)
    }
  }
`

function App() {
  const [ key ] = useAtom(keyAtom)
  const [ deleteDataModal, setDeleteDataModal ] = useAtom(deleteDataModalAtom)
  
  if (key === null) {
    return <AppWrapper>
      <LockPage />
      <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
        <Button onClick={() => setDeleteDataModal({ header: 'Settings' })} style={{ background: 'rgba(0,0,0,0)'}} customClass={"lock-settings"}>
          <Icon icon={icons_list.settings}/>
        </Button>
      </div>
      {deleteDataModal ? <DeleteDataModal /> : ''}
    </AppWrapper>
  }

  return <AppContextComponent>
    <GlobalStyle />
    <AppContext />
  </AppContextComponent>
}

function AppContext() {
  const context = useAppContext()

  const error = false //!context?.rpcs || !context?.scan || !context?.config

  if (error) {
    return <AppWrapper>
      {/* <div style={{ color: 'white'}}>
        Error
      </div> */}
    </AppWrapper>
  }

  return (
    <AppWrapper>
        <AppMain context={context}/>
    </AppWrapper>
    
  )
}

function AppMain({context}) {
  const [ appPage ] = useAtom(appPageAtom)
  const [ modal ] = useAtom(dappModalAtom)
  const [ tokenModal ] = useAtom(tokensModalAtom)
  const [ singleTokenModal ] = useAtom(tokenModalAtom)
  const [ walletsModal ] = useAtom(walletsModalAtom)
  const [ settingsModal ] = useAtom(settingsModalAtom)
  const [ liquidityPoolModal ] = useAtom(liquidityPoolModalAtom)
  const [ liquiditySearchModal ] = useAtom(liquiditySearchModalAtom)
  const [ toast, setToast ] = useAtom(toastAtom)

  useUpdateSettings({ context })
  const priceData = usePrice(context)
  const balanceData = useGetBalance(priceData)
  const farmData = useFarms({context, priceData})
  const hexData = useHex({ wallets: context?.data?.wallets ?? {} })
  const lpData = useLPs({context, priceData})
  const historyData = useHistory({ priceData })
  const communityData = useCommunityDapp(context)

  const removeToast = useCallback((id) => {
    setToast(prev => ({
      ...prev,
      messages: prev.messages.filter(msg => msg.id !== id)
    }))
  }, [setToast])

  const wplsPrice = priceData?.prices?.['0xa1077a294dde1b09bb078844df40758a5d0f9a27']?.priceUsd ?? 0
  const bestStable = priceData?.bestStable
  const prices = priceData.prices  

  return (
    <AppWrapper>
        <Layout>
          {!appPage ? <WalletsPage priceData={priceData} balanceData={balanceData} farmData={farmData} lpData={lpData} historyData={historyData} hexData={hexData}/> : ''}
          {appPage == 'activities' ? <ActivitiesPage priceData={priceData} balanceData={balanceData} farmData={farmData}/> : ''}
        </Layout>
        {modal ? <DappModal communityData={communityData} /> : ''}
        {tokenModal ? <TokensModal wplsPrice={wplsPrice} /> : ''}
        {singleTokenModal ? <TokenModal historyData={historyData} bestStable={bestStable}/> : ''}
        {walletsModal ? <WalletsModal balanceData={balanceData} farmData={farmData} lpData={lpData} prices={prices} hexData={hexData}/> : ''}
        {settingsModal ? <SettingsModal context={context} /> : ''}
        {liquidityPoolModal ? <LiquidityPoolModal /> : ''}
        {liquiditySearchModal ? <LiquiditySearchModal /> : ''}
        {toast.messages.length > 0 && (
          <Toast 
            messages={toast.messages}
            onRemove={removeToast}
          />
        )}
    </AppWrapper>
    
  )
}

export default App