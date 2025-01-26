import { LeftNavigation } from './LeftNavigation'
import styled from 'styled-components'
import 'typeface-raleway'
import { expandedAtom } from '../store';
import { useAtom } from 'jotai';
import { useAppContext } from './AppContext';

const LayoutWrapper = styled.div`
  position: absolute;
  left: 0; top: 0; height: 100vh; width: 100vw;
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
  &.collapsed {
    grid-template-columns: 50px 1fr;

    .content {
      width: calc( 100vw - 50px);
    }
  }
`

const Content = styled.div`
  // background: black;
  z-index: 0;
  transition: all 1s ease;
  width: calc(100vw - 199px);
  position: absolute;
  height: calc(100vh + 30px);
  right: 0;
  top: 0;
  overflow-x: none;
  overflow-y: scroll;

  // background-image: linear-gradient(to top, rgba(19, 21, 25, 0), rgb(19, 21, 25)) !important;

  .padding {
    padding: 40px 40px 100px 40px;
    overflow-wrap: break-word;
    // word-wrap: break-word;
    white-space: normal;
  }
`;

function Layout({ children }) {
  const [ expanded, setExpanded ] = useAtom(expandedAtom)
  const { data, update, updateImageUrReference } = useAppContext()

  return (
    <LayoutWrapper>
        <Grid className={expanded ? 'expanded' : 'collapsed'}>
            <LeftNavigation />
            {update === 0 ? <Content className="content">
              Initializing
            </Content>
            : <Content className="content">
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