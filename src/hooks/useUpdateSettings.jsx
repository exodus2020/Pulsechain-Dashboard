import { useEffect, useRef } from "react"

export default function useUpdateSettings({ context }) {
    const init = useRef(false)

    useEffect(() => {
        if (init.current || !context?.data) return
        if (context?.data?.settings?.scan?.mainnet[0] === 'https://api.scan.pulsechain.com/api') {
            init.current = true
            return
        }

        console.log('resetting scan to new api')
        context.resetSingleSetting('scan', {
            mainnet: ['https://api.scan.pulsechain.com/api'],
            testnet: ['https://api.scan.v4.testnet.pulsechain.com/api']
        })
    
        init.current = true
    }, [context, context.data])

    return {}
}