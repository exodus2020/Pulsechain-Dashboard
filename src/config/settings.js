export const defaultSettings = {
    rpcs: {
        mainnet: [
            'https://rpc.pulsechain.com',
            'https://pulsechain-rpc.publicnode.com',
        ],

        ethereum: [
            'https://ethereum-rpc.publicnode.com',
        ],

        testnet: [
            'https://rpc.v4.testnet.pulsechain.com',
            'https://pulsechain-testnet-rpc.publicnode.com'
        ]

    },

    scan: {
        mainnet: [
            'https://api.scan.pulsechain.com/api'
        ],

        ethereum: [
            'https://eth.blockscout.com/api'
        ],

        testnet: [
            'https://api.scan.v4.testnet.pulsechain.com/api'
        ]
    },

    config: {
        scanEnabled: true,
        tokenImagesEnabled: true,
        dappImagesEnabled: false
    }
}

export const migrateSettings = (settings) => {
    if (!settings) return defaultSettings

    const obsoleteMainnetRpcs = [
        'https://rpc-pulsechain.g4mm4.io'
    ]

    const savedMainnetRpcs = settings?.rpcs?.mainnet ?? []
    const hasObsoleteRpc = savedMainnetRpcs.some(
        rpc => obsoleteMainnetRpcs.includes(rpc)
    )

    const migrated = hasObsoleteRpc
        ? {
            ...settings,
            rpcs: {
                ...settings.rpcs,
                mainnet: [
                    ...defaultSettings.rpcs.mainnet,
                    ...savedMainnetRpcs.filter(
                        rpc =>
                            !obsoleteMainnetRpcs.includes(rpc) &&
                            !defaultSettings.rpcs.mainnet.includes(rpc)
                    )
                ]
            }
        }
        : settings

    // Explorer access is a required dashboard service, not a user preference.
    // Force it on for existing/imported configs that may still contain scanEnabled: false.
    return {
        ...migrated,
        config: {
            ...defaultSettings.config,
            ...(migrated.config ?? {}),
            scanEnabled: true
        }
    }
}

//const version = await window.electron.getFile('https://gitlab.com/pulsechain-lunagray/pulsechain-dashboard/-/raw/main/src/config/version.json?ref_type=heads')
export const defaultMarkets = {
    "LunarShard": 'https://gitlab.com/pulsechain-lunagray/pulsechain-dashboard/-/raw/main/src/config/market.json?ref_type=heads',
}