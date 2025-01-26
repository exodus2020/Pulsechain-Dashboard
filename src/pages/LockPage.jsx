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
        const response = await window.electron.loadFile('config.json')
        if (response) {
            try {
                const isUnencrypted = JSON.parse(response ?? {})
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

    useEffect(() => {
        testLoadData()
    }, [])

    return <LockWrapper>
        <div style={{ padding: 30, fontSize: 50}}>
            PulseChain Dashboard
        </div>
        <SubText>
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
            </div>
            : <div style={{ width: 300 }}>
                <div style={{ marginBottom: 10 }} >
                    Enter password to continue
                </div>
                <div>
                    <Input type="password" placeholder="Enter password" buttonText="Submit" clearOnSubmit={true} onSubmit={async (pass) => {
                        
                        const hashedKey = await hashString(pass)
                        const validKey = await isKeyCorrect(hashedKey)
                        
                        if (validKey) setKey(hashedKey)                       
                    }}/>
                </div>
            </div>}
        </SubText>
    </LockWrapper>
}