import { useAtom } from "jotai"
import styled from "styled-components"
import { appSettingsAtom, keyAtom } from "../store"
import { useEffect, useState } from "react"
import LoadingWave from "../components/LoadingWave"
import { Input } from "../components/Input"
import { hashString } from "../lib/crypto"
import { initData, isKeyCorrect } from "../shared/AppContext"
import { defaultSettings } from "../config/settings"

const LockWrapper = styled.div`
    color: white;
    position: absolute; left: 50%; top: 35%;
    transform: translateX(-50%) translateY(-50%);
    text-align: center;
    transition: all 0.3s ease;

    .lock-header {
        padding: 30px;
        font-size: 50px;
        position: relative;
    }

    @media (max-width: 600px) {
        .lock-header {
            font-size: 30px;
        }
    }
    @media (max-width: 400px) {
        left: 50%;
        top: 220px;
        transform: translateX(-50%) translateY(-50%);
    }
`

const SubText = styled.div`
    position: absolute;
    bottom: -15px; left: 50%;
    transform: translateX(-50%) translateY(50%);
`

export default function LockPage () {
    const [ key, setKey ] = useAtom(keyAtom)
    const [ attemptKey, setAttemptKey ] = useState('')
    const [ settings, setSettings ] = useAtom(appSettingsAtom)

    const [ isNewUser, setIsNewUser ] = useState(undefined)

    const testLoadData = async () => {
    if (!window.electron?.loadFile) {
        setSettings(defaultSettings)
        setKey('')
        setIsNewUser(true)
        return
    }

    const response = await window.electron.loadFile('config.json')
    if (response) {
        try {
            const isUnencrypted = JSON.parse(response ?? '{}')
            setSettings(isUnencrypted?.settings ?? defaultSettings)
            setKey('')
            setIsNewUser(false)
        } catch {
            setIsNewUser(false)
        }
    } else {
        setSettings(defaultSettings)
        setIsNewUser(true)
    }
}

    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            await window.electron.saveFile('config.json', text)
            window.location.reload()
        } catch (error) {
            console.error('Error reading file:', error);
            onFileContent(null);
        }
    }

    useEffect(() => {
        testLoadData()
    }, [])

    return <LockWrapper>
        <div className="lock-header" >
            <div style={{ position: 'absolute', top: -20, left: 10, transform: 'translateY(-50%) translateX(-50%)' }}>
                {/* <img src="/logo128x128.png" alt="PulseChain Dashboard" width={64} height={64}/> */}
                <div style={{ paddingLeft: 40, width: 600 }}>
                    PulseChain Dashboard
                    <div style={{ fontSize: 26 }}>
                        Privacy-First Portfolio Tracker
                    </div>
                </div>
            </div>
        </div>
        <SubText >
            {isNewUser === undefined 
                ? <div><div style={{ display: 'inline-block'}}><LoadingWave speed={150} numDots={8} /></div></div> 
            : isNewUser ? <div style={{ width: 300 }}>
                <div style={{ marginBottom: 10 }}>
                    Create a password to encrypt (optional)
                </div>
                <div>
                    <Input placeholder="Set password" buttonText="Save" onSubmit={async (pass) => {
                        if(pass === '') {
                            setKey('')
                            return
                        }
                        
                        const hashedKey = await hashString(pass)
                        const saved = await initData(hashedKey)
                        const settings = saved?.settings ?? defaultSettings
                        setSettings(settings)
                        setKey(hashedKey) 
                    }}/>
                </div>
                <div style={{ position: 'absolute', bottom: -30, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', cursor: 'pointer', fontSize: 14 }} className="tl">
                    {/* Import from File */}
                    <label style={{ cursor: 'pointer' }}  className="tl">
                        Import from File
                    <input
                        type="file"
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                    />
                    </label>
                </div>
            </div>
            : <div style={{ width: 300 }}>
                <div style={{ marginBottom: 10 }} >
                    Enter password to login
                </div>
                <div>
                    <Input type="password" placeholder="Enter password" buttonText="Submit" clearOnSubmit={true} onSubmit={async (pass) => {
                        
                        const hashedKey = await hashString(pass)
                        const validKey = await isKeyCorrect(hashedKey)
                        
                        if (validKey) setKey(hashedKey)                       
                    }}/>
                </div>
            </div>}

            <div style={{ position: 'absolute', bottom: -120, textAlign: 'center', width: '100%', fontSize: 14 }}>
                Download for PC & MacOS<br/>
                <a href="https://gitlab.com/pulsechain-lunagray/pulsechain-dashboard" target="_blank" style={{ color: 'white', marginTop: 10, display: 'inline-block'}}>
                    Open-Source Repository & Downloads
                </a>
            </div>
        </SubText>
    </LockWrapper>
}