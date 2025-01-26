import { useEffect, useState } from "react"
import { defaultCommunityDapps } from "../shared/AppContext"
import { repositories } from "../config/dapps"

export default function useCommunityDapp(context) {
    // const [ communityLists, setCommunityLists ] = useState([])
    const communityLists = context?.data?.communityDapps || []
    const [ communityDapps, setCommunityDapps ] = useState([])

    const initialized = context?.data

    useEffect(() => {
        if (!context?.data?.communityDapps && initialized) {
            context.toggleCommunityDapp(defaultCommunityDapps, true)
        }
    }, [context])

    const { toggleCommunityDapp, data } = context

    const isValidLocalDapp = (dapp) => {
        if(dapp?.port && dapp?.repoUrl && dapp?.name && dapp?.folder && (typeof dapp.port === 'number' || typeof dapp.port === 'string') && typeof dapp.repoUrl === 'string' && typeof dapp.name === 'string' && typeof dapp.folder === 'string') {
            return true
        }
        return false
    }

    const isValidLinkDapp = (dapp) => {
        if(dapp?.webUrl && dapp?.name && typeof dapp?.webUrl === 'string' && typeof dapp.webUrl === 'string') {
            return true
        }
        return false
    }

    useEffect(() => {
        if (!context?.data?.communityDapps) return

        if(data?.communityDapps && Array.isArray(data?.communityDapps)) {
            const dappArray = data.communityDapps.map(market => {
                if (!Array.isArray(market.data.dapps)) return []
                return market.data.dapps.map(dapp => ({ communityName: market?.data?.name ?? '', communityUrl: market?.url ?? '', ...dapp}))
            }).flat()

            const communityDapps = dappArray.filter(f => isValidLocalDapp(f))
            .filter(f => !repositories.some(s => s.folder.toLowerCase() === f.folder.toLowerCase()))

            const usedPorts = new Set([...communityDapps.map(dapp => dapp.port), ...repositories.map(dapp => dapp.port)])
            const startingPort = 3000

            for(let i = 0; i < communityDapps.length; i++) {
                const dapp = communityDapps[i]
                let port = parseInt(dapp.port.toString())

                if(usedPorts.has(port)) {
                    let newPort = startingPort
                    while(usedPorts.has(newPort)) {
                        newPort++
                    }
                    communityDapps[i] = { ...dapp, port: newPort }
                    port = newPort
                }
    
                usedPorts.add(port)
            }

            const communityLinks = dappArray.filter(f => !isValidLocalDapp(f) && isValidLinkDapp(f))
            setCommunityDapps([...communityDapps, ...communityLinks])
        }
        
        // setCommunityLists(context?.data?.communityDapps || [])
    }, [context?.update])

    const checkIsListValid = async (url) => {
        if (typeof url !== 'string') return null
        const response = await window.electron.getFile(url)

        if(response.name && typeof response.name === 'string' && Array.isArray(response?.dapps)) {
            try {
                const result = {
                    url, 
                    data: response,
                    updated: new Date().getTime()
                }
                return result
            } catch(e) {
                return null
            }
        }
        return null
    }

    const toggleDappList = async (dappUrl, update = false) => {
        const isUrl = await checkIsListValid(dappUrl)
        const validDapp = isUrl !== null ? isUrl : dappUrl?.data?.name && Array.isArray(dappUrl?.data?.dapps) ? dappUrl : undefined
        if (validDapp) {
            toggleCommunityDapp(validDapp, update)
            return true
        } else {
            return false
        }
    }

    return {
        toggleDappList,
        communityLists,
        communityDapps
    }
}