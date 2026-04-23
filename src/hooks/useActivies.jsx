// useActivies.jsx
import { useEffect, useState } from "react"
import { batchFetchActivities } from "../lib/web3"
import { defaultSettings } from "../config/settings"


export default function useActivities (wallets = [], network = 'mainnet', settings = defaultSettings) {
    const [ activities, setActivities ] = useState({})
    const [ loading, setLoading ] = useState(false)

    useEffect(() => {
        const getActivities = async () => {
            const response = await batchFetchActivities(wallets, network, settings)

            setActivities(response)
            setLoading(false)
        }

        if(Object.keys(activities).length === 0 && !loading) {
            setLoading(true)
            getActivities()
        }

    }, [wallets.length])

    return { activities, loading }
}