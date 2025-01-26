export const defaultSettings = {
    rpcs: {
        mainnet: ['https://rpc-pulsechain.g4mm4.io'],
        testnet: ['https://rpc-testnet-pulsechain.g4mm4.io']
    },
    scan: {
        mainnet: ['https://api.scan.pulsechain.com/api'],
        testnet: ['https://api.scan.v4.testnet.pulsechain.com/api']
    },
    config: {
        scanEnabled: false,
        tokenImagesEnabled: false
    }
}

//const version = await window.electron.getFile('https://gitlab.com/pulsechain-lunagray/pulsechain-dashboard/-/raw/main/src/config/version.json?ref_type=heads')
export const defaultMarkets = {
    "LunarShard": 'https://gitlab.com/pulsechain-lunagray/pulsechain-dashboard/-/raw/main/src/config/market.json?ref_type=heads',
}