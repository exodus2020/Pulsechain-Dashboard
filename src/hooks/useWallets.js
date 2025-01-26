import { useAtom } from 'jotai'
import { hiddenWalletsAtom } from '../store'

export function useWallets(wallets) {
    const [hiddenWallets, setHiddenWallets] = useAtom(hiddenWalletsAtom)

    const toggleWalletVisibility = (address) => {
        setHiddenWallets(prev => {
            const isHidden = prev.includes(address)
            if (isHidden) {
                return prev.filter(a => a !== address)
            } else {
                const newHidden = [...prev, address]
                // If all wallets would be hidden, clear the array instead
                // if (newHidden.length === Object.keys(wallets).length) {
                //     return []
                // }
                return newHidden
            }
        })
    }

    const visibleWallets = Object.keys(wallets ?? {}).reduce((acc, address) => {
        // // If all wallets are hidden, show all wallets
        // if (hiddenWallets.length === Object.keys(wallets).length) {
        //     acc[address] = wallets[address]
        // }
        // // Otherwise, only show non-hidden wallets
        // else 
        if (!hiddenWallets.includes(address)) {
            acc[address] = wallets[address]
        }
        return acc
    }, {})

    return {
        toggleWalletVisibility,
        visibleWallets,
        isHidden: (address) => hiddenWallets.includes(address)
    }
} 