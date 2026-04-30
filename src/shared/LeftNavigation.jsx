// LeftNavigation.jsx
import styled from "styled-components"
import { menuOptions } from "../config/menu-options" 
import Icon from "../components/Icon"
import { appPageAtom, expandedAtom } from "../store"
import { useAtom } from "jotai"
import { icons_list } from "../config/icons"
import { useModals } from "../hooks/useModals"
import version from "../config/version.json"
import { useState, useEffect } from "react"
import Tooltip from "./Tooltip"

const Wrapper = styled.div`
    position: relative;
    background: rgba(0, 0, 0, 1);
    background: rgba(30, 30, 30, 1);
    background: linear-gradient(to bottom, rgba(25, 25, 25, 1), rgba(20, 20, 20, 0.8));
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

    .mini-button {
        width: 24px; height: 24px;
        border-radius: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgb(30,30,30);
        color: rgb(150,150,150);
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
            background: rgb(40,40,40);
            color: rgb(200,200,200);
        }
    }
`

export function LeftNavigation({ fees, toggleMode }) {
    const [ expanded, setExpanded ] = useAtom(expandedAtom)
    const [ appPage ] = useAtom(appPageAtom)

    const { setModal } = useModals();

    const { estimatedFees, loading, error } = fees
    const [ gitlabVersion, setGitlabVersion ] = useState(null)
    useEffect(() => {
        handleCheckForUpdates()
    }, [])

    const DEV_ADDRESS = "0xb7c85151e4eeD387837B54fD252ff63C4496Fd58"
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(DEV_ADDRESS)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error("Copy failed", err)
        }
    }

    const handleOpenGitlab = async () => {
        await window.electron.openExternal('https://github.com/exodus2020/Pulsechain-Dashboard')
    }
    const isRemoteNewer = (remote, local) => {
        const r = String(remote).split('.').map(Number)
        const l = String(local).split('.').map(Number)

        for (let i = 0; i < Math.max(r.length, l.length); i++) {
            const rv = r[i] || 0
            const lv = l[i] || 0

            if (rv > lv) return true
            if (rv < lv) return false
        }

        return false
    }
    const handleCheckForUpdates = async () => {
        setGitlabVersion('checking')

        try {
            const remoteVersion = await window.electron.getFile(
                'https://raw.githubusercontent.com/exodus2020/Pulsechain-Dashboard/main/src/config/version.json'
            )

            const nextVersion = remoteVersion?.version ?? 'error'
            setGitlabVersion(nextVersion)

            if (
                nextVersion !== 'error' &&
                isRemoteNewer(nextVersion, version.version)
            ) {
                await window.electron.openExternal('https://github.com/exodus2020/Pulsechain-Dashboard/releases')
            }
        } catch (error) {
            setGitlabVersion('error')
        }
    }

    const handleToggleMode = () => {
        toggleMode?.()
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
                    {/* {expanded && <div style={{ position: 'absolute', bottom: 55, left: 5, padding: 10 }}>
                        <div className='mini-button' onClick={handleToggleMode}>
                            <Icon icon={icons_list['pip-in']} size={20}/>
                        </div>
                    </div>} */}
                    <div style={{ position: 'absolute', bottom: expanded ? 170 : 55, right: 0, padding: 10 }}>
                        {expanded ? <div style={{ position: 'relative', color: 'rgb(150,150,150)' }}>
                            {estimatedFees?.slow?.baseFee ? <span style={{ fontSize: 14, marginRight: 28, whiteSpace: 'nowrap' }}>
                                {parseFloat(Math.round(estimatedFees?.slow?.baseFee / 1_000) / 1_000).toFixed(2)} mB
                            </span> : <span style={{ fontSize: 14, marginRight: 24 }}>
                                Estimating
                                </span>}
                            {<div style={{ position: 'absolute', right: 4, bottom: -4 }}>
                                <Icon icon={icons_list['gas']} size={20}/>
                            </div>}
                        </div> :
                        <div style={{ position: 'relative', color: 'rgb(150,150,150)', width: '100%', textAlign: 'center' }}>
                            {estimatedFees?.slow?.baseFee ? <span style={{ fontSize: 10, whiteSpace: 'nowrap', marginLeft: 4 }}>
                                {parseFloat(Math.round(estimatedFees?.slow?.baseFee / 1_000) / 1_000).toFixed(1)} mB
                            </span> : <span style={{ fontSize: 14, marginRight: 24 }}>
                                ...
                                </span>}
                            {<div style={{ position: 'absolute', right: 4, bottom: 20 }}>
                                <Icon icon={icons_list['gas']} size={20}/>
                            </div>}
                        </div>}
                    </div>
                </div>
                <div className="nav-footer" style={{ minHeight: expanded ? 145 : 40 }}>
                    <div>
                        <div style={{ textAlign: 'left', paddingLeft: 9}}>
                            <Tooltip content="Open GitHub" placement="right">
                                <div 
                                    className="hoverable" 
                                    style={{ cursor: 'pointer', display: 'inline-block'}}
                                    onClick={handleOpenGitlab}
                                >
                                    <Icon icon={icons_list['tanuki']} size={14}/>
                                </div>
                            </Tooltip>
                        </div>

                        {expanded && (
                            <div style={{
                                marginTop: 10,
                                padding: '8px 10px',
                                textAlign: 'center'
                            }}>
                                <div style={{
                                    fontSize: 12,
                                    color: 'rgb(150,150,150)',
                                    marginBottom: 6
                                }}>
                                    Support the developer
                                </div>

                                <button
                                    onClick={handleCopy}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        background: 'rgb(30,30,30)',
                                        border: '1px solid rgb(50,50,50)',
                                        borderRadius: 6,
                                        color: 'white',
                                        fontSize: 12,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {copied ? 'Copied ✔' : 'Copy Address'}
                                </button>

                                <div style={{
                                    marginTop: 4,
                                    fontSize: 10,
                                    color: 'rgb(100,100,100)'
                                }}>
                                    {DEV_ADDRESS.slice(0,6)}...{DEV_ADDRESS.slice(-4)}
                                </div>
                            </div>
                        )}

                        <div className="mute version" style={expanded ? { left: 15, top: 33 } : { left: 15, top: 33 }}>
                            <div onClick={handleCheckForUpdates}>
                                v{version.version}
                            </div>
                        </div>

                        <div className="mute version" style={expanded ? { right: 12, top: 33, opacity: 1 } : { right: -85, top: 33, opacity: 0, pointerEvents: 'none' }}>
                            <div>
                                <span>
                                    {gitlabVersion === 'checking'
                                    ? 'Checking for update...'
                                    : gitlabVersion === 'error'
                                    ? 'Update check failed'
                                    : gitlabVersion && isRemoteNewer(gitlabVersion, version.version)
                                    ? `Update Available (v${gitlabVersion})`
                                    : gitlabVersion
                                    ? 'Up To Date'
                                    : 'Checking for update...'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Wrapper>
    )
}