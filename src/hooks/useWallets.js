//useWallets.js
import { useAtom } from 'jotai'
import { hiddenWalletsAtom } from '../store'

const normalizeAddress = address => {
    return String(address ?? '').toLowerCase().trim()
}

export function useWallets(wallets) {
    const [hiddenWallets, setHiddenWallets] =
        useAtom(hiddenWalletsAtom)

    const normalizedHiddenWallets =
        hiddenWallets.map(normalizeAddress)

    const toggleWalletVisibility = address => {
        const normalizedAddress =
            normalizeAddress(address)

        if (!normalizedAddress) {
            return
        }

        setHiddenWallets(previousWallets => {
            const normalizedPreviousWallets =
                previousWallets.map(normalizeAddress)

            const isHidden =
                normalizedPreviousWallets.includes(
                    normalizedAddress
                )

            if (isHidden) {
                return previousWallets.filter(walletAddress => {
                    return (
                        normalizeAddress(walletAddress) !==
                        normalizedAddress
                    )
                })
            }

            return [
                ...previousWallets,
                normalizedAddress
            ]
        })
    }

    const visibleWallets =
        Object.keys(wallets ?? {}).reduce(
            (accumulator, address) => {
                const normalizedAddress =
                    normalizeAddress(address)

                if (
                    !normalizedHiddenWallets.includes(
                        normalizedAddress
                    )
                ) {
                    accumulator[address] = wallets[address]
                }

                return accumulator
            },
            {}
        )

    return {
        toggleWalletVisibility,
        visibleWallets,
        isHidden: address => {
            return normalizedHiddenWallets.includes(
                normalizeAddress(address)
            )
        }
    }
}