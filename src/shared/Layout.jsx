import { LeftNavigation } from './LeftNavigation'
import styled from 'styled-components'
import 'typeface-raleway'
import { expandedAtom } from '../store';
import { useAtom } from 'jotai';
import { useAppContext } from './AppContext';
import { MobileHeader } from './MobileHeader';
import ErrorMessage from '../components/ErrorMessage';

const LayoutWrapper = styled.div`
  position: absolute;
  left: 0; top: 0; height: 100dvh; width: 100dvw;
  font-family: 'Oswald', sans-serif;
  overflow: hidden;

  .raleway {
    font-family: 'Raleway', sans-serif;
  }

  .btn {
    margin-top: 20px;
    margin-left: 20px;
    width: 150px;
    background-color: rgba(0,0,0,0);
    border: none;
    color: white;
    padding: 15px 32px;
    text-align: left;
    text-decoration: none;
    display: inline-block;
    font-size: 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
      background-color: rgba(70,70,70,.9);
      transform: scale(1.05);
      box-shadow: inset 0px 0px 1px rgba(90,90,90,1);
    }

    &:active {
      background-color: rgba(90,90,90,.9);
      transform: scale(0.95);
      box-shadow: inset 0px 0px 1px rgba(90,90,90,1);
    }
  }
  button {
    &:hover {
      background-color: rgba(70,70,70,.9);
      transform: scale(1.015);
      box-shadow: inset 0px 0px 1px rgba(90,90,90,1);
    }

    &:active {
      background-color: rgba(90,90,90,.9);
      transform: scale(0.95);
      box-shadow: inset 0px 0px 1px rgba(90,90,90,1);
    }
  }

`;

const Grid = styled.div`
  position: relative;
  display: grid;
  height: 100vh;
  width: 100vw;
  grid-template-columns: 200px 1fr;
  transition: all 1s ease;
  
  @media (min-width: 650px) {
    &.collapsed {
      grid-template-columns: 50px 1fr;
      .content {
        transition: all 1s ease;
        width: calc( 100vw - 50px);
        display: flex;
        justify-content: center;
      }
    }
    &.expanded {
      grid-template-columns: 200px 1fr;
      .content {
        transition: all 1s ease;
        width: calc( 100vw - 200px);
        display: flex;
        justify-content: center;
      }
    }

    .padding {
      padding: 50px 40px 100px 40px;
    }
  }

  @media (max-width: 650px) {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    height: 100dvh;
    width: 100dvw;
    .padding {
      padding: 50px 40px 100px 40px;
    }

    .left-navigation {
      display: none;
    }
  }


`

const Content = styled.div`
  z-index: 0;
  transition: position 1s ease;
  position: absolute;
  height: calc( 100% - 50px );

  &.expanded-c {
    left: 0px;
  }

  &.collapsed-c {
    left: 0px;
  }
  
  top: 0px;
  overflow-x: none;
  overflow-y: scroll;
  position: relative;
`;

function Layout({ children, fees, toggleMode }) {
  const [ expanded, setExpanded ] = useAtom(expandedAtom)
  const { data, update, updateImageUrReference } = useAppContext()

  return (
    <LayoutWrapper>
        <MobileHeader />
        <Grid className={`${expanded ? 'expanded' : 'collapsed'}`}>
          <div className="left-navigation">
            <LeftNavigation fees={fees} toggleMode={toggleMode} />
          </div>
          {update === 0 ? <Content className="content">
              <ErrorMessage />
              Initializing
            </Content>
            : <Content className={`content ${expanded ? 'expanded-c' : 'collapsed-c'}`}>
              <ErrorMessage />
              <div className="padding">
                { children }
              </div>
            </Content>
          }
        </Grid>
    </LayoutWrapper>
  )
}

export default Layout