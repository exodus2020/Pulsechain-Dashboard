import styled from "styled-components"
import { menuOptions } from "../config/menu-options" 
import Icon from "../components/Icon"
import { appPageAtom, expandedAtom } from "../store"
import { useAtom } from "jotai"
import { icons_list } from "../config/icons"
import { useModals } from "../hooks/useModals"
import version from "../config/version.json"
import axios from "axios"
import { useState } from "react"
import Tooltip from "./Tooltip"

const Wrapper = styled.div`
    position: relative;
    background: rgba(0, 0, 0, 1);
    background: rgba(30, 30, 30, 1);
    height: 100%;
    color: white;

    .header {
        padding-top: 20px;
        text-align: center;
        font-size: 24px;
        font-weight: 700;
    }

    .menu {
        margin-top: 20px;
    }

    .menu-item {
        display: flex;
        align-items: center;
        padding: 0px 20px;
        margin-right: 20px;
        transition: all 0.3s ease;
        
        button {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            color: inherit;
            background: none;
            border: none;
            cursor: pointer;
            padding: 15px 8px;
            border-radius: 8px;
            transition: background-color 0.2s;
            margin-top: 5px;

            &:hover {
                background-color: rgba(255, 255, 255, 0.1);
            }
        }

        &.active {
            button {
                background-color: rgba(255, 255, 255, 0.1);
            }
        }
    }

    &.collapsed {
        .menu-item {
            padding: 0 0 0 0px;
            margin: 0;
            button {
                padding-left: 13px;
            }
        }
    }

    .expand-collapse-button {
        z-index: 50;
        position: absolute;
        width: 24px; height: 24px;
        border-radius: 5px;
        outline: rgb(70,70,70) 1px solid;
        right: -10px;
        top: 65px;
        
        display: flex;
        align-items: center;
        justify-content: center;
        background: black;
    }
    
    .nav-footer {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 10px;
        background: rgba(0, 0, 0, 0.5);
    }

    .hoverable {
        filter: grayscale(1);
        transition: filter 0.3s ease;
        &:hover {
            filter: grayscale(0);
        }
    }

    .version {
        position: absolute;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 1s ease;
    }
    .text-link {
        text-decoration: underline;
        color: rgb(130,130,130);
        transition: color 0.3s ease;
        cursor: pointer;
        &:hover {
            color: rgb(200,200,200);
        }
    }
`

export function LeftNavigation() {
    const [ expanded, setExpanded ] = useAtom(expandedAtom)
    const [ appPage ] = useAtom(appPageAtom)

    const { setModal } = useModals();

    const [ gitlabVersion, setGitlabVersion ] = useState(null)

    const handleOpenGitlab = async () => {
        await window.electron.openExternal('https://gitlab.com/pulsechain-lunagray/pulsechain-dashboard')
    }

    const handleCheckForUpdates = async () => {
        const version = await window.electron.getFile('https://gitlab.com/pulsechain-lunagray/pulsechain-dashboard/-/raw/main/src/config/version.json?ref_type=heads')
        setGitlabVersion(version?.version ?? null)
    }

    return (
        <Wrapper className={`${expanded ? 'expanded' : 'collapsed' }`}>
            <div className="expand-collapse-button mute" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
                <Icon icon={icons_list[expanded ? "arrow-back" : "arrow-forward"]} size={24}/>
            </div>
            <div style={{ overflow: 'hidden' }}>
                <div className="header raleway">
                    {expanded ? <div>PulseChain<br/>Dashboard</div> : <div>P<br/>D</div>}
                </div>
                <div className="menu">
                    {menuOptions.map(m => {
                        const isActive = m?.activePath === appPage
                        return (<div key={m.name} className={`menu-item ${isActive ? 'active' : ''}`}>
                            <button onClick={() => setModal(m.action, true)}>
                                <Icon icon={m.icon} />
                                {expanded ? m.name : ''}
                            </button>
                        </div>
                    )})}
                </div>
                <div className="nav-footer" style={{ minHeight: 40 }}>
                    <div>
                        <div style={{ textAlign: 'left', paddingLeft: 9}}>
                            <Tooltip content="Launch Gitlab" placement="right">
                                <div 
                                    className="hoverable" 
                                    style={{ cursor: 'pointer', display: 'inline-block'}}
                                    onClick={handleOpenGitlab}
                                >
                                    <Icon icon={icons_list['tanuki']} size={14}/>
                                </div>
                            </Tooltip>
                        </div>
                        <div className="mute version" style={expanded ? { left: 15, top: 33 } : { left: 15, top: 33 }}>
                            <div onClick={handleCheckForUpdates}>
                                v{version.version}
                            </div>
                        </div>
                        <div className="mute version" style={expanded ? { right: 12, top: 33, opacity: 1 } : { right: -85, top: 33, opacity: 0, pointerEvents: 'none' }}>
                            <div>
                                <span className={gitlabVersion ? 'mute' : 'text-link'} onClick={handleCheckForUpdates}>
                                    {gitlabVersion && version.version !== gitlabVersion ? `Update Available v${gitlabVersion}` : gitlabVersion && version.version === gitlabVersion ? 'No Updates Available' : 'Check for Updates'}
                                </span>
                            </div>
                        </div>
                    </div>
    
                </div>
            </div>
        </Wrapper>
    )
}