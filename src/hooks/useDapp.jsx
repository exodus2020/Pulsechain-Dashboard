import { useState, useEffect } from 'react'
import { useAtom } from 'jotai'
import { dappModalAtom, serverStatusAtom } from '../store'
import { repositories } from '../config/dapps'

export function useDapp(repoName) {
    const [isInstalled, setIsInstalled] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [, setDappModal] = useAtom(dappModalAtom)
    const [runningServers, setRunningServers] = useAtom(serverStatusAtom)
    
    const repo = repositories.find(r => r.folder === repoName)

    useEffect(() => {
        const checkInstallation = async () => {
            if (!repo) return
            try {
                const version = await window.electron.checkVersion(repo.folder)
                setIsInstalled(!!version?.tag)
            } catch (err) {
                setIsInstalled(false)
            } finally {
                setIsLoading(false)
            }
        }
        
        checkInstallation()
    }, [repo])

    const launchDapp = async (additionalUrlText) => {
        if (!repo) return
        
        if (!isInstalled) {
            return
        }

        try {
            // Start server and update global status
            await window.electron.serveWebapp(repo.folder, repo.port)
            
            // Update the global server status atom
            setRunningServers(prev => ({
                ...prev,
                [repo.folder]: true
            }))

            await window.electron.openExternal(`http://localhost:${repo.port}${additionalUrlText ?? ''}`)
        } catch (err) {
            console.error('Error launching dapp:', err)
            setRunningServers(prev => ({
                ...prev,
                [repo.folder]: false
            }))
        }
    }

    return {
        isInstalled,
        isLoading,
        launchDapp,
        repo
    }
} 