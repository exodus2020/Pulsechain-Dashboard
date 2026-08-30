import { useEffect, useMemo, useState } from "react"
import { ethers } from "ethers"
import {
    fetchCompleteAddressTokenTransfers,
    fetchCompleteAddressTransactions,
    batchFetchTokenInfo,
    fetchExplorerTransaction
} from "../lib/web3"
import { defaultTokenInformation } from "../lib/tokens"
import { defaultSettings } from "../config/settings"

const GECKO_API = "https://api.geckoterminal.com/api/v2"
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const HEX_ADDRESS = "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39"
const PRVX_ADDRESS = "0xf6f8db0aba00007681f8faf16a0fda1c9b030b11"
const PRVX_WPLS_PREFERRED_PAIR = "0x62f7d076c92db76cf84223b6309801ea461d7afe"
const PRVX_SACRIFICE_ADDRESS = "0xafa2a89cb43619677d9c72e81f6d4c8a730a1022"
// ProveX sacrifice ran in late 2025 / early 2026. Keep this scan narrow so
// PRVX basis discovery does not turn into another full-wallet history scan.
const PRVX_SACRIFICE_START_BLOCK = 23750000
const PRVX_SACRIFICE_END_BLOCK = 24450000
const PRVX_SACRIFICE_CACHE_VERSION = 1
const WPLS_WRAP_CACHE_VERSION = 4
const PLS_NATIVE_CACHE_VERSION = 1

// PRVX baseline cost-basis model. Assume every sacrifice distribution received
// the best (maximum-return) allocation. Calibration supplied from a known
// maximum-multiplier sacrifice: $700 -> 8.36M PRVX. This is intentionally
// an estimate and is applied per distribution receipt, not per combined wallet.
const PRVX_MAX_RETURN_TOKENS_PER_USD = 8_360_000 / 700

const RESULT_CACHE_VERSION = 20
const RESULT_CACHE_MAX_AGE = 30 * 60 * 1000
const RECEIPT_CACHE_VERSION = 2
const PRICE_CACHE_VERSION = 15
const POOL_CACHE_VERSION = 10
const TRANSFER_CACHE_VERSION = 18
const CHECKPOINT_CACHE_VERSION = 18
const ACCOUNTING_CACHE_VERSION = 18
const PROVIDER_FAILURE_CACHE_VERSION = 15
const PROVIDER_FAILURE_TTL_MS = 6 * 60 * 60 * 1000

const WPLS_ADDRESS = "0xa1077a294dde1b09bb078844df40758a5d0f9a27"
const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
const ETHEREUM_FORK_BLOCK = 17233000


// V15: PulseChain historical pricing is now on-chain first.  We anchor WPLS
// to the bridged USDC/USDT/DAI PulseX pools and derive any payment token's
// USD value through its WPLS pair at the transaction block.  This avoids
// depending on third-party candle APIs for the common PulseChain path.
const PULSEX_V1_FACTORY = "0x1715a3E4A142d8b698131108995174F37aEBA10D"
const PULSEX_V2_FACTORY = "0x29eA7545DEf87022BAdc76323F373EA1e707C523"
const PULSEX_STABLE_ANCHORS = [
    {
        pair: "0x6753560538eca67617a9ce605178f788be7e524e",
        stable: "0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07",
        stableDecimals: 6,
        wplsIsToken0: false,
        symbol: "USDC"
    },
    {
        pair: "0x322df7921f28f1146cdf62afdac0d6bc0ab80711",
        stable: "0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f",
        stableDecimals: 6,
        wplsIsToken0: false,
        symbol: "USDT"
    },
    {
        pair: "0xe56043671df55de5cdf8459710433c10324de0ae",
        stable: "0xefd766ccb38eaf1dfd701853bfce31359239f305",
        stableDecimals: 18,
        wplsIsToken0: true,
        symbol: "DAI"
    }
]
const PULSEX_PAIR_ABI = [
    "function getReserves() view returns (uint112 reserve0,uint112 reserve1,uint32 blockTimestampLast)",
    "function token0() view returns (address)",
    "function token1() view returns (address)"
]
const PULSEX_FACTORY_ABI = [
    "function getPair(address tokenA,address tokenB) view returns (address pair)"
]
const ONCHAIN_CALL_TIMEOUT_MS = 8000
const ZERO_PAIR = ZERO_ADDRESS
const onchainProviderCache = new Map()
const onchainPairCache = new Map()
const onchainWplsDayCache = new Map()

const promiseWithTimeout = (promise, timeout = ONCHAIN_CALL_TIMEOUT_MS) =>
    Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("On-chain historical call timed out")), timeout))
    ])

const getPulseProviders = settings => {
    const rpcs = [...new Set([
        ...(settings?.rpcs?.mainnet ?? []),
        ...(defaultSettings?.rpcs?.mainnet ?? [])
    ].filter(Boolean))]
    return rpcs.map(rpc => {
        if (!onchainProviderCache.has(rpc)) {
            onchainProviderCache.set(rpc, new ethers.providers.JsonRpcProvider(rpc))
        }
        return { rpc, provider: onchainProviderCache.get(rpc) }
    })
}

const callAtHistoricalBlock = async (settings, contractAddress, abi, method, args, blockNumber) => {
    if (!Number.isFinite(Number(blockNumber)) || Number(blockNumber) <= 0) return null
    for (const { provider } of getPulseProviders(settings)) {
        try {
            const contract = new ethers.Contract(contractAddress, abi, provider)
            return await promiseWithTimeout(
                contract[method](...(args ?? []), { blockTag: Number(blockNumber) })
            )
        } catch {
            // Try the next configured/archive RPC. External price providers are
            // still available if none of the RPCs support historical eth_call.
        }
    }
    return null
}

const readPulseXPairSnapshot = async (settings, pairAddress, blockNumber, knownToken0 = null) => {
    const pair = normalizeAddress(pairAddress)
    if (!pair || pair === ZERO_PAIR) return null
    let token0 = knownToken0 ? normalizeAddress(knownToken0) : null
    for (const { provider } of getPulseProviders(settings)) {
        try {
            const contract = new ethers.Contract(pair, PULSEX_PAIR_ABI, provider)
            if (!token0) token0 = normalizeAddress(await promiseWithTimeout(contract.token0()))
            const reserves = await promiseWithTimeout(contract.getReserves({ blockTag: Number(blockNumber) }))
            const r0 = Number(ethers.utils.formatUnits(reserves?.reserve0 ?? reserves?.[0] ?? 0, 18))
            const r1 = Number(ethers.utils.formatUnits(reserves?.reserve1 ?? reserves?.[1] ?? 0, 18))
            // Raw reserve values are returned too because token decimals may not be 18.
            return {
                token0,
                reserve0Raw: String(reserves?.reserve0 ?? reserves?.[0] ?? "0"),
                reserve1Raw: String(reserves?.reserve1 ?? reserves?.[1] ?? "0"),
                reserve0Approx18: r0,
                reserve1Approx18: r1
            }
        } catch {
            // Try next RPC.
        }
    }
    return null
}

const median = values => {
    const valid = values.filter(v => Number.isFinite(v) && v > 0).sort((a,b) => a-b)
    if (!valid.length) return null
    const mid = Math.floor(valid.length / 2)
    return valid.length % 2 ? valid[mid] : (valid[mid-1] + valid[mid]) / 2
}

const getHistoricalWplsUsdOnChain = async (settings, timestamp, blockNumber) => {
    const ts = toUnixSeconds(timestamp)
    const day = Math.floor(ts / 86400)
    if (onchainWplsDayCache.has(day)) return onchainWplsDayCache.get(day)
    const cached = readCachedHistoricalPrice("mainnet", WPLS_ADDRESS, ts)
    if (cached) {
        onchainWplsDayCache.set(day, cached)
        return cached
    }
    if (!Number.isFinite(Number(blockNumber)) || Number(blockNumber) <= 0) return null

    const historicalBlock = Math.max(ETHEREUM_FORK_BLOCK, Number(blockNumber) - 1)
    const anchorPrices = await Promise.all(PULSEX_STABLE_ANCHORS.map(async anchor => {
        const snap = await readPulseXPairSnapshot(
            settings,
            anchor.pair,
            historicalBlock,
            anchor.wplsIsToken0 ? WPLS_ADDRESS : anchor.stable
        )
        if (!snap) return null
        try {
            const wplsRaw = BigInt(anchor.wplsIsToken0 ? snap.reserve0Raw : snap.reserve1Raw)
            const stableRaw = BigInt(anchor.wplsIsToken0 ? snap.reserve1Raw : snap.reserve0Raw)
            const wpls = Number(ethers.utils.formatUnits(wplsRaw, 18))
            const stable = Number(ethers.utils.formatUnits(stableRaw, anchor.stableDecimals))
            const price = stable / wpls
            return Number.isFinite(price) && price > 0 ? price : null
        } catch {
            return null
        }
    }))
    const prices = anchorPrices.filter(Boolean)
    const price = median(prices)
    if (price) {
        writeHistoricalPrice("mainnet", WPLS_ADDRESS, ts, price)
        onchainWplsDayCache.set(day, price)
        return price
    }
    return null
}

const discoverPulseXWplsPairs = async (settings, tokenAddress) => {
    const token = normalizeAddress(tokenAddress)
    if (!token || token === WPLS_ADDRESS) return []
    if (onchainPairCache.has(token)) return onchainPairCache.get(token)
    const pairs = []
    // PRVX has several PRVX/WPLS pools, including tiny legacy pools. Prefer
    // the deep PulseX v2 pool used by the live market so historical reserve
    // pricing does not get stranded on a dust pair. Factory discovery remains
    // as a fallback and can add any other valid pools.
    if (token === PRVX_ADDRESS) pairs.push(PRVX_WPLS_PREFERRED_PAIR)
    for (const { provider } of getPulseProviders(settings)) {
        try {
            for (const factoryAddress of [PULSEX_V2_FACTORY, PULSEX_V1_FACTORY]) {
                const factory = new ethers.Contract(factoryAddress, PULSEX_FACTORY_ABI, provider)
                const pair = normalizeAddress(await promiseWithTimeout(factory.getPair(token, WPLS_ADDRESS)))
                if (pair && pair !== ZERO_PAIR && !pairs.includes(pair)) pairs.push(pair)
            }
            if (pairs.length) break
        } catch {}
    }
    onchainPairCache.set(token, pairs)
    return pairs
}

const getHistoricalPulseTokenUsdOnChain = async ({ settings, tokenAddress, timestamp, blockNumber, decimals = 18 }) => {
    const token = normalizeAddress(tokenAddress)
    const ts = toUnixSeconds(timestamp)
    if (!token || !ts || !Number.isFinite(Number(blockNumber)) || Number(blockNumber) <= 0) return null
    const cached = readCachedHistoricalPrice("mainnet", token, ts)
    if (cached) return cached

    const wplsUsd = await getHistoricalWplsUsdOnChain(settings, ts, blockNumber)
    if (!wplsUsd) return null
    if (token === WPLS_ADDRESS) return wplsUsd

    const pairs = await discoverPulseXWplsPairs(settings, token)
    let best = null
    for (const pair of pairs) {
        const snap = await readPulseXPairSnapshot(settings, pair, Math.max(ETHEREUM_FORK_BLOCK, Number(blockNumber) - 1))
        if (!snap) continue
        try {
            const tokenIs0 = normalizeAddress(snap.token0) === token
            const tokenRaw = BigInt(tokenIs0 ? snap.reserve0Raw : snap.reserve1Raw)
            const wplsRaw = BigInt(tokenIs0 ? snap.reserve1Raw : snap.reserve0Raw)
            const tokenUnits = Number(ethers.utils.formatUnits(tokenRaw, Number(decimals ?? 18)))
            const wplsUnits = Number(ethers.utils.formatUnits(wplsRaw, 18))
            const tokenInWpls = wplsUnits / tokenUnits
            const usd = tokenInWpls * wplsUsd
            if (!Number.isFinite(usd) || usd <= 0) continue
            // Prefer the historical pair with the largest WPLS reserve.
            if (!best || wplsUnits > best.wplsLiquidity) best = { usd, wplsLiquidity: wplsUnits }
        } catch {}
    }
    if (best?.usd) {
        writeHistoricalPrice("mainnet", token, ts, best.usd)
        return best.usd
    }
    return null
}

const ONCHAIN_DAY_CONCURRENCY = 4

const prefetchPulseXOnChainPrices = async (tokenAddress, timestamps, blockByDay, settings, decimals = 18) => {
    const token = normalizeAddress(tokenAddress)
    if (!token) return false
    const requested = [...new Set((timestamps ?? []).map(toUnixSeconds).filter(Boolean))]
    let any = false
    let resolved = 0
    let attempted = 0

    const pending = []
    for (const ts of requested) {
        if (readCachedHistoricalPrice("mainnet", token, ts)) {
            any = true
            resolved += 1
            continue
        }
        const day = Math.floor(ts / 86400)
        const blockNumber = Number(blockByDay?.[day] ?? 0)
        if (!blockNumber) continue
        pending.push({ ts, blockNumber })
    }

    // Historical reserve reads used to run one date at a time. A token with
    // years of purchase history could therefore require hundreds of serial RPC
    // round trips. Process a small number of independent days concurrently.
    // Four workers is intentionally conservative: it gives a large speed-up
    // without turning an archive RPC into a request storm. Each successful day
    // is still persisted immediately by writeHistoricalPrice(), so an early
    // shutdown loses only the currently in-flight requests.
    let cursor = 0
    const worker = async () => {
        while (cursor < pending.length) {
            const index = cursor
            cursor += 1
            const { ts, blockNumber } = pending[index]
            attempted += 1
            const price = await getHistoricalPulseTokenUsdOnChain({
                settings,
                tokenAddress: token,
                timestamp: ts,
                blockNumber,
                decimals
            })
            if (price) {
                any = true
                resolved += 1
            }
        }
    }

    const workerCount = Math.min(ONCHAIN_DAY_CONCURRENCY, pending.length)
    if (workerCount > 0) {
        await Promise.all(Array.from({ length: workerCount }, () => worker()))
    }

    console.info("Token P&L v21 ONCHAIN PRICE", JSON.stringify({
        token, requested: requested.length, attempted, resolved,
        concurrency: ONCHAIN_DAY_CONCURRENCY
    }))
    return any
}

const getPrvxSacrificeCacheKey = wallet => `token-pnl:prvx-sacrifice:v${PRVX_SACRIFICE_CACHE_VERSION}:${normalizeAddress(wallet)}`

const readPrvxSacrificeCache = wallet => {
    try {
        const raw = safeLocalStorageGet(getPrvxSacrificeCacheKey(wallet))
        return raw ? JSON.parse(raw) : null
    } catch { return null }
}

const writePrvxSacrificeCache = (wallet, data) => {
    try { safeLocalStorageSet(getPrvxSacrificeCacheKey(wallet), JSON.stringify(data)) } catch {}
    return data
}

const fetchPrvxNativeSacrifices = async (wallet, settings) => {
    const configuredScan = settings?.scan?.ethereum
    const scanApi = Array.isArray(configuredScan) ? configuredScan[0] : configuredScan
    if (!scanApi || !window?.electron?.fetchJson) return []
    const results = []
    for (let page = 1; page <= 20; page += 1) {
        const url = new URL(scanApi)
        url.searchParams.set("module", "account")
        url.searchParams.set("action", "txlist")
        url.searchParams.set("address", normalizeAddress(wallet))
        url.searchParams.set("startblock", String(PRVX_SACRIFICE_START_BLOCK))
        url.searchParams.set("endblock", String(PRVX_SACRIFICE_END_BLOCK))
        url.searchParams.set("sort", "asc")
        url.searchParams.set("page", String(page))
        url.searchParams.set("offset", "250")
        try {
            const response = await promiseWithTimeout(window.electron.fetchJson(url.toString()), 12000)
            const json = response?.data ?? response
            const rows = Array.isArray(json?.result) ? json.result : []
            if (!rows.length) break
            for (const tx of rows) {
                if (normalizeAddress(tx?.to) !== PRVX_SACRIFICE_ADDRESS) continue
                const raw = String(tx?.value ?? "0")
                if (raw === "0") continue
                results.push({
                    network: "ethereum",
                    hash: String(tx?.hash ?? "").toLowerCase(),
                    blockNumber: Number(tx?.blockNumber ?? 0),
                    timestamp: Number(tx?.timeStamp ?? 0),
                    nativeValueRaw: raw
                })
            }
            if (rows.length < 250) break
        } catch { break }
    }
    return results
}

// V40: native PLS bought through a router arrives as an internal native-value
// transfer, not an ERC-20 WPLS Transfer event. Fetch those movements from the
// Blockscout v2 endpoint so the Pulse row can reconstruct native PLS as well as
// wrapped PLS.
const fetchCompleteAddressInternalTransactions = async (wallet, settings, options = {}) => {
    const configured = settings?.scan?.mainnet
    const scanApi = Array.isArray(configured) ? configured[0] : configured
    if (!scanApi || !window?.electron?.fetchJson) return []
    const maxPages = Number(options.maxPages ?? 250)
    const rows = []
    const seen = new Set()
    let nextPageParams = null
    for (let page = 0; page < maxPages; page += 1) {
        const base = String(scanApi).replace(/\/$/, '')
        const url = new URL(`${base}/v2/addresses/${normalizeAddress(wallet)}/internal-transactions`)
        Object.entries(nextPageParams ?? {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
        })
        try {
            const response = await promiseWithTimeout(window.electron.fetchJson(url.toString()), 15000)
            const data = response?.data ?? response ?? {}
            const items = Array.isArray(data?.items) ? data.items : []
            for (const item of items) {
                const hash = String(item?.transaction_hash ?? item?.transaction?.hash ?? item?.hash ?? '').toLowerCase()
                const index = String(item?.index ?? item?.trace_address ?? item?.type ?? '')
                const value = String(item?.value ?? '0')
                const from = normalizeAddress(item?.from?.hash ?? item?.from)
                const to = normalizeAddress(item?.to?.hash ?? item?.to)
                const id = `${hash}:${index}:${from}:${to}:${value}`
                if (!hash || seen.has(id)) continue
                seen.add(id)
                rows.push(item)
            }
            nextPageParams = data?.next_page_params ?? null
            if (!nextPageParams || items.length === 0) break
        } catch (error) {
            console.debug('Token P&L v40 PLS INTERNAL HISTORY FAILED', { wallet, message: error?.message })
            break
        }
    }
    return rows
}

const PRICE_SOURCES = {
    ethereum: {
        geckoNetwork: "eth",
        wrappedNativeAddress: WETH_ADDRESS,
        label: "Ethereum"
    },
    mainnet: {
        geckoNetwork: "pulsechain",
        wrappedNativeAddress: WPLS_ADDRESS,
        label: "PulseChain"
    }
}

const ETHEREUM_USD_STABLECOINS = new Set([
    "0x6b175474e89094c44da98b954eedeac495271d0f",
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "0xdac17f958d2ee523a2206206994597c13d831ec7"
])

const COINGECKO_API = "https://api.coingecko.com/api/v3"
const COINGECKO_IDS = {
    // PulseChain-native assets CoinGecko tracks directly.
    "mainnet:0xa1077a294dde1b09bb078844df40758a5d0f9a27": "wrapped-pulse-wpls",
    "mainnet:0x95b303987a60c71504d99aa1b13b4da07b0790ab": "pulsex",
    "mainnet:0x2b591e99afe9f32eaa6214f7b7629768c40eeb39": "hex-pulsechain",

    // Ethereum assets used to reconstruct pre-fork copied positions.
    "ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "ethereum",
    "ethereum:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "wrapped-bitcoin",
    "ethereum:0x6b175474e89094c44da98b954eedeac495271d0f": "dai",
    "ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "usd-coin",
    "ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7": "tether",
    "ethereum:0x2b591e99afe9f32eaa6214f7b7629768c40eeb39": "hex"
}

// DefiLlama is the first provider V13 asks for historical contract prices.
// Its Coins API is keyless and supports multi-timestamp requests, which lets us
// price the *payment leg* of many swaps without walking DEX candle history.
const DEFILLAMA_COINS_API = "https://coins.llama.fi"
const DEFILLAMA_CHAIN = {
    ethereum: "ethereum",
    mainnet: "pulsechain"
}

// If a chain/address lookup is not indexed, these coingecko aliases give
// DefiLlama a second way to resolve the major reference assets. They are only
// fallbacks; contract-address pricing remains preferred.
const DEFILLAMA_ALIASES = {
    "mainnet:0xa1077a294dde1b09bb078844df40758a5d0f9a27": "coingecko:wrapped-pulse-wpls",
    "mainnet:0x95b303987a60c71504d99aa1b13b4da07b0790ab": "coingecko:pulsex",
    "mainnet:0x2b591e99afe9f32eaa6214f7b7629768c40eeb39": "coingecko:hex-pulsechain",
    "ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "coingecko:ethereum",
    "ethereum:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "coingecko:wrapped-bitcoin",
    "ethereum:0x6b175474e89094c44da98b954eedeac495271d0f": "coingecko:dai",
    "ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "coingecko:usd-coin",
    "ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7": "coingecko:tether"
}

// Exchange-traded reference assets get a second, independent historical
// source. Binance Vision is public, requires no API key, and is already used
// by the HEX DCA scanner. WBTC is valued from BTCUSDT because WBTC is intended
// to track BTC closely; this is only used on Ethereum/pre-fork history.
const BINANCE_HISTORY_SYMBOLS = {
    "ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "ETHUSDT",
    "ethereum:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "BTCUSDT"
}

// IMPORTANT: Ethereum DAI/USDC/USDT contract addresses on PulseChain are
// copied assets, not guaranteed $1 stablecoins. Never hard-code them to $1.


// GeckoTerminal's public API is intentionally rate limited.  Keep every
// request made by this hook on one serialized lane so a wallet with many
// tokens cannot create a burst of browser requests.
let geckoRequestLane = Promise.resolve()
let lastGeckoRequestAt = 0
const GECKO_MIN_REQUEST_GAP_MS = 2500

const queueGeckoRequest = task => {
    const run = async () => {
        const elapsed = Date.now() - lastGeckoRequestAt
        if (elapsed < GECKO_MIN_REQUEST_GAP_MS) {
            await wait(GECKO_MIN_REQUEST_GAP_MS - elapsed)
        }
        lastGeckoRequestAt = Date.now()
        return task()
    }

    const queued = geckoRequestLane.then(run, run)
    geckoRequestLane = queued.catch(() => undefined)
    return queued
}

const normalizeAddress = address =>
    String(address ?? "").toLowerCase().trim()

const wait = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds))

const toUnixSeconds = timestamp => {
    if (typeof timestamp === "number") {
        return timestamp > 1e12
            ? Math.floor(timestamp / 1000)
            : Math.floor(timestamp)
    }

    const parsed = Date.parse(String(timestamp ?? ""))
    return Number.isFinite(parsed)
        ? Math.floor(parsed / 1000)
        : 0
}

const safeLocalStorageGet = key => {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

const safeLocalStorageSet = (key, value) => {
    try {
        localStorage.setItem(key, value)
    } catch {
        // P&L still works without persistent caching.
    }
}

const safeLocalStorageRemove = key => {
    try {
        localStorage.removeItem(key)
    } catch {
        // Ignore storage failures.
    }
}

const formatRawAmount = (rawValue, decimals) => {
    try {
        const formatted = ethers.utils.formatUnits(
            String(rawValue ?? "0"),
            Number(decimals ?? 18)
        )

        const amount = Number(formatted)
        return Number.isFinite(amount) ? amount : 0
    } catch {
        return 0
    }
}

const fetchJsonWithRetry = async (
    url,
    {
        attempts = 2,
        delay = 1200,
        timeout = 9000
    } = {}
) => {
    let lastError = null

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            if (!window?.electron?.fetchJson) {
                throw new Error("Electron JSON fetch bridge is unavailable")
            }

            const result = await queueGeckoRequest(() =>
                Promise.race([
                    window.electron.fetchJson(url),
                    new Promise((_, reject) => {
                        setTimeout(() => {
                            const error = new Error(
                                `Historical price request timed out after ${timeout} ms`
                            )
                            error.status = 408
                            reject(error)
                        }, timeout)
                    })
                ])
            )

            if (!result?.ok) {
                const error = new Error(
                    result?.error ??
                    `Historical price request failed (${result?.status ?? "unknown"})`
                )
                error.status = result?.status
                throw error
            }

            return result.data
        } catch (error) {
            lastError = error

            // Auth/CORS-style failures are not helped by retrying.
            if ([400, 401, 403, 404].includes(Number(error?.status))) {
                break
            }

            if (attempt < attempts - 1) {
                await wait(
                    Number(error?.status) === 429
                        ? 8000
                        : delay * (attempt + 1)
                )
            }
        }
    }

    throw lastError ?? new Error("Unable to retrieve historical price")
}

const poolMemoryCache = new Map()
const priceMemoryCache = new Map()

const extractRelationshipTokenAddress = relationshipId => {
    const value = String(relationshipId ?? "").toLowerCase()
    const match = value.match(/0x[a-f0-9]{40}$/)
    return match?.[0] ?? ""
}

const getTopPool = async (tokenAddress, network = "mainnet") => {
    const token = normalizeAddress(tokenAddress)
    const source = PRICE_SOURCES[network] ?? PRICE_SOURCES.mainnet
    if (!token) return null

    const memoryKey = `${source.geckoNetwork}:${token}`
    if (poolMemoryCache.has(memoryKey)) {
        return poolMemoryCache.get(memoryKey)
    }

    const storageKey = `token_pnl_pool_v${POOL_CACHE_VERSION}:${memoryKey}`
    const cached = safeLocalStorageGet(storageKey)
    if (cached) {
        if (cached === "__none__") {
            poolMemoryCache.set(memoryKey, null)
            return null
        }
        try {
            const parsed = JSON.parse(cached)
            if (parsed?.address) {
                poolMemoryCache.set(memoryKey, parsed)
                return parsed
            }
        } catch {
            // Ignore malformed cache entries.
        }
    }

    const url = `${GECKO_API}/networks/${source.geckoNetwork}/tokens/${token}/pools?page=1`
    try {
        const json = await fetchJsonWithRetry(url, { attempts: 2, delay: 1200, timeout: 10000 })
        const poolAddress = normalizeAddress(json?.data?.[0]?.attributes?.address)
        if (!poolAddress) {
            poolMemoryCache.set(memoryKey, null)
            safeLocalStorageSet(storageKey, "__none__")
            return null
        }
        const result = { address: poolAddress, geckoNetwork: source.geckoNetwork }
        poolMemoryCache.set(memoryKey, result)
        safeLocalStorageSet(storageKey, JSON.stringify(result))
        return result
    } catch (error) {
        console.debug("Token P&L v15 POOL UNAVAILABLE", { network, token, status: error?.status ?? null })
        return null
    }
}
const selectClosestCandlePrice = (candles, targetTimestamp) => {
    if (!Array.isArray(candles) || candles.length === 0) {
        return null
    }

    const valid = candles
        .map(candle => ({
            timestamp: Number(candle?.[0]),
            close: Number(candle?.[4])
        }))
        .filter(candle =>
            Number.isFinite(candle.timestamp) &&
            Number.isFinite(candle.close) &&
            candle.close > 0
        )
        .sort((a, b) =>
            Math.abs(a.timestamp - targetTimestamp) -
            Math.abs(b.timestamp - targetTimestamp)
        )

    return valid?.[0]?.close ?? null
}

const getPriceCacheKey = (network, token, dayBucket) =>
    `${network}:${normalizeAddress(token)}:${dayBucket}`

const readCachedHistoricalPrice = (network, tokenAddress, timestamp) => {
    const token = normalizeAddress(tokenAddress)
    const unixTimestamp = toUnixSeconds(timestamp)
    if (!token || !unixTimestamp) return null
    const dayBucket = Math.floor(unixTimestamp / 86400)

    // Ethereum-native stablecoins were designed to hold $1 before the fork.
    // Do NOT apply this shortcut to their copied PulseChain versions.
    if (network === "ethereum" && ETHEREUM_USD_STABLECOINS.has(token)) return 1

    if (network === "mainnet") {
        const sharedHexDcaPrice = Number(
            safeLocalStorageGet(`hex_dca_price_pulsechain:${token}:${dayBucket}`)
        )
        if (Number.isFinite(sharedHexDcaPrice) && sharedHexDcaPrice > 0) return sharedHexDcaPrice
    } else if (network === "ethereum") {
        const sharedHexDcaPrice = Number(
            safeLocalStorageGet(`hex_dca_price_ethereum:${token}:${dayBucket}`)
        )
        if (Number.isFinite(sharedHexDcaPrice) && sharedHexDcaPrice > 0) return sharedHexDcaPrice
    }

    const cacheKey = getPriceCacheKey(network, token, dayBucket)
    if (priceMemoryCache.has(cacheKey)) return priceMemoryCache.get(cacheKey)
    const storageKey = `token_pnl_price_v${PRICE_CACHE_VERSION}:${cacheKey}`
    const storedPrice = Number(safeLocalStorageGet(storageKey))
    if (Number.isFinite(storedPrice) && storedPrice > 0) {
        priceMemoryCache.set(cacheKey, storedPrice)
        return storedPrice
    }
    return null
}

const writeHistoricalPrice = (network, tokenAddress, candleTimestamp, price) => {
    const token = normalizeAddress(tokenAddress)
    const numericPrice = Number(price)
    const timestamp = Number(candleTimestamp)
    if (!token || !Number.isFinite(timestamp) || !Number.isFinite(numericPrice) || numericPrice <= 0) return
    const dayBucket = Math.floor(timestamp / 86400)
    const cacheKey = getPriceCacheKey(network, token, dayBucket)
    priceMemoryCache.set(cacheKey, numericPrice)
    safeLocalStorageSet(`token_pnl_price_v${PRICE_CACHE_VERSION}:${cacheKey}`, String(numericPrice))
}

// V40: the dashboard intentionally displays native PLS + WPLS as one Pulse
// position. Find the earliest real WPLS market observation we have already
// cached so genesis/unknown native PLS can receive a conservative market-based
// estimate instead of silently making the combined position impossible to price.
const findEarliestCachedWplsPrice = () => {
    try {
        const prefix = `token_pnl_price_v${PRICE_CACHE_VERSION}:mainnet:${WPLS_ADDRESS}:`
        let bestDay = Infinity
        let bestPrice = null
        for (let i = 0; i < window.localStorage.length; i += 1) {
            const key = window.localStorage.key(i)
            if (!key || !key.startsWith(prefix)) continue
            const day = Number(key.slice(prefix.length))
            const price = Number(window.localStorage.getItem(key))
            if (Number.isFinite(day) && Number.isFinite(price) && price > 0 && day < bestDay) {
                bestDay = day
                bestPrice = price
            }
        }
        return Number.isFinite(bestPrice) && bestPrice > 0
            ? { day: bestDay, timestamp: bestDay * 86400, price: bestPrice }
            : null
    } catch { return null }
}

const extractDefiLlamaObservations = (entry, requested = []) => {
    const observations = []
    const add = (timestamp, price) => {
        const ts = toUnixSeconds(timestamp)
        const p = Number(price)
        if (ts > 0 && Number.isFinite(p) && p > 0) observations.push({ ts, price: p })
    }

    if (!entry) return observations
    if (Number.isFinite(Number(entry.price))) {
        add(entry.timestamp ?? requested?.[0], entry.price)
    }

    const prices = Array.isArray(entry?.prices) ? entry.prices : (Array.isArray(entry) ? entry : [])
    prices.forEach(item => {
        if (Array.isArray(item)) add(item[0], item[1])
        else if (item && typeof item === "object") add(item.timestamp ?? item.ts ?? item.time, item.price ?? item.value)
    })

    // Some batch responses use a timestamp -> price object.
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        Object.entries(entry).forEach(([key, value]) => {
            if (/^\d{9,13}$/.test(key)) {
                if (value && typeof value === "object") add(key, value.price ?? value.value)
                else add(key, value)
            }
        })
    }
    return observations
}

const prefetchDefiLlamaPrices = async (tokenAddress, timestamps, network = "mainnet") => {
    const token = normalizeAddress(tokenAddress)
    const requested = [...new Set((timestamps ?? []).map(toUnixSeconds).filter(ts => ts > 0))]
    if (!token || requested.length === 0) return false
    if (providerIsCoolingDown("defillama", network, token)) return false

    const chain = DEFILLAMA_CHAIN[network]
    const candidates = []
    if (chain) candidates.push(`${chain}:${token}`)
    const alias = DEFILLAMA_ALIASES[`${network}:${token}`]
    if (alias && !candidates.includes(alias)) candidates.push(alias)

    // DefiLlama documents batchHistorical as a GET endpoint whose `coins`
    // query parameter is a JSON object of coin-id -> timestamp array. V13
    // tried POST first; that made the best free fallback look unavailable on
    // deployments that only expose the documented GET route.
    for (const coinId of candidates) {
        let missing = requested.filter(ts => !readCachedHistoricalPrice(network, token, ts))
        if (missing.length === 0) return true

        try {
            // Keep URLs comfortably below common proxy limits and persist each
            // successful chunk immediately. A shutdown after chunk 2 resumes
            // with only the still-missing dates on the next launch.
            for (let offset = 0; offset < missing.length; offset += 40) {
                const chunk = missing.slice(offset, offset + 40)
                const query = encodeURIComponent(JSON.stringify({ [coinId]: chunk }))
                const url = `${DEFILLAMA_COINS_API}/batchHistorical?coins=${query}&searchWidth=24h`
                const result = await window.electron.fetchJson(url)
                if (!result?.ok) {
                    const error = new Error(result?.error ?? `DefiLlama batch request failed (${result?.status ?? "unknown"})`)
                    error.status = result?.status
                    throw error
                }

                const root = result?.data?.coins ?? result?.data ?? {}
                const entry = root?.[coinId] ?? root?.[coinId.toLowerCase()] ?? null
                const observations = extractDefiLlamaObservations(entry, chunk)
                observations.forEach(({ ts, price }) => writeHistoricalPrice(network, token, ts, price))

                for (const ts of chunk) {
                    if (readCachedHistoricalPrice(network, token, ts)) continue
                    const closest = observations
                        .slice()
                        .sort((a, b) => Math.abs(a.ts - ts) - Math.abs(b.ts - ts))[0]
                    if (closest && Math.abs(closest.ts - ts) <= 36 * 60 * 60) {
                        writeHistoricalPrice(network, token, ts, closest.price)
                    }
                }
            }

            missing = requested.filter(ts => !readCachedHistoricalPrice(network, token, ts))

            // If batchHistorical has no entry for a particular date, use the
            // simpler historical endpoint for a small number of gaps. This is
            // intentionally capped so an obscure token cannot turn startup
            // into hundreds of serial HTTP calls.
            for (const ts of missing.slice(0, 12)) {
                const url = `${DEFILLAMA_COINS_API}/prices/historical/${ts}/${encodeURIComponent(coinId)}?searchWidth=24h`
                const result = await window.electron.fetchJson(url)
                if (!result?.ok) continue
                const root = result?.data?.coins ?? result?.data ?? {}
                const entry = root?.[coinId] ?? root?.[coinId.toLowerCase()] ?? null
                const observations = extractDefiLlamaObservations(entry, [ts])
                const closest = observations
                    .slice()
                    .sort((a, b) => Math.abs(a.ts - ts) - Math.abs(b.ts - ts))[0]
                if (closest && Math.abs(closest.ts - ts) <= 36 * 60 * 60) {
                    writeHistoricalPrice(network, token, ts, closest.price)
                }
            }

            if (requested.some(ts => readCachedHistoricalPrice(network, token, ts))) {
                safeLocalStorageRemove(getProviderFailureKey("defillama", network, token))
                return true
            }
        } catch (error) {
            const status = Number(error?.status ?? 0)
            console.debug("Token P&L v15 DEFILLAMA PRICE FAILED", { network, token, coinId, status })
            if ([400, 401, 403, 404, 429].includes(status)) {
                markProviderFailure("defillama", network, token, status)
            }
        }
    }
    return requested.some(ts => readCachedHistoricalPrice(network, token, ts))
}

const prefetchBinancePrices = async (tokenAddress, timestamps, network = "mainnet") => {
    const token = normalizeAddress(tokenAddress)
    const requested = [...new Set((timestamps ?? []).map(toUnixSeconds).filter(ts => ts > 0))]
    const symbol = BINANCE_HISTORY_SYMBOLS[`${network}:${token}`]
    if (!symbol || requested.length === 0) return false

    let any = false
    for (const ts of requested) {
        if (readCachedHistoricalPrice(network, token, ts)) {
            any = true
            continue
        }

        const dayStartMs = Math.floor(ts / 86400) * 86400 * 1000
        const url =
            `https://data-api.binance.vision/api/v3/klines` +
            `?symbol=${encodeURIComponent(symbol)}` +
            `&interval=1d&startTime=${dayStartMs}` +
            `&endTime=${dayStartMs + 86400000 - 1}&limit=1`

        try {
            const json = await fetchJsonWithRetry(url, { attempts: 2, delay: 900, timeout: 10000 })
            const candle = Array.isArray(json) && Array.isArray(json[0]) ? json[0] : null
            const close = Number(candle?.[4])
            if (Number.isFinite(close) && close > 0) {
                writeHistoricalPrice(network, token, ts, close)
                any = true
            }
        } catch {
            // CoinGecko remains available as the next source.
        }
    }
    return any
}

const prefetchCoinGeckoPrices = async (tokenAddress, timestamps, network = "mainnet") => {
    const token = normalizeAddress(tokenAddress)
    const requested = [...new Set((timestamps ?? []).map(toUnixSeconds).filter(ts => ts > 0))]
    if (!token || requested.length === 0) return false

    if (providerIsCoolingDown("coingecko", network, token)) return false

    const key = `${network}:${token}`
    const coinId = COINGECKO_IDS[key]
    const platform = network === "ethereum" ? "ethereum" : "pulsechain"
    const endpoint = coinId
        ? `${COINGECKO_API}/coins/${encodeURIComponent(coinId)}/market_chart/range`
        : `${COINGECKO_API}/coins/${platform}/contract/${token}/market_chart/range`

    // Fetch only calendar-year windows that contain required transaction days.
    // This avoids one giant multi-year response, makes progress resumable, and
    // lets us persist every daily observation CoinGecko returns rather than only
    // the exact purchase dates that happened to trigger the request.
    const years = [...new Set(requested.map(ts => new Date(ts * 1000).getUTCFullYear()))].sort()
    let any = false

    for (const year of years) {
        const yearRequested = requested.filter(ts => new Date(ts * 1000).getUTCFullYear() === year)
        if (yearRequested.every(ts => readCachedHistoricalPrice(network, token, ts))) {
            any = true
            continue
        }

        const from = Math.floor(Date.UTC(year, 0, 1) / 1000)
        const to = Math.min(
            Math.floor(Date.UTC(year + 1, 0, 2) / 1000),
            Math.floor(Date.now() / 1000)
        )
        const url = `${endpoint}?vs_currency=usd&from=${from}&to=${to}`

        let json
        try {
            json = await fetchJsonWithRetry(url, { attempts: 2, delay: 1800, timeout: 20000 })
        } catch (error) {
            const status = Number(error?.status ?? 0)
            console.debug("Token P&L v15 COINGECKO PRICE FAILED", { network, token, year, status })
            if ([400, 401, 403, 404, 429].includes(status)) {
                markProviderFailure("coingecko", network, token, status)
            }
            break
        }

        const prices = Array.isArray(json?.prices) ? json.prices : []
        if (prices.length === 0) continue

        const normalizedPrices = prices
            .map(item => ({ ts: Math.floor(Number(item?.[0]) / 1000), price: Number(item?.[1]) }))
            .filter(item => Number.isFinite(item.ts) && Number.isFinite(item.price) && item.price > 0)

        // Persist the whole response. Future purchases on a day we already
        // fetched become instant even if that day wasn't part of today's plan.
        normalizedPrices.forEach(item => writeHistoricalPrice(network, token, item.ts, item.price))

        // CoinGecko samples can land a few hours away from UTC midnight. Map
        // each required transaction day to the closest observation as well.
        for (const ts of yearRequested) {
            if (readCachedHistoricalPrice(network, token, ts)) continue
            const closest = normalizedPrices
                .slice()
                .sort((a, b) => Math.abs(a.ts - ts) - Math.abs(b.ts - ts))[0]
            if (closest && Math.abs(closest.ts - ts) <= 4 * 86400) {
                writeHistoricalPrice(network, token, ts, closest.price)
            }
        }

        if (yearRequested.some(ts => readCachedHistoricalPrice(network, token, ts))) any = true
    }

    if (any) safeLocalStorageRemove(getProviderFailureKey("coingecko", network, token))
    return any
}

/*
 * V10 prices transactions in batches. A single OHLCV response can contain up
 * to 1000 daily candles, so we fetch broad windows once per token/network and
 * cache every returned day. The accounting loop then performs zero Gecko
 * requests in the normal case.
 */
const prefetchHistoricalTokenPrices = async (tokenAddress, timestamps, network = "mainnet", options = {}) => {
    const token = normalizeAddress(tokenAddress)
    const source = PRICE_SOURCES[network] ?? PRICE_SOURCES.mainnet
    const requested = [...new Set((timestamps ?? []).map(toUnixSeconds).filter(ts => ts > 0))]
    if (!token || requested.length === 0) return

    if (network === "ethereum" && ETHEREUM_USD_STABLECOINS.has(token)) {
        requested.forEach(ts => writeHistoricalPrice(network, token, ts, 1))
        return
    }

    let missing = requested.filter(ts => !readCachedHistoricalPrice(network, token, ts))
    if (missing.length === 0) return

    // V15: PulseChain pricing starts from historical PulseX reserves at the
    // actual transaction block. Only gaps fall through to outside APIs.
    if (network === "mainnet") {
        await prefetchPulseXOnChainPrices(
            token,
            missing,
            options?.blockByDay ?? {},
            options?.settings ?? defaultSettings,
            options?.decimals ?? 18
        )
        missing = missing.filter(ts => !readCachedHistoricalPrice(network, token, ts))
        if (missing.length === 0) return
    }

    // Price the wallet's PAYMENT LEG. Deep exchange history handles BTC/ETH;
    // deep exchange history for BTC/ETH, then DefiLlama's batched contract
    // history, then CoinGecko, with GeckoTerminal only as the final on-chain
    // fallback. Successful days are persisted regardless of provider.
    await prefetchBinancePrices(token, missing, network)
    missing = missing.filter(ts => !readCachedHistoricalPrice(network, token, ts))
    if (missing.length === 0) return

    await prefetchDefiLlamaPrices(token, missing, network)
    missing = missing.filter(ts => !readCachedHistoricalPrice(network, token, ts))
    if (missing.length === 0) return

    await prefetchCoinGeckoPrices(token, missing, network)
    missing = missing.filter(ts => !readCachedHistoricalPrice(network, token, ts))
    if (missing.length === 0) return

    if (providerIsCoolingDown("geckoterminal", network, token)) return

    const pool = await getTopPool(token, network)
    if (!pool?.address) return

    const attemptedBefore = new Set()
    let requestCount = 0
    while (missing.length > 0 && requestCount < 6) {
        const newestMissing = Math.max(...missing)
        const beforeTimestamp = newestMissing + 86400
        const beforeDay = Math.floor(beforeTimestamp / 86400)
        if (attemptedBefore.has(beforeDay)) break
        attemptedBefore.add(beforeDay)

        const url =
            `${GECKO_API}/networks/${source.geckoNetwork}/pools/${pool.address}` +
            `/ohlcv/day?aggregate=1&limit=1000&currency=usd` +
            `&token=${encodeURIComponent(token)}` +
            `&before_timestamp=${beforeTimestamp}` +
            `&include_empty_intervals=true`

        requestCount += 1
        let json
        try {
            json = await fetchJsonWithRetry(url, { attempts: 3, delay: 2000, timeout: 15000 })
        } catch (error) {
            console.debug("Token P&L v15 BATCH PRICE FAILED", {
                network, token, status: error?.status ?? null, requestCount
            })
            if ([401, 403, 429].includes(Number(error?.status))) {
                markProviderFailure("geckoterminal", network, token, error?.status)
            }
            break
        }

        safeLocalStorageRemove(getProviderFailureKey("geckoterminal", network, token))
        const candles = json?.data?.attributes?.ohlcv_list ?? []
        if (!Array.isArray(candles) || candles.length === 0) break
        candles.forEach(candle => writeHistoricalPrice(network, token, Number(candle?.[0]), Number(candle?.[4])))

        // If a requested day is a market-gap day, accept the closest candle
        // within 72 hours rather than issuing another request for the same gap.
        for (const ts of missing) {
            if (readCachedHistoricalPrice(network, token, ts)) continue
            const closest = selectClosestCandlePrice(candles, ts)
            const closestCandle = candles
                .map(c => ({ ts: Number(c?.[0]), close: Number(c?.[4]) }))
                .filter(c => Number.isFinite(c.ts) && Number.isFinite(c.close) && c.close > 0)
                .sort((a, b) => Math.abs(a.ts - ts) - Math.abs(b.ts - ts))[0]
            if (closest && closestCandle && Math.abs(closestCandle.ts - ts) <= 3 * 86400) {
                writeHistoricalPrice(network, token, ts, closest)
            }
        }

        const priorMissing = missing.length
        missing = missing.filter(ts => !readCachedHistoricalPrice(network, token, ts))
        if (missing.length === 0) break

        // If all remaining dates are older than this 1000-candle window, the
        // next iteration naturally jumps directly to the newest old date.
        const oldestReturned = Math.min(...candles.map(c => Number(c?.[0])).filter(Number.isFinite))
        if (Number.isFinite(oldestReturned)) {
            const insideWindowUnpriced = missing.filter(ts => ts >= oldestReturned - 3 * 86400)
            if (insideWindowUnpriced.length > 0 && missing.length === priorMissing) break
        }
    }
}

const fetchHistoricalTokenPrice = async (tokenAddress, timestamp, network = "mainnet") => {
    const cached = readCachedHistoricalPrice(network, tokenAddress, timestamp)
    if (cached) return cached
    await prefetchHistoricalTokenPrices(tokenAddress, [timestamp], network)
    return readCachedHistoricalPrice(network, tokenAddress, timestamp)
}
const transferIdentity = transfer => {
    const hash = String(transfer?.transaction_hash ?? transfer?.transaction?.hash ?? transfer?.hash ?? "").toLowerCase()
    const token = normalizeAddress(transfer?.token?.address_hash ?? transfer?.token?.address ?? transfer?.token_address ?? transfer?.tokenAddress)
    const from = normalizeAddress(transfer?.from?.hash ?? transfer?.from)
    const to = normalizeAddress(transfer?.to?.hash ?? transfer?.to)
    const rawValue = String(transfer?.total?.value ?? transfer?.value ?? "0")
    const logIndex = String(transfer?.log_index ?? transfer?.index ?? "")
    return `${hash}:${logIndex}:${token}:${from}:${to}:${rawValue}`
}

const mergeTransfers = (...lists) => {
    const merged = new Map()
    lists.flat().filter(Boolean).forEach(transfer => {
        const key = transferIdentity(transfer)
        if (key && !merged.has(key)) merged.set(key, transfer)
    })
    return [...merged.values()].sort((a, b) =>
        Number(a?.block_number ?? 0) - Number(b?.block_number ?? 0) ||
        Number(a?.timestamp ?? 0) - Number(b?.timestamp ?? 0)
    )
}

const getTransferCacheKey = (network, wallet) =>
    `token_pnl_transfers_v${TRANSFER_CACHE_VERSION}:${network}:${normalizeAddress(wallet)}`

const readTransferCache = (network, wallet) => {
    const stored = safeLocalStorageGet(getTransferCacheKey(network, wallet))
    if (!stored) return { transfers: [], lastBlock: 0, complete: false }
    try {
        const parsed = JSON.parse(stored)
        return {
            transfers: Array.isArray(parsed?.transfers) ? parsed.transfers : [],
            lastBlock: Number(parsed?.lastBlock ?? 0),
            lastTimestamp: Number(parsed?.lastTimestamp ?? 0),
            complete: Boolean(parsed?.complete),
            cachedAt: Number(parsed?.cachedAt ?? 0)
        }
    } catch {
        return { transfers: [], lastBlock: 0, complete: false }
    }
}

const writeTransferCache = (network, wallet, transfers, { complete = false } = {}) => {
    const merged = mergeTransfers(transfers)
    const last = merged[merged.length - 1]
    safeLocalStorageSet(getTransferCacheKey(network, wallet), JSON.stringify({
        transfers: merged,
        lastBlock: Number(last?.block_number ?? 0),
        lastTimestamp: Number(last?.timestamp ?? 0),
        complete,
        cachedAt: Date.now()
    }))
    return merged
}

const getCheckpointKey = (walletKey, tokenKey) =>
    `token_pnl_checkpoint_v${CHECKPOINT_CACHE_VERSION}:${walletKey}:${tokenKey}`

const writeCheckpoint = (walletKey, tokenKey, value) => {
    safeLocalStorageSet(getCheckpointKey(walletKey, tokenKey), JSON.stringify({
        ...value,
        updatedAt: Date.now()
    }))
}

const getAccountingCheckpointKey = (walletKey, tokenKey) =>
    `token_pnl_accounting_v${ACCOUNTING_CACHE_VERSION}:${walletKey}:${tokenKey}`

const readAccountingCheckpoint = (walletKey, tokenKey) => {
    const stored = safeLocalStorageGet(getAccountingCheckpointKey(walletKey, tokenKey))
    if (!stored) return null
    try { return JSON.parse(stored) } catch { return null }
}

const writeAccountingCheckpoint = (walletKey, tokenKey, value) => {
    safeLocalStorageSet(getAccountingCheckpointKey(walletKey, tokenKey), JSON.stringify({
        ...value,
        updatedAt: Date.now()
    }))
}

const getProviderFailureKey = (provider, network, token) =>
    `token_pnl_provider_fail_v${PROVIDER_FAILURE_CACHE_VERSION}:${provider}:${network}:${normalizeAddress(token)}`

const providerIsCoolingDown = (provider, network, token) => {
    const stored = safeLocalStorageGet(getProviderFailureKey(provider, network, token))
    if (!stored) return false
    try {
        const parsed = JSON.parse(stored)
        const status = Number(parsed?.status ?? 0)
        const ttl = status === 429 ? 10 * 60 * 1000 : PROVIDER_FAILURE_TTL_MS
        return Date.now() - Number(parsed?.failedAt ?? 0) < ttl
    } catch { return false }
}

const markProviderFailure = (provider, network, token, status) => {
    safeLocalStorageSet(getProviderFailureKey(provider, network, token), JSON.stringify({
        failedAt: Date.now(),
        status: Number(status ?? 0)
    }))
}

const serializeTransfers = transfers =>
    (transfers ?? []).map(transfer => ({
        tokenAddress: normalizeAddress(transfer?.tokenAddress),
        from: normalizeAddress(transfer?.from),
        to: normalizeAddress(transfer?.to),
        value: String(transfer?.value ?? "0")
    }))

const getReceiptCacheKey = hash =>
    `token_pnl_receipt_v${RECEIPT_CACHE_VERSION}:${String(hash ?? "").toLowerCase()}`

const readReceiptCache = hash => {
    const stored = safeLocalStorageGet(getReceiptCacheKey(hash))
    if (!stored) return null

    try {
        const parsed = JSON.parse(stored)
        if (!Array.isArray(parsed?.transfers)) return null
        return parsed
    } catch {
        return null
    }
}

const writeReceiptCache = (hash, receiptResult) => {
    safeLocalStorageSet(
        getReceiptCacheKey(hash),
        JSON.stringify({
            transfers: serializeTransfers(receiptResult?.transfers),
            timestamp: receiptResult?.timestamp ?? null,
            blockNumber: receiptResult?.blockNumber ?? null
        })
    )
}

const activityTouchesTrackedToken = (activity, trackedTokenSet) => {
    if (
        !activity?.hash ||
        activity?.status === "error" ||
        activity?.result === "error"
    ) {
        return false
    }

    const method = String(activity?.method ?? "").toLowerCase()

    // These can hide the final token transfer in the explorer summary.
    if (method.includes("swap") || method.includes("multicall")) {
        return true
    }

    const transfers = Array.isArray(activity?.token_transfers)
        ? activity.token_transfers
        : []

    return transfers.some(transfer => {
        const tokenAddress = normalizeAddress(
            transfer?.token?.address ?? transfer?.token?.address_hash
        )
        return trackedTokenSet.has(tokenAddress)
    })
}

const getResultCacheKey = ({ walletKey, tokenKey }) =>
    `token_pnl_result_v${RESULT_CACHE_VERSION}:${walletKey}:${tokenKey}`

const readResultCache = key => {
    const stored = safeLocalStorageGet(key)
    if (!stored) return null

    try {
        const parsed = JSON.parse(stored)
        if (!parsed?.positions || !parsed?.cachedAt) return null
        return parsed
    } catch {
        return null
    }
}

const writeResultCache = (key, value) => {
    safeLocalStorageSet(
        key,
        JSON.stringify({
            ...value,
            cachedAt: Date.now()
        })
    )
}

const buildTrackedTokens = (watchlist, currentBalances, visibleWalletAddresses) => {
    const candidateAddresses = new Set(
        Object.keys(defaultTokenInformation).map(normalizeAddress)
    )

    Object.values(watchlist ?? {}).forEach(item => {
        const address = normalizeAddress(
            item?.token?.address ??
            item?.token0?.id ??
            item?.token1?.id
        )
        if (address) candidateAddresses.add(address)
    })

    // P&L is only useful for positions that are actually held.  Filtering here
    // dramatically reduces historical scans and price lookups on long watchlists.
    return [...candidateAddresses]
        .filter(Boolean)
        .filter(token => {
            return visibleWalletAddresses.some(wallet => {
                const raw = currentBalances?.[wallet]?.balances?.[token]?.raw
                if (raw == null) return false
                try {
                    return BigInt(String(raw)) > 0n
                } catch {
                    return Number(currentBalances?.[wallet]?.balances?.[token]?.normalized ?? 0) > 0
                }
            })
        })
}

export default function useTokenPnl({
    wallets = {},
    hiddenWallets = [],
    watchlist = {},
    currentBalances = {},
    settings = defaultSettings,
    enabled = true
} = {}) {
    const [positions, setPositions] = useState({})
    const [walletPositions, setWalletPositions] = useState({})
    const [loading, setLoading] = useState(false)
    const [activeTokens, setActiveTokens] = useState([])
    const [progress, setProgress] = useState({ stage: "idle", current: 0, total: 0 })
    const [errors, setErrors] = useState([])

    // V32: P&L reconstruction is keyed to the complete watched-wallet universe,
    // not the currently visible subset. Hiding/showing wallets must be a cheap
    // aggregation operation and must never trigger another explorer/history scan.
    const allWalletAddresses = useMemo(() => Object.keys(wallets ?? {})
        .map(normalizeAddress)
        .filter(Boolean)
        .sort(), [wallets])

    const visibleWalletAddresses = useMemo(() => {
        const hidden = new Set((hiddenWallets ?? []).map(normalizeAddress))
        return allWalletAddresses.filter(address => !hidden.has(address))
    }, [allWalletAddresses, hiddenWallets])

    const currentBalanceKey = useMemo(() => {
        return allWalletAddresses.map(wallet => {
            const held = Object.entries(currentBalances?.[wallet]?.balances ?? {})
                .filter(([, value]) => {
                    try { return BigInt(String(value?.raw ?? 0)) > 0n }
                    catch { return Number(value?.normalized ?? 0) > 0 }
                })
                .map(([token]) => normalizeAddress(token))
                .sort()
            return `${wallet}:${held.join(",")}`
        }).join("|")
    }, [currentBalances, allWalletAddresses])

    const trackedTokens = useMemo(
        () => buildTrackedTokens(watchlist, currentBalances, allWalletAddresses),
        [watchlist, currentBalanceKey, allWalletAddresses]
    )

    // scanWalletKey is intentionally independent from visibility filters.
    const walletKey = allWalletAddresses.join("|")
    const visibleWalletKey = visibleWalletAddresses.join("|")
    const tokenKey = trackedTokens.join("|")

    // V32: aggregate already-computed wallet ledgers locally. No RPC/explorer work
    // is needed when the user changes which wallets are visible. Cost basis is
    // additive; average entry is always total basis / total remaining units.
    useEffect(() => {
        if (visibleWalletAddresses.length === 0) {
            setPositions({})
            return
        }
        const aggregated = {}
        for (const token of trackedTokens) {
            // Only wallets that currently hold this token participate in its
            // weighted aggregate. A visible wallet with a zero balance must not
            // make another wallet's otherwise-complete ledger look incomplete.
            const holderWallets = visibleWalletAddresses.filter(wallet =>
                Number(currentBalances?.[wallet]?.balances?.[token]?.normalized ?? 0) > 0
            )
            const parts = holderWallets
                .map(wallet => walletPositions?.[wallet]?.[token])
                .filter(Boolean)
            if (parts.length === 0) continue
            const seed = {
                tokenAddress: token,
                symbol: parts.find(p => p?.symbol)?.symbol ?? "",
                decimals: Number(parts.find(p => Number.isFinite(Number(p?.decimals)))?.decimals ?? 18),
                units: 0, costBasisUsd: 0, acquisitionCount: 0, disposalCount: 0,
                pricedAcquisitionCount: 0, unpricedAcquisitionCount: 0,
                transferDateBasisCount: 0, actualSpendBasisCount: 0,
                allocatedSpendBasisCount: 0, zeroBasisAcquisitionCount: 0,
                internalTransferBasisCount: 0, stakedUnits: 0, stakedCostBasisUsd: 0,
                stakeEstimatedBasisUnits: 0, unknownDisposedUnits: 0, lastEventTimestamp: null
            }
            const summed = parts.reduce((acc, p) => {
                for (const key of [
                    "units", "costBasisUsd", "acquisitionCount", "disposalCount",
                    "pricedAcquisitionCount", "unpricedAcquisitionCount",
                    "transferDateBasisCount", "actualSpendBasisCount",
                    "allocatedSpendBasisCount", "zeroBasisAcquisitionCount",
                    "internalTransferBasisCount", "stakedUnits", "stakedCostBasisUsd",
                    "stakeEstimatedBasisUnits", "unknownDisposedUnits"
                ]) acc[key] += Number(p?.[key] ?? 0)
                acc.lastEventTimestamp = Math.max(Number(acc.lastEventTimestamp ?? 0), Number(p?.lastEventTimestamp ?? 0)) || null
                return acc
            }, seed)
            const methods = [...new Set(parts.map(p => p?.basisMethod).filter(Boolean))]
            aggregated[token] = {
                ...summed,
                averageEntry: summed.units > 0 && summed.costBasisUsd > 0 ? summed.costBasisUsd / summed.units : null,
                basisMethod: methods.length === 1 ? methods[0] : methods.length > 1 ? "mixed-estimate" : "historical-market",
                // Weighted P&L is only trustworthy when every currently-held
                // wallet has a complete ledger. Cost basis and units are summed;
                // percentages are never averaged wallet-by-wallet.
                complete: parts.length === holderWallets.length && parts.every(p => p?.complete !== false)
            }
        }
        setPositions(aggregated)
    }, [walletPositions, visibleWalletKey, tokenKey, currentBalanceKey])

    useEffect(() => {
        let cancelled = false

        const getAddress = value => normalizeAddress(value?.hash ?? value)
        const getTokenAddress = transfer => normalizeAddress(
            transfer?.token?.address_hash ??
            transfer?.token?.address ??
            transfer?.token_address ??
            transfer?.tokenAddress
        )
        const getTransferRawValue = transfer => String(
            transfer?.total?.value ?? transfer?.value ?? "0"
        )
        const getHash = transfer => String(
            transfer?.transaction_hash ??
            transfer?.transaction?.hash ??
            transfer?.hash ?? ""
        ).toLowerCase()
        const getTimestamp = transfer => toUnixSeconds(
            transfer?.timestamp ?? transfer?.transaction?.timestamp
        )
        const getBlockNumber = transfer => Number(
            transfer?.block_number ?? transfer?.block ?? 0
        )
        const getMethod = transfer => String(
            transfer?.method ?? transfer?.transaction?.method ?? ""
        )

        const load = async () => {
            if (!enabled) {
                setLoading(false)
                return
            }

            if (allWalletAddresses.length === 0 || trackedTokens.length === 0) {
                setPositions({})
                setWalletPositions({})
                setLoading(false)
                setErrors([])
                setProgress({ stage: "idle", current: 0, total: 0 })
                setActiveTokens([])
                return
            }

            // V32 no longer caches a selected wallet-set result. Instead, every
            // wallet/token ledger is persisted independently and the visible result
            // is assembled locally. This prevents the combinatorial cache explosion
            // caused by 2^N possible wallet visibility combinations.
            const resultCacheKey = getResultCacheKey({ walletKey, tokenKey })

            // Warm-start the UI from persistent per-wallet caches before doing any
            // freshness checks. When the watched-wallet universe is unchanged this
            // makes app launch and visibility toggles effectively immediate.
            const warmWalletPositions = {}
            for (const wallet of allWalletAddresses) {
                for (const token of trackedTokens) {
                    try {
                        let raw = safeLocalStorageGet(`token_pnl_wallet_v41:${wallet}:${token}`)
                        if (!raw) raw = safeLocalStorageGet(`token_pnl_wallet_v40:${wallet}:${token}`)
                        if (!raw) raw = safeLocalStorageGet(`token_pnl_wallet_v37:${wallet}:${token}`)
                        if (!raw) raw = safeLocalStorageGet(`token_pnl_wallet_v34:${wallet}:${token}`)
                        if (!raw && token !== HEX_ADDRESS && token !== WPLS_ADDRESS) {
                            raw = safeLocalStorageGet(`token_pnl_wallet_v32:${wallet}:${token}`)
                        }
                        if (!raw) continue
                        const parsed = JSON.parse(raw)
                        if (!parsed?.position) continue
                        if (!warmWalletPositions[wallet]) warmWalletPositions[wallet] = {}
                        warmWalletPositions[wallet][token] = parsed.position
                    } catch {}
                }
            }
            if (Object.keys(warmWalletPositions).length > 0) setWalletPositions(warmWalletPositions)

            setLoading(true)
            setErrors([])
            setActiveTokens([])
            setProgress({ stage: "transfers", current: 0, total: 0 })

            console.info("Token P&L v34 START", JSON.stringify({
                wallets: allWalletAddresses.length,
                visibleWallets: visibleWalletAddresses.length,
                trackedTokens: trackedTokens.length
            }))

            try {
                const walletSet = new Set(allWalletAddresses)
                const trackedTokenSet = new Set(trackedTokens)

                /*
                 * V6 deliberately starts from Blockscout's token-transfer index,
                 * not the general transaction feed. Routers/bridges/multicalls can
                 * hide ERC-20 movements from transaction summaries; the transfer
                 * index contains the actual wallet movements we need for cost basis.
                 */
                // V10 scans BOTH sides of the PulseChain fork. Tokens such as copied
                // DAI/WBTC/HEX may have entered the wallet on Ethereum before the
                // snapshot and therefore have no PulseChain acquisition transfer at all.
                const transferResults = {}
                for (const network of ["ethereum", "mainnet"]) {
                    transferResults[network] = { transfers: {}, errors: {} }

                    for (const wallet of allWalletAddresses) {
                        if (cancelled) return
                        const cachedTransferState = readTransferCache(network, wallet)
                        let accumulatedTransfers = cachedTransferState.transfers
                        const ethereumHistoryComplete = network === "ethereum" && cachedTransferState.complete

                        // Ethereum history before the fork is immutable. Once it has
                        // completed successfully, never download it again. PulseChain
                        // resumes at the most recently cached block and de-duplicates
                        // that boundary block, which protects against app shutdowns
                        // in the middle of a page.
                        if (!ethereumHistoryComplete) {
                            const startBlock = Math.max(0, Number(cachedTransferState.lastBlock ?? 0))
                            const endBlock = network === "ethereum"
                                ? ETHEREUM_FORK_BLOCK - 1
                                : 99999999

                            try {
                                const freshTransfers = await fetchCompleteAddressTokenTransfers(
                                    wallet,
                                    network,
                                    settings,
                                    {
                                        maxPages: 250,
                                        pageSize: 250,
                                        delayBetweenPages: 120,
                                        retryAttempts: 4,
                                        startBlock,
                                        endBlock,
                                        onPage: info => {
                                            if (cancelled) return
                                            accumulatedTransfers = writeTransferCache(
                                                network,
                                                wallet,
                                                mergeTransfers(accumulatedTransfers, info?.transfers ?? []),
                                                { complete: false }
                                            )
                                            writeCheckpoint(walletKey, tokenKey, {
                                                stage: network === "ethereum" ? "ethereum-transfers" : "pulsechain-transfers",
                                                network,
                                                wallet,
                                                page: Number(info?.page ?? 0),
                                                collected: accumulatedTransfers.length,
                                                lastBlock: Number(accumulatedTransfers.at(-1)?.block_number ?? 0)
                                            })
                                        },
                                        onProgress: info => {
                                            if (cancelled) return
                                            setProgress({
                                                stage: network === "ethereum" ? "ethereum-transfers" : "pulsechain-transfers",
                                                current: Number(info?.page ?? 0),
                                                total: 0,
                                                collected: accumulatedTransfers.length || Number(info?.collected ?? 0),
                                                wallet: info?.address
                                            })
                                        }
                                    }
                                )
                                accumulatedTransfers = writeTransferCache(
                                    network,
                                    wallet,
                                    mergeTransfers(accumulatedTransfers, freshTransfers),
                                    { complete: true }
                                )
                            } catch (error) {
                                // Keep every successfully persisted page. The next
                                // launch resumes from the last cached block instead of
                                // throwing away minutes of explorer work.
                                transferResults[network].errors[wallet] = error?.message ?? "Unable to update token-transfer history"
                                accumulatedTransfers = readTransferCache(network, wallet).transfers
                            }
                        }

                        transferResults[network].transfers[wallet] = accumulatedTransfers
                    }
                }

                writeCheckpoint(walletKey, tokenKey, {
                    stage: "transfers-complete",
                    networks: Object.fromEntries(Object.entries(transferResults).map(([network, result]) => [network,
                        Object.values(result?.transfers ?? {}).reduce((sum, items) => sum + (items?.length ?? 0), 0)
                    ]))
                })

                const transferSummary = Object.fromEntries(
                    Object.entries(transferResults).map(([network, result]) => [network, {
                        totalTransfers: Object.values(result?.transfers ?? {}).reduce((sum, items) => sum + (items?.length ?? 0), 0),
                        errors: result?.errors ?? {}
                    }])
                )
                console.info("Token P&L v18 TRANSFERS", JSON.stringify(transferSummary))

                const scanErrors = Object.entries(transferResults).flatMap(([network, result]) =>
                    Object.entries(result?.errors ?? {}).map(([wallet, message]) => ({ network, wallet, message }))
                )

                // PRVX is distributed from the ProveX sacrifice set before normal
                // trading begins, so its receipt transactions have no payment leg.
                // Reconstruct its economic basis from sacrifices sent by the same
                // tracked Ethereum addresses during the sacrifice window. This scan
                // is separate from the pre-fork Ethereum history used for copied
                // PulseChain assets and is cached permanently per wallet.
                let prvxSacrificeTransfers = []
                let prvxNativeSacrifices = []
                if (trackedTokenSet.has(PRVX_ADDRESS)) {
                    for (const wallet of allWalletAddresses) {
                        if (cancelled) return
                        let cachedSac = readPrvxSacrificeCache(wallet)
                        if (!cachedSac?.complete) {
                            try {
                                const tokenTransfers = await fetchCompleteAddressTokenTransfers(
                                    wallet, "ethereum", settings,
                                    { maxPages: 50, pageSize: 250, delayBetweenPages: 80, retryAttempts: 3,
                                      startBlock: PRVX_SACRIFICE_START_BLOCK, endBlock: PRVX_SACRIFICE_END_BLOCK }
                                )
                                const outgoing = tokenTransfers.filter(t =>
                                    normalizeAddress(t?.from) === normalizeAddress(wallet) &&
                                    normalizeAddress(t?.to) === PRVX_SACRIFICE_ADDRESS
                                )
                                const native = await fetchPrvxNativeSacrifices(wallet, settings)
                                cachedSac = writePrvxSacrificeCache(wallet, { complete: true, tokenTransfers: outgoing, native })
                            } catch (error) {
                                cachedSac = { complete: false, tokenTransfers: [], native: [], error: error?.message }
                            }
                        }
                        prvxSacrificeTransfers.push(...(cachedSac?.tokenTransfers ?? []))
                        prvxNativeSacrifices.push(...(cachedSac?.native ?? []))
                    }
                    console.info("Token P&L v28 PRVX SACRIFICE SCAN", JSON.stringify({
                        tokenTransfers: prvxSacrificeTransfers.length,
                        nativeTransfers: prvxNativeSacrifices.length
                    }))
                }

                // De-duplicate logs per network. Ethereum and PulseChain share many
                // contract addresses and can even share transaction hashes, so the
                // network is part of every event key.
                const uniqueTransfers = new Map()
                Object.entries(transferResults).forEach(([network, result]) => {
                    Object.values(result?.transfers ?? {}).flat().forEach(transfer => {
                        const blockNumber = getBlockNumber(transfer)
                        if (network === "ethereum" && blockNumber >= ETHEREUM_FORK_BLOCK) return
                        if (network === "mainnet" && blockNumber > 0 && blockNumber < ETHEREUM_FORK_BLOCK) return

                        const hash = getHash(transfer)
                        const token = getTokenAddress(transfer)
                        const from = getAddress(transfer?.from)
                        const to = getAddress(transfer?.to)
                        const raw = getTransferRawValue(transfer)
                        const logIndex = String(transfer?.log_index ?? transfer?.index ?? "")
                        if (!hash || !token) return
                        const key = `${network}:${hash}:${logIndex}:${token}:${from}:${to}:${raw}`
                        if (!uniqueTransfers.has(key)) uniqueTransfers.set(key, { ...transfer, pnlNetwork: network })
                    })
                })

                // Group every transfer touching one of our wallets by transaction.
                const eventMap = new Map()
                for (const transfer of uniqueTransfers.values()) {
                    const network = transfer?.pnlNetwork ?? "mainnet"
                    const hash = getHash(transfer)
                    const token = getTokenAddress(transfer)
                    const from = getAddress(transfer?.from)
                    const to = getAddress(transfer?.to)
                    if (!walletSet.has(from) && !walletSet.has(to)) continue

                    const eventKey = `${network}:${hash}`
                    let event = eventMap.get(eventKey)
                    if (!event) {
                        event = {
                            network,
                            hash,
                            timestamp: getTimestamp(transfer),
                            blockNumber: getBlockNumber(transfer),
                            method: getMethod(transfer),
                            transfers: [],
                            deltas: Object.fromEntries(trackedTokens.map(t => [t, 0n])),
                            walletDeltas: {},
                            nativeValueRaw: "0",
                            from: ""
                        }
                        eventMap.set(eventKey, event)
                    }
                    if (!event.timestamp) event.timestamp = getTimestamp(transfer)
                    if (!event.blockNumber) event.blockNumber = getBlockNumber(transfer)
                    if (!event.method) event.method = getMethod(transfer)

                    const raw = BigInt(getTransferRawValue(transfer) || "0")
                    event.transfers.push({ tokenAddress: token, from, to, value: raw.toString() })
                    if (trackedTokenSet.has(token)) {
                        if (walletSet.has(to)) {
                            event.deltas[token] += raw
                            if (!event.walletDeltas[to]) event.walletDeltas[to] = {}
                            event.walletDeltas[to][token] = (event.walletDeltas[to][token] ?? 0n) + raw
                        }
                        if (walletSet.has(from)) {
                            event.deltas[token] -= raw
                            if (!event.walletDeltas[from]) event.walletDeltas[from] = {}
                            event.walletDeltas[from][token] = (event.walletDeltas[from][token] ?? 0n) - raw
                        }
                    }
                }

                const events = [...eventMap.values()]
                    .filter(event => Object.values(event.walletDeltas ?? {}).some(deltas => Object.values(deltas ?? {}).some(delta => delta !== 0n)))
                    .filter(event => Number.isFinite(event.timestamp) && event.timestamp > 0)
                    .sort((a, b) => a.timestamp - b.timestamp || a.blockNumber - b.blockNumber)

                console.info("Token P&L v18 EVENTS", JSON.stringify({
                    uniqueTransfers: uniqueTransfers.size,
                    transactionEvents: events.length
                }))

                // Fetch metadata for held assets plus assets that actually left the
                // wallet in a tracked acquisition transaction.
                const paymentTokenSet = new Set()
                events.forEach(event => {
                    const hasIncomingTracked = trackedTokens.some(t => event.deltas[t] > 0n)
                    if (!hasIncomingTracked) return
                    event.transfers.forEach(transfer => {
                        const token = normalizeAddress(transfer.tokenAddress)
                        if (token && walletSet.has(normalizeAddress(transfer.from)) && !walletSet.has(normalizeAddress(transfer.to))) {
                            paymentTokenSet.add(token)
                        }
                    })
                })

                prvxSacrificeTransfers.forEach(transfer => {
                    const token = getTokenAddress(transfer)
                    if (token) paymentTokenSet.add(token)
                })

                const allInfoTokens = [...new Set([...trackedTokens, ...paymentTokenSet])]
                const tokenInfo = await batchFetchTokenInfo(allInfoTokens, "mainnet", settings)
                if (cancelled) return
                console.info("Token P&L v18 TOKEN INFO", JSON.stringify({
                    requested: allInfoTokens.length,
                    resolved: Object.keys(tokenInfo ?? {}).length
                }))

                console.info("Token P&L v18 EVENT SAMPLE", JSON.stringify(events.slice(0, 8).map(event => ({
                    network: event.network,
                    hash: event.hash,
                    timestamp: event.timestamp,
                    method: event.method,
                    deltas: Object.fromEntries(Object.entries(event.deltas).filter(([,v]) => v !== 0n).map(([k,v]) => [k, v.toString()])),
                    transferCount: event.transfers.length
                }))))

                let workingPositions = trackedTokens.reduce((acc, token) => {
                    acc[token] = {
                        tokenAddress: token,
                        symbol: tokenInfo?.[token]?.symbol ?? defaultTokenInformation?.[token]?.symbol ?? "",
                        decimals: Number(tokenInfo?.[token]?.decimals ?? defaultTokenInformation?.[token]?.decimals ?? 18),
                        units: 0,
                        costBasisUsd: 0,
                        acquisitionCount: 0,
                        disposalCount: 0,
                        pricedAcquisitionCount: 0,
                        unpricedAcquisitionCount: 0,
                        transferDateBasisCount: 0,
                        actualSpendBasisCount: 0,
                        allocatedSpendBasisCount: 0,
                        zeroBasisAcquisitionCount: 0,
                        unknownDisposedUnits: 0,
                        lastEventTimestamp: null
                    }
                    return acc
                }, {})

                const firstEvent = events[0]
                const lastEvent = events[events.length - 1]
                const eventFingerprint = [
                    events.length,
                    firstEvent ? `${firstEvent.network}:${firstEvent.hash}:${firstEvent.blockNumber}` : "none",
                    lastEvent ? `${lastEvent.network}:${lastEvent.hash}:${lastEvent.blockNumber}` : "none",
                    trackedTokens.join(",")
                ].join("|")
                const savedAccounting = readAccountingCheckpoint(walletKey, tokenKey)
                let accountingStartIndex = 0
                if (
                    savedAccounting?.eventFingerprint === eventFingerprint &&
                    savedAccounting?.positions &&
                    Number.isInteger(Number(savedAccounting?.nextEventIndex)) &&
                    Number(savedAccounting.nextEventIndex) >= 0 &&
                    Number(savedAccounting.nextEventIndex) <= events.length
                ) {
                    workingPositions = savedAccounting.positions
                    accountingStartIndex = Number(savedAccounting.nextEventIndex)
                    console.info("Token P&L v18 ACCOUNTING RESUME", JSON.stringify({
                        nextEventIndex: accountingStartIndex,
                        totalEvents: events.length
                    }))
                }

                const historicalPriceCache = new Map()
                const getHistoricalPrice = async (token, timestamp, network = "mainnet") => {
                    const dayBucket = Math.floor(timestamp / 86400)
                    const key = `${network}:${token}:${dayBucket}`
                    if (historicalPriceCache.has(key)) return historicalPriceCache.get(key)
                    const value = await fetchHistoricalTokenPrice(token, timestamp, network)
                    historicalPriceCache.set(key, value ?? null)
                    return value
                }

                // V37: very early WPLS receipts can pre-date the stable-anchor pools
                // used by our exact transaction-day price reconstruction. WPLS is a
                // 1:1 wrapper for PLS, so for those old receipts use the first real
                // WPLS market observation AFTER the acquisition rather than leaving
                // the position permanently unpriced. This is intentionally one-way
                // (future only) and capped at 60 days so we never pull a later bull/
                // bear-market price backward across a long period.
                const getHistoricalPriceWithWplsBootstrap = async (token, timestamp, network = "mainnet") => {
                    const exact = await getHistoricalPrice(token, timestamp, network)
                    if (Number.isFinite(exact) && exact > 0) return { price: exact, bootstrapDays: 0 }
                    if (network !== "mainnet" || normalizeAddress(token) !== WPLS_ADDRESS) return { price: null, bootstrapDays: null }

                    const offsets = [1, 3, 7, 14, 30, 60]
                    for (const days of offsets) {
                        const futureTs = Number(timestamp) + days * 86400
                        const future = await getHistoricalPrice(token, futureTs, network)
                        if (Number.isFinite(future) && future > 0) {
                            console.info("Token P&L v37 WPLS BOOTSTRAP PRICE", JSON.stringify({
                                originalTimestamp: Number(timestamp),
                                pricedTimestamp: futureTs,
                                daysForward: days,
                                price: future
                            }))
                            return { price: future, bootstrapDays: days }
                        }
                    }
                    return { price: null, bootstrapDays: null }
                }

                const txDetailCache = new Map()
                const getTransactionDetail = async event => {
                    const key = `${event.network}:${event.hash}`
                    if (txDetailCache.has(key)) return txDetailCache.get(key)
                    try {
                        const detail = await fetchExplorerTransaction(
                            event.hash,
                            event.network ?? "mainnet",
                            settings,
                            { retryAttempts: 3 }
                        )
                        txDetailCache.set(key, detail ?? null)
                        return detail ?? null
                    } catch {
                        txDetailCache.set(key, null)
                        return null
                    }
                }

                const getOutgoingPayments = event => {
                    const grouped = new Map()
                    event.transfers.forEach(transfer => {
                        const token = normalizeAddress(transfer.tokenAddress)
                        const from = normalizeAddress(transfer.from)
                        const to = normalizeAddress(transfer.to)
                        if (!token || !walletSet.has(from) || walletSet.has(to)) return
                        const raw = BigInt(String(transfer.value ?? "0"))
                        grouped.set(token, (grouped.get(token) ?? 0n) + raw)
                    })
                    return grouped
                }

                // V16: receiving a reward in the same transaction as a farm/stake
                // interaction is NOT a purchase. V15 treated every token leaving the
                // wallet as payment for every token entering it, which could assign
                // an LP deposit (or another protocol movement) as the cost of mined
                // INC. That is how a small reward balance can acquire a huge basis.
                const isProtocolRewardEvent = event => {
                    const method = String(event?.method ?? "").toLowerCase()
                    return [
                        "harvest", "claim", "getreward", "reward", "deposit",
                        "withdraw", "stake", "unstake", "emergencywithdraw",
                        "collect", "mint", "farm"
                    ].some(keyword => method.includes(keyword))
                }

                const isLiquidityAccountingEvent = event => {
                    const method = String(event?.method ?? "").toLowerCase()
                    return method.includes("addliquidity") || method.includes("removeliquidity")
                }

                const tokenWasMintedToWallet = (event, token) => event.transfers.some(transfer =>
                    normalizeAddress(transfer.tokenAddress) === token &&
                    normalizeAddress(transfer.from) === ZERO_ADDRESS &&
                    walletSet.has(normalizeAddress(transfer.to))
                )

                // PulseX MasterChef pays INC rewards from the farm contract rather
                // than minting directly from the zero address. Treat those receipts
                // as mined/farmed rewards even when the explorer method label is
                // missing or opaque. This avoids assigning the LP movement in the
                // same transaction as INC purchase spend.
                const PULSEX_MASTER_CHEF = normalizeAddress("0xB2Ca4A66d3e57a5a9A12043B6bAD28249fE302d4")
                const tokenWasPaidByFarm = (event, token) => event.network === "mainnet" && event.transfers.some(transfer =>
                    normalizeAddress(transfer.tokenAddress) === token &&
                    normalizeAddress(transfer.from) === PULSEX_MASTER_CHEF &&
                    walletSet.has(normalizeAddress(transfer.to))
                )

                // V32: reconstruct a ledger for EACH watched wallet and persist it
                // independently. Visibility is only an aggregation filter; switching
                // between one wallet, several wallets, or all wallets never changes
                // the historical cache key and never requires re-fetching history.
                const WALLET_TOKEN_CACHE_VERSION = 42
                const getWalletTokenCacheKey = (wallet, token) =>
                    `token_pnl_wallet_v${WALLET_TOKEN_CACHE_VERSION}:${wallet}:${token}`
                const readWalletTokenCache = (wallet, token) => {
                    try {
                        const raw = safeLocalStorageGet(getWalletTokenCacheKey(wallet, token))
                        if (raw) {
                            const parsed = JSON.parse(raw)
                            if (parsed?.position) return parsed
                        }
                        // V41 forces only the combined PLS/WPLS position to rebuild.
                        // Every other token migrates the existing per-wallet ledger unchanged.
                        if (token !== WPLS_ADDRESS) {
                            for (const legacyVersion of [40, 37, 34]) {
                                const legacyRaw = safeLocalStorageGet(`token_pnl_wallet_v${legacyVersion}:${wallet}:${token}`)
                                if (!legacyRaw) continue
                                const parsed = JSON.parse(legacyRaw)
                                if (parsed?.position) return { ...parsed, legacyV32: true }
                            }
                        }
                        return null
                    } catch { return null }
                }
                const writeWalletTokenCache = (wallet, token, position, fingerprint) => {
                    try {
                        safeLocalStorageSet(getWalletTokenCacheKey(wallet, token), JSON.stringify({
                            cachedAt: Date.now(),
                            fingerprint,
                            universe: walletKey,
                            position
                        }))
                    } catch {}
                }

                const getWplsWrapCacheKey = wallet => `token_pnl_wpls_wrap_v${WPLS_WRAP_CACHE_VERSION}:${wallet}`
                const readWplsWrapCache = wallet => {
                    try {
                        const raw = safeLocalStorageGet(getWplsWrapCacheKey(wallet))
                        return raw ? JSON.parse(raw) : null
                    } catch { return null }
                }
                const writeWplsWrapCache = (wallet, payload) => {
                    try { safeLocalStorageSet(getWplsWrapCacheKey(wallet), JSON.stringify(payload)) } catch {}
                    return payload
                }

                const getPlsNativeCacheKey = wallet => `token_pnl_pls_native_v${PLS_NATIVE_CACHE_VERSION}:${wallet}`
                const readPlsNativeCache = wallet => {
                    try {
                        const raw = safeLocalStorageGet(getPlsNativeCacheKey(wallet))
                        return raw ? JSON.parse(raw) : null
                    } catch { return null }
                }
                const writePlsNativeCache = (wallet, payload) => {
                    try { safeLocalStorageSet(getPlsNativeCacheKey(wallet), JSON.stringify(payload)) } catch {}
                    return payload
                }

                const makePosition = token => ({
                    tokenAddress: token,
                    symbol: tokenInfo?.[token]?.symbol ?? defaultTokenInformation?.[token]?.symbol ?? "",
                    decimals: Number(tokenInfo?.[token]?.decimals ?? defaultTokenInformation?.[token]?.decimals ?? 18),
                    units: 0, costBasisUsd: 0, acquisitionCount: 0, disposalCount: 0,
                    pricedAcquisitionCount: 0, unpricedAcquisitionCount: 0,
                    transferDateBasisCount: 0, actualSpendBasisCount: 0,
                    allocatedSpendBasisCount: 0, zeroBasisAcquisitionCount: 0,
                    internalTransferBasisCount: 0,
                    stakedUnits: 0, stakedCostBasisUsd: 0, stakeEstimatedBasisUnits: 0,
                    unknownDisposedUnits: 0, lastEventTimestamp: null
                })

                const getWalletDelta = (event, wallet, token) =>
                    event?.walletDeltas?.[wallet]?.[token] ?? 0n

                const getOutgoingPaymentsForWallet = (event, wallet) => {
                    const grouped = new Map()
                    event.transfers.forEach(transfer => {
                        const token = normalizeAddress(transfer.tokenAddress)
                        const from = normalizeAddress(transfer.from)
                        const to = normalizeAddress(transfer.to)
                        // Transfers to another watched wallet are basis-preserving
                        // internal moves, not payment for an acquisition.
                        if (!token || from !== wallet || to === wallet || walletSet.has(to)) return
                        const raw = BigInt(String(transfer.value ?? "0"))
                        grouped.set(token, (grouped.get(token) ?? 0n) + raw)
                    })
                    return grouped
                }

                const tokenWasMintedToSpecificWallet = (event, token, wallet) => event.transfers.some(transfer =>
                    normalizeAddress(transfer.tokenAddress) === token &&
                    normalizeAddress(transfer.from) === ZERO_ADDRESS &&
                    normalizeAddress(transfer.to) === wallet
                )
                const tokenWasPaidByFarmToSpecificWallet = (event, token, wallet) => event.network === "mainnet" && event.transfers.some(transfer =>
                    normalizeAddress(transfer.tokenAddress) === token &&
                    normalizeAddress(transfer.from) === PULSEX_MASTER_CHEF &&
                    normalizeAddress(transfer.to) === wallet
                )

                const publishTokenWalletPositions = (token, perWallet) => {
                    if (cancelled) return
                    setWalletPositions(prev => {
                        const next = { ...prev }
                        for (const [wallet, position] of Object.entries(perWallet)) {
                            next[wallet] = { ...(next[wallet] ?? {}), [token]: position }
                        }
                        return next
                    })
                }

                // Match visible-value priority, but calculate against the full wallet
                // universe so hidden-wallet toggles remain instant.
                const tokenCurrentUsd = token => allWalletAddresses.reduce((sum, wallet) => {
                    const value = Number(currentBalances?.[wallet]?.balances?.[token]?.usd ?? 0)
                    return sum + (Number.isFinite(value) ? value : 0)
                }, 0)
                const orderedTokens = [...trackedTokens].sort((a, b) =>
                    tokenCurrentUsd(b) - tokenCurrentUsd(a)
                )

                let completedTokenCount = 0

                const processTokenInner = async (targetToken, tokenIndex) => {
                    if (cancelled) return
                    const symbol = tokenInfo?.[targetToken]?.symbol ?? defaultTokenInformation?.[targetToken]?.symbol ?? targetToken
                    // Pure transfers between watched wallets have aggregate delta 0,
                    // so inspect wallet deltas rather than the old aggregate event delta.
                    const tokenEvents = events.filter(event =>
                        Object.keys(event.walletDeltas ?? {}).some(wallet => getWalletDelta(event, wallet, targetToken) !== 0n)
                    )

                    const walletFingerprint = wallet => {
                        const walletEvents = tokenEvents.filter(event => getWalletDelta(event, wallet, targetToken) !== 0n)
                        // V33: the cache identity belongs to THIS wallet, not to every
                        // wallet currently being watched. We only encode peer status for
                        // direct transfers of this token, because adding/removing an
                        // unrelated watched wallet must not invalidate this ledger.
                        const peerMarkers = []
                        for (const event of walletEvents) {
                            for (const transfer of event.transfers ?? []) {
                                if (normalizeAddress(transfer.tokenAddress) !== targetToken) continue
                                const from = normalizeAddress(transfer.from)
                                const to = normalizeAddress(transfer.to)
                                if (from !== wallet && to !== wallet) continue
                                const peer = from === wallet ? to : from
                                if (!peer) continue
                                peerMarkers.push(`${event.network}:${event.hash}:${from === wallet ? "out" : "in"}:${peer}:${walletSet.has(peer) ? "watched" : "external"}`)
                            }
                        }
                        return [
                            targetToken, wallet, walletEvents.length,
                            walletEvents[0] ? `${walletEvents[0].network}:${walletEvents[0].hash}:${walletEvents[0].blockNumber}` : "none",
                            walletEvents.at(-1) ? `${walletEvents.at(-1).network}:${walletEvents.at(-1).hash}:${walletEvents.at(-1).blockNumber}` : "none",
                            peerMarkers.sort().join(",")
                        ].join("|")
                    }

                    // V33: reuse every valid wallet cache independently. If one wallet
                    // needs rebuilding, only it and wallets directly connected to it by
                    // transfers of this token are recalculated. This scales to dozens of
                    // wallets without turning one new address into an all-wallet rebuild.
                    const cachedPerWallet = {}
                    const rebuildWallets = new Set()
                    for (const wallet of allWalletAddresses) {
                        const cached = readWalletTokenCache(wallet, targetToken)
                        const fingerprint = walletFingerprint(wallet)
                        const fingerprintMatches = cached?.fingerprint === fingerprint || cached?.legacyV32 === true
                        const usable = cached?.position && fingerprintMatches &&
                            (targetToken !== PRVX_ADDRESS || Number(cached.position.pricedAcquisitionCount ?? 0) > 0 || Number(cached.position.units ?? 0) === 0)
                        if (usable) {
                            cachedPerWallet[wallet] = cached.position
                            if (cached?.legacyV32) writeWalletTokenCache(wallet, targetToken, cached.position, fingerprint)
                        } else rebuildWallets.add(wallet)
                    }

                    // Internal transfers couple the cost basis of sender and receiver.
                    // Expand the rebuild set transitively only across those direct peers.
                    let expanded = true
                    while (expanded) {
                        expanded = false
                        for (const event of tokenEvents) {
                            for (const transfer of event.transfers ?? []) {
                                if (normalizeAddress(transfer.tokenAddress) !== targetToken) continue
                                const from = normalizeAddress(transfer.from)
                                const to = normalizeAddress(transfer.to)
                                if (!walletSet.has(from) || !walletSet.has(to) || from === to) continue
                                if (rebuildWallets.has(from) !== rebuildWallets.has(to)) {
                                    rebuildWallets.add(from); rebuildWallets.add(to); expanded = true
                                }
                            }
                        }
                    }
                    const workingWallets = allWalletAddresses.filter(wallet => rebuildWallets.has(wallet))
                    if (workingWallets.length === 0) {
                        publishTokenWalletPositions(targetToken, cachedPerWallet)
                        completedTokenCount += 1
                        setProgress({ stage: "token-complete", current: completedTokenCount, total: orderedTokens.length, token: symbol, cached: true })
                        return
                    }

                    setProgress({ stage: "token-pricing", current: completedTokenCount, total: orderedTokens.length, token: symbol })

                    // Build one shared historical-price plan for this token across all
                    // wallets. Prices are themselves cached, so two token workers can
                    // safely run together without repeating completed lookups.
                    const requirementMap = new Map()
                    const requirePrice = (network, token, timestamp, blockNumber = 0) => {
                        const normalized = normalizeAddress(token)
                        const ts = toUnixSeconds(timestamp)
                        if (!normalized || !ts) return
                        const key = `${network}:${normalized}`
                        if (!requirementMap.has(key)) requirementMap.set(key, { network, token: normalized, timestamps: new Set(), blockByDay: {} })
                        const req = requirementMap.get(key)
                        req.timestamps.add(ts)
                        const day = Math.floor(ts / 86400)
                        if (!req.blockByDay[day] && Number(blockNumber) > 0) req.blockByDay[day] = Number(blockNumber)
                    }

                    tokenEvents.forEach(event => {
                        for (const wallet of workingWallets) {
                            if (getWalletDelta(event, wallet, targetToken) <= 0n) continue
                            const method = String(event.method ?? "").toLowerCase()
                            if (targetToken === HEX_ADDRESS && (method.includes("stakestart") || method.includes("stakeend") || method.includes("goodaccounting"))) continue
                            const outgoing = getOutgoingPaymentsForWallet(event, wallet)
                            outgoing.forEach((_, paymentToken) => requirePrice(event.network, paymentToken, event.timestamp, event.blockNumber))
                            if (outgoing.size === 0) {
                                const wrappedNative = (PRICE_SOURCES[event.network] ?? PRICE_SOURCES.mainnet).wrappedNativeAddress
                                requirePrice(event.network, wrappedNative, event.timestamp, event.blockNumber)
                                requirePrice(event.network, targetToken, event.timestamp, event.blockNumber)
                            }
                            trackedTokens.filter(t => getWalletDelta(event, wallet, t) > 0n)
                                .forEach(t => requirePrice(event.network, t, event.timestamp, event.blockNumber))
                        }
                    })

                    const requirements = [...requirementMap.values()]
                    for (let reqIndex = 0; reqIndex < requirements.length; reqIndex += 1) {
                        if (cancelled) return
                        const req = requirements[reqIndex]
                        await prefetchHistoricalTokenPrices(req.token, [...req.timestamps], req.network, {
                            blockByDay: req.blockByDay ?? {}, settings,
                            decimals: tokenInfo?.[req.token]?.decimals ?? defaultTokenInformation?.[req.token]?.decimals ?? 18
                        })
                    }

                    const positionsForToken = Object.fromEntries(workingWallets.map(wallet => [wallet, makePosition(targetToken)]))
                    const eventSpendCache = new Map()

                    const getEventSpendUsdForWallet = async (event, wallet) => {
                        const spendKey = `${event.network}:${event.hash}:${wallet}`
                        if (eventSpendCache.has(spendKey)) return eventSpendCache.get(spendKey)
                        if (isProtocolRewardEvent(event) || isLiquidityAccountingEvent(event)) {
                            eventSpendCache.set(spendKey, 0); return 0
                        }
                        const outgoing = getOutgoingPaymentsForWallet(event, wallet)
                        let totalUsd = 0, foundPayment = false
                        for (const [paymentToken, rawAmount] of outgoing.entries()) {
                            const decimals = Number(tokenInfo?.[paymentToken]?.decimals ?? defaultTokenInformation?.[paymentToken]?.decimals ?? 18)
                            const amount = formatRawAmount(rawAmount.toString(), decimals)
                            if (!Number.isFinite(amount) || amount <= 0) continue
                            const historicalPrice = await getHistoricalPrice(paymentToken, event.timestamp, event.network)
                            if (!Number.isFinite(historicalPrice) || historicalPrice <= 0) {
                                eventSpendCache.set(spendKey, null); return null
                            }
                            totalUsd += amount * historicalPrice
                            foundPayment = true
                        }
                        if (!foundPayment) {
                            const detail = await getTransactionDetail(event)
                            const initiator = getAddress(detail?.from)
                            const nativeAmount = formatRawAmount(String(detail?.value ?? "0"), 18)
                            if (initiator === wallet && Number.isFinite(nativeAmount) && nativeAmount > 0) {
                                const wrappedNative = (PRICE_SOURCES[event.network] ?? PRICE_SOURCES.mainnet).wrappedNativeAddress
                                const nativePrice = await getHistoricalPrice(wrappedNative, event.timestamp, event.network)
                                if (Number.isFinite(nativePrice) && nativePrice > 0) {
                                    totalUsd += nativeAmount * nativePrice
                                    foundPayment = true
                                }
                            }
                        }
                        const value = foundPayment && totalUsd > 0 ? totalUsd : null
                        eventSpendCache.set(spendKey, value)
                        return value
                    }

                    // Global chronological ledger for this token. Keeping all wallets
                    // in one pass lets internal wallet-to-wallet transfers carry the
                    // sender's actual average basis instead of resetting to market.
                    for (const event of tokenEvents) {
                        if (cancelled) return
                        const remaining = new Map(workingWallets.map(wallet => [wallet, getWalletDelta(event, wallet, targetToken)]))

                        // Move basis directly for explicit transfers between watched wallets.
                        for (const transfer of event.transfers) {
                            if (normalizeAddress(transfer.tokenAddress) !== targetToken) continue
                            const from = normalizeAddress(transfer.from)
                            const to = normalizeAddress(transfer.to)
                            if (!walletSet.has(from) || !walletSet.has(to) || from === to) continue
                            if (!positionsForToken[from] || !positionsForToken[to]) continue
                            const raw = BigInt(String(transfer.value ?? "0"))
                            if (raw <= 0n) continue
                            const units = formatRawAmount(raw.toString(), positionsForToken[from].decimals)
                            if (!Number.isFinite(units) || units <= 0) continue

                            const sender = positionsForToken[from]
                            const receiver = positionsForToken[to]
                            const accounted = Math.min(units, Math.max(0, sender.units))
                            const avg = sender.units > 0 ? sender.costBasisUsd / sender.units : 0
                            const carriedBasis = Number.isFinite(avg) && avg >= 0 ? avg * accounted : 0
                            sender.costBasisUsd = Math.max(0, sender.costBasisUsd - carriedBasis)
                            sender.units = Math.max(0, sender.units - accounted)
                            if (units > accounted) sender.unknownDisposedUnits += units - accounted
                            sender.lastEventTimestamp = event.timestamp

                            receiver.units += units
                            receiver.costBasisUsd += carriedBasis
                            receiver.internalTransferBasisCount += 1
                            receiver.lastEventTimestamp = event.timestamp
                            if (units > accounted) receiver.unpricedAcquisitionCount += 1
                            else receiver.pricedAcquisitionCount += 1

                            remaining.set(from, (remaining.get(from) ?? 0n) + raw)
                            remaining.set(to, (remaining.get(to) ?? 0n) - raw)
                        }

                        for (const wallet of workingWallets) {
                            const rawDelta = remaining.get(wallet) ?? 0n
                            if (rawDelta === 0n) continue
                            const position = positionsForToken[wallet]

                            const method = String(event.method ?? "").toLowerCase()
                            if (rawDelta < 0n) {
                                const delta = formatRawAmount((-rawDelta).toString(), position.decimals)
                                if (Number.isFinite(delta) && delta > 0) {
                                    position.lastEventTimestamp = event.timestamp
                                    if (targetToken === HEX_ADDRESS && method.includes("stakestart")) {
                                        // V42: staking is not a disposal. Older explorer history can
                                        // omit HEX that was already present before a stakeStart
                                        // (especially around the Ethereum -> PulseChain snapshot).
                                        //
                                        // Previously we only moved the portion covered by the
                                        // reconstructed liquid ledger into the stake bucket. That
                                        // permanently lost the rest of the stake principal, so a
                                        // later stakeEnd could not restore its basis to liquid HEX.
                                        //
                                        // Carry exact reconstructed basis first. For any uncovered
                                        // principal, prefer this wallet's existing weighted HEX entry
                                        // when available; otherwise use HEX's historical market price
                                        // on the stakeStart date as an explicitly estimated basis.
                                        const availableUnits = Math.max(0, position.units)
                                        const accounted = Math.min(delta, availableUnits)
                                        const liquidAvg =
                                            availableUnits > 0 && position.costBasisUsd > 0
                                                ? position.costBasisUsd / availableUnits
                                                : 0
                                        const carriedBasis =
                                            Number.isFinite(liquidAvg) && liquidAvg > 0
                                                ? liquidAvg * accounted
                                                : 0

                                        const missingStakeUnits = Math.max(0, delta - accounted)
                                        let estimatedMissingBasis = 0
                                        let missingBasisPrice = null
                                        let missingBasisMethod = null

                                        if (missingStakeUnits > 0) {
                                            if (Number.isFinite(liquidAvg) && liquidAvg > 0) {
                                                missingBasisPrice = liquidAvg
                                                missingBasisMethod = "wallet-weighted-entry"
                                            } else {
                                                const historicalHexPrice =
                                                    await getHistoricalPrice(
                                                        HEX_ADDRESS,
                                                        event.timestamp,
                                                        event.network
                                                    )
                                                if (
                                                    Number.isFinite(historicalHexPrice) &&
                                                    historicalHexPrice > 0
                                                ) {
                                                    missingBasisPrice = historicalHexPrice
                                                    missingBasisMethod = "stake-start-market-estimate"
                                                }
                                            }

                                            if (
                                                Number.isFinite(missingBasisPrice) &&
                                                missingBasisPrice > 0
                                            ) {
                                                estimatedMissingBasis =
                                                    missingStakeUnits * missingBasisPrice
                                                position.stakeEstimatedBasisUnits =
                                                    Number(position.stakeEstimatedBasisUnits ?? 0) +
                                                    missingStakeUnits
                                                position.transferDateBasisCount +=
                                                    missingBasisMethod === "stake-start-market-estimate"
                                                        ? 1
                                                        : 0
                                            } else {
                                                // Preserve the units even when pricing fails. This
                                                // keeps stakeStart/stakeEnd accounting balanced, but
                                                // marks the wallet incomplete so the UI will not
                                                // silently present an unsupported P&L.
                                                position.unpricedAcquisitionCount += 1
                                            }
                                        }

                                        position.costBasisUsd =
                                            Math.max(0, position.costBasisUsd - carriedBasis)
                                        position.units =
                                            Math.max(0, position.units - accounted)

                                        // The full stake principal is now tracked, not only the
                                        // portion that happened to exist in explorer history.
                                        position.stakedUnits += delta
                                        position.stakedCostBasisUsd +=
                                            carriedBasis + estimatedMissingBasis

                                    } else {
                                        position.disposalCount += 1
                                        if (position.units > 0) {
                                            const avg = position.costBasisUsd / position.units
                                            const accounted = Math.min(delta, position.units)
                                            position.costBasisUsd = Math.max(0, position.costBasisUsd - avg * accounted)
                                            position.units = Math.max(0, position.units - accounted)
                                            if (delta > accounted) position.unknownDisposedUnits += delta - accounted
                                        } else position.unknownDisposedUnits += delta
                                    }
                                }
                                continue
                            }

                            if (targetToken === HEX_ADDRESS && method.includes("stakeend")) {
                                const returnedUnits = formatRawAmount(rawDelta.toString(), position.decimals)
                                if (Number.isFinite(returnedUnits) && returnedUnits > 0) {
                                    const principal = Math.min(returnedUnits, Math.max(0, position.stakedUnits))
                                    const stakeAvg = position.stakedUnits > 0 ? position.stakedCostBasisUsd / position.stakedUnits : 0
                                    const carriedBasis = Number.isFinite(stakeAvg) && stakeAvg >= 0 ? stakeAvg * principal : 0
                                    position.stakedUnits = Math.max(0, position.stakedUnits - principal)
                                    position.stakedCostBasisUsd = Math.max(0, position.stakedCostBasisUsd - carriedBasis)
                                    position.units += returnedUnits
                                    position.costBasisUsd += carriedBasis
                                    position.pricedAcquisitionCount += 1
                                    if (returnedUnits > principal) position.zeroBasisAcquisitionCount += 1
                                    position.lastEventTimestamp = event.timestamp
                                }
                                continue
                            }
                            if (targetToken === HEX_ADDRESS && method.includes("goodaccounting")) continue
                            const units = formatRawAmount(rawDelta.toString(), position.decimals)
                            if (!Number.isFinite(units) || units <= 0) continue
                            position.lastEventTimestamp = event.timestamp
                            position.acquisitionCount += 1
                            position.units += units

                            const incomingAll = trackedTokens.filter(t => getWalletDelta(event, wallet, t) > 0n)
                            const eventSpendUsd = await getEventSpendUsdForWallet(event, wallet)
                            const wrappedNativeForEvent = normalizeAddress((PRICE_SOURCES[event.network] ?? PRICE_SOURCES.mainnet).wrappedNativeAddress)
                            const isWrappedNativeDeposit = targetToken === wrappedNativeForEvent && method.includes("deposit")
                            const rewardLike = !isWrappedNativeDeposit && (
                                isProtocolRewardEvent(event) ||
                                tokenWasMintedToSpecificWallet(event, targetToken, wallet) ||
                                tokenWasPaidByFarmToSpecificWallet(event, targetToken, wallet)
                            )

                            let basisUsd = null, basisSource = null
                            if (targetToken === PRVX_ADDRESS && Number.isFinite(eventSpendUsd) && eventSpendUsd > 0) {
                                basisUsd = eventSpendUsd; basisSource = "actual-spend"
                            } else if (targetToken === PRVX_ADDRESS) {
                                basisUsd = units / PRVX_MAX_RETURN_TOKENS_PER_USD
                                basisSource = "prvx-max-multiplier-estimate"
                            } else if (rewardLike) {
                                basisUsd = 0; basisSource = "mined-reward-zero"
                            } else if (incomingAll.length === 1 && Number.isFinite(eventSpendUsd) && eventSpendUsd > 0) {
                                basisUsd = eventSpendUsd; basisSource = "actual-spend"
                            } else if (incomingAll.length > 1 && Number.isFinite(eventSpendUsd) && eventSpendUsd > 0) {
                                const values = []
                                for (const t of incomingAll) {
                                    const dec = Number(tokenInfo?.[t]?.decimals ?? defaultTokenInformation?.[t]?.decimals ?? 18)
                                    const u = formatRawAmount(getWalletDelta(event, wallet, t).toString(), dec)
                                    const px = await getHistoricalPrice(t, event.timestamp, event.network)
                                    values.push({ token: t, value: Number.isFinite(px) && px > 0 ? u * px : 0 })
                                }
                                const total = values.reduce((a, b) => a + b.value, 0)
                                const mine = values.find(v => v.token === targetToken)?.value ?? 0
                                if (total > 0 && mine > 0) {
                                    basisUsd = eventSpendUsd * (mine / total)
                                    basisSource = "allocated-spend"
                                }
                            }
                            if (basisUsd === null) {
                                const priced = await getHistoricalPriceWithWplsBootstrap(targetToken, event.timestamp, event.network)
                                const px = priced?.price
                                if (Number.isFinite(px) && px > 0) {
                                    basisUsd = units * px
                                    basisSource = priced?.bootstrapDays > 0
                                        ? "wpls-bootstrap-market"
                                        : "transfer-date-market"
                                }
                            }

                            if (Number.isFinite(basisUsd) && basisUsd >= 0 && basisSource) {
                                position.costBasisUsd += basisUsd
                                position.pricedAcquisitionCount += 1
                                if (basisSource === "actual-spend" || basisSource === "prvx-max-multiplier-estimate") position.actualSpendBasisCount += 1
                                if (basisSource === "allocated-spend") position.allocatedSpendBasisCount += 1
                                if (basisSource === "transfer-date-market" || basisSource === "wpls-bootstrap-market") position.transferDateBasisCount += 1
                                if (basisSource === "mined-reward-zero") position.zeroBasisAcquisitionCount += 1
                            } else position.unpricedAcquisitionCount += 1
                        }
                    }

                    const finalPerWallet = { ...cachedPerWallet }
                    for (const wallet of workingWallets) {
                        const position = positionsForToken[wallet]

                        // V33: WPLS deposits are native-value wraps and some explorer
                        // token-transfer indexes omit the mint-side movement entirely.
                        // When the on-chain balance is larger than the reconstructed ERC20
                        // ledger, recover that missing basis from actual WPLS deposit() txs.
                        if (targetToken === WPLS_ADDRESS) {
                            const combinedCurrentUnits = Number(currentBalances?.[wallet]?.balances?.[targetToken]?.normalized ?? 0)
                            let nativeCurrentUnits = 0
                            try {
                                nativeCurrentUnits = Number(ethers.utils.formatUnits(String(currentBalances?.[wallet]?.balances?.PLS?.raw ?? '0'), 18))
                            } catch {}
                            const wrappedCurrentUnits = Math.max(0, combinedCurrentUnits - nativeCurrentUnits)
                            const missingUnits = Number.isFinite(wrappedCurrentUnits) ? Math.max(0, wrappedCurrentUnits - position.units) : 0
                            if (missingUnits > Math.max(0.000001, wrappedCurrentUnits * 0.001)) {
                                let wrapCache = readWplsWrapCache(wallet)
                                if (!wrapCache?.complete) {
                                    try {
                                        const txs = await fetchCompleteAddressTransactions(wallet, "mainnet", settings, {
                                            maxPages: 250, delayBetweenPages: 80, retryAttempts: 4
                                        })
                                        const deposits = (txs ?? []).filter(tx => {
                                            const to = normalizeAddress(tx?.to?.hash ?? tx?.to)
                                            const from = normalizeAddress(tx?.from?.hash ?? tx?.from)
                                            const methodName = String(tx?.method ?? tx?.decoded_input?.method_call ?? "").toLowerCase()
                                            const input = String(tx?.raw_input ?? tx?.input ?? "").toLowerCase()
                                            const value = Number(ethers.utils.formatEther(String(tx?.value ?? "0")))
                                            // Any native-value transaction from this wallet to the
                                            // canonical WPLS contract is a wrap. Explorer method labels
                                            // are inconsistent on older PulseChain transactions, so do
                                            // not require the transaction to be decoded as deposit().
                                            return from === wallet && to === WPLS_ADDRESS && value > 0
                                        }).map(tx => ({
                                            hash: String(tx?.hash ?? "").toLowerCase(),
                                            timestamp: toUnixSeconds(tx?.timestamp),
                                            blockNumber: Number(tx?.block_number ?? 0),
                                            units: Number(ethers.utils.formatEther(String(tx?.value ?? "0")))
                                        })).filter(x => x.timestamp > 0 && x.units > 0)
                                        wrapCache = writeWplsWrapCache(wallet, { complete: true, deposits })
                                    } catch (error) {
                                        wrapCache = { complete: false, deposits: [], error: error?.message }
                                    }
                                }
                                const deposits = [...(wrapCache?.deposits ?? [])].sort((a,b) => a.timestamp-b.timestamp)
                                let unitsNeeded = missingUnits
                                let recoveredUnits = 0
                                let recoveredBasis = 0
                                for (const dep of deposits) {
                                    if (unitsNeeded <= 0) break
                                    const take = Math.min(unitsNeeded, Number(dep.units ?? 0))
                                    if (!(take > 0)) continue
                                    const priced = await getHistoricalPriceWithWplsBootstrap(WPLS_ADDRESS, dep.timestamp, "mainnet")
                                    const px = priced?.price
                                    if (!(Number.isFinite(px) && px > 0)) continue
                                    recoveredUnits += take
                                    recoveredBasis += take * px
                                    unitsNeeded -= take
                                }
                                if (recoveredUnits > 0) {
                                    position.units += recoveredUnits
                                    position.costBasisUsd += recoveredBasis
                                    position.pricedAcquisitionCount += deposits.length > 0 ? 1 : 0
                                    position.transferDateBasisCount += 1
                                }
                                if (unitsNeeded > Math.max(0.000001, wrappedCurrentUnits * 0.001)) position.unpricedAcquisitionCount += 1
                            }

                            // The displayed Pulse balance is native PLS + WPLS. Reconstruct
                            // native PLS separately, then merge the two ledgers. Router buys of
                            // native PLS arrive as internal transactions, while direct transfers
                            // are ordinary transactions. Unknown/genesis residual is valued at
                            // the earliest real WPLS market observation already in our cache.
                            if (nativeCurrentUnits > 0) {
                                let nativeLedger = readPlsNativeCache(wallet)
                                const nativeCacheFresh = nativeLedger && Number(nativeLedger.currentUnits ?? -1) >= 0 &&
                                    Math.abs(Number(nativeLedger.currentUnits ?? 0) - nativeCurrentUnits) <= Math.max(0.000001, nativeCurrentUnits * 0.001)
                                if (!nativeCacheFresh) {
                                    try {
                                        const [regularTxs, internalTxs] = await Promise.all([
                                            fetchCompleteAddressTransactions(wallet, 'mainnet', settings, { maxPages: 250, delayBetweenPages: 60, retryAttempts: 4 }),
                                            fetchCompleteAddressInternalTransactions(wallet, settings, { maxPages: 250 })
                                        ])
                                        const movements = []
                                        const addMovement = (tx, kind) => {
                                            const from = normalizeAddress(tx?.from?.hash ?? tx?.from)
                                            const to = normalizeAddress(tx?.to?.hash ?? tx?.to)
                                            const raw = String(tx?.value ?? '0')
                                            let units = 0
                                            try { units = Number(ethers.utils.formatEther(raw)) } catch {}
                                            if (!(Number.isFinite(units) && units > 0)) return
                                            const hash = String(tx?.transaction_hash ?? tx?.transaction?.hash ?? tx?.hash ?? '').toLowerCase()
                                            const timestamp = toUnixSeconds(tx?.timestamp ?? tx?.timeStamp)
                                            const blockNumber = Number(tx?.block_number ?? tx?.blockNumber ?? 0)
                                            if (!hash || !timestamp) return
                                            if (to === wallet && from !== wallet) movements.push({ direction: 'in', units, hash, timestamp, blockNumber, kind })
                                            if (from === wallet && to !== wallet) movements.push({ direction: 'out', units, hash, timestamp, blockNumber, kind })
                                        }
                                        ;(regularTxs ?? []).forEach(tx => addMovement(tx, 'regular'))
                                        ;(internalTxs ?? []).forEach(tx => addMovement(tx, 'internal'))
                                        movements.sort((a,b) => a.timestamp-b.timestamp || a.blockNumber-b.blockNumber)

                                        let nativeUnits = 0
                                        let nativeBasis = 0
                                        let pricedIncoming = 0
                                        let unpricedIncoming = 0
                                        let unpricedUnits = 0
                                        for (const move of movements) {
                                            if (move.direction === 'out') {
                                                const take = Math.min(move.units, Math.max(0, nativeUnits))
                                                const avg = nativeUnits > 0 ? nativeBasis / nativeUnits : 0
                                                nativeUnits = Math.max(0, nativeUnits - take)
                                                nativeBasis = Math.max(0, nativeBasis - avg * take)
                                                continue
                                            }
                                            let basis = null
                                            const matchingEvent = events.find(event => event.network === 'mainnet' && String(event.hash).toLowerCase() === move.hash)
                                            if (matchingEvent) {
                                                const spend = await getEventSpendUsdForWallet(matchingEvent, wallet)
                                                if (Number.isFinite(spend) && spend > 0) basis = spend
                                            }
                                            if (!(Number.isFinite(basis) && basis >= 0)) {
                                                const priced = await getHistoricalPriceWithWplsBootstrap(WPLS_ADDRESS, move.timestamp, 'mainnet')
                                                if (Number.isFinite(priced?.price) && priced.price > 0) basis = move.units * priced.price
                                            }
                                            nativeUnits += move.units
                                            if (Number.isFinite(basis) && basis >= 0) { nativeBasis += basis; pricedIncoming += 1 }
                                            else { unpricedIncoming += 1; unpricedUnits += move.units }
                                        }

                                        // Reconcile known history to the actual current native balance.
                                        // A positive residual is normally launch/genesis PLS or an old
                                        // explorer gap. Use the earliest cached market observation rather
                                        // than pretending it had zero cost.
                                        if (nativeUnits > nativeCurrentUnits) {
                                            const excess = nativeUnits - nativeCurrentUnits
                                            const avg = nativeUnits > 0 ? nativeBasis / nativeUnits : 0
                                            nativeBasis = Math.max(0, nativeBasis - excess * avg)
                                            nativeUnits = nativeCurrentUnits
                                        } else if (nativeUnits < nativeCurrentUnits) {
                                            const residual = nativeCurrentUnits - nativeUnits
                                            const earliest = findEarliestCachedWplsPrice()
                                            if (earliest?.price > 0) {
                                                nativeBasis += residual * earliest.price
                                                nativeUnits += residual
                                                pricedIncoming += 1
                                                console.info('Token P&L v40 PLS GENESIS/UNKNOWN BASELINE', JSON.stringify({ wallet, residualUnits: residual, price: earliest.price, pricedTimestamp: earliest.timestamp }))
                                            } else {
                                                unpricedIncoming += 1
                                            }
                                        }
                                        // If some incoming native PLS could not be matched to a
                                        // purchase/payment, apply the same earliest-market baseline to
                                        // those units. The row is explicitly estimated, but it is still
                                        // amount-weighted and far more representative than dropping the
                                        // entire native PLS balance from P&L.
                                        if (unpricedUnits > 0) {
                                            const earliest = findEarliestCachedWplsPrice()
                                            if (earliest?.price > 0) {
                                                const unitsStillHeld = Math.min(unpricedUnits, nativeCurrentUnits)
                                                nativeBasis += unitsStillHeld * earliest.price
                                                pricedIncoming += 1
                                                unpricedIncoming = 0
                                                console.info('Token P&L v40 PLS UNPRICED BASELINE', JSON.stringify({ wallet, units: unitsStillHeld, price: earliest.price, pricedTimestamp: earliest.timestamp }))
                                            }
                                        }
                                        nativeLedger = writePlsNativeCache(wallet, {
                                            currentUnits: nativeCurrentUnits, units: nativeUnits, costBasisUsd: nativeBasis,
                                            pricedIncoming, unpricedIncoming, complete: unpricedIncoming === 0, cachedAt: Date.now()
                                        })
                                    } catch (error) {
                                        nativeLedger = { currentUnits: nativeCurrentUnits, units: 0, costBasisUsd: 0, pricedIncoming: 0, unpricedIncoming: 1, complete: false, error: error?.message }
                                    }
                                }
                                const nativeUnits = Number(nativeLedger?.units ?? 0)
                                const nativeBasis = Number(nativeLedger?.costBasisUsd ?? 0)
                                if (nativeUnits > 0 && Number.isFinite(nativeBasis) && nativeBasis >= 0) {
                                    position.units += nativeUnits
                                    position.costBasisUsd += nativeBasis
                                    position.pricedAcquisitionCount += Number(nativeLedger?.pricedIncoming ?? 0) > 0 ? 1 : 0
                                    if (nativeLedger?.complete === false) position.unpricedAcquisitionCount += 1
                                } else if (nativeCurrentUnits > 0) {
                                    position.unpricedAcquisitionCount += 1
                                }
                                console.info('Token P&L v41 PLS NATIVE LEDGER', JSON.stringify({ wallet, nativeCurrentUnits, units: nativeLedger?.units ?? 0, costBasisUsd: nativeLedger?.costBasisUsd ?? 0, complete: nativeLedger?.complete === true }))
                            }

                            // V41 final Pulse reconciliation. The UI intentionally displays
                            // native PLS + WPLS as one position. Explorer history can omit old
                            // wraps/genesis allocations entirely, leaving the reconstructed
                            // ledger at zero even though the current wallet balance is known.
                            // Reconcile the ledger to that ACTUAL combined balance. Missing
                            // current units receive the earliest real Pulse market price already
                            // discovered by the bootstrap path; excess reconstructed units are
                            // trimmed at their current weighted basis. This is explicitly an
                            // estimated historical baseline, but it prevents a missing explorer
                            // event from blanking the whole Pulse P&L forever.
                            let actualCombinedUnits = 0
                            try {
                                const rawCombined = String(currentBalances?.[wallet]?.balances?.[WPLS_ADDRESS]?.raw ?? '0')
                                actualCombinedUnits = Number(ethers.utils.formatUnits(rawCombined, 18))
                            } catch {
                                actualCombinedUnits = Number(currentBalances?.[wallet]?.balances?.[WPLS_ADDRESS]?.normalized ?? 0)
                            }
                            if (Number.isFinite(actualCombinedUnits) && actualCombinedUnits >= 0) {
                                const tolerance = Math.max(0.000001, actualCombinedUnits * 0.001)
                                if (position.units > actualCombinedUnits + tolerance) {
                                    const excess = position.units - actualCombinedUnits
                                    const avg = position.units > 0 ? position.costBasisUsd / position.units : 0
                                    position.costBasisUsd = Math.max(0, position.costBasisUsd - Math.max(0, avg) * excess)
                                    position.units = actualCombinedUnits
                                } else if (position.units + tolerance < actualCombinedUnits) {
                                    const residualUnits = actualCombinedUnits - position.units
                                    const earliest = findEarliestCachedWplsPrice()
                                    if (earliest?.price > 0) {
                                        position.units += residualUnits
                                        position.costBasisUsd += residualUnits * earliest.price
                                        position.pricedAcquisitionCount += 1
                                        position.transferDateBasisCount += 1
                                        position.residualBaselineUnits = Number(position.residualBaselineUnits ?? 0) + residualUnits
                                        // The remaining current position now has a basis. Historical
                                        // unpriced events no longer need to suppress the current P&L.
                                        position.unpricedAcquisitionCount = 0
                                        console.info('Token P&L v41 PLS CURRENT-BALANCE BASELINE', JSON.stringify({
                                            wallet, reconstructedBefore: actualCombinedUnits - residualUnits,
                                            residualUnits, actualCombinedUnits, price: earliest.price,
                                            pricedTimestamp: earliest.timestamp
                                        }))
                                    }
                                }
                            }
                        }

                        const averageEntry = position.units > 0 && position.costBasisUsd > 0
                            ? position.costBasisUsd / position.units : null
                        const walletHasScanError = scanErrors.some(error => normalizeAddress(error?.wallet) === wallet)
                        const finalPosition = {
                            ...position,
                            averageEntry,
                            basisMethod: targetToken === PRVX_ADDRESS && position.pricedAcquisitionCount > 0
                                ? "prvx-max-multiplier-estimate"
                                : position.transferDateBasisCount > 0 || position.allocatedSpendBasisCount > 0
                                    ? "mixed-estimate"
                                    : position.actualSpendBasisCount > 0
                                        ? "actual-spend"
                                        : position.internalTransferBasisCount > 0
                                            ? "internal-transfer"
                                            : "historical-market",
                            complete: !walletHasScanError && position.unpricedAcquisitionCount === 0
                        }
                        finalPerWallet[wallet] = finalPosition
                        writeWalletTokenCache(wallet, targetToken, finalPosition, walletFingerprint(wallet))
                    }

                    if (targetToken === HEX_ADDRESS || targetToken === WPLS_ADDRESS) {
                        const ledgerDiagnostics = Object.fromEntries(allWalletAddresses.map(wallet => {
                            const reconstructedUnits = Number(finalPerWallet[wallet]?.units ?? 0)
                            const currentUnits = Number(currentBalances?.[wallet]?.balances?.[targetToken]?.normalized ?? 0)
                            const coverage =
                                currentUnits > 0 && reconstructedUnits > 0
                                    ? Math.min(reconstructedUnits / currentUnits, currentUnits / reconstructedUnits)
                                    : 0

                            return [wallet, {
                                currentUnits,
                                reconstructedUnits,
                                coveragePercent: Number((coverage * 100).toFixed(4)),
                                costBasisUsd: Number(finalPerWallet[wallet]?.costBasisUsd ?? 0),
                                averageEntry: Number(finalPerWallet[wallet]?.averageEntry ?? 0),
                                stakedUnits: Number(finalPerWallet[wallet]?.stakedUnits ?? 0),
                                stakedCostBasisUsd: Number(finalPerWallet[wallet]?.stakedCostBasisUsd ?? 0),
                                stakeEstimatedBasisUnits: Number(finalPerWallet[wallet]?.stakeEstimatedBasisUnits ?? 0),
                                pricedAcquisitions: Number(finalPerWallet[wallet]?.pricedAcquisitionCount ?? 0),
                                unpricedAcquisitions: Number(finalPerWallet[wallet]?.unpricedAcquisitionCount ?? 0),
                                unknownDisposedUnits: Number(finalPerWallet[wallet]?.unknownDisposedUnits ?? 0),
                                complete: finalPerWallet[wallet]?.complete !== false,
                                basisMethod: finalPerWallet[wallet]?.basisMethod ?? null
                            }]
                        }))

                        // WARNING level on purpose: packaged Electron builds can hide INFO
                        // messages depending on DevTools' level/filter settings.
                        console.warn(
                            `========== ${targetToken === HEX_ADDRESS ? "HEX" : "PLS+WPLS"} P&L WALLET DIAGNOSTICS ==========\n` +
                            JSON.stringify(ledgerDiagnostics, null, 2) +
                            `\n========== END ${targetToken === HEX_ADDRESS ? "HEX" : "PLS+WPLS"} P&L WALLET DIAGNOSTICS ==========`
                        )
                    }

                    if (targetToken === PRVX_ADDRESS) {
                        console.info("Token P&L v33 PRVX WALLET BASELINES", JSON.stringify(
                            Object.fromEntries(allWalletAddresses.map(wallet => [wallet, {
                                units: finalPerWallet[wallet]?.units ?? 0,
                                costBasisUsd: finalPerWallet[wallet]?.costBasisUsd ?? 0,
                                tokensPerUsd: PRVX_MAX_RETURN_TOKENS_PER_USD
                            }]))
                        ))
                    }

                    publishTokenWalletPositions(targetToken, finalPerWallet)
                    completedTokenCount += 1
                    setProgress({ stage: "token-complete", current: completedTokenCount, total: orderedTokens.length, token: symbol })
                    console.info("Token P&L v41 TOKEN COMPLETE", JSON.stringify({
                        index: tokenIndex + 1,
                        total: orderedTokens.length,
                        token: targetToken,
                        symbol,
                        walletsCached: allWalletAddresses.length
                    }))
                }

                // V38: track every token worker independently. The UI previously only
                // knew that the overall P&L job was running, so a warm cached position
                // suppressed the loading animation even while that token was being rebuilt.
                // With two workers we expose both active token addresses to the renderer.
                const processToken = async (targetToken, tokenIndex) => {
                    if (cancelled) return
                    setActiveTokens(prev => prev.includes(targetToken) ? prev : [...prev, targetToken])
                    try {
                        await processTokenInner(targetToken, tokenIndex)
                    } finally {
                        if (!cancelled) setActiveTokens(prev => prev.filter(token => token !== targetToken))
                    }
                }

                // Two token workers substantially improve first-run speed while keeping
                // historical RPC pressure bounded. The lower-level on-chain price fetcher
                // already has its own concurrency cap, so going much wider here would mostly
                // increase rate-limit errors rather than reduce wall-clock time.
                let nextTokenIndex = 0
                const tokenWorkerCount = Math.min(2, orderedTokens.length)
                const tokenWorker = async () => {
                    while (!cancelled) {
                        const index = nextTokenIndex++
                        if (index >= orderedTokens.length) return
                        await processToken(orderedTokens[index], index)
                    }
                }
                await Promise.all(Array.from({ length: tokenWorkerCount }, () => tokenWorker()))
                console.info("Token P&L v36 WALLET CACHE COMPLETE", JSON.stringify({
                    wallets: allWalletAddresses.length,
                    tokens: orderedTokens.length,
                    tokenWorkers: tokenWorkerCount,
                    errors: scanErrors.length
                }))
                safeLocalStorageRemove(getAccountingCheckpointKey(walletKey, tokenKey))
                safeLocalStorageRemove(getCheckpointKey(walletKey, tokenKey))
                if (!cancelled) setErrors(scanErrors)
            } catch (error) {
                console.error("Token P&L v36 FAILED", {
                    message: error?.message,
                    stack: error?.stack
                })
                if (!cancelled) {
                    setErrors([{ message: error?.message ?? "Unable to calculate token P&L" }])
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                    setActiveTokens([])
                    setProgress({ stage: "complete", current: 1, total: 1 })
                }
            }
        }

        load()
        return () => { cancelled = true }
    }, [walletKey, tokenKey, settings, enabled])

    return { positions, walletPositions, loading, activeTokens, progress, errors }
}
