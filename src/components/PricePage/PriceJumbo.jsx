import { memo } from "react";
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
    border: 1px solid rgb(70,70,70);
    background: rgb(15,15,15);
    padding: 25px;
    text-align: center;
    position: relative;
    min-height: 150px;

    .jumbo-header {
        padding-top: 15px;
        font-size: 24px;
        letter-spacing: 1px !important;
    }

    .jumbo-price {
        font-family: 'Oswald', sans-serif;
        font-size: 50px;
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
`

export default memo(PriceJumbo)
function PriceJumbo ({ balance = 0, wallets = {}, loading = false, isFiltered = false, loadingStatuses = {}, bestStable = null }) {
    const [ walletModal, setWalletModal ] = useAtom(walletsModalAtom)
    
    const displayBalance = addCommasToNumber(balance)
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

    if (noAddresses) return <Wrapper>
        <div className="jumbo-header">
            Add an address to get started
            <div>
                <Button parentStyle={{display: 'inline-block', marginTop: 30, width: '200px'}} textAlign={'center'} onClick={() => setWalletModal(true)}>
                    Add Address
                </Button>
            </div>
        </div>
    </Wrapper>

    return <Wrapper>
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
            {isFiltered ? 'Filtered Addresses' : 'All Addresses'}
        </div>
        <div>
            <span>
                $ 
            </span>
            <span className="jumbo-price">
                {displayBalance}<br/>
            </span>
        </div>
        {balancesLoading ? <div className="jumbo-loader">
            <Tooltip content={tooltipContent} placement="top">
                <LoadingWave numDots={8} speed={100} />
            </Tooltip>
        </div> : ''}
    </Wrapper>
}