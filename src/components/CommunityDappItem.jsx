import { useState } from "react"
import { icons_list } from "../config/icons"
import { formatDatetime } from "../lib/date"
import Tooltip from "../shared/Tooltip"
import Icon from "./Icon"
import styled from "styled-components"

const Wrapper = styled.div`
    .arrow-nav {
        transition: all 0.2s ease-in-out;
        &.expanded {
            transform: rotate(-90deg) translateX(4px);
        }
    }
    
`

export default function CommunityDappItem({m, i, toggleDappList}) {
    const updated = formatDatetime( new Date(m?.updated ?? new Date().getTime()))
    const handleSync = () => {
        toggleDappList?.(m.url, true)
    }

    const handleDeleteItem = () => {
        toggleDappList?.(m, false)
    }

    const handleDeleteDapp = (folder) => {
        const newDappList = m.data.dapps.filter(dapp => dapp.folder !== folder)
        const newItem = {...m, data: {...m.data, dapps: newDappList}}
        toggleDappList?.(newItem, true)
    }

    const [ expand, setExpand ] = useState(false)

    const dapps = Array.isArray(m?.data?.dapps) ? m.data.dapps : []

    return <Wrapper style={{ background: i % 2 == 0 ? 'rgba(35,35,35,0.5)' : 'rgba(20,20,20,0.5)', fontSize: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '25px 140px 1fr 80px', gap: 10, padding: '10px 0px 10px 10px' }}>
            <div>
                <Tooltip content="View Dapps" style={{ cursor: 'pointer' }}>
                    <div style={{ cursor: 'pointer', display: 'inline-block'}} onClick={handleDeleteItem}>
                        <Icon icon={icons_list.cancel} size={14}/>
                    </div>
                </Tooltip>
            </div>
            <div style={{ overflowWrap: 'break-word', wordWrap: 'break-word', whiteSpace: 'normal' }}>
                {m?.data?.name}
            </div>
            <div style={{ overflowWrap: 'break-word', wordWrap: 'break-word', whiteSpace: 'normal' }}>
                {updated}
            </div>
            <div>
                <div style={{ cursor: 'pointer', display: 'inline-block' }}>
                    <Tooltip content={m.url} style={{ cursor: 'pointer' }} onClick={() => window.electron.openExternal(m.url)}>
                        <Icon icon={icons_list.world} size={14}/>
                    </Tooltip>
                </div>
                <div style={{ cursor: 'pointer', display: 'inline-block', marginLeft: 10 }} onClick={handleSync}>
                    <Tooltip content="Pull Latest">
                        <Icon icon={icons_list.sync} size={14}/>
                    </Tooltip>
                </div>
                <div style={{ cursor: 'pointer', display: 'inline-block', marginLeft: 10 }} onClick={() => setExpand(!expand)} className={`arrow-nav ${expand ? 'expanded' : 'collapsed'}`}>
                    <Tooltip content="View Dapps">
                        <Icon icon={icons_list["caret-left"]} size={14}/>
                    </Tooltip>
                </div>               
            </div>
        </div>
        {expand ? <div style={{ paddingLeft: 40}}>
            {dapps.map((dapp, i) => {
                return <div key={i} style={{ padding: '10px 10px 10px 0px', background: i % 2 == 0 ? 'rgba(40,40,40,1)' : 'rgba(25,25,25,1)'}}>
                    <div style={{ display: 'grid', gridTemplateColumns: '20px 140px 1fr 20px', gap: 10}}>
                        <div>
                            <div style={{ cursor: 'pointer', display: 'inline-block', marginLeft: 10 }} onClick={() => handleDeleteDapp(dapp?.folder)}>
                                <Tooltip content="Delete from List">
                                    <Icon icon={icons_list.cancel} size={14}/>
                                </Tooltip>
                            </div>
                        </div>
                        <div style={{ overflowWrap: 'break-word', wordWrap: 'break-word', whiteSpace: 'normal' }}>
                            {dapp?.name ?? 'Missing Name'}
                        </div>
                        <div style={{ overflowWrap: 'break-word', wordWrap: 'break-word', whiteSpace: 'normal' }}>
                            {dapp?.description ?? 'Missing Description'}
                        </div>
                        <div style={{ cursor: 'pointer', display: 'inline-block' }} onClick={() => window.electron.openExternal(dapp?.repoUrl)}>
                            <Tooltip content="Go to Repo">
                                <Icon icon={icons_list.launch} size={14}/>
                            </Tooltip>
                        </div>
                    </div>
                </div>
            })}
        </div> : ''}
    </Wrapper>
}