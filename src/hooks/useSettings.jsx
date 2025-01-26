import { useAtom } from "jotai"
import { appSettingsAtom } from "../store"

export function useSettings({network}) {
    const [ settings, setSettings ] = useAtom(appSettingsAtom)
    const scan = settings.scan[network].map(m => m.replace('/api/v2', '/api'))
    
    return {
        scan, 
        settings, 
        setSettings 
    }
}