import styled from "styled-components";
import Icon from "../components/Icon";
import ImageContainer from "../components/ImageContainer";
import { icons_list } from "../config/icons";
import { useModals } from "../hooks/useModals";
import ErrorMessage from "../components/ErrorMessage";

const Wrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 50px;
  background: rgb(50,50,50);
  z-index: 100;
  color: white;

  .header {
        padding-top: 10px;
        text-align: center;
        font-size: 16px;
        font-weight: 700;
    }

    @media (min-width: 650px) {
        display: none;
    }
`;

export function MobileHeader() {
    const { setModal } = useModals();

    const handleOpenApps = () => {
        setModal('dapps', true);
    }

    const handleOpenSettings = () => {
        setModal('settings', true);
    }
    
  return (
    <Wrapper>
      <div className="header raleway">
        {/* <ImageContainer src={"./icon_64x64.png"} width={24} height={24}/> */}
        <div style={{ textAlign: 'left', paddingLeft: 10, paddingTop: 3, position: 'relative' }}>
            <img src="./icon_64x64.png" alt="PulseChain Dashboard" width={24} height={24}/>
            <div style={{ textAlign: 'left', paddingLeft: 10, paddingTop: 3, position: 'absolute', left: 35, top: 4 }}>
                PulseChain Dashboard
            </div>

            <div style={{ position: 'absolute', right: 10, top: 4 }}>
                <div style={{ cursor: 'pointer', marginRight: 20, display: 'inline-block' }} onClick={handleOpenApps}>
                    <Icon icon={icons_list.apps} size={24}/>
                </div>
                <div style={{ cursor: 'pointer', display: 'inline-block' }} onClick={handleOpenSettings}>
                    <Icon icon={icons_list.settings} size={24}/>
                </div>
            </div>
        </div>
      </div>

      <ErrorMessage />
    </Wrapper>
  )
}
