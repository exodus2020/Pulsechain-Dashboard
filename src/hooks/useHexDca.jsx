// useHexDca.jsx
import { useEffect, useMemo, useState } from "react"
import { ethers } from "ethers"
import {
    batchFetchCompleteActivities,
    fetchIncomingTokenTransferTransactions,
    fetchCompleteAddressTokenTransfers,
    batchFetchTokenInfo,
    decodeTransferLogs,
    fetchExplorerTransaction,
    fetchExplorerTransactionTokenTransfers,
    PULSECHAIN_FIRST_BLOCK
} from "../lib/web3"
import { defaultSettings } from "../config/settings"


const HEX_ADDRESS =
    "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39"

const WPLS_ADDRESS =
    "0xa1077a294dde1b09bb078844df40758a5d0f9a27"

const WETH_ADDRESS =
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"

const ZERO_ADDRESS =
    "0x0000000000000000000000000000000000000000"

const GECKO_API =
    "https://api.geckoterminal.com/api/v2"

// v2.4.3 cleanup: historical DCA audit output is intentionally silent in normal builds.
// Keep the diagnostic call sites/data paths intact so they can be re-enabled during debugging
// without changing scanner behaviour.
const dcaDiagnostic = () => {}

/*
 * PulseChain launched from the Ethereum state taken around
 * Ethereum block 17,232,000.
 *
 * Ethereum DCA scanning stops before this block so purchases made
 * after the fork are not included in the pre-fork Ethereum figures.
 */
const ETHEREUM_FORK_BLOCK = 17233000

const DCA_SOURCES = [
    {
        network: "ethereum",
        key: "ethereum",
        label: "Ethereum",
        geckoNetwork: "eth",
        nativeSymbol: "ETH",
        wrappedNativeAddress: WETH_ADDRESS,
        minimumBlock: null,
        maximumBlock: ETHEREUM_FORK_BLOCK - 1
    },

    {
        network: "mainnet",
        key: "pulsechain",
        label: "PulseChain",
        geckoNetwork: "pulsechain",
        nativeSymbol: "PLS",
        wrappedNativeAddress: WPLS_ADDRESS,
        minimumBlock: PULSECHAIN_FIRST_BLOCK,
        maximumBlock: null
    }
]

const getDcaSource = network => {
    return (
        DCA_SOURCES.find(source => {
            return source.network === network
        }) ?? DCA_SOURCES[1]
    )
}

const USD_STABLECOIN_ADDRESSES = new Set([
    // DAI
    "0x6b175474e89094c44da98b954eedeac495271d0f",

    // USDC
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",

    // USDT
    "0xdac17f958d2ee523a2206206994597c13d831ec7"
])

const EXCLUDED_METHODS = [
    "stakeend",
    "stakestart",
    "goodaccounting"
]

const priceMemoryCache = new Map()
const poolMemoryCache = new Map()
// Increment this whenever the transaction-detection logic changes.
// Doing so automatically ignores results produced by an older parser.
const DCA_TRANSACTION_CACHE_VERSION = 16 // v161: parity reset; discard stale browser/Electron transaction classifications once

const getTransactionCacheKey = ({
    network,
    wallet,
    hash
}) => {
    return (
        `hex_dca_transaction_v${DCA_TRANSACTION_CACHE_VERSION}:` +
        `${network}:` +
        `${normalizeAddress(wallet)}:` +
        `${String(hash ?? "").toLowerCase()}`
    )
}

const readCachedTransactionResult = cacheKey => {
    const storedValue = safeLocalStorageGet(cacheKey)

    if (!storedValue) {
        return {
            hit: false,
            purchase: null
        }
    }

    try {
        const parsed = JSON.parse(storedValue)

        return {
            hit: true,
            purchase: parsed?.purchase ?? null
        }
    } catch {
        return {
            hit: false,
            purchase: null
        }
    }
}

const writeCachedTransactionResult = (
    cacheKey,
    purchase
) => {
    safeLocalStorageSet(
        cacheKey,
        JSON.stringify({
            purchase: purchase ?? null,
            cachedAt: Date.now()
        })
    )
}

const wait = milliseconds => {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds)
    })
}


const normalizeAddress = address => {
    return (address ?? "").toLowerCase().trim()
}


const getAddress = addressObject => {
    return normalizeAddress(addressObject?.hash)
}


const getTokenAddress = transfer => {
    return normalizeAddress(
        transfer?.token?.address ??
        transfer?.token?.address_hash
    )
}


const getTransferType = transfer => {
    return (transfer?.type ?? "").toLowerCase()
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
        return true
    } catch {
        // DCA still works without persistent caching.
        return false
    }
}

// v2.4.3: Browser localStorage can be much smaller than Electron's persistent store.
// A large multi-wallet scan can fill it with per-transaction evidence before the
// critical per-wallet ledger/checkpoint is written. If that happens, discard the
// rebuildable transaction-result cache and retry the wallet checkpoint write.
const writeCriticalDcaStorage = (key, value) => {
    if (safeLocalStorageSet(key, value)) return true

    try {
        const transactionPrefix = `hex_dca_transaction_v${DCA_TRANSACTION_CACHE_VERSION}:`
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i += 1) {
            const storageKey = localStorage.key(i)
            if (storageKey?.startsWith(transactionPrefix)) keysToRemove.push(storageKey)
        }
        keysToRemove.forEach(storageKey => localStorage.removeItem(storageKey))
        console.warn(`[HEX DCA v2.4.3] localStorage quota recovery removed ${keysToRemove.length} rebuildable transaction cache entries`)
        return safeLocalStorageSet(key, value)
    } catch (error) {
        console.warn('[HEX DCA v2.4.3] unable to persist critical DCA wallet checkpoint', error)
        return false
    }
}
const DCA_RESULT_CACHE_VERSION = 14 // v195: rebuild with asymmetric PulseChain snapshot union

// v158: rebuild once so browser and Electron start from the same verified ledger.
// v157-era browser caches could permanently checkpoint a transiently incomplete
// PulseChain scan (for example 35 purchases while Electron had 36).
const DCA_WALLET_CACHE_VERSION = 18 // v195: rebuild with asymmetric PulseChain snapshot union
const getDcaWalletCacheKey = wallet => `hex_dca_wallet_v${DCA_WALLET_CACHE_VERSION}:${normalizeAddress(wallet)}`
const readDcaWalletCache = wallet => {
    try {
        const raw = safeLocalStorageGet(getDcaWalletCacheKey(wallet))
        if (!raw) return null
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed?.purchases) ? parsed : null
    } catch { return null }
}
const writeDcaWalletCache = (wallet, purchases, walletErrors = {}, transactionErrors = [], complete = true, scanCheckpoints = {}) => {
    // V45: only a fully successful wallet scan is allowed to become a warm
    // six-hour DCA cache. A transient explorer/RPC/pricing failure used to be
    // persisted exactly like a successful zero-purchase wallet, which could
    // make a packaged restart show DCA/P&L as N/A until the cache expired.
    const payload = { purchases, walletErrors, transactionErrors, complete: complete === true, scanCheckpoints, cachedAt: Date.now() }
    writeCriticalDcaStorage(getDcaWalletCacheKey(wallet), JSON.stringify(payload))
    return payload
}

const getDcaResultCacheKey = ({
    network,
    walletKey
}) => {
    return (
        `hex_dca_result_v${DCA_RESULT_CACHE_VERSION}:` +
        `${network}:` +
        `${walletKey}`
    )
}

const readCachedDcaResult = cacheKey => {
    const storedValue = safeLocalStorageGet(cacheKey)

    if (!storedValue) {
        return null
    }

    try {
        const parsed = JSON.parse(storedValue)

        if (!Array.isArray(parsed?.purchases)) {
            return null
        }

        return parsed
    } catch {
        return null
    }
}

const writeCachedDcaResult = (
    cacheKey,
    {
        purchases,
        walletErrors,
        transactionErrors
    }
) => {
    safeLocalStorageSet(
        cacheKey,
        JSON.stringify({
            purchases,
            walletErrors,
            transactionErrors,
            cachedAt: Date.now()
        })
    )
}

/**
 * Convert a raw integer token value without first coercing it to Number.
 * ethers.utils.formatUnits avoids precision loss for large HEX amounts.
 */
const formatRawAmount = (rawValue, decimals) => {
    try {
        const formatted = ethers.utils.formatUnits(
            String(rawValue ?? "0"),
            Number(decimals ?? 0)
        )

        const amount = Number(formatted)

        return Number.isFinite(amount) ? amount : 0
    } catch {
        return 0
    }
}


const formatTokenAmount = transfer => {
    return formatRawAmount(
        transfer?.total?.value ?? "0",
        transfer?.total?.decimals ??
            transfer?.token?.decimals ??
            0
    )
}


const toUnixSeconds = timestamp => {
    if (timestamp === null || timestamp === undefined) {
        return null
    }

    if (typeof timestamp === "number") {
        if (!Number.isFinite(timestamp)) {
            return null
        }

        return timestamp > 1e12
            ? Math.floor(timestamp / 1000)
            : Math.floor(timestamp)
    }

    const numericTimestamp = Number(timestamp)

    if (Number.isFinite(numericTimestamp)) {
        return numericTimestamp > 1e12
            ? Math.floor(numericTimestamp / 1000)
            : Math.floor(numericTimestamp)
    }

    const parsedMilliseconds = new Date(timestamp).getTime()

    return Number.isFinite(parsedMilliseconds)
        ? Math.floor(parsedMilliseconds / 1000)
        : null
}

// v157: DCA pricing is intentionally bucketed to the nearest whole UTC hour.
// This is materially more precise than daily closes while still allowing every
// purchase in the same token/hour bucket to share one cached historical quote.
const toNearestUtcHour = timestamp => {
    const unixTimestamp = toUnixSeconds(timestamp)
    return unixTimestamp ? Math.round(unixTimestamp / 3600) * 3600 : null
}


// v134: GeckoTerminal historical pricing is a shared, rate-limited resource.
// Serialize first-time requests, dedupe identical URLs, and keep a cooldown after 429s
// so one burst cannot turn otherwise-priceable purchases into permanent gaps.
let v134PriceRequestTail = Promise.resolve()
let v134LastPriceRequestAt = 0
let v134RateLimitUntil = 0
const v134InFlightPriceRequests = new Map()

const v134RunPriceRequest = async task => {
    const run = async () => {
        const now = Date.now()
        const waitForCooldown = Math.max(0, v134RateLimitUntil - now)
        const waitForSpacing = Math.max(0, 850 - (now - v134LastPriceRequestAt))
        const waitMs = Math.max(waitForCooldown, waitForSpacing)
        if (waitMs > 0) await wait(waitMs)
        v134LastPriceRequestAt = Date.now()
        return task()
    }
    const result = v134PriceRequestTail.then(run, run)
    v134PriceRequestTail = result.catch(() => {})
    return result
}

// Web build: use Electron's IPC fetch bridge when available, otherwise use
// the browser's native fetch. Keeping the same { ok, status, data, error }
// shape means the DCA pricing pipeline is identical in both environments.
const fetchJsonUniversal = async url => {
    if (window?.electron?.fetchJson) {
        return window.electron.fetchJson(url)
    }

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: { Accept: "application/json" }
        })
        let data = null
        try {
            data = await response.json()
        } catch {
            // Preserve the same failure shape as the Electron bridge.
        }
        return {
            ok: response.ok,
            status: response.status,
            data,
            error: response.ok ? null : `HTTP ${response.status}`
        }
    } catch (error) {
        return {
            ok: false,
            status: 0,
            data: null,
            error: error?.message ?? "Browser fetch failed"
        }
    }
}

const fetchJsonWithRetry = async (
    url,
    {
        attempts = 3,
        delay = 500,
        timeout = 6000
    } = {}
) => {
    let lastError = null

    for (
        let attempt = 0;
        attempt < attempts;
        attempt += 1
    ) {
        try {
            let sharedRequest = v134InFlightPriceRequests.get(url)
            if (!sharedRequest) {
                sharedRequest = v134RunPriceRequest(() => fetchJsonUniversal(url))
                v134InFlightPriceRequests.set(url, sharedRequest)
                sharedRequest.finally(() => {
                    if (v134InFlightPriceRequests.get(url) === sharedRequest) {
                        v134InFlightPriceRequests.delete(url)
                    }
                })
            }

            const result = await Promise.race([
                sharedRequest,

                new Promise((_, reject) => {
                    setTimeout(() => {
                        const error = new Error(
                            `Price request timed out after ${timeout} ms`
                        )

                        error.status = 408
                        reject(error)
                    }, timeout)
                })
            ])

            if (!result?.ok) {
                const error = new Error(
                    result?.error ??
                    `GeckoTerminal returned ${
                        result?.status ?? "an error"
                    }`
                )

                error.status = result?.status
                throw error
            }

            return result.data
        } catch (error) {
            lastError = error

            if (
                error?.status === 400 ||
                error?.status === 401 ||
                error?.status === 403
            ) {
                break
            }

            if (error?.status === 429) {
                const cooldownMs = 6000 * (attempt + 1)
                v134RateLimitUntil = Math.max(v134RateLimitUntil, Date.now() + cooldownMs)
            }

            if (attempt < attempts - 1) {
                const retryDelay =
                    error?.status === 429
                        ? 6000 * (attempt + 1)
                        : delay * (attempt + 1)

                await wait(retryDelay)
            }
        }
    }

    throw (
        lastError ??
        new Error("Unable to fetch historical price")
    )
}


const getTopPoolAddress = async (
    tokenAddress,
    source = getDcaSource("mainnet")
) => {
    const normalizedToken = normalizeAddress(tokenAddress)

    if (!normalizedToken) {
        return null
    }

    const networkKey =
        source?.key ??
        source?.network ??
        "pulsechain"

    const memoryKey =
        `${networkKey}:${normalizedToken}`

    if (poolMemoryCache.has(memoryKey)) {
        return poolMemoryCache.get(memoryKey)
    }

    const storageKey =
        `hex_dca_pool_${networkKey}_${normalizedToken}`

    const cachedPool =
        safeLocalStorageGet(storageKey)

    if (cachedPool) {
        poolMemoryCache.set(memoryKey, cachedPool)
        return cachedPool
    }

    const geckoNetwork =
        source?.geckoNetwork ?? "pulsechain"

    const url =
        `${GECKO_API}/networks/${geckoNetwork}` +
        `/tokens/${normalizedToken}/pools?page=1`

    const json = await fetchJsonWithRetry(url, {
        attempts: 2,
        delay: 500,
        timeout: 6000
    })

    const poolAddress = normalizeAddress(
        json?.data?.[0]?.attributes?.address
    )

    if (!poolAddress) {
        return null
    }

    poolMemoryCache.set(memoryKey, poolAddress)
    safeLocalStorageSet(storageKey, poolAddress)

    return poolAddress
}


const selectClosestCandlePrice = (
    candles,
    targetTimestamp
) => {
    if (!Array.isArray(candles) || candles.length === 0) {
        return null
    }

    const validCandles = candles
        .map(candle => ({
            timestamp: Number(candle?.[0]),
            close: Number(candle?.[4])
        }))
        .filter(candle => {
            return (
                Number.isFinite(candle.timestamp) &&
                Number.isFinite(candle.close) &&
                candle.close > 0
            )
        })

    if (validCandles.length === 0) {
        return null
    }

    validCandles.sort((a, b) => {
        return (
            Math.abs(a.timestamp - targetTimestamp) -
            Math.abs(b.timestamp - targetTimestamp)
        )
    })

    return validCandles[0].close
}

const fetchHistoricalEthPrice = async timestamp => {
    const roundedTimestamp = toNearestUtcHour(timestamp)
    if (!roundedTimestamp) return null

    const cacheKey = `eth:hour:${roundedTimestamp}`
    if (priceMemoryCache.has(cacheKey)) return priceMemoryCache.get(cacheKey)

    const storageKey = `hex_dca_price_web2_${cacheKey}`
    const storedPrice = Number(safeLocalStorageGet(storageKey))
    if (Number.isFinite(storedPrice) && storedPrice > 0) {
        priceMemoryCache.set(cacheKey, storedPrice)
        return storedPrice
    }

    const startTime = roundedTimestamp * 1000
    const endTime = startTime + 3600000 - 1
    const url =
        `https://data-api.binance.vision/api/v3/klines` +
        `?symbol=ETHUSDT&interval=1h` +
        `&startTime=${startTime}&endTime=${endTime}&limit=1`

    try {
        const json = await fetchJsonWithRetry(url, { attempts: 3, delay: 1000 })
        const candle = Array.isArray(json) && Array.isArray(json[0]) ? json[0] : null
        // Use the hourly OPEN: it is the market price at the rounded whole hour.
        const price = Number(candle?.[1])
        if (!Number.isFinite(price) || price <= 0) return null
        priceMemoryCache.set(cacheKey, price)
        safeLocalStorageSet(storageKey, String(price))
        return price
    } catch (error) {
        console.error("ETH HOURLY PRICE FALLBACK FAILED:", {
            timestamp, roundedTimestamp, url, status: error?.status, message: error?.message
        })
        return null
    }
}
// v135: DefiLlama is the first historical-price fallback for arbitrary payment
// assets. This lets DCA value HEX bought with *any* token instead of depending
// on that token having a usable GeckoTerminal pool/candle endpoint.
const fetchHistoricalLlamaPrice = async (
    tokenAddress,
    timestamp,
    source = getDcaSource("mainnet")
) => {
    const normalizedToken = normalizeAddress(tokenAddress)
    const roundedTimestamp = toNearestUtcHour(timestamp)
    if (!normalizedToken || !roundedTimestamp) return null

    const llamaChain = source?.key === "ethereum" ? "ethereum" : "pulsechain"
    const coinKey = `${llamaChain}:${normalizedToken}`
    const cacheKey = `llama:hour:${coinKey}:${roundedTimestamp}`

    if (priceMemoryCache.has(cacheKey)) {
        return priceMemoryCache.get(cacheKey)
    }

    const storageKey = `hex_dca_price_web2_${cacheKey}`
    const storedPrice = Number(safeLocalStorageGet(storageKey))
    if (Number.isFinite(storedPrice) && storedPrice > 0) {
        priceMemoryCache.set(cacheKey, storedPrice)
        return storedPrice
    }

    try {
        const url =
            `https://coins.llama.fi/prices/historical/${roundedTimestamp}/` +
            encodeURIComponent(coinKey)
        const result = await fetchJsonUniversal(url)
        if (!result?.ok) return null

        const coin = result?.data?.coins?.[coinKey]
        const price = Number(coin?.price)
        if (!Number.isFinite(price) || price <= 0) return null

        priceMemoryCache.set(cacheKey, price)
        safeLocalStorageSet(storageKey, String(price))
        return price
    } catch {
        return null
    }
}

const fetchHistoricalTokenPrice = async (
    tokenAddress,
    timestamp,
    tokenSymbol = "",
    source = getDcaSource("mainnet")
) => {
    const normalizedToken = normalizeAddress(tokenAddress)
    const unixTimestamp = toUnixSeconds(timestamp)
    const roundedTimestamp = toNearestUtcHour(timestamp)

    if (!normalizedToken || !unixTimestamp || !roundedTimestamp) {
        return null
    }

    if (USD_STABLECOIN_ADDRESSES.has(normalizedToken)) {
        return 1
    }
const normalizedSymbol =
    String(tokenSymbol ?? "").toUpperCase()

// v134: bridged/stable assets can use different contract addresses on PulseChain.
// Their symbol is enough for DCA cost basis and avoids needless remote lookups.
if (["USDC", "USDT", "DAI", "USDC.E", "USDT.E", "DAI.E"].includes(normalizedSymbol)) {
    return 1
}

if (
    normalizedSymbol === "WETH" ||
    normalizedSymbol === "ETH"
) {
    const ethPrice =
        await fetchHistoricalEthPrice(timestamp)

    if (Number.isFinite(ethPrice) && ethPrice > 0) {
        return ethPrice
    }
}

// v135: Try a chain/address historical oracle before GeckoTerminal. It works
// for many long-tail assets (MKR, NMR, etc.) and avoids burning Gecko's tiny
// public rate-limit budget merely because the user paid for HEX with an odd coin.
const llamaPrice = await fetchHistoricalLlamaPrice(
    normalizedToken,
    timestamp,
    source
)
if (Number.isFinite(llamaPrice) && llamaPrice > 0) {
    return llamaPrice
}

    // Cache one historical price per token per nearest UTC hour.
    // This keeps pricing accurate to the hour without repeating requests for
    // multicalls or purchases that share the same hourly market bucket.
    const hourBucket = Math.floor(roundedTimestamp / 3600)

    const networkKey =
        source?.key ??
        source?.network ??
        "pulsechain"

    const cacheKey =
        `${networkKey}:${normalizedToken}:hour:${hourBucket}`

    if (priceMemoryCache.has(cacheKey)) {
        return priceMemoryCache.get(cacheKey)
    }

    const storageKey = `hex_dca_price_web2_${cacheKey}`
    const storedPrice = Number(safeLocalStorageGet(storageKey))

    if (Number.isFinite(storedPrice) && storedPrice > 0) {
        priceMemoryCache.set(cacheKey, storedPrice)
        return storedPrice
    }

    const poolAddress = await getTopPoolAddress(
        normalizedToken,
        source
    )

    if (!poolAddress) {
        return null
    }

    const fetchCandles = async timeframe => {
        const intervalSeconds = timeframe === "hour" ? 3600 : 86400
        const targetTimestamp = timeframe === "hour" ? roundedTimestamp : unixTimestamp
        const beforeTimestamp = targetTimestamp + intervalSeconds
        const geckoNetwork =
            source?.geckoNetwork ?? "pulsechain"

        const url =
            `${GECKO_API}/networks/${geckoNetwork}` +
            `/pools/${poolAddress}/ohlcv/${timeframe}` +
            `?aggregate=1&limit=5&currency=usd` +
            `&token=${encodeURIComponent(normalizedToken)}` +
            `&before_timestamp=${beforeTimestamp}` +
            `&include_empty_intervals=true`
        const json = await fetchJsonWithRetry(url, { attempts: 4, delay: 750, timeout: 8000 })

        return json?.data?.attributes?.ohlcv_list ?? []
    }

    let price = null

    // v157: hourly first. Daily is only a last-resort fallback when the provider
    // has no hourly candle for this older/long-tail asset.
    try {
        const hourlyCandles = await fetchCandles("hour")
        price = selectClosestCandlePrice(hourlyCandles, roundedTimestamp)
    } catch (hourlyError) {
        try {
            const dailyCandles = await fetchCandles("day")
            price = selectClosestCandlePrice(dailyCandles, unixTimestamp)
        } catch (dailyError) {
            throw dailyError ?? hourlyError
        }
    }

    if (!price) {
        const dailyCandles = await fetchCandles("day")
        price = selectClosestCandlePrice(dailyCandles, unixTimestamp)
    }

    if (!Number.isFinite(price) || price <= 0) {
        return null
    }

    priceMemoryCache.set(cacheKey, price)
    safeLocalStorageSet(storageKey, String(price))

    return price
}


const calculateStablecoinUsdSpent = ({
    payments,
    nativePlsSpent
}) => {
    if (
        !Array.isArray(payments) ||
        payments.length === 0 ||
        nativePlsSpent > 0
    ) {
        return null
    }

    const everyPaymentIsStablecoin =
        payments.every(payment => {
            return USD_STABLECOIN_ADDRESSES.has(
                normalizeAddress(payment?.tokenAddress)
            )
        })

    if (!everyPaymentIsStablecoin) {
        return null
    }

    const usdSpent =
        payments.reduce((total, payment) => {
            return total + Number(payment?.amount ?? 0)
        }, 0)

    return Number.isFinite(usdSpent) && usdSpent > 0
        ? usdSpent
        : null
}


const pricePurchase = async purchase => {
    const source = getDcaSource(
        purchase?.network ?? "mainnet"
    )

    if (
        purchase?.usdSpent !== null &&
        purchase?.usdSpent !== undefined
    ) {
        return purchase
    }

    const paymentLegs = []

    if (Number(purchase?.nativePlsSpent ?? 0) > 0) {
        paymentLegs.push({
            tokenAddress: source.wrappedNativeAddress,
            symbol: source.nativeSymbol,
            amount: Number(purchase.nativePlsSpent)
        })
    }

    ;(purchase?.payments ?? []).forEach(payment => {
        if (Number(payment?.amount ?? 0) > 0) {
            paymentLegs.push(payment)
        }
    })

    if (paymentLegs.length === 0) {
        return {
            ...purchase,
            pricingError: "No outgoing payment asset was found"
        }
    }

    let usdSpent = 0
    const pricedPayments = []
    for (const payment of paymentLegs) {

    // v138: A provider failure (401/429/timeout) must not abort pricePurchase
    // before the fallback chain gets a chance to run. Provider failures are
    // captured here so the fallback chain below can continue.
    let historicalPrice = null
    let primaryPricingError = null
    try {
        historicalPrice = await fetchHistoricalTokenPrice(
            payment?.tokenAddress,
            purchase?.timestamp,
            payment?.symbol,
            source
        )
    } catch (error) {
        primaryPricingError = error
    }

    // v138: 0x57fde... is an early PulseChain HEX payment asset. If its
    // PulseChain oracle is unavailable, try the Ethereum HEX historical oracle
    // as a secondary market reference before falling through to swap-ratio
    // recovery. This is deliberately limited to HEX-symbol payment legs; it
    // does not change purchase discovery or classify arbitrary tokens as HEX.
    if (
        (!Number.isFinite(historicalPrice) || historicalPrice <= 0) &&
        String(payment?.symbol ?? "").toUpperCase() === "HEX" &&
        source?.key === "pulsechain"
    ) {
        try {
            const ethereumHexPrice = await fetchHistoricalLlamaPrice(
                HEX_ADDRESS,
                purchase?.timestamp,
                getDcaSource("ethereum")
            )
            if (Number.isFinite(ethereumHexPrice) && ethereumHexPrice > 0) {
                historicalPrice = ethereumHexPrice
            }
        } catch {
            // Continue into generic swap-ratio recovery below.
        }
    }

    // v137: Some early PulseChain payment assets have no usable historical
    // USD feed (the final examples were PLP and copied/bridged HEX).  We still
    // know exactly how much native PulseChain HEX the swap delivered.  When the
    // payment-token oracle is unavailable, anchor the transaction to the
    // historical USD price of the HEX that was received, then derive the
    // payment asset's effective execution price from the on-chain swap ratio.
    // This remains generic: it works for any odd payment token without adding
    // a token allow-list or changing purchase discovery.
    if (!Number.isFinite(historicalPrice) || historicalPrice <= 0) {
        const purchasedHex = Number(
            purchase?.hexAmount ?? purchase?.purchasedHex ?? 0
        )

        if (
            source?.key === "pulsechain" &&
            Number.isFinite(purchasedHex) &&
            purchasedHex > 0 &&
            paymentLegs.length === 1
        ) {
            // v138: The HEX anchor can fail for the same provider reason as
            // the payment token. Treat that as a failed fallback, not as an
            // exception that skips the rest of this purchase.
            let receivedHexUsdPrice = null
            try {
                receivedHexUsdPrice = await fetchHistoricalTokenPrice(
                    HEX_ADDRESS,
                    purchase?.timestamp,
                    "HEX",
                    source
                )
            } catch {
                // Historical HEX anchor unavailable; preserve the purchase as unpriced.
            }

            const paymentAmount = Number(payment?.amount ?? 0)
            if (
                Number.isFinite(receivedHexUsdPrice) &&
                receivedHexUsdPrice > 0 &&
                Number.isFinite(paymentAmount) &&
                paymentAmount > 0
            ) {
                const transactionUsd = purchasedHex * receivedHexUsdPrice
                historicalPrice = transactionUsd / paymentAmount

            }
        }
    }

    if (!Number.isFinite(historicalPrice) || historicalPrice <= 0) {
            return {
                ...purchase,
                pricingError:
                    primaryPricingError?.message ??
                    (`Historical USD price unavailable for ` +
                    `${payment?.symbol || payment?.tokenAddress || "payment token"}`)
            }
        }

        const paymentUsd =
            Number(payment?.amount ?? 0) * historicalPrice

        if (!Number.isFinite(paymentUsd) || paymentUsd <= 0) {
            return {
                ...purchase,
                pricingError: "Historical payment value was invalid"
            }
        }

        usdSpent += paymentUsd
        pricedPayments.push({
            ...payment,
            historicalPrice,
            usdValue: paymentUsd
        })

        // GeckoTerminal's keyless API is rate-limited. Most values are cached,
        // so this delay mainly protects first-time scans.
        await wait(100)
    }

    const purchasedHex = Number(purchase?.purchasedHex ?? 0)

    return {
        ...purchase,
        payments: pricedPayments,
        usdSpent,
        averagePrice:
            purchasedHex > 0
                ? usdSpent / purchasedHex
                : null,
        pricingError: null
    }
}


const isExcludedTransaction = transaction => {
    const method =
        (transaction?.method ?? "").toLowerCase()

    return EXCLUDED_METHODS.some(excludedMethod => {
        return method.includes(excludedMethod)
    })
}


const isPossibleHexPurchase = (
    activity,
    walletAddress,
    source = getDcaSource("mainnet")
) => {
    if (
        !activity?.hash ||
        activity?.status === "error" ||
        activity?.result === "error"
    ) {
        return false
    }

    const activityBlock = Number(
        activity?.block ??
        activity?.block_number
    )

    if (
        Number.isFinite(activityBlock) &&
        Number.isFinite(source?.minimumBlock) &&
        activityBlock < source.minimumBlock
    ) {
        return false
    }

    if (
        Number.isFinite(activityBlock) &&
        Number.isFinite(source?.maximumBlock) &&
        activityBlock > source.maximumBlock
    ) {
        return false
    }

    if (isExcludedTransaction(activity)) {
        return false
    }

    // Correctness first: Blockscout's lightweight transaction rows do not
    // consistently include internal token_transfers and many router calls are
    // labelled execute/exactInput/etc. rather than swap/multicall.  Treat every
    // non-excluded transaction in the valid block range as a receipt candidate.
    // extractRpcHexPurchase() is the authoritative filter: it only accepts a
    // receipt that actually sends HEX into this wallet and has an outgoing
    // payment leg.  Receipt results (including confirmed non-purchases) are
    // cached, so this broader audit is primarily a one-time cost.
    return true
}


// v178 diagnostic-only: record the exact per-transaction classification outcome.
// This is intentionally global to the hook module so extractRpcHexPurchase can annotate
// the same candidate that the worker later sees. It does not alter classification/math.
const v178CandidateFates = new Map()
const v178FateKey = (network, wallet, hash) => `${String(network ?? "").toLowerCase().includes("eth") ? "ethereum" : "pulsechain"}:${normalizeAddress(wallet)}:${String(hash ?? "").toLowerCase()}`

// v180: focus diagnostics on the three PulseChain transactions that differed
// between Web and Electron in v178. Keep normal DCA behavior unchanged.
const V180_TRACE_HASHES = new Set([
    // v207: V206 isolated the remaining parity mismatch to these two transactions.
    // f3b19... exists in both ledgers but classifies as 450k HEX in Electron vs
    // 500k in Web. a8c6... is accepted only by Electron. Capture their raw
    // receipt-transfer inputs so the next patch can fix the source divergence.
    "0xf3b19d04a0e6c7a2a91a523eb70464e06a2136eb317dcfb91f64fc0401cbf6b5",
    "0xa8c6fa67b6c40fd6683f6728ef44b2f6dc41fce7de7b39e200a72e077fdf32fd"
])
const v180IsTraceHash = hash => V180_TRACE_HASHES.has(String(hash ?? "").toLowerCase())

// v208 deterministic classifier input: keep a monotonic, per-transaction union of
// every receipt/log snapshot observed during this scan. V207 proved that the same
// hash can reach the classifier once with a complete transfer list and later with
// an empty/partial list (or vice versa). Classification must never depend on which
// asynchronous response happened to arrive last.
const v208CanonicalTransferEvidence = new Map()
const v208TransferKey = transfer => [
    normalizeAddress(transfer?.tokenAddress),
    normalizeAddress(transfer?.from),
    normalizeAddress(transfer?.to),
    String(transfer?.value?.toString?.() ?? transfer?.value ?? "0")
].join(":")
const v208EvidenceKey = (network, wallet, hash) => [
    String(network ?? "").toLowerCase().includes("eth") ? "ethereum" : "pulsechain",
    normalizeAddress(wallet),
    String(hash ?? "").toLowerCase()
].join(":")
const v208MergeCanonicalTransfers = (network, wallet, hash, ...snapshots) => {
    const key = v208EvidenceKey(network, wallet, hash)
    const previous = v208CanonicalTransferEvidence.get(key) ?? []
    const merged = []
    const seen = new Set()
    ;[previous, ...snapshots].forEach(snapshot => {
        if (!Array.isArray(snapshot)) return
        snapshot.forEach(transfer => {
            if (!transfer) return
            const transferKey = v208TransferKey(transfer)
            if (!seen.has(transferKey)) {
                seen.add(transferKey)
                merged.push(transfer)
            }
        })
    })
    // Monotonic only: an empty or shorter response can add nothing, but can never
    // erase transfer legs already observed for this transaction.
    v208CanonicalTransferEvidence.set(key, merged)
    return merged
}
const v178RecordFate = (network, wallet, hash, fate, extra = {}) => {
    const key = v178FateKey(network, wallet, hash)
    const previous = v178CandidateFates.get(key) ?? {}
    v178CandidateFates.set(key, { ...previous, network: key.split(":")[0], wallet: normalizeAddress(wallet), hash: String(hash ?? "").toLowerCase(), fate, ...extra })
}

const ethDcaRejectAudit = {
    emptyReceipt: 0, excluded: 0, missingMetadata: 0, belowMinBlock: 0, aboveMaxBlock: 0,
    noIncomingHex: 0, noPaymentLeg: 0, invalidHexAmount: 0, accepted: 0,
    emptyReceiptSamples: []
}
const resetEthDcaRejectAudit = () => Object.keys(ethDcaRejectAudit).forEach(key => { ethDcaRejectAudit[key] = 0 })

// v118 diagnostic: keep PulseChain discovery/classification behavior unchanged, but
// retain enough information to see exactly where real incoming HEX is being rejected.
// This lets us recover missing purchases without risking the known-good Ethereum path.
const pulseDcaRejectAudit = {
    emptyReceipt: 0, excluded: 0, missingMetadata: 0, belowMinBlock: 0, aboveMaxBlock: 0,
    noIncomingHex: 0, noPaymentLeg: 0, invalidHexAmount: 0, accepted: 0,
    incomingHexRejected: [],
    rejectionSamples: []
}
const resetPulseDcaRejectAudit = () => {
    Object.keys(pulseDcaRejectAudit).forEach(key => {
        pulseDcaRejectAudit[key] = Array.isArray(pulseDcaRejectAudit[key]) ? [] : 0
    })
}

// v122 diagnostic only: record a compact, copy-friendly sample for every
// PulseChain rejection bucket. This does NOT change purchase classification.
const recordPulseReject = (reason, activity, extra = {}) => {
    if (pulseDcaRejectAudit.rejectionSamples.length >= 300) return
    pulseDcaRejectAudit.rejectionSamples.push({
        reason,
        hash: activity?.hash ?? activity?.transaction_hash ?? null,
        block: extra.block ?? activity?.blockNumber ?? activity?.block ?? activity?.block_number ?? null,
        method: activity?.method ?? null,
        from: activity?.from ?? null,
        to: activity?.to ?? null,
        nativeValue: activity?.value ?? null,
        ...extra
    })
}

const extractRpcHexPurchase = async ({
    rpcTransfers,
    rpcTimestamp,
    rpcBlockNumber,
    activity,
    walletAddress,
    network,
    settings
}) => {
    const source = getDcaSource(network)

    // v208: hydrate the classifier from the strongest transfer evidence seen for
    // this exact network/wallet/hash. This makes repeated calls idempotent even if
    // an RPC/explorer response is transiently empty or truncated.
    rpcTransfers = v208MergeCanonicalTransfers(
        network, walletAddress, activity?.hash, rpcTransfers
    )

    // v204 diagnostic-only: for the three transactions that actually diverged in
    // V203, capture the raw classifier inputs before any rejection/acceptance.
    // This does not alter discovery, classification, pricing, cache, or DCA math.
    if (v180IsTraceHash(activity?.hash)) {
        const traceTransfers = Array.isArray(rpcTransfers) ? rpcTransfers.map((transfer, index) => ({
            index,
            tokenAddress: normalizeAddress(transfer?.tokenAddress),
            from: normalizeAddress(transfer?.from),
            to: normalizeAddress(transfer?.to),
            value: transfer?.value?.toString?.() ?? String(transfer?.value ?? ""),
            logIndex: transfer?.logIndex ?? transfer?.log_index ?? null
        })) : []
        dcaDiagnostic(`[HEX DCA V209 ${typeof window !== "undefined" && window?.electronAPI ? "ELECTRON" : "WEB"}] RAW CLASSIFIER INPUT ${String(activity?.hash ?? "").toLowerCase()}`)
        dcaDiagnostic("activity", {
            hash: String(activity?.hash ?? "").toLowerCase(),
            block: rpcBlockNumber ?? activity?.blockNumber ?? activity?.block ?? null,
            timestamp: rpcTimestamp ?? activity?.timestamp ?? activity?.timeStamp ?? null,
            from: normalizeAddress(activity?.from),
            to: normalizeAddress(activity?.to),
            value: String(activity?.value ?? "0"),
            method: activity?.method ?? null,
            network
        })
        dcaDiagnostic(`receipt transfers (${traceTransfers.length})`, traceTransfers)
        dcaDiagnostic(`[HEX DCA V209 COPY INPUT] ${String(activity?.hash ?? "").toLowerCase()} | block=${rpcBlockNumber ?? "?"} | value=${String(activity?.value ?? "0")} | transfers=${JSON.stringify(traceTransfers)}`)
        dcaDiagnostic()
    }

    if (!Array.isArray(rpcTransfers) || rpcTransfers.length === 0) {
        if (network === "ethereum") {
            ethDcaRejectAudit.emptyReceipt += 1
            if (ethDcaRejectAudit.emptyReceiptSamples.length < 12) {
                ethDcaRejectAudit.emptyReceiptSamples.push({
                    hash: activity?.hash ?? null,
                    explorerBlock: activity?.blockNumber ?? activity?.block ?? activity?.block_number ?? null,
                    timestamp: activity?.timestamp ?? activity?.timeStamp ?? null,
                    method: activity?.method ?? null,
                    from: activity?.from ?? null,
                    to: activity?.to ?? null,
                    value: activity?.value ?? null
                })
            }
        }
        if (network === "pulsechain" || network === "mainnet") {
            pulseDcaRejectAudit.emptyReceipt += 1
            recordPulseReject("emptyReceipt", activity, { transferCount: 0 })
        }
        v178RecordFate(network, walletAddress, activity?.hash, "empty-receipt")
        return null
    }
    if (isExcludedTransaction(activity)) {
        if (network === "ethereum") ethDcaRejectAudit.excluded += 1
        if (network === "pulsechain" || network === "mainnet") {
            pulseDcaRejectAudit.excluded += 1
            recordPulseReject("excluded", activity, { transferCount: rpcTransfers.length })
        }
        v178RecordFate(network, walletAddress, activity?.hash, "excluded-transaction")
        return null
    }

    if (
        !rpcTimestamp ||
        !Number.isFinite(Number(rpcBlockNumber))
    ) {
        if (network === "ethereum") ethDcaRejectAudit.missingMetadata += 1
        if (network === "pulsechain" || network === "mainnet") {
            pulseDcaRejectAudit.missingMetadata += 1
            recordPulseReject("missingMetadata", activity, { block: rpcBlockNumber, hasTimestamp: Boolean(rpcTimestamp), transferCount: rpcTransfers.length })
        }
        v178RecordFate(network, walletAddress, activity?.hash, "missing-metadata", { block: rpcBlockNumber ?? null, timestamp: rpcTimestamp ?? null })
        throw new Error(
            `${source.label} RPC transaction metadata was unavailable.`
        )
    }

    const numericBlockNumber =
        Number(rpcBlockNumber)

    // v131: Do not reject PulseChain purchases solely because recovered receipt
    // metadata reports a block below PULSECHAIN_FIRST_BLOCK. These candidates were
    // discovered from the PulseChain explorer itself and can contain valid incoming
    // HEX + payment legs even when recovered block metadata is inconsistent. The
    // chain-specific discovery source is the authority here; classification should
    // validate the swap contents, not discard it on this redundant lower-bound check.
    // Keep the guard for any non-Pulse source that defines a minimum block.
    const isPulseSource = network === "pulsechain" || network === "mainnet"
    if (
        !isPulseSource &&
        Number.isFinite(source?.minimumBlock) &&
        numericBlockNumber < source.minimumBlock
    ) {
        if (network === "ethereum") ethDcaRejectAudit.belowMinBlock += 1
        v178RecordFate(network, walletAddress, activity?.hash, "below-min-block", { block: numericBlockNumber })
        return null
    }

    if (
        Number.isFinite(source?.maximumBlock) &&
        numericBlockNumber > source.maximumBlock
    ) {
        if (network === "ethereum") ethDcaRejectAudit.aboveMaxBlock += 1
        if (network === "pulsechain" || network === "mainnet") {
            pulseDcaRejectAudit.aboveMaxBlock += 1
            recordPulseReject("aboveMaxBlock", activity, { block: numericBlockNumber, maximumBlock: source?.maximumBlock, transferCount: rpcTransfers.length })
        }
        v178RecordFate(network, walletAddress, activity?.hash, "above-max-block", { block: numericBlockNumber })
        return null
    }
    const normalizedWallet =
        normalizeAddress(walletAddress)

    const incomingHexTransfers =
        rpcTransfers.filter(transfer => {
            return (
                normalizeAddress(transfer?.tokenAddress) === HEX_ADDRESS &&
                normalizeAddress(transfer?.to) === normalizedWallet &&
                normalizeAddress(transfer?.from) !== ZERO_ADDRESS
            )
        })

    if (incomingHexTransfers.length === 0) {
        if (network === "ethereum") ethDcaRejectAudit.noIncomingHex += 1
        if (network === "pulsechain" || network === "mainnet") {
            pulseDcaRejectAudit.noIncomingHex += 1
            recordPulseReject("noIncomingHex", activity, { block: numericBlockNumber, transferCount: rpcTransfers.length })
        }
        v178RecordFate(network, walletAddress, activity?.hash, "no-incoming-hex", { receiptTransfers: rpcTransfers.length, incomingHexTransfers: 0, outgoingPaymentTransfers: 0, nativeSpent: 0 })
        return null
    }

    const outgoingPaymentTransfers =
        rpcTransfers.filter(transfer => {
            return (
                normalizeAddress(transfer?.from) === normalizedWallet &&
                normalizeAddress(transfer?.tokenAddress) !== HEX_ADDRESS
            )
        })

    const nativePlsRaw =
        String(activity?.value ?? "0")

    const nativePlsSpent =
        formatRawAmount(nativePlsRaw, 18)

    if (
        outgoingPaymentTransfers.length === 0 &&
        nativePlsSpent <= 0
    ) {
        if (network === "ethereum") ethDcaRejectAudit.noPaymentLeg += 1
        if (network === "pulsechain" || network === "mainnet") {
            pulseDcaRejectAudit.noPaymentLeg += 1
            const incomingRaw = incomingHexTransfers.reduce((t, x) => t + BigInt(x?.value?.toString?.() ?? x?.value ?? "0"), 0n)
            const rejectedHex = formatRawAmount(incomingRaw.toString(), 8)
            pulseDcaRejectAudit.incomingHexRejected.push({
                reason: "noPaymentLeg", hash: activity?.hash ?? null, wallet: normalizedWallet,
                block: rpcBlockNumber, purchasedHex: rejectedHex,
                method: activity?.method ?? null, nativeValue: nativePlsRaw, transferCount: rpcTransfers.length
            })
            recordPulseReject("noPaymentLeg", activity, { block: numericBlockNumber, purchasedHex: rejectedHex, transferCount: rpcTransfers.length, outgoingPaymentTransfers: 0 })
        }
        v178RecordFate(network, walletAddress, activity?.hash, "no-payment-leg", { receiptTransfers: rpcTransfers.length, incomingHexTransfers: incomingHexTransfers.length, outgoingPaymentTransfers: outgoingPaymentTransfers.length, nativeSpent: nativePlsSpent })
        return null
    }

    const purchasedHexRaw =
        incomingHexTransfers.reduce(
            (total, transfer) => {
                return total + BigInt(
                    transfer?.value?.toString?.() ??
                    transfer?.value ??
                    "0"
                )
            },
            0n
        )

    const purchasedHex =
        formatRawAmount(
            purchasedHexRaw.toString(),
            8
        )

    if (
        !Number.isFinite(purchasedHex) ||
        purchasedHex <= 0
    ) {
        if (network === "ethereum") ethDcaRejectAudit.invalidHexAmount += 1
        if (network === "pulsechain" || network === "mainnet") {
            pulseDcaRejectAudit.invalidHexAmount += 1
            recordPulseReject("invalidHexAmount", activity, { block: numericBlockNumber, purchasedHex, transferCount: rpcTransfers.length })
        }
        v178RecordFate(network, walletAddress, activity?.hash, "invalid-hex-amount", { purchasedHex })
        return null
    }

    const paymentTokenAddresses = [
        ...new Set(
            outgoingPaymentTransfers
                .map(transfer => {
                    return normalizeAddress(
                        transfer?.tokenAddress
                    )
                })
                .filter(Boolean)
        )
    ]

    const tokenInfo =
        paymentTokenAddresses.length > 0
            ? await batchFetchTokenInfo(
                paymentTokenAddresses,
                network,
                settings
            )
            : {}

    // v140: Do not classify AMM liquidity removal as a HEX purchase.
    // Uniswap-V2-style pairs (including PulseX) burn/remove liquidity by sending
    // the wallet's LP token back to the LP/pair contract itself; the pair then
    // returns its underlying assets to the wallet. That can look superficially
    // like "LP token out -> HEX in", but it is a redemption, not a purchase.
    // Keep this structural rather than hard-coding PLP or a specific pair.
    const isLpRedemption =
        nativePlsSpent <= 0 &&
        outgoingPaymentTransfers.length > 0 &&
        outgoingPaymentTransfers.every(transfer => {
            const tokenAddress = normalizeAddress(transfer?.tokenAddress)
            const recipient = normalizeAddress(transfer?.to)
            const info = tokenInfo?.[tokenAddress] ?? {}
            const symbol = String(info?.symbol ?? "").toUpperCase()
            const name = String(info?.name ?? "").toLowerCase()
            const looksLikeLpToken =
                symbol === "PLP" ||
                symbol.includes("LP") ||
                name.includes("lp") ||
                name.includes("liquidity")

            return Boolean(tokenAddress) &&
                recipient === tokenAddress &&
                looksLikeLpToken
        })

    if (isLpRedemption) {
        if (network === "pulsechain" || network === "mainnet") {
            recordPulseReject("liquidityRedemption", activity, {
                block: numericBlockNumber,
                purchasedHex,
                transferCount: rpcTransfers.length,
                outgoingPaymentTransfers: outgoingPaymentTransfers.length
            })
        }
        v178RecordFate(network, walletAddress, activity?.hash, "liquidity-redemption", { purchasedHex })
        return null
    }

    const groupedPayments = new Map()

    outgoingPaymentTransfers.forEach(transfer => {
        const tokenAddress =
            normalizeAddress(transfer?.tokenAddress)

        const rawValue =
            BigInt(
                transfer?.value?.toString?.() ??
                transfer?.value ??
                "0"
            )

        const existing =
            groupedPayments.get(tokenAddress) ?? 0n

        groupedPayments.set(
            tokenAddress,
            existing + rawValue
        )
    })

    const payments = [
        ...groupedPayments.entries()
    ].map(([tokenAddress, rawValue]) => {
        const info =
            tokenInfo?.[tokenAddress] ?? {}

        const decimals =
            Number(info?.decimals ?? 18)

        return {
            tokenAddress,
            symbol: info?.symbol ?? "",
            name: info?.name ?? "",
            amount: formatRawAmount(
                rawValue.toString(),
                decimals
            ),
            rawValue: rawValue.toString(),
            decimals
        }
    }).filter(payment => {
        return (
            Number.isFinite(payment.amount) &&
            payment.amount > 0
        )
    })

    const usdSpent =
        calculateStablecoinUsdSpent({
            payments,
            nativePlsSpent
        })

    if (network === "ethereum") ethDcaRejectAudit.accepted += 1
    if (network === "pulsechain" || network === "mainnet") pulseDcaRejectAudit.accepted += 1
    v178RecordFate(network, walletAddress, activity?.hash, "accepted", { receiptTransfers: rpcTransfers.length, incomingHexTransfers: incomingHexTransfers.length, outgoingPaymentTransfers: outgoingPaymentTransfers.length, nativeSpent: nativePlsSpent, purchasedHex, usdSpent })

    return {
        network,
        networkKey: source.key,
        networkLabel: source.label,
        wallet: normalizedWallet,
        hash: activity?.hash,
        timestamp: rpcTimestamp,
        block: rpcBlockNumber,
        method: activity?.method,
        purchasedHex,
        purchasedHexRaw: [
            purchasedHexRaw.toString()
        ],
        nativePlsSpent,
        nativePlsRaw,
        payments,
        usdSpent,
        averagePrice:
            usdSpent !== null
                ? usdSpent / purchasedHex
                : null,
        pricingError: null
    }
}


export default function useHexDca({
    wallets = {},
    hiddenWallets = [],
    network = "mainnet",
    settings = defaultSettings
} = {}) {
    const [purchases, setPurchases] = useState([])
    const [walletErrors, setWalletErrors] = useState({})
    const [transactionErrors, setTransactionErrors] = useState([])
    const [loading, setLoading] = useState(false)
    const [progress, setProgress] = useState({
        current: 0,
        total: 0,
        stage: "idle",
        showPhases: false
    })

    const walletAddresses = useMemo(() => {
        if (Array.isArray(wallets)) {
            return [
                ...new Set(
                    wallets
                        .filter(Boolean)
                        .map(normalizeAddress)
                )
            ]
        }

        return [
            ...new Set(
                Object.keys(wallets ?? {})
                    .filter(Boolean)
                    .map(normalizeAddress)
            )
        ]
    }, [wallets])

    const walletKey = walletAddresses
        .slice()
        .sort()
        .join("|")

    useEffect(() => {
        let cancelled = false

        const loadHexPurchases = async () => {
            if (walletAddresses.length === 0) {
                setPurchases([])
                setWalletErrors({})
                setTransactionErrors([])
                setProgress({
                    current: 0,
                    total: 0,
                    stage: "idle"
                })
                setLoading(false)
                return
            }
const resultCacheKey =
    getDcaResultCacheKey({
        network: "lifetime",
        walletKey
    })

// V33: warm from independent wallet caches. Visibility is handled later by
// stats filtering, so adding or hiding an unrelated wallet never invalidates
// another wallet's HEX purchase history.
const cachedWallets = {}
const staleWallets = [...walletAddresses]

// Migrate the existing V6 combined cache into wallet-sized pieces once. This
// preserves the expensive scan users already completed before V33.
const legacyCombinedCache = readCachedDcaResult(resultCacheKey)
if (legacyCombinedCache) {
    for (const wallet of walletAddresses) {
        if (readDcaWalletCache(wallet)) continue
        const walletPurchases = (legacyCombinedCache.purchases ?? []).filter(p => normalizeAddress(p?.wallet) === normalizeAddress(wallet))
        const walletErrorSubset = Object.fromEntries(Object.entries(legacyCombinedCache.walletErrors ?? {}).filter(([key]) => key.endsWith(`:${normalizeAddress(wallet)}`)))
        const walletTxErrors = (legacyCombinedCache.transactionErrors ?? []).filter(e => normalizeAddress(e?.wallet) === normalizeAddress(wallet))
        const migrated = {
            purchases: walletPurchases, walletErrors: walletErrorSubset, transactionErrors: walletTxErrors,
            cachedAt: Number(legacyCombinedCache.cachedAt ?? Date.now())
        }
        safeLocalStorageSet(getDcaWalletCacheKey(wallet), JSON.stringify(migrated))
    }
}

for (const wallet of walletAddresses) {
    const cached = readDcaWalletCache(wallet)
    // Always key the in-memory cache by normalized address. Incremental scan
    // lookups also use normalized addresses; mixing checksum/original keys here
    // caused valid checkpoints to be missed and restarted lifetime history scans.
    if (cached) cachedWallets[normalizeAddress(wallet)] = cached
}

// v157: distinguish a genuinely new/uncached wallet from the cheap forward
// checkpoint refresh performed for wallets that already have a completed DCA.
const uncachedWallets = walletAddresses.filter(wallet => !cachedWallets[normalizeAddress(wallet)])
const showFullScanPhases = uncachedWallets.length > 0

const warmPurchases = Object.values(cachedWallets).flatMap(item => item?.purchases ?? [])
const warmWalletErrors = Object.values(cachedWallets).reduce((acc, item) => ({ ...acc, ...(item?.walletErrors ?? {}) }), {})
const warmTransactionErrors = Object.values(cachedWallets).flatMap(item => item?.transactionErrors ?? [])

if (warmPurchases.length > 0 || Object.keys(cachedWallets).length > 0) {
    setPurchases(warmPurchases)
    setWalletErrors(warmWalletErrors)
    setTransactionErrors(warmTransactionErrors)
    setProgress({ current: warmPurchases.length, total: warmPurchases.length, stage: "complete" })
    setLoading(false)
}

// Cached DCA is displayed immediately above. On a cold start, mark the DCA
// card busy BEFORE the RPC head probes. Those probes can take several seconds
// on a fresh install; previously the card misleadingly showed N/A during them.
            setLoading(true)
            setProgress({
                current: 0,
                total: 0,
                stage: showFullScanPhases ? "history" : "checkpoint",
                showPhases: showFullScanPhases
            })

// Cached DCA is displayed immediately above. Now do only a forward scan.
            const sourceHeads = {}
            for (const source of DCA_SOURCES) {
                try {
                    const rpcList = settings?.rpcs?.[source.network] ?? []
                    const rpcUrl = Array.isArray(rpcList) ? rpcList[0] : rpcList
                    const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
                    const liveHead = await provider.getBlockNumber()
                    sourceHeads[source.key] = source.maximumBlock == null ? Number(liveHead) : Math.min(Number(liveHead), Number(source.maximumBlock))
                } catch (error) {
                    sourceHeads[source.key] = source.maximumBlock ?? null
                }
            }

            // Incremental checks should be cheap. Once a per-chain checkpoint exists,
            // query the HEX contract logs directly between checkpoint+1 and the live head
            // instead of paging Blockscout history from newest -> oldest. The explorer v2
            // endpoint does not apply startBlock server-side, so even a tiny forward check
            // could otherwise walk many old pages before reaching the checkpoint.
            // Reuse one RPC provider per network for all wallet checks in this run.
            // Creating a new JsonRpcProvider for every wallet causes repeated network
            // detection/handshakes and made a tiny checkpoint scan feel much slower.
            const incrementalProviders = new Map()
            const fetchIncrementalIncomingHexLogs = async (wallet, source, startBlock, endBlock) => {
                if (!Number.isFinite(startBlock) || !Number.isFinite(endBlock) || startBlock > endBlock) return []
                const rpcList = settings?.rpcs?.[source.network] ?? []
                const rpcUrl = Array.isArray(rpcList) ? rpcList[0] : rpcList
                if (!rpcUrl) throw new Error(`No RPC configured for ${source.label}`)
                let provider = incrementalProviders.get(source.key)
                if (!provider) {
                    provider = new ethers.providers.JsonRpcProvider(rpcUrl)
                    incrementalProviders.set(source.key, provider)
                }
                const transferTopic = ethers.utils.id("Transfer(address,address,uint256)")
                const toTopic = ethers.utils.hexZeroPad(normalizeAddress(wallet), 32)
                const rowsByHash = new Map()
                // V228: keep the proven V226 bidirectional HEX-log discovery only; downstream verification uses the original stable FIFO scheduling. Build the exact same non-overlapping
                // block chunks as V225, but let two conservative workers claim chunks from
                // opposite ends of history. This tests the "meet in the middle" idea without
                // increasing the request fan-out beyond two simultaneous getLogs calls.
                // Ethereum remains single-direction/single-worker to preserve its locked path.
                const chunkSize = source.network === "ethereum" ? 25000 : 100000
                const chunks = []
                for (let fromBlock = startBlock; fromBlock <= endBlock; fromBlock += chunkSize) {
                    chunks.push({ fromBlock, toBlock: Math.min(endBlock, fromBlock + chunkSize - 1) })
                }

                let lowChunkIndex = 0
                let highChunkIndex = chunks.length - 1
                const claimChunk = direction => {
                    if (lowChunkIndex > highChunkIndex) return null
                    if (direction === "backward") return chunks[highChunkIndex--]
                    return chunks[lowChunkIndex++]
                }

                const scanChunk = async ({ fromBlock, toBlock }) => {
                    let logs = null
                    let lastError = null
                    for (let attempt = 1; attempt <= 4; attempt += 1) {
                        try {
                            logs = await provider.getLogs({
                                address: HEX_ADDRESS,
                                fromBlock,
                                toBlock,
                                topics: [transferTopic, null, toTopic]
                            })
                            break
                        } catch (error) {
                            lastError = error
                            if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 350 * attempt))
                        }
                    }
                    if (!logs) throw lastError ?? new Error(`Unable to read HEX logs ${fromBlock}-${toBlock}`)
                    for (const log of logs) {
                        const hash = String(log?.transactionHash ?? "").toLowerCase()
                        if (!hash || rowsByHash.has(hash)) continue
                        rowsByHash.set(hash, {
                            hash,
                            block: Number(log?.blockNumber ?? 0),
                            method: "",
                            timestamp: null,
                            value: "0",
                            originating_address: normalizeAddress(wallet),
                            dca_discovery_source: "incremental-rpc-hex-transfer",
                            discovered_token_address: HEX_ADDRESS
                        })
                    }
                }

                const scanDirection = async direction => {
                    while (!cancelled) {
                        const chunk = claimChunk(direction)
                        if (!chunk) return
                        await scanChunk(chunk)
                    }
                }

                if (source.key === "pulsechain" && chunks.length > 1) {
                    await Promise.all([scanDirection("forward"), scanDirection("backward")])
                } else {
                    await scanDirection("forward")
                }

                // Completion order is intentionally irrelevant. Return a deterministic order so
                // downstream classification receives the same candidate sequence in both apps.
                return [...rowsByHash.values()].sort((a, b) =>
                    Number(a?.block ?? 0) - Number(b?.block ?? 0) || String(a?.hash ?? "").localeCompare(String(b?.hash ?? ""))
                )
            }

            const getIncrementalStartBlock = (wallet, source) => {
                const cached = cachedWallets[normalizeAddress(wallet)]
                const checkpoint = Number(cached?.scanCheckpoints?.[source.key])
                if (Number.isFinite(checkpoint) && checkpoint > 0) return checkpoint + 1
                const matchingBlocks = (cached?.purchases ?? [])
                    .filter(p => (p?.networkKey ?? (p?.network === "ethereum" ? "ethereum" : "pulsechain")) === source.key)
                    .map(p => Number(p?.blockNumber ?? p?.block ?? 0))
                    .filter(n => Number.isFinite(n) && n > 0)
                if (matchingBlocks.length > 0) return Math.max(...matchingBlocks) + 1
                return Number(source.minimumBlock ?? 0)
            }

            // v59c: stale wallet history is still being refreshed even when a warm
            // cache is displayed. Keep DCA marked busy so Token P&L does not start
            // its own explorer crawl and rate-limit the Ethereum DCA scan.
            setLoading(true)

            if (Object.keys(cachedWallets).length === 0) {
                setPurchases([])
                setWalletErrors({})
                setTransactionErrors([])
            }
            setProgress({
                current: 0,
                total: 0,
                stage: "history",
                showPhases: showFullScanPhases
            })

            try {
    const candidates = []
    const combinedWalletErrors = {}
    // v177 diagnostic-only instrumentation. Do not alter discovery/classification.
    // Capture exactly what each runtime receives at every boundary so fluctuating
    // Web/Electron results can be localized to discovery vs verification.
    const v177ScanStartedAt = Date.now()
    // v215 diagnostics: timestamp the major pre-canonical boundaries without
    // changing discovery, classification, retry, or DCA behavior.
    let v215DiscoveryEndAt = null
    let v215InitialVerificationEndAt = null
    const v177Discovery = []
    // v188: this value is used by the PulseChain discovery diagnostics below.
    // Define it before the parallel discovery pass to avoid the temporal-dead-zone
    // failure that caused V187 to discard otherwise successful incoming-index rows.
    const v177Environment = (typeof navigator !== "undefined" && /electron/i.test(navigator.userAgent || "")) ? "ELECTRON" : "WEB"

    // v120: discover Ethereum and PulseChain history concurrently. They use
    // independent explorers/RPCs, so there is no reason to wait for Ethereum
    // discovery to finish before starting PulseChain. Verification already uses
    // separate network worker pools below.
    await Promise.all(DCA_SOURCES.map(async (source) => {
        if (cancelled) return

        // v121: keep independent discovery progress for both chains so parallel
        // history scans do not overwrite each other in the DCA card.
        setProgress(previous => ({
            ...previous,
            stage: "history",
            historyProgress: {
                ...(previous?.historyProgress ?? {}),
                [source.network]: { current: 0, collected: 0 }
            }
        }))

        let historyResult

        try {
            // v59: restore the original v2.4.0 activity-discovery path for BOTH
            // Ethereum and PulseChain. The v2.4.0 implementation already handled
            // Ethereum correctly; recent tokentx experiments bypassed information
            // that the downstream purchase parser expects. Keep the newer UI,
            // caching and progress display around this known-good path.
            // v72: Ethereum DCA discovery starts from the explorer's HEX token-transfer
            // index instead of every generic wallet transaction. This turns hundreds of
            // transaction-detail lookups into only the hashes where HEX actually entered
            // the wallet. PulseChain keeps its established full-activity path.
            if (source.network === "ethereum") {
                const activities = {}
                const errors = {}

                // v74: use Blockscout v2 incoming-transfer pagination for discovery.
                // The legacy /api?module=account&action=tokentx path was repeatedly
                // 429ing before page 1 could complete. This endpoint only walks
                // incoming ERC-20 transfers and filters HEX locally.
                for (const walletAddress of staleWallets) {
                    const normalizedWallet = normalizeAddress(walletAddress)
                    const startBlock = getIncrementalStartBlock(normalizedWallet, source)
                    const endBlock = Number(sourceHeads[source.key] ?? source.maximumBlock ?? Number.MAX_SAFE_INTEGER)
                    if (Number.isFinite(endBlock) && startBlock > endBlock) { activities[normalizedWallet] = []; continue }
                    try {
                        const hasCheckpoint = Number(cachedWallets[normalizedWallet]?.scanCheckpoints?.[source.key]) > 0
                        if (hasCheckpoint) {
                            activities[normalizedWallet] = await fetchIncrementalIncomingHexLogs(normalizedWallet, source, startBlock, endBlock)
                            continue
                        }
                        // v171: cold Ethereum discovery must be deterministic. Recent clean
                        // browser/Electron runs showed different Ethereum candidate totals even
                        // though the accepted Ethereum ledger had historically converged to the
                        // same 28 purchases. That means the Blockscout token-transfer index can
                        // transiently omit rows between requests. Run a small convergence loop and
                        // UNION hashes across passes instead of trusting a single snapshot. Stop as
                        // soon as a pass adds nothing; cap at three passes so a flaky explorer can
                        // never turn this into an unbounded scan.
                        const ethereumDiscoveryByHash = new Map()
                        let previousEthereumDiscoveryCount = -1
                        const ethereumDiscoveryStartedAt = Date.now()
                        for (let discoveryPass = 1; discoveryPass <= 3; discoveryPass += 1) {
                            const passRows = await fetchIncomingTokenTransferTransactions(
                                normalizedWallet,
                                HEX_ADDRESS,
                                source.network,
                                settings,
                                {
                                    maxPages: 100,
                                    delayBetweenPages: 550,
                                    retryAttempts: 5,
                                    startBlock: getIncrementalStartBlock(normalizedWallet, source),
                                    endBlock: sourceHeads[source.key] ?? source.maximumBlock ?? Number.MAX_SAFE_INTEGER,
                                    onProgress: progress => {
                                        setProgress(previous => ({
                                            ...previous,
                                            stage: "history",
                                            historyProgress: {
                                                ...(previous?.historyProgress ?? {}),
                                                [source.network]: {
                                                    current: Number(progress.page ?? 0),
                                                    collected: Math.max(
                                                        ethereumDiscoveryByHash.size,
                                                        Number(progress.collected ?? 0)
                                                    )
                                                }
                                            }
                                        }))
                                    }
                                }
                            )
                            for (const row of passRows) {
                                const hash = String(row?.hash ?? "").toLowerCase()
                                if (hash && !ethereumDiscoveryByHash.has(hash)) ethereumDiscoveryByHash.set(hash, row)
                            }
                            const currentCount = ethereumDiscoveryByHash.size
                            const added = previousEthereumDiscoveryCount < 0
                                ? currentCount
                                : currentCount - previousEthereumDiscoveryCount
                            dcaDiagnostic(`[HEX DCA V171] Ethereum discovery pass ${discoveryPass} ${normalizedWallet}: ${currentCount} unique hashes (${added >= 0 ? `+${added}` : added})`)
                            if (previousEthereumDiscoveryCount === currentCount) break
                            previousEthereumDiscoveryCount = currentCount
                            if (discoveryPass < 3) await new Promise(resolve => setTimeout(resolve, 700))
                        }
                        activities[normalizedWallet] = [...ethereumDiscoveryByHash.values()]
                        dcaDiagnostic(`[HEX DCA V171] Ethereum discovery converged ${normalizedWallet}: ${activities[normalizedWallet].length} hashes in ${((Date.now() - ethereumDiscoveryStartedAt) / 1000).toFixed(1)}s`)

                    } catch (error) {
                        activities[normalizedWallet] = []
                        errors[normalizedWallet] = error?.message ?? "Unable to retrieve Ethereum HEX transfer history"
                    }
                }

                historyResult = { activities, errors }
            } else {
                // v108 PULSECHAIN-ONLY discovery recovery, built directly on the locked
                // v106 Ethereum baseline. Ethereum above is intentionally untouched.
                // Use the two HEX-specific indexes that previously produced the strongest
                // PulseChain candidate set, instead of the generic activity crawl.
                const activities = {}
                const errors = {}

                for (const walletAddress of staleWallets) {
                    const normalizedWallet = normalizeAddress(walletAddress)
                    const startBlock = getIncrementalStartBlock(normalizedWallet, source)
                    const endBlock = Number(sourceHeads[source.key] ?? source.maximumBlock ?? Number.MAX_SAFE_INTEGER)
                    if (Number.isFinite(endBlock) && startBlock > endBlock) { activities[normalizedWallet] = []; continue }
                    const merged = new Map()
                    let successfulDiscoverySources = 0
                const failedDiscoverySources = []
                    const hasCheckpoint = Number(cachedWallets[normalizedWallet]?.scanCheckpoints?.[source.key]) > 0

                    // v199: on a cold PulseChain scan, start a direct HEX Transfer-log scan
                    // immediately and let it run in parallel with the explorer indexes below.
                    // Explorer pagination has repeatedly returned complete-looking but different
                    // subsets (61-65 purchases). Contract logs are the deterministic discovery
                    // floor: they tell us every tx in which this wallet received HEX. The normal
                    // classifier still decides whether each tx was a purchase, transfer, LP
                    // redemption, etc. Ethereum is intentionally unchanged here.
                    const v199PulseRpcDiscoveryPromise = (!hasCheckpoint && source.key === "pulsechain")
                        ? fetchIncrementalIncomingHexLogs(
                            normalizedWallet,
                            source,
                            Number(source.minimumBlock ?? PULSECHAIN_FIRST_BLOCK),
                            endBlock
                        ).catch(error => {
                            console.warn(`[HEX DCA V200 ${v177Environment}] Pulse RPC discovery failed; falling back to explorer union`, {
                                wallet: normalizedWallet,
                                message: error?.message ?? String(error)
                            })
                            return null
                        })
                        : null

                    // v200: the direct HEX Transfer log is now the authoritative cold-scan
                    // discovery source. Every real acquisition that leaves HEX in this wallet
                    // must emit an incoming HEX Transfer event, including router swaps. The
                    // explorer/activity union was useful as a diagnostic, but its pagination is
                    // demonstrably nondeterministic between Electron and the browser and was
                    // changing the classifier input from run to run. Do not union explorer-only
                    // hashes into a successful RPC scan. If RPC fails completely, fall through
                    // to the existing explorer path as a resilience fallback.
                    if (v199PulseRpcDiscoveryPromise) {
                        const authoritativeRpcRows = await v199PulseRpcDiscoveryPromise
                        if (Array.isArray(authoritativeRpcRows)) {
                            const rpcHashes = authoritativeRpcRows
                                .map(row => String(row?.hash ?? "").toLowerCase())
                                .filter(Boolean)
                                .sort()
                            activities[normalizedWallet] = authoritativeRpcRows
                            dcaDiagnostic(`[HEX DCA V200 ${v177Environment}] AUTHORITATIVE RPC DISCOVERY ${normalizedWallet}: ${rpcHashes.length} candidate hashes`)
                            dcaDiagnostic(`[HEX DCA V200 ${v177Environment}] AUTHORITATIVE RPC HASHES ${normalizedWallet}`, rpcHashes)
                            continue
                        }
                    }

                    if (hasCheckpoint) {
                        try {
                            const incrementalRows = await fetchIncrementalIncomingHexLogs(normalizedWallet, source, startBlock, endBlock)
                            activities[normalizedWallet] = incrementalRows
                            continue
                        } catch (error) {
                            // If the fast incremental RPC path is unavailable, preserve the
                            // existing explorer fallback so DCA verification can still complete.
                        }
                    }

                    try {
                        const incomingHex = await fetchIncomingTokenTransferTransactions(
                            normalizedWallet,
                            HEX_ADDRESS,
                            source.network,
                            settings,
                            {
                                maxPages: 100,
                                delayBetweenPages: 225,
                                retryAttempts: 3,
                                startBlock: getIncrementalStartBlock(normalizedWallet, source),
                                endBlock: sourceHeads[source.key] ?? source.maximumBlock ?? Number.MAX_SAFE_INTEGER,
                                onProgress: progress => {
                                    setProgress(previous => ({
                                        ...previous,
                                        stage: "history",
                                        historyProgress: {
                                            ...(previous?.historyProgress ?? {}),
                                            [source.network]: {
                                                current: Number(progress.page ?? 0),
                                                collected: Number(progress.collected ?? 0)
                                            }
                                        }
                                    }))
                                }
                            }
                        )
                        successfulDiscoverySources += 1
                        // v187 parity: Blockscout's address/token index has proven to return
                        // different complete-looking subsets to Electron and Web. One response
                        // is therefore not authoritative. Union three snapshots of this narrow
                        // HEX-only incoming index before candidate classification.
                        const incomingHexUnion = new Map()
                        const addIncomingSnapshot = rows => (rows ?? []).forEach(row => {
                            const hash = String(row?.hash ?? "").toLowerCase()
                            if (hash && !incomingHexUnion.has(hash)) incomingHexUnion.set(hash, row)
                        })
                        addIncomingSnapshot(incomingHex)
                        // v191: three fixed snapshots still produced different complete-looking
                        // candidate sets in Web and Electron (37 vs 36). Converge the *narrow*
                        // incoming-HEX index instead: continue only while new hashes are appearing,
                        // and require two quiet passes before trusting the union. This spends extra
                        // requests only when the explorer is actually fluctuating.
                        // v197: roll discovery back to V191's bounded convergence rule. V191 was the
                        // last test that reached 64/64 Electron/Web. The later fixed 8/16-snapshot
                        // unions increased runtime and actually widened parity (V196: 65/62). Stop
                        // after two quiet snapshots, with six passes maximum.
                        let v191IncomingQuietPasses = 0
                        for (let v191Pass = 2; v191Pass <= 6 && v191IncomingQuietPasses < 2; v191Pass += 1) {
                            try {
                                await new Promise(resolve => setTimeout(resolve, 450))
                                const before = incomingHexUnion.size
                                const extraIncoming = await fetchIncomingTokenTransferTransactions(
                                    normalizedWallet, HEX_ADDRESS, source.network, settings,
                                    {
                                        maxPages: 100,
                                        delayBetweenPages: 225,
                                        retryAttempts: 3,
                                        startBlock: getIncrementalStartBlock(normalizedWallet, source),
                                        endBlock: sourceHeads[source.key] ?? source.maximumBlock ?? Number.MAX_SAFE_INTEGER
                                    }
                                )
                                addIncomingSnapshot(extraIncoming)
                                const added = incomingHexUnion.size - before
                                v191IncomingQuietPasses = added === 0 ? v191IncomingQuietPasses + 1 : 0
                                dcaDiagnostic(`[HEX DCA V197 ${v177Environment}] incoming convergence pass ${v191Pass} ${normalizedWallet}: ${incomingHexUnion.size} hashes (+${added}), quiet=${v191IncomingQuietPasses}`)
                            } catch { /* retain the union from successful snapshots */ }
                        }
                        const canonicalIncomingHex = [...incomingHexUnion.values()]
                        canonicalIncomingHex.forEach(row => {
                            const hash = String(row?.hash ?? "").toLowerCase()
                            if (hash && !merged.has(hash)) merged.set(hash, { ...row, dca_discovery_source: row?.dca_discovery_source ?? "pulsechain-incoming-index-v187" })
                        })
                        v177Discovery.push({ network: "pulsechain", wallet: normalizedWallet, source: "incoming-index-v187-union", count: canonicalIncomingHex.length, hashes: canonicalIncomingHex.map(row => String(row?.hash ?? "").toLowerCase()).filter(Boolean) })
                        dcaDiagnostic(`[HEX DCA V187 ${v177Environment}] incoming HEX union ${normalizedWallet}: ${canonicalIncomingHex.length} hashes`)
                    } catch (error) {
                        failedDiscoverySources.push("incoming-index")
                        console.warn("HEX DCA PulseChain incoming index failed", {
                            wallet: normalizedWallet,
                            message: error?.message ?? String(error)
                        })
                    }

                    try {
                        const legacyHexTransfers = await fetchCompleteAddressTokenTransfers(
                            normalizedWallet,
                            source.network,
                            settings,
                            {
                                maxPages: 120,
                                pageSize: 250,
                                delayBetweenPages: 175,
                                retryAttempts: 5,
                                startBlock: getIncrementalStartBlock(normalizedWallet, source),
                                endBlock: sourceHeads[source.key] ?? source.maximumBlock ?? 99999999,
                                tokenAddress: HEX_ADDRESS,
                                onProgress: progress => {
                                    setProgress(previous => ({
                                        ...previous,
                                        stage: "history",
                                        historyProgress: {
                                            ...(previous?.historyProgress ?? {}),
                                            [source.network]: {
                                                current: Number(progress.page ?? 0),
                                                collected: Number(progress.collected ?? 0)
                                            }
                                        }
                                    }))
                                }
                            }
                        )
                        successfulDiscoverySources += 1
                        // v187: apply the same snapshot-union rule to the legacy HEX-specific
                        // transfer index. This is the source that exposed the 9d79/3b04/a8c6
                        // parity misses in earlier traces.
                        const legacyUnion = new Map()
                        const addLegacySnapshot = rows => (rows ?? []).forEach(row => {
                            const hash = String(row?.transaction_hash ?? row?.hash ?? "").toLowerCase()
                            const to = normalizeAddress(row?.to)
                            const key = `${hash}:${to}:${String(row?.value ?? row?.total?.value ?? "")}`
                            if (hash && !legacyUnion.has(key)) legacyUnion.set(key, row)
                        })
                        addLegacySnapshot(legacyHexTransfers)
                        // v191: use the same convergence rule for the legacy HEX index. Earlier
                        // traces showed that this source can expose a purchase that the v2 index
                        // omits, so neither source is allowed to win from one lucky snapshot.
                        // v197: restore V191's bounded convergence here too. Extra fixed snapshots
                        // were adding minutes without making the final candidate set deterministic.
                        let v191LegacyQuietPasses = 0
                        for (let v191Pass = 2; v191Pass <= 6 && v191LegacyQuietPasses < 2; v191Pass += 1) {
                            try {
                                await new Promise(resolve => setTimeout(resolve, 450))
                                const before = legacyUnion.size
                                const extraLegacy = await fetchCompleteAddressTokenTransfers(
                                    normalizedWallet, source.network, settings,
                                    {
                                        maxPages: 120,
                                        pageSize: 250,
                                        delayBetweenPages: 175,
                                        retryAttempts: 5,
                                        startBlock: getIncrementalStartBlock(normalizedWallet, source),
                                        endBlock: sourceHeads[source.key] ?? source.maximumBlock ?? 99999999,
                                        tokenAddress: HEX_ADDRESS
                                    }
                                )
                                addLegacySnapshot(extraLegacy)
                                const added = legacyUnion.size - before
                                v191LegacyQuietPasses = added === 0 ? v191LegacyQuietPasses + 1 : 0
                                dcaDiagnostic(`[HEX DCA V197 ${v177Environment}] legacy convergence pass ${v191Pass} ${normalizedWallet}: ${legacyUnion.size} rows (+${added}), quiet=${v191LegacyQuietPasses}`)
                            } catch { /* retain successful snapshots */ }
                        }
                        const canonicalLegacyHexTransfers = [...legacyUnion.values()]
                        v177Discovery.push({ network: "pulsechain", wallet: normalizedWallet, source: "legacy-index-v187-union", count: canonicalLegacyHexTransfers.length, hashes: canonicalLegacyHexTransfers.map(row => String(row?.transaction_hash ?? row?.hash ?? "").toLowerCase()).filter(Boolean) })
                        dcaDiagnostic(`[HEX DCA V187 ${v177Environment}] legacy HEX union ${normalizedWallet}: ${canonicalLegacyHexTransfers.length} rows`)
                        let added = 0
                        canonicalLegacyHexTransfers
                            .filter(row => normalizeAddress(row?.to) === normalizedWallet)
                            .forEach(row => {
                                const hash = String(row?.transaction_hash ?? row?.hash ?? "").toLowerCase()
                                if (!hash || merged.has(hash)) return
                                merged.set(hash, {
                                    hash,
                                    block: Number(row?.block_number ?? row?.block ?? 0),
                                    method: String(row?.method ?? ""),
                                    timestamp: row?.timestamp ?? null,
                                    value: "0",
                                    originating_address: normalizedWallet,
                                    dca_discovery_source: "pulsechain-hex-tokentx-v108"
                                })
                                added += 1
                            })
                    } catch (error) {
                        failedDiscoverySources.push("legacy-index")
                        console.warn("HEX DCA PulseChain legacy index failed", {
                            wallet: normalizedWallet,
                            message: error?.message ?? String(error)
                        })
                    }

                    // v176: removed the unconditional second HEX-index discovery pass.
                    // v175 repeated both paginated indexes for every wallet and added minutes
                    // without producing deterministic browser/Electron ledgers. The primary
                    // incoming + legacy union above remains authoritative; failed sources leave
                    // the checkpoint open so the next run can repair transient omissions.

                    // v109 PulseChain-only recovery: add the known-good v106 wallet-activity
                    // discovery as a THIRD source, but only after the two HEX-specific indexes.
                    // This is deliberately scoped to PulseChain; the locked Ethereum v106 path
                    // above is byte-for-byte unchanged. The activity source can expose router /
                    // internal purchase transactions that are absent from token-transfer indexes.
                    try {
                        const activitySupplement = !cachedWallets[normalizedWallet] ? await batchFetchCompleteActivities(
                            [normalizedWallet],
                            source.network,
                            settings,
                            {
                                maxPages: 250,
                                delayBetweenPages: 250,
                                retryAttempts: 3,
                                onProgress: progress => {
                                    setProgress(previous => ({
                                        ...previous,
                                        stage: "history",
                                        historyProgress: {
                                            ...(previous?.historyProgress ?? {}),
                                            [progress.network ?? source.network]: {
                                                current: Number(progress.page ?? 0),
                                                collected: Number(progress.collected ?? 0)
                                            }
                                        }
                                    }))
                                }
                            }
                        ) : { activities: { [normalizedWallet]: [] }, errors: {} }
                        const activityRows = activitySupplement?.activities?.[normalizedWallet] ?? []
                        v177Discovery.push({ network: "pulsechain", wallet: normalizedWallet, source: "activity-supplement", count: activityRows.length, hashes: activityRows.map(row => String(row?.hash ?? row?.transaction_hash ?? "").toLowerCase()).filter(Boolean) })
                        let activityAdded = 0
                        activityRows.forEach(row => {
                            const hash = String(row?.hash ?? row?.transaction_hash ?? "").toLowerCase()
                            if (!hash || merged.has(hash)) return
                            merged.set(hash, row)
                            activityAdded += 1
                        })
                        successfulDiscoverySources += 1
                    } catch (error) {
                        failedDiscoverySources.push("activity-supplement")
                        console.warn("HEX DCA PulseChain activity supplement failed", {
                            wallet: normalizedWallet,
                            message: error?.message ?? String(error)
                        })
                    }

                    // v199: union the direct RPC discovery floor with all explorer sources.
                    // This is deliberately additive: an RPC outage cannot erase explorer results,
                    // and an explorer omission cannot erase a hash proven by the HEX contract log.
                    if (v199PulseRpcDiscoveryPromise) {
                        const rpcRows = await v199PulseRpcDiscoveryPromise
                        if (Array.isArray(rpcRows)) {
                            let rpcAdded = 0
                            rpcRows.forEach(row => {
                                const hash = String(row?.hash ?? "").toLowerCase()
                                if (!hash || merged.has(hash)) return
                                merged.set(hash, row)
                                rpcAdded += 1
                            })
                            successfulDiscoverySources += 1
                            v177Discovery.push({
                                network: "pulsechain",
                                wallet: normalizedWallet,
                                source: "rpc-hex-transfer-v199",
                                count: rpcRows.length,
                                hashes: rpcRows.map(row => String(row?.hash ?? "").toLowerCase()).filter(Boolean)
                            })
                            dcaDiagnostic(`[HEX DCA V200 ${v177Environment}] Pulse RPC floor ${normalizedWallet}: ${rpcRows.length} hashes; +${rpcAdded} missing from explorer union`)
                        } else {
                            failedDiscoverySources.push("rpc-hex-transfer")
                        }
                    }

                    activities[normalizedWallet] = [...merged.values()]
                    dcaDiagnostic(`[HEX DCA V200 ${v177Environment}] DISCOVERY UNION ${normalizedWallet}: ${activities[normalizedWallet].length} unique candidate hashes`)
                    dcaDiagnostic(`[HEX DCA V200 ${v177Environment}] DISCOVERY HASHES ${normalizedWallet}`, activities[normalizedWallet].map(row => String(row?.hash ?? row?.transaction_hash ?? "").toLowerCase()).filter(Boolean).sort())
                    if (successfulDiscoverySources === 0) {
                        errors[normalizedWallet] = "Unable to retrieve PulseChain HEX transfer history"
                    } else if (failedDiscoverySources.length > 0) {
                        // Do not advance the wallet's PulseChain checkpoint after a partial
                        // discovery run. We can still display everything we found, but the
                        // next launch must be allowed to repair any transaction omitted by a
                        // transient explorer/browser failure.
                        errors[normalizedWallet] = `PulseChain history was only partially verified (${failedDiscoverySources.join(", ")})`
                    }
                }

                historyResult = { activities, errors }
            }
        } catch (error) {
            combinedWalletErrors[
                `${source.key}:general`
            ] =
                error?.message ??
                `Unable to retrieve ${source.label} history`

            return
        }

        if (cancelled) return


        const sourceErrors =
            historyResult?.errors ?? {}

        Object.entries(sourceErrors).forEach(
            ([walletAddress, error]) => {
                combinedWalletErrors[
                    `${source.key}:${walletAddress}`
                ] = error
            }
        )

        const activities =
            historyResult?.activities ?? {}

        Object.entries(activities).forEach(
            ([walletAddress, transactions]) => {
                const normalizedWallet =
                    normalizeAddress(walletAddress)

                ;(transactions ?? [])
                    .filter(activity => {
                        return isPossibleHexPurchase(
                            activity,
                            normalizedWallet,
                            source
                        )
                    })
                    .forEach(activity => {
                        candidates.push({
                            network: source.network,
                            networkKey: source.key,
                            networkLabel: source.label,
                            wallet: normalizedWallet,
                            hash: activity?.hash,
                            activity
                        })
                    })
            }
        )
    }))


    // v215: all chain/wallet history discovery has completed here.
    v215DiscoveryEndAt = Date.now()

    if (cancelled) {
        return
    }

    setWalletErrors(combinedWalletErrors)



    // v128: The same PulseChain transaction can arrive from more than one history
    // source. The old Map was "last candidate wins", which could replace a complete
    // candidate (block/value/method metadata present) with a thinner duplicate. That is
    // exactly what the v127 Wallet #4 trace exposed: several July 2025 hashes appeared
    // once with usable metadata and once with blockNumber=null, and the thin copy could
    // be the one classified. Merge duplicates instead and prefer the richer metadata.
    const v128CandidateMap = new Map()
    const v128HasValue = value => value !== undefined && value !== null && value !== ""
    const v128ActivityScore = candidate => {
        const a = candidate?.activity ?? {}
        return [
            a.blockNumber ?? a.block_number,
            a.timestamp ?? a.timeStamp,
            a.value,
            a.method,
            a.from,
            a.to
        ].reduce((score, value) => score + (v128HasValue(value) ? 1 : 0), 0)
    }
    const v128MergeCandidate = (existing, incoming) => {
        if (!existing) return incoming
        const richer = v128ActivityScore(incoming) > v128ActivityScore(existing) ? incoming : existing
        const other = richer === incoming ? existing : incoming
        const richerActivity = richer?.activity ?? {}
        const otherActivity = other?.activity ?? {}
        const mergedActivity = { ...otherActivity, ...richerActivity }
        for (const [key, value] of Object.entries(otherActivity)) {
            if (!v128HasValue(mergedActivity[key]) && v128HasValue(value)) mergedActivity[key] = value
        }
        return { ...other, ...richer, activity: mergedActivity }
    }
    for (const candidate of candidates) {
        const key =
            `${candidate.network}:` +
            `${candidate.wallet}:` +
            `${candidate.hash?.toLowerCase()}`
        v128CandidateMap.set(key, v128MergeCandidate(v128CandidateMap.get(key), candidate))
    }
    const uniqueCandidates = [...v128CandidateMap.values()]
    const v177CandidateRows = uniqueCandidates.map(candidate => ({
        network: candidate.networkKey ?? candidate.network ?? "unknown",
        wallet: normalizeAddress(candidate.wallet),
        hash: String(candidate.hash ?? "").toLowerCase(),
        source: candidate?.activity?.dca_discovery_source ?? candidate?.activity?.source ?? "unknown",
        block: Number(candidate?.activity?.blockNumber ?? candidate?.activity?.block_number ?? candidate?.activity?.block ?? 0) || 0,
        timestamp: candidate?.activity?.timestamp ?? candidate?.activity?.timeStamp ?? null
    })).filter(row => row.hash).sort((a,b) => a.network.localeCompare(b.network) || a.wallet.localeCompare(b.wallet) || a.hash.localeCompare(b.hash))
    // v180: legacy full candidate dump removed; targeted trace is emitted at completion.

                
                const initialCandidateTotalsByNetwork = uniqueCandidates.reduce((acc, candidate) => {
                    const rawKey = candidate.network ?? "unknown"
                    const key = rawKey === "mainnet" ? "pulsechain" : rawKey
                    acc[key] = (acc[key] ?? 0) + 1
                    return acc
                }, {})

                setProgress({
                    current: 0,
                    total: uniqueCandidates.length,
                    networkProgress: {
                        ethereum: { current: 0, total: initialCandidateTotalsByNetwork.ethereum ?? 0 },
                        pulsechain: { current: 0, total: initialCandidateTotalsByNetwork.pulsechain ?? 0 }
                    },
                    stage: "transactions",
                    showPhases: showFullScanPhases
                })

                const foundPurchases = []
                const detailErrors = []
                resetEthDcaRejectAudit()
                resetPulseDcaRejectAudit()
                v178CandidateFates.clear()

                // Receipt inspection is independent per transaction. Run a small
                // worker pool instead of serially waiting on every RPC call. Six
                // workers is fast enough to materially reduce scan time without
                // hammering the public RPC endpoints.
                // Public Ethereum RPCs rate-limit aggressive receipt bursts (HTTP 429).
                // Keep concurrent inspection, but cap it at 2 workers so DCA scanning
                // does not drown out the app's normal RPC traffic.
                // v112: Run network-specific pools. PulseChain receipt inspection is the
                // expensive bottleneck and can safely use more parallelism. Ethereum stays
                // deliberately conservative because its known-good explorer path must not
                // be destabilized by burst rate limits.
                const PULSECHAIN_TRANSACTION_WORKERS = 14
                const ETHEREUM_TRANSACTION_WORKERS = 3
                let nextCandidateIndex = 0
                let completedCandidates = 0
                const candidateTotalsByNetwork = uniqueCandidates.reduce((acc, candidate) => {
                    const rawKey = candidate.network ?? "unknown"
                    const key = rawKey === "mainnet" ? "pulsechain" : rawKey
                    acc[key] = (acc[key] ?? 0) + 1
                    return acc
                }, {})
                const completedCandidatesByNetwork = {}
                let cachedCandidateCount = 0
                let liveCandidateCount = 0
                const purchaseCountsByNetwork = {}
                // v126 diagnostic: trace PulseChain candidates BEFORE purchase classification.
                // This lets us see incoming HEX that never reaches the accepted/rejectedIncoming buckets.
                const v126PulsePreFilterTrace = []

                const inspectCandidate = async (candidate, countProgress = true, forcePulseExplorer = false) => {
                    const transactionCacheKey = getTransactionCacheKey({
                        network: candidate.network,
                        wallet: candidate.wallet,
                        hash: candidate.hash
                    })
                    const cachedResult = readCachedTransactionResult(transactionCacheKey)
                    // v117: DCA_SOURCES uses network="mainnet" for PulseChain. Older code
                    // accidentally treated those cached nulls as trustworthy because it only
                    // checked for the literal string "pulsechain". Never trust a cached negative
                    // for PulseChain; transient/incomplete receipts must be inspected again.
                    const isPulseChainCandidate =
                        candidate.networkKey === "pulsechain" ||
                        candidate.networkLabel === "PulseChain" ||
                        candidate.network === "mainnet" ||
                        candidate.network === "pulsechain"
                    // v167 parity: if discovery itself identifies this PulseChain transaction
                    // as HEX-related, do not let Electron/browser classify it from potentially
                    // different partial RPC receipts. Use the explorer-backed merged view on the
                    // first live inspection in both environments. This is deliberately narrow:
                    // ordinary PulseChain candidates keep the fast RPC path and Ethereum is untouched.
                    let v167PulseActivityHexHint = false
                    if (isPulseChainCandidate) {
                        try {
                            v167PulseActivityHexHint = JSON.stringify(candidate?.activity ?? {})
                                .toLowerCase()
                                .includes(HEX_ADDRESS)
                        } catch {
                            v167PulseActivityHexHint = false
                        }
                    }

                    // v170: an authoritative PulseChain parity pass must actually hit the
                    // explorer-backed path. A previously cached positive is useful during the
                    // normal fast pass, but allowing it here would make the "force" pass a no-op
                    // in whichever runtime happened to cache that hash first.
                    const usableCachedResult =
                        !forcePulseExplorer &&
                        cachedResult.hit && !(isPulseChainCandidate && !cachedResult.purchase)

                    try {
                        let purchase = null
                        if (usableCachedResult) {
                            cachedCandidateCount += 1
                            purchase = cachedResult.purchase
                            v178RecordFate(candidate.network, candidate.wallet, candidate.hash, purchase ? "accepted-cached" : "rejected-cached")
                        } else {
                            liveCandidateCount += 1
                            const isEthereumCandidate = candidate.network === "ethereum"
                            const startedAt = Date.now()
                            if (isEthereumCandidate) {
                            }

                            // v72: Ethereum candidates are already prefiltered to incoming HEX hashes; fetch detail only for those.
                            // v70 proved this path returns the historical block/timestamp/transfers
                            // that the public Ethereum receipt RPC was failing to provide. Avoiding
                            // the doomed receipt call removes the ~45s-per-candidate bottleneck.
                            const candidateTimeoutMs = isEthereumCandidate ? 18000 : 45000
                            let timeoutId = null
                            try {
                                let effectiveResult

                                if (isEthereumCandidate) {
                                    // v111 SPEED/INTEGRITY: the public Ethereum receipt RPC has
                                    // repeatedly returned empty transfer sets for the same hashes,
                                    // after which the known-good explorer path succeeds. Go straight
                                    // to that exact fallback path. Discovery and purchase parsing are
                                    // unchanged, so this removes wasted RPC time without changing the
                                    // Ethereum candidate set or classification logic.
                                    const explorerTx = await fetchExplorerTransaction(
                                        candidate.hash,
                                        candidate.network,
                                        settings,
                                        { retryAttempts: 2, minimumSpacingMs: 550 }
                                    )
                                    const explorerTransfers = Array.isArray(explorerTx?.token_transfers)
                                        ? explorerTx.token_transfers.map(transfer => ({
                                            tokenAddress: getTokenAddress(transfer),
                                            from: getAddress(transfer?.from),
                                            to: getAddress(transfer?.to),
                                            value: transfer?.total?.value ?? transfer?.value ?? "0"
                                        })).filter(transfer => transfer.tokenAddress && transfer.from && transfer.to)
                                        : []

                                    effectiveResult = {
                                        transfers: explorerTransfers,
                                        blockNumber: explorerTx?.block_number ?? explorerTx?.blockNumber ?? candidate.activity?.blockNumber ?? candidate.activity?.block_number ?? null,
                                        timestamp: explorerTx?.timestamp ?? candidate.activity?.timestamp ?? candidate.activity?.timeStamp ?? null,
                                        transactionValue: explorerTx?.value ?? candidate.activity?.value ?? "0"
                                    }
                                } else {
                                    effectiveResult = await Promise.race([
                                        decodeTransferLogs(
                                            candidate.hash,
                                            candidate.network,
                                            settings,
                                            { includeMetadata: true }
                                        ),
                                        new Promise((_, reject) => {
                                            timeoutId = setTimeout(() => reject(new Error(
                                                `HEX DCA candidate timed out after ${candidateTimeoutMs / 1000}s`
                                            )), candidateTimeoutMs)
                                        })
                                    ])

                                    // v119 PulseChain recovery: the public RPC intermittently returns
                                    // a valid receipt with no decodable Transfer logs. v118 showed this
                                    // "emptyReceipt" bucket is now the largest unexplained rejection.
                                    // Only for those empty PulseChain results, ask the explorer for the
                                    // full transaction and use its token_transfers. This keeps the fast
                                    // RPC path for normal candidates and leaves Ethereum completely alone.
                                    // v129 PulseChain recovery: explorer fallback is also required
                                    // when RPC decoded the Transfer logs but did not return block/timestamp
                                    // metadata. v127 showed the missing Wallet #4 July purchases in exactly
                                    // this state: valid incoming HEX transfers, but blockNumber=null. Previously
                                    // V119 only called the explorer for an *empty* receipt, so those candidates
                                    // reached extractRpcHexPurchase with missing metadata and were discarded.
                                    const v129MissingPulseMetadata =
                                        !Number.isFinite(Number(effectiveResult?.blockNumber)) ||
                                        !effectiveResult?.timestamp
                                    if (
                                        isPulseChainCandidate &&
                                        (
                                            forcePulseExplorer ||
                                            v167PulseActivityHexHint ||
                                            !Array.isArray(effectiveResult?.transfers) ||
                                            effectiveResult.transfers.length === 0 ||
                                            // v181: Blockscout/API responses that stop at exactly 10
                                            // transfer rows are a pagination/truncation signature. v180
                                            // proved the same tx can be 10 rows in Electron and 30 in Web.
                                            // Force the dedicated paginated transfer endpoint for these
                                            // candidates so runtime timing cannot change classification.
                                            effectiveResult.transfers.length === 10 ||
                                            v129MissingPulseMetadata
                                        )
                                    ) {
                                        try {
                                            const explorerTx = await fetchExplorerTransaction(
                                                candidate.hash,
                                                candidate.network,
                                                settings,
                                                { retryAttempts: 4, minimumSpacingMs: 250 }
                                            )
                                            // v180: the transaction-detail endpoint may truncate token_transfers
                                            // to 10 rows. Fetch the dedicated paginated transfer collection and
                                            // use it as the explorer view; fall back to the embedded rows only if
                                            // that endpoint fails.
                                            let explorerTransfers = []
                                            try {
                                                // v183 parity hardening: Blockscout can intermittently return a
                                                // different *complete-looking* snapshot for the same transaction
                                                // (V182 observed 10/11/12/30 rows across Web vs Electron). A single
                                                // paginated request therefore is not authoritative enough for a
                                                // transaction whose original receipt hit the suspicious 10-row cap.
                                                // For ONLY that narrow case, take three explorer snapshots and union
                                                // their transfer legs. This makes classification depend on the union
                                                // of observed legs rather than whichever runtime won the API race.
                                                const originalTransferCount = Array.isArray(effectiveResult?.transfers)
                                                    ? effectiveResult.transfers.length
                                                    : 0
                                                const snapshotCount = originalTransferCount === 10 ? 3 : 1
                                                const mergedExplorerTransfers = []
                                                const mergedExplorerKeys = new Set()
                                                for (let snapshotIndex = 0; snapshotIndex < snapshotCount; snapshotIndex += 1) {
                                                    const snapshot = await fetchExplorerTransactionTokenTransfers(
                                                        candidate.hash, candidate.network, settings,
                                                        { retryAttempts: 4, minimumSpacingMs: snapshotIndex === 0 ? 500 : 850, maxPages: 20 }
                                                    )
                                                    for (const transfer of snapshot) {
                                                        const key = [
                                                            normalizeAddress(transfer?.tokenAddress),
                                                            normalizeAddress(transfer?.from),
                                                            normalizeAddress(transfer?.to),
                                                            String(transfer?.value?.toString?.() ?? transfer?.value ?? "0")
                                                        ].join(":")
                                                        if (!mergedExplorerKeys.has(key)) {
                                                            mergedExplorerKeys.add(key)
                                                            mergedExplorerTransfers.push(transfer)
                                                        }
                                                    }
                                                    // Once we have escaped the known 10-row truncation shape,
                                                    // one extra confirming snapshot is unnecessary; the union is
                                                    // already strictly more informative than the original receipt.
                                                    if (snapshotIndex >= 1 && mergedExplorerTransfers.length > 10) break
                                                }
                                                explorerTransfers = mergedExplorerTransfers
                                            } catch {
                                                explorerTransfers = Array.isArray(explorerTx?.token_transfers)
                                                    ? explorerTx.token_transfers.map(transfer => ({
                                                        tokenAddress: getTokenAddress(transfer),
                                                        from: getAddress(transfer?.from),
                                                        to: getAddress(transfer?.to),
                                                        value: transfer?.total?.value ?? transfer?.value ?? "0"
                                                    })).filter(transfer => transfer.tokenAddress && transfer.from && transfer.to)
                                                    : []
                                            }

                                            // Keep the RPC transfers when they were already decoded successfully;
                                            // in the metadata-only failure case we only need the explorer's block/time.
                                            // If RPC was empty, use explorer token_transfers as before.
                                            const existingTransfers = Array.isArray(effectiveResult?.transfers)
                                                ? effectiveResult.transfers
                                                : []
                                            // v159 parity: on the controlled PulseChain retry, merge the RPC
                                            // and explorer views instead of trusting either transport alone.
                                            // Browser and Electron can occasionally receive different partial
                                            // receipt/log views for the same transaction. Deduping identical
                                            // transfer legs gives extractRpcHexPurchase one deterministic,
                                            // complete transaction view without double-counting HEX.
                                            // v182 deterministic truncation repair: v181 correctly detected
                                            // the 10-row truncation signature and fetched the dedicated paginated
                                            // transfer collection, but then accidentally kept the original 10 RPC
                                            // rows unless this was also a forced/hinted retry. That meant the repair
                                            // could fetch the complete view and then throw it away.
                                            //
                                            // When the original view is exactly 10 rows, prefer the dedicated
                                            // paginated explorer collection whenever it returned data. For forced
                                            // or HEX-hinted passes, continue merging both views as before.
                                            const v182TruncatedTenRowView = existingTransfers.length === 10
                                            const recoveredTransfers = (forcePulseExplorer || v167PulseActivityHexHint)
                                                ? (() => {
                                                    const merged = []
                                                    const seen = new Set()
                                                    ;[...existingTransfers, ...explorerTransfers].forEach(transfer => {
                                                        const key = [
                                                            normalizeAddress(transfer?.tokenAddress),
                                                            normalizeAddress(transfer?.from),
                                                            normalizeAddress(transfer?.to),
                                                            String(transfer?.value?.toString?.() ?? transfer?.value ?? "0")
                                                        ].join(":")
                                                        if (!seen.has(key)) {
                                                            seen.add(key)
                                                            merged.push(transfer)
                                                        }
                                                    })
                                                    return merged
                                                })()
                                                : (v182TruncatedTenRowView && explorerTransfers.length > 0
                                                    ? explorerTransfers
                                                    : (existingTransfers.length > 0 ? existingTransfers : explorerTransfers))

                                            if (v182TruncatedTenRowView) {
                                                v178RecordFate(candidate.network, candidate.wallet, candidate.hash, "v183-ten-row-union-recovered", {
                                                    originalTransferCount: existingTransfers.length,
                                                    explorerTransferCount: explorerTransfers.length,
                                                    recoveredTransferCount: recoveredTransfers.length
                                                })
                                            }

                                            effectiveResult = {
                                                ...effectiveResult,
                                                transfers: recoveredTransfers,
                                                blockNumber: explorerTx?.block_number ?? explorerTx?.blockNumber ?? effectiveResult?.blockNumber ?? candidate.activity?.blockNumber ?? candidate.activity?.block_number ?? null,
                                                timestamp: explorerTx?.timestamp ?? effectiveResult?.timestamp ?? candidate.activity?.timestamp ?? candidate.activity?.timeStamp ?? null,
                                                transactionValue: explorerTx?.value ?? effectiveResult?.transactionValue ?? candidate.activity?.value ?? "0"
                                            }

                                        } catch (fallbackError) {
                                            console.warn("HEX DCA PulseChain receipt fallback failed", {
                                                wallet: candidate.wallet,
                                                hash: candidate.hash,
                                                message: fallbackError?.message ?? String(fallbackError)
                                            })
                                        }
                                    }
                                }

                                if (isEthereumCandidate) {
                                }
                                // v126: capture what the receipt/explorer actually contained before
                                // extractRpcHexPurchase applies any purchase rules. Diagnostic only.
                                let v126TraceEntry = null
                                if (isPulseChainCandidate) {
                                    const transfers = Array.isArray(effectiveResult?.transfers) ? effectiveResult.transfers : []
                                    const normalizedWallet = normalizeAddress(candidate.wallet)
                                    const incomingHexTransfers = transfers.filter(t =>
                                        normalizeAddress(t?.tokenAddress) === HEX_ADDRESS &&
                                        normalizeAddress(t?.to) === normalizedWallet &&
                                        normalizeAddress(t?.from) !== ZERO_ADDRESS
                                    )
                                    const incomingHexRaw = incomingHexTransfers.reduce((sum, t) => {
                                        try { return sum + BigInt(t?.value?.toString?.() ?? t?.value ?? "0") }
                                        catch { return sum }
                                    }, 0n)
                                    const outgoingPayments = transfers.filter(t =>
                                        normalizeAddress(t?.from) === normalizedWallet &&
                                        normalizeAddress(t?.tokenAddress) !== HEX_ADDRESS
                                    )
                                    v126TraceEntry = {
                                        wallet: normalizedWallet,
                                        hash: String(candidate.hash ?? "").toLowerCase(),
                                        blockNumber: Number(effectiveResult?.blockNumber ?? candidate.activity?.blockNumber ?? candidate.activity?.block_number ?? 0) || null,
                                        timestamp: effectiveResult?.timestamp ?? candidate.activity?.timestamp ?? candidate.activity?.timeStamp ?? null,
                                        transferCount: transfers.length,
                                        incomingHexTransferCount: incomingHexTransfers.length,
                                        incomingHex: formatRawAmount(incomingHexRaw.toString(), 8),
                                        outgoingPaymentTransferCount: outgoingPayments.length,
                                        outgoingPayments: outgoingPayments.map(t => ({
                                            tokenAddress: normalizeAddress(t?.tokenAddress),
                                            to: normalizeAddress(t?.to),
                                            rawValue: t?.value?.toString?.() ?? t?.value ?? "0"
                                        })),
                                        nativeValue: effectiveResult?.transactionValue ?? candidate.activity?.value ?? "0",
                                        nativePls: formatRawAmount(String(effectiveResult?.transactionValue ?? candidate.activity?.value ?? "0"), 18),
                                        method: candidate.activity?.method ?? null,
                                        accepted: false
                                    }
                                    v126PulsePreFilterTrace.push(v126TraceEntry)
                                }

                                purchase = await extractRpcHexPurchase({
                                    rpcTransfers: Array.isArray(effectiveResult?.transfers) ? effectiveResult.transfers : [],
                                    rpcTimestamp: effectiveResult?.timestamp,
                                    rpcBlockNumber: effectiveResult?.blockNumber,
                                    activity: {
                                        ...candidate.activity,
                                        value: effectiveResult?.transactionValue ?? candidate.activity?.value ?? "0"
                                    },
                                    walletAddress: candidate.wallet,
                                    network: candidate.network,
                                    settings
                                })
                                if (v126TraceEntry) v126TraceEntry.accepted = Boolean(purchase)
                            } finally {
                                if (timeoutId) clearTimeout(timeoutId)
                            }
                            // v115 integrity: a transient/incomplete PulseChain receipt can look like
                            // a legitimate non-purchase. Cache confirmed purchases, but do not persist
                            // negative PulseChain classifications across scans. Ethereum behavior stays
                            // unchanged to preserve the known-good Ethereum discovery baseline.
                            if (purchase || !isPulseChainCandidate) {
                                writeCachedTransactionResult(transactionCacheKey, purchase)
                            }
                        }
                        if (purchase) {
                            foundPurchases.push(purchase)
                            const purchaseNetwork = candidate.networkLabel ?? candidate.network ?? "unknown"
                            purchaseCountsByNetwork[purchaseNetwork] = (purchaseCountsByNetwork[purchaseNetwork] ?? 0) + 1
                        }
                    } catch (error) {
                        v178RecordFate(candidate.network, candidate.wallet, candidate.hash, "verification-error", { message: error?.message ?? String(error) })
                        if (candidate.network === "ethereum") {
                            console.warn("HEX DCA Ethereum receipt failed", {
                                wallet: candidate.wallet,
                                hash: candidate.hash,
                                message: error?.message ?? String(error)
                            })
                        }
                        detailErrors.push({
                            network: candidate.network,
                            networkKey: candidate.networkKey,
                            networkLabel: candidate.networkLabel,
                            wallet: candidate.wallet,
                            hash: candidate.hash,
                            message: error?.message ?? "Unable to fetch transaction details"
                        })
                    } finally {
                        if (!countProgress) return
                        completedCandidates += 1
                        const rawProgressNetwork = candidate.network ?? "unknown"
                        const progressNetwork = rawProgressNetwork === "mainnet" ? "pulsechain" : rawProgressNetwork
                        completedCandidatesByNetwork[progressNetwork] =
                            (completedCandidatesByNetwork[progressNetwork] ?? 0) + 1
                        if (!cancelled) {
                            setProgress({
                                current: completedCandidatesByNetwork[progressNetwork],
                                total: candidateTotalsByNetwork[progressNetwork] ?? 0,
                                overallCurrent: completedCandidates,
                                overallTotal: uniqueCandidates.length,
                                network: progressNetwork,
                                networkProgress: {
                                    ethereum: {
                                        current: completedCandidatesByNetwork.ethereum ?? 0,
                                        total: candidateTotalsByNetwork.ethereum ?? 0
                                    },
                                    pulsechain: {
                                        current: completedCandidatesByNetwork.pulsechain ?? 0,
                                        total: candidateTotalsByNetwork.pulsechain ?? 0
                                    },
                                    mainnet: { current: 0, total: 0 }
                                },
                                stage: "transactions",
                                showPhases: showFullScanPhases
                            })
                        }
                    }
                }

                const runCandidatePool = async (poolCandidates, workerCount, staggerMs = 0) => {
                    let poolIndex = 0
                    const poolWorker = async workerIndex => {
                        if (workerIndex > 0 && staggerMs > 0) {
                            await new Promise(resolve => setTimeout(resolve, workerIndex * staggerMs))
                        }
                        while (!cancelled) {
                            const index = poolIndex++
                            if (index >= poolCandidates.length) return
                            await inspectCandidate(poolCandidates[index])
                        }
                    }
                    await Promise.all(Array.from(
                        { length: Math.min(workerCount, Math.max(1, poolCandidates.length)) },
                        (_, workerIndex) => poolWorker(workerIndex)
                    ))
                }

                const ethereumCandidates = uniqueCandidates.filter(candidate => candidate.network === "ethereum")
                // v117: PulseChain's configured network id is "mainnet". Put those candidates in
                // the intended 10-worker PulseChain pool instead of the 3-worker fallback pool.
                const pulsechainCandidates = uniqueCandidates.filter(candidate =>
                    candidate.networkKey === "pulsechain" ||
                    candidate.networkLabel === "PulseChain" ||
                    candidate.network === "mainnet" ||
                    candidate.network === "pulsechain"
                )
                const pulsechainCandidateKeys = new Set(pulsechainCandidates.map(candidate =>
                    `${candidate.network}:${candidate.wallet}:${String(candidate.hash ?? "").toLowerCase()}`
                ))
                const otherCandidates = uniqueCandidates.filter(candidate => {
                    if (candidate.network === "ethereum") return false
                    const key = `${candidate.network}:${candidate.wallet}:${String(candidate.hash ?? "").toLowerCase()}`
                    return !pulsechainCandidateKeys.has(key)
                })


                await Promise.all([
                    runCandidatePool(ethereumCandidates, ETHEREUM_TRANSACTION_WORKERS, 250),
                    runCandidatePool(pulsechainCandidates, PULSECHAIN_TRANSACTION_WORKERS, 45),
                    runCandidatePool(otherCandidates, 3, 100)
                ])
                // v215: first-pass transaction verification boundary. Everything between
                // this point and canonical start is retry/reconciliation/diagnostic prep.
                v215InitialVerificationEndAt = Date.now()

                // v159 parity repair: Electron and browser use different transport paths,
                // so an otherwise valid PulseChain receipt can occasionally decode empty on
                // the browser's first attempt. PulseChain negative classifications are already
                // intentionally uncached; give only the unmatched PulseChain candidates one
                // controlled second pass before pricing/caching. This makes the final ledger
                // deterministic without touching the known-good Ethereum path.
                const firstPassPulseHashes = new Set(
                    foundPurchases
                        .filter(purchase => (
                            purchase?.network === "pulsechain" ||
                            purchase?.network === "mainnet" ||
                            purchase?.networkKey === "pulsechain" ||
                            purchase?.networkLabel === "PulseChain"
                        ))
                        .map(purchase => String(purchase?.hash ?? purchase?.transactionHash ?? "").toLowerCase())
                        .filter(Boolean)
                )
                // v160: Do NOT blindly re-run every non-purchase PulseChain candidate.
                // v159 did that to repair browser/Electron parity, but on wallets with hundreds
                // of ordinary non-purchase transactions it created a hidden second explorer scan
                // after the visible counters had already reached 100%.
                //
                // Retry only candidates whose first-pass receipt/explorer view still looked
                // incomplete or purchase-like: no transfers at all, missing block/time metadata,
                // or incoming HEX that failed classification. These are the only cases where a
                // second transport view can materially change the result.
                const retryablePulseKeys = new Set(
                    v126PulsePreFilterTrace
                        .filter(trace => (
                            Number(trace?.transferCount ?? 0) === 0 ||
                            !Number.isFinite(Number(trace?.blockNumber)) ||
                            !trace?.timestamp ||
                            Number(trace?.incomingHex ?? 0) > 0
                        ))
                        .map(trace => `${normalizeAddress(trace?.wallet)}:${String(trace?.hash ?? "").toLowerCase()}`)
                )

                // v162 parity repair: a partial PulseChain RPC receipt can contain *some*
                // transfers while omitting the incoming HEX leg. v160's retry filter treated
                // that as a complete non-purchase (transferCount > 0, metadata present,
                // incomingHex == 0), which let browser and Electron classify the same candidate
                // differently even though discovery produced identical candidate totals.
                //
                // The discovery activity itself often still carries the HEX contract/address
                // hint. Retry those unmatched candidates through the explorer as well. This is
                // much narrower than v159's expensive retry of every non-purchase candidate.
                const pulseActivityHexHintKeys = new Set(
                    pulsechainCandidates
                        .filter(candidate => {
                            try {
                                return JSON.stringify(candidate?.activity ?? {})
                                    .toLowerCase()
                                    .includes(HEX_ADDRESS)
                            } catch {
                                return false
                            }
                        })
                        .map(candidate => `${normalizeAddress(candidate?.wallet)}:${String(candidate?.hash ?? "").toLowerCase()}`)
                )
                pulseActivityHexHintKeys.forEach(key => retryablePulseKeys.add(key))
                const pulseRetryCandidates = pulsechainCandidates.filter(candidate => {
                    const hash = String(candidate?.hash ?? "").toLowerCase()
                    if (!hash || firstPassPulseHashes.has(hash)) return false
                    return retryablePulseKeys.has(`${normalizeAddress(candidate?.wallet)}:${hash}`)
                })
                if (pulseRetryCandidates.length > 0) {
                    const v169FinalizationStartedAt = Date.now()
                    if (!cancelled) {
                        setProgress({
                            current: 0,
                            total: pulseRetryCandidates.length,
                            stage: "finalizing",
                            showPhases: showFullScanPhases
                        })
                    }
                    let retryIndex = 0
                    let completedRetries = 0
                    const retryWorker = async () => {
                        while (!cancelled) {
                            const index = retryIndex++
                            if (index >= pulseRetryCandidates.length) return
                            await inspectCandidate(pulseRetryCandidates[index], false, true)
                            completedRetries += 1
                            if (!cancelled) {
                                setProgress({
                                    current: completedRetries,
                                    total: pulseRetryCandidates.length,
                                    stage: "finalizing",
                                    showPhases: showFullScanPhases
                                })
                            }
                        }
                    }
                    await Promise.all(Array.from(
                        { length: Math.min(10, pulseRetryCandidates.length) },
                        () => retryWorker()
                    ))
                    dcaDiagnostic(`[HEX DCA V169] PulseChain final recovery: ${pulseRetryCandidates.length} candidates in ${((Date.now() - v169FinalizationStartedAt) / 1000).toFixed(1)}s`)
                }

                // v186 deterministic Pulse purchase-set rebuild:
                // V185 made pricing converge, but Electron/Web could still finish with a
                // different accepted Pulse purchase set (for example 38 vs 36). The V185
                // rebuild also depended on the transaction-detail endpoint succeeding before
                // it ever queried the dedicated transfer endpoint; a transient detail failure
                // therefore produced 0/N rebuilt purchases.
                //
                // Rebuild the narrow Pulse purchase-shaped set directly from the dedicated,
                // paginated token-transfer endpoint. Do not require transaction-detail. Union
                // repeated snapshots, classify that stable union, and replace the provisional
                // Pulse purchases only when we obtained a usable canonical result. Ethereum is
                // deliberately untouched.
                try {
                    const provisionalPulseKeys = new Set(foundPurchases
                        .filter(p => p?.network === "pulsechain" || p?.network === "mainnet" || p?.networkKey === "pulsechain" || p?.networkLabel === "PulseChain")
                        .map(p => `${normalizeAddress(p?.wallet)}:${String(p?.hash ?? p?.transactionHash ?? "").toLowerCase()}`))

                    const canonicalCandidates = pulsechainCandidates.filter(candidate => {
                        const key = `${normalizeAddress(candidate?.wallet)}:${String(candidate?.hash ?? "").toLowerCase()}`
                        if (provisionalPulseKeys.has(key)) return true
                        try {
                            return JSON.stringify(candidate?.activity ?? {}).toLowerCase().includes(HEX_ADDRESS)
                        } catch {
                            return false
                        }
                    })

                    // v190 diagnostic: compare the exact candidate set entering the canonical
                    // Pulse rebuild before any transfer fetch/classification can change the result.
                    // This is diagnostic-only and intentionally does not alter discovery or math.
                    try {
                        const provisionalHashes = Array.from(provisionalPulseKeys).sort()
                        const canonicalRows = canonicalCandidates.map(candidate => ({
                            wallet: normalizeAddress(candidate?.wallet),
                            hash: String(candidate?.hash ?? "").toLowerCase(),
                            source: String(candidate?.source ?? candidate?.activity?.source ?? "?"),
                            block: Number(candidate?.activity?.blockNumber ?? candidate?.activity?.block_number ?? candidate?.activity?.block ?? 0) || 0
                        })).filter(row => row.hash).sort((a, b) => a.hash.localeCompare(b.hash))
                        dcaDiagnostic(`[HEX DCA V197 ${v177Environment}] PRE-CLASSIFICATION CANDIDATE AUDIT`)
                        dcaDiagnostic(`[V197 ${v177Environment}] provisionalPulse=${provisionalHashes.length} canonicalCandidates=${canonicalRows.length}`)
                        dcaDiagnostic(`[V197 ${v177Environment}] provisional keys`, provisionalHashes)
                        dcaDiagnostic(`[V197 ${v177Environment}] canonical candidates`, canonicalRows)
                        dcaDiagnostic()
                    } catch (v190AuditError) {
                        console.warn("[HEX DCA V197] pre-classification audit failed", v190AuditError)
                    }

                    const rebuiltByKey = new Map()
                    const successfullyClassifiedKeys = new Set()
                    let canonicalCursor = 0
                    let canonicalCompleted = 0
                    // v215 diagnostics: preserve V214 timing and split the previously
                    // unexplained pre-canonical time into discovery, first-pass verification,
                    // and retry/reconciliation work.
                    const v214CanonicalStartedAt = Date.now()
                    const v215DiscoveryElapsedMs = Math.max(0, (v215DiscoveryEndAt ?? v214CanonicalStartedAt) - v177ScanStartedAt)
                    const v215InitialVerificationElapsedMs = Math.max(0, (v215InitialVerificationEndAt ?? v214CanonicalStartedAt) - (v215DiscoveryEndAt ?? v177ScanStartedAt))
                    const v215RetryReconciliationElapsedMs = Math.max(0, v214CanonicalStartedAt - (v215InitialVerificationEndAt ?? v215DiscoveryEndAt ?? v177ScanStartedAt))
                    const v215PreCanonicalElapsedMs = Math.max(0, v214CanonicalStartedAt - v177ScanStartedAt)
                    if (!cancelled) {
                        setProgress({
                            current: 0,
                            total: canonicalCandidates.length,
                            stage: "canonical",
                            showPhases: showFullScanPhases
                        })
                    }
                    // v231 controlled test: raise ONLY canonical worker concurrency 12 -> 14.
                    // Canonical evidence semantics remain three fresh RPC reads per candidate; no early-exit or reuse shortcut is changed.
                    const canonicalWorkers = Array.from({ length: Math.min(14, canonicalCandidates.length) }, async () => {
                        while (!cancelled) {
                            const i = canonicalCursor++
                            if (i >= canonicalCandidates.length) return
                            const candidate = canonicalCandidates[i]
                            const key = `${normalizeAddress(candidate?.wallet)}:${String(candidate?.hash ?? "").toLowerCase()}`
                            try {
                                const merged = []
                                const seen = new Set()
                                let canonicalMetadata = null

                                // v203: classify from the immutable RPC receipt first. Explorer
                                // transaction-transfer endpoints were the last nondeterministic input:
                                // V201/V202 could discover the same 114 candidates but still accept a
                                // different purchase in Electron vs Web. A mined receipt is canonical,
                                // so one successful RPC decode is enough. Retry transient RPC failures;
                                // use the stabilized explorer union only as a fallback when every RPC
                                // attempt fails.
                                // v208: V207 proved a "successful" RPC snapshot can still be
                                // incomplete. Take all three snapshots and union them instead of
                                // stopping after the first response. Seed the union with any stronger
                                // evidence already observed by the provisional classifier.
                                const priorEvidence = v208MergeCanonicalTransfers(
                                    candidate.network, candidate.wallet, candidate.hash
                                )
                                priorEvidence.forEach(t => {
                                    const transferKey = v208TransferKey(t)
                                    if (!seen.has(transferKey)) { seen.add(transferKey); merged.push(t) }
                                })

                                let successfulRpcSnapshots = 0
                                // v224 SAFETY REVERT: V223 proved that reducing canonical verification to two fresh RPC reads
                                // can lose a known-good purchase in one environment. Keep prior evidence seeded into
                                // the union, but restore the proven three fresh canonical RPC reads for every candidate.
                                // This deliberately prioritizes parity/consistency over the V223 timing experiment.
                                const v223CanonicalRpcPasses = 3
                                for (let pass = 0; pass < v223CanonicalRpcPasses; pass += 1) {
                                    try {
                                        const rpcSnapshot = await decodeTransferLogs(
                                            candidate.hash,
                                            candidate.network,
                                            settings,
                                            { includeMetadata: true }
                                        )
                                        if (rpcSnapshot && Array.isArray(rpcSnapshot.transfers)) {
                                            successfulRpcSnapshots += 1
                                            // Prefer the snapshot with usable metadata, but never let a
                                            // later metadata-poor response replace it.
                                            if (
                                                !canonicalMetadata ||
                                                (!canonicalMetadata?.timestamp && rpcSnapshot?.timestamp) ||
                                                (!Number.isFinite(Number(canonicalMetadata?.blockNumber)) && Number.isFinite(Number(rpcSnapshot?.blockNumber)))
                                            ) canonicalMetadata = rpcSnapshot

                                            rpcSnapshot.transfers.forEach(t => {
                                                const transferKey = v208TransferKey(t)
                                                if (!seen.has(transferKey)) { seen.add(transferKey); merged.push(t) }
                                            })
                                        }
                                    } catch {
                                        if (pass < v223CanonicalRpcPasses - 1) await wait(250 * (pass + 1))
                                    }
                                }

                                // Persist the canonical union before classification so every later
                                // invocation sees the same-or-stronger transaction evidence.
                                const stabilizedRpcUnion = v208MergeCanonicalTransfers(
                                    candidate.network, candidate.wallet, candidate.hash, merged
                                )
                                merged.length = 0
                                stabilizedRpcUnion.forEach(t => {
                                    const transferKey = v208TransferKey(t)
                                    if (!seen.has(transferKey)) seen.add(transferKey)
                                    merged.push(t)
                                })

                                // v209: V208 finally isolated the remaining 68-vs-69 mismatch to
                                // source evidence, not classifier math. The two traced transactions can
                                // return complete-looking but different RPC receipts between Electron
                                // and Web (for example a8c6... with 10 vs 30 transfer legs, and f3b19...
                                // with 10 vs 12). For ONLY those two known-divergent hashes, augment the
                                // RPC union with the explorer transfer endpoint even when RPC succeeded.
                                // This keeps the normal 114-candidate path fast while making the two
                                // unstable receipts converge on the strongest evidence either source has.
                                const forceExplorerAugment = v180IsTraceHash(candidate.hash)
                                if (forceExplorerAugment || !successfulRpcSnapshots || !merged.length) {
                                    let successfulSnapshots = 0
                                    let stableSnapshots = 0
                                    let previousFingerprint = ""
                                    const maxExplorerPasses = forceExplorerAugment ? 8 : 6
                                    for (let pass = 0; pass < maxExplorerPasses; pass += 1) {
                                        try {
                                            const snapshot = await fetchExplorerTransactionTokenTransfers(
                                                candidate.hash, candidate.network, settings,
                                                { retryAttempts: 5, minimumSpacingMs: 650 + pass * 250, maxPages: 30 }
                                            )
                                            successfulSnapshots += 1
                                            snapshot.forEach(t => {
                                                const transferKey = v208TransferKey(t)
                                                if (!seen.has(transferKey)) { seen.add(transferKey); merged.push(t) }
                                            })
                                            const fingerprint = [...seen].sort().join("|")
                                            if (fingerprint && fingerprint === previousFingerprint) stableSnapshots += 1
                                            else stableSnapshots = 0
                                            previousFingerprint = fingerprint
                                            // Require two unchanged confirming snapshots for the known
                                            // divergent hashes; ordinary fallback keeps the old bound.
                                            if (forceExplorerAugment) {
                                                if (successfulSnapshots >= 4 && stableSnapshots >= 2) break
                                            } else if (successfulSnapshots >= 3 && stableSnapshots >= 1) break
                                        } catch { /* another fallback snapshot may still succeed */ }
                                    }
                                    if (!merged.length) continue

                                    const stabilizedCrossSourceUnion = v208MergeCanonicalTransfers(
                                        candidate.network, candidate.wallet, candidate.hash, merged
                                    )
                                    merged.length = 0
                                    seen.clear()
                                    stabilizedCrossSourceUnion.forEach(t => {
                                        const transferKey = v208TransferKey(t)
                                        if (!seen.has(transferKey)) { seen.add(transferKey); merged.push(t) }
                                    })
                                    if (forceExplorerAugment) {
                                        dcaDiagnostic(`[HEX DCA V209 ${v177Environment}] cross-source union ${String(candidate.hash ?? "").toLowerCase()}: ${merged.length} transfers (${successfulRpcSnapshots} RPC snapshots, ${successfulSnapshots} explorer snapshots)`)
                                    }
                                }

                                // The candidate was discovered by the explorer, so its activity
                                // metadata is sufficient for classification. This intentionally
                                // avoids making canonicalization depend on a second flaky detail API.
                                const activity = {
                                    ...candidate.activity,
                                    hash: candidate.hash,
                                    value: candidate.activity?.value ?? "0"
                                }
                                const rebuilt = await extractRpcHexPurchase({
                                    rpcTransfers: merged,
                                    rpcTimestamp: canonicalMetadata?.timestamp ?? candidate.activity?.timestamp ?? candidate.activity?.timeStamp ?? null,
                                    rpcBlockNumber: canonicalMetadata?.blockNumber ?? candidate.activity?.blockNumber ?? candidate.activity?.block_number ?? candidate.activity?.block ?? null,
                                    activity: {
                                        ...activity,
                                        value: canonicalMetadata?.transactionValue ?? activity.value ?? "0"
                                    },
                                    walletAddress: candidate.wallet,
                                    network: candidate.network,
                                    settings
                                })
                                // v202: never let a transient negative canonical fetch erase a
                                // purchase that the first pass already proved. A null rebuild means
                                // "canonical view was insufficient", not "definitely not a purchase".
                                // Positive canonical results remain authoritative and can replace the
                                // provisional row with the stabilized transfer union above.
                                if (rebuilt) {
                                    successfullyClassifiedKeys.add(key)
                                    rebuiltByKey.set(key, rebuilt)
                                } else if (!provisionalPulseKeys.has(key)) {
                                    successfullyClassifiedKeys.add(key)
                                } else {
                                    v178RecordFate(candidate.network, candidate.wallet, candidate.hash, "v202-preserved-provisional-positive")
                                }
                            } catch { /* preserve provisional result when canonical data is unusable */ }
                            finally {
                                canonicalCompleted += 1
                                if (!cancelled) {
                                    setProgress({
                                        current: canonicalCompleted,
                                        total: canonicalCandidates.length,
                                        stage: "canonical",
                                        showPhases: showFullScanPhases
                                    })
                                }
                            }
                        }
                    })
                    await Promise.all(canonicalWorkers)
                    const v214CanonicalElapsedMs = Date.now() - v214CanonicalStartedAt

                    // v212: deterministic settlement sweep. V211 proved the candidate set is
                    // stable (114) while a small number of candidates can fall through the
                    // parallel canonical workers because every RPC/explorer attempt for that
                    // candidate happened to fail in that run. Those unclassified candidates
                    // were the source of the repeatable 69 vs intermittent 67/68 results.
                    // Retry ONLY unresolved candidates, serially, after the parallel pass has
                    // gone quiet. This avoids request contention and gives each unresolved tx
                    // a fresh cross-source union before we allow the manifest to be finalized.
                    const v212UnresolvedBefore = canonicalCandidates.filter(candidate => {
                        const key = `${normalizeAddress(candidate?.wallet)}:${String(candidate?.hash ?? "").toLowerCase()}`
                        return !successfullyClassifiedKeys.has(key)
                    })
                    let v212Settled = 0
                    let v212StillUnresolved = 0
                    const v212SettledHashes = []
                    const v212UnresolvedHashes = []

                    // v213: keep the proven v212 settlement algorithm intact, but settle two
                    // independent candidates at a time. This trims the long serial tail without
                    // increasing request pressure enough to recreate the web/electron race that
                    // v212 fixed. Each candidate still gets the exact same RPC + explorer evidence
                    // sweep before it is allowed to affect the final manifest.
                    let v213SettlementCompleted = 0
                    let v213SettlementIndex = 0
                    const v214SettlementStartedAt = Date.now()
                    if (v212UnresolvedBefore.length && !cancelled) {
                        setProgress({
                            current: 0,
                            total: v212UnresolvedBefore.length,
                            stage: "settlement",
                            showPhases: showFullScanPhases
                        })
                    }

                    const v213SettlementWorkerCount = Math.min(6, v212UnresolvedBefore.length)
                    const v213SettlementWorkers = Array.from({ length: v213SettlementWorkerCount }, async () => {
                        while (!cancelled) {
                            const candidateIndex = v213SettlementIndex++
                            if (candidateIndex >= v212UnresolvedBefore.length) break
                            const candidate = v212UnresolvedBefore[candidateIndex]
                            try {
                            if (cancelled) break
                            const key = `${normalizeAddress(candidate?.wallet)}:${String(candidate?.hash ?? "").toLowerCase()}`
                            const merged = []
                            const seen = new Set()
                            let canonicalMetadata = null
                            let gotUsableEvidence = false

                            const addTransfers = transfers => {
                                if (!Array.isArray(transfers)) return
                                for (const t of transfers) {
                                    const transferKey = v208TransferKey(t)
                                    if (!seen.has(transferKey)) {
                                        seen.add(transferKey)
                                        merged.push(t)
                                    }
                                }
                            }

                            try {
                                // Start with every transfer leg already learned anywhere in this run.
                                addTransfers(v208MergeCanonicalTransfers(
                                    candidate.network, candidate.wallet, candidate.hash
                                ))

                                // Fresh RPC attempts are deliberately serial here. A successful receipt
                                // is unioned rather than replacing earlier evidence.
                                for (let pass = 0; pass < 4; pass += 1) {
                                    try {
                                        const rpcSnapshot = await decodeTransferLogs(
                                            candidate.hash, candidate.network, settings,
                                            { includeMetadata: true }
                                        )
                                        if (rpcSnapshot && Array.isArray(rpcSnapshot.transfers)) {
                                            gotUsableEvidence = true
                                            addTransfers(rpcSnapshot.transfers)
                                            if (
                                                !canonicalMetadata ||
                                                (!canonicalMetadata?.timestamp && rpcSnapshot?.timestamp) ||
                                                (!Number.isFinite(Number(canonicalMetadata?.blockNumber)) && Number.isFinite(Number(rpcSnapshot?.blockNumber)))
                                            ) canonicalMetadata = rpcSnapshot
                                        }
                                    } catch { /* explorer settlement below can still recover it */ }
                                    if (pass < 3) await wait(350 * (pass + 1))
                                }

                                // Always add explorer evidence for unresolved candidates. Requiring two
                                // unchanged fingerprints prevents one partial explorer response from
                                // becoming authoritative.
                                let previousFingerprint = ""
                                let stableSnapshots = 0
                                let successfulSnapshots = 0
                                for (let pass = 0; pass < 8; pass += 1) {
                                    try {
                                        const snapshot = await fetchExplorerTransactionTokenTransfers(
                                            candidate.hash, candidate.network, settings,
                                            { retryAttempts: 6, minimumSpacingMs: 900 + pass * 300, maxPages: 30 }
                                        )
                                        successfulSnapshots += 1
                                        gotUsableEvidence = true
                                        addTransfers(snapshot)
                                        const fingerprint = [...seen].sort().join("|")
                                        if (fingerprint && fingerprint === previousFingerprint) stableSnapshots += 1
                                        else stableSnapshots = 0
                                        previousFingerprint = fingerprint
                                        if (successfulSnapshots >= 3 && stableSnapshots >= 2) break
                                    } catch { /* keep trying this one unresolved transaction */ }
                                }

                                if (gotUsableEvidence && merged.length) {
                                    const stabilized = v208MergeCanonicalTransfers(
                                        candidate.network, candidate.wallet, candidate.hash, merged
                                    )
                                    const activity = {
                                        ...candidate.activity,
                                        hash: candidate.hash,
                                        value: candidate.activity?.value ?? "0"
                                    }
                                    const rebuilt = await extractRpcHexPurchase({
                                        rpcTransfers: stabilized,
                                        rpcTimestamp: canonicalMetadata?.timestamp ?? candidate.activity?.timestamp ?? candidate.activity?.timeStamp ?? null,
                                        rpcBlockNumber: canonicalMetadata?.blockNumber ?? candidate.activity?.blockNumber ?? candidate.activity?.block_number ?? candidate.activity?.block ?? null,
                                        activity: {
                                            ...activity,
                                            value: canonicalMetadata?.transactionValue ?? activity.value ?? "0"
                                        },
                                        walletAddress: candidate.wallet,
                                        network: candidate.network,
                                        settings
                                    })

                                    if (rebuilt) {
                                        successfullyClassifiedKeys.add(key)
                                        rebuiltByKey.set(key, rebuilt)
                                        v212Settled += 1
                                        v212SettledHashes.push(String(candidate.hash ?? "").toLowerCase())
                                    } else if (!provisionalPulseKeys.has(key)) {
                                        // We obtained stable evidence and positively classified this as
                                        // a rejection. Marking it classified is safe and deterministic.
                                        successfullyClassifiedKeys.add(key)
                                        v212Settled += 1
                                        v212SettledHashes.push(String(candidate.hash ?? "").toLowerCase())
                                    }
                                }
                            } catch { /* leave unresolved so provisional positives remain untouched */ }

                            if (!successfullyClassifiedKeys.has(key)) {
                                v212StillUnresolved += 1
                                v212UnresolvedHashes.push(String(candidate.hash ?? "").toLowerCase())
                            }                            } finally {
                                v213SettlementCompleted += 1
                                if (!cancelled) {
                                    setProgress({
                                        current: v213SettlementCompleted,
                                        total: v212UnresolvedBefore.length,
                                        stage: "settlement",
                                        showPhases: showFullScanPhases
                                    })
                                }
                            }
                        }
                    })
                    await Promise.all(v213SettlementWorkers)
                    const v214SettlementElapsedMs = Date.now() - v214SettlementStartedAt
                    const v214TotalElapsedMs = Date.now() - v177ScanStartedAt

                    dcaDiagnostic(`[HEX DCA V231 ${v177Environment}] settlement sweep: before=${v212UnresolvedBefore.length}; settled=${v212Settled}; unresolved=${v212StillUnresolved}`)
                    if (v212UnresolvedHashes.length) dcaDiagnostic(`[HEX DCA V231 ${v177Environment}] STILL UNRESOLVED`, v212UnresolvedHashes)

                    if (successfullyClassifiedKeys.size > 0) {
                        // Remove only Pulse provisional rows that we successfully reclassified;
                        // failed canonical fetches keep their previous known-good result.
                        for (let i = foundPurchases.length - 1; i >= 0; i -= 1) {
                            const p = foundPurchases[i]
                            const isPulse = p?.network === "pulsechain" || p?.network === "mainnet" || p?.networkKey === "pulsechain" || p?.networkLabel === "PulseChain"
                            if (!isPulse) continue
                            const key = `${normalizeAddress(p?.wallet)}:${String(p?.hash ?? p?.transactionHash ?? "").toLowerCase()}`
                            if (successfullyClassifiedKeys.has(key)) foundPurchases.splice(i, 1)
                        }
                        for (const rebuilt of rebuiltByKey.values()) foundPurchases.push(rebuilt)
                    }

                } catch (v186Error) {
                    console.warn("[HEX DCA V187] canonical Pulse rebuild failed", v186Error)
                }

                const pulsePurchaseHashes = new Set(
                    foundPurchases
                        .filter(purchase => purchase.network === "pulsechain")
                        .map(purchase => String(purchase?.hash ?? purchase?.transactionHash ?? "").toLowerCase())
                        .filter(Boolean)
                )
                const pulseUnmatchedCandidates = uniqueCandidates
                    .filter(candidate => pulsechainCandidateKeys.has(`${candidate.network}:${candidate.wallet}:${String(candidate.hash ?? "").toLowerCase()}`))
                    .filter(candidate => !pulsePurchaseHashes.has(String(candidate.hash ?? "").toLowerCase()))
                    .map(candidate => ({ wallet: candidate.wallet, hash: candidate.hash }))

                const pulseRejectedHexTotal = pulseDcaRejectAudit.incomingHexRejected.reduce(
                    (sum, item) => sum + (Number(item?.purchasedHex) || 0), 0
                )

                // v122: intentionally diagnostic-only. One compact object should be enough
                // to paste back without copying the entire console.
                const pulseRejectReasonCounts = pulseDcaRejectAudit.rejectionSamples.reduce((counts, item) => {
                    counts[item.reason] = (counts[item.reason] ?? 0) + 1
                    return counts
                }, {})

                // v125 diagnostic: break PulseChain verification down by wallet so a
                // single selected wallet (especially Wallet #4) can be compared with the UI.
                // Also expose rejected incoming-HEX candidates by wallet; this tells us whether
                // the missing ~10.4M target is being rejected before the pricing/cache handoff.
                const v125IsPulse = item => (
                    item?.network === "mainnet" ||
                    item?.network === "pulsechain" ||
                    item?.networkKey === "pulsechain" ||
                    item?.networkLabel === "PulseChain"
                )
                const v125NormWallet = item => normalizeAddress(item?.wallet)
                const v125Hex = item => Number(item?.hexAmount ?? item?.purchasedHex ?? 0) || 0
                const v125Hash = item => String(item?.hash ?? item?.transactionHash ?? "").toLowerCase()
                const v125PulsePurchases = foundPurchases.filter(v125IsPulse)
                const v125Wallets = [...new Set([
                    ...pulsechainCandidates.map(v125NormWallet),
                    ...v125PulsePurchases.map(v125NormWallet),
                    ...pulseDcaRejectAudit.incomingHexRejected.map(v125NormWallet)
                ].filter(Boolean))]
                const v125WalletBreakdown = Object.fromEntries(v125Wallets.map(wallet => {
                    const accepted = v125PulsePurchases.filter(p => v125NormWallet(p) === wallet)
                    const rejectedIncoming = pulseDcaRejectAudit.incomingHexRejected.filter(p => v125NormWallet(p) === wallet)
                    const candidates = pulsechainCandidates.filter(p => v125NormWallet(p) === wallet)
                    return [wallet, {
                        candidateCount: candidates.length,
                        acceptedCount: accepted.length,
                        acceptedHex: accepted.reduce((sum, p) => sum + v125Hex(p), 0),
                        acceptedPurchases: accepted.map(p => ({
                            hash: v125Hash(p),
                            hex: v125Hex(p),
                            blockNumber: p?.blockNumber ?? p?.block ?? null,
                            timestamp: p?.timestamp ?? null
                        })),
                        rejectedIncomingHexCount: rejectedIncoming.length,
                        rejectedIncomingHex: rejectedIncoming.reduce((sum, p) => sum + v125Hex(p), 0),
                        rejectedIncoming: rejectedIncoming.map(p => ({
                            hash: v125Hash(p),
                            hex: v125Hex(p),
                            reason: p?.reason ?? null,
                            blockNumber: p?.blockNumber ?? p?.block ?? null
                        }))
                    }]
                }))

                // v126: pre-classification trace grouped by wallet. The compact summary is
                // intended to be pasted from DevTools. incomingHexCandidates exposes every
                // candidate whose decoded receipt actually delivered HEX to that wallet, even
                // if a later rule rejected it. july2025IncomingHex isolates the period where
                // Wallet #4 is known to contain the large PulseChain purchase batch.
                const v126Wallets = [...new Set(v126PulsePreFilterTrace.map(x => x.wallet).filter(Boolean))]
                const v126Breakdown = Object.fromEntries(v126Wallets.map(wallet => {
                    const rows = v126PulsePreFilterTrace.filter(x => x.wallet === wallet)
                    const incoming = rows.filter(x => Number(x.incomingHex) > 0)
                    const july2025 = incoming.filter(x => {
                        const ts = Date.parse(x.timestamp ?? "")
                        return Number.isFinite(ts) && ts >= Date.parse("2025-07-01T00:00:00Z") && ts < Date.parse("2025-08-01T00:00:00Z")
                    })
                    return [wallet, {
                        candidateCount: rows.length,
                        candidatesWithIncomingHex: incoming.length,
                        incomingHexTotal: incoming.reduce((sum, x) => sum + (Number(x.incomingHex) || 0), 0),
                        acceptedIncomingCount: incoming.filter(x => x.accepted).length,
                        rejectedIncomingCount: incoming.filter(x => !x.accepted).length,
                        july2025IncomingCount: july2025.length,
                        july2025IncomingHex: july2025.reduce((sum, x) => sum + (Number(x.incomingHex) || 0), 0),
                        incomingHexCandidates: incoming
                    }]
                }))

                // v127: focus on Wallet #4 and show exactly why each incoming-HEX
                // candidate survives or fails classification. Diagnostic only.
                const v127Wallet4 = "0xe9d30bd886c69eab9471f36b78aa19ad642d082e"
                const v127Rows = v126PulsePreFilterTrace
                    .filter(x => x.wallet === v127Wallet4 && Number(x.incomingHex) > 0)
                    .map(x => {
                        const reject = pulseDcaRejectAudit.rejectionSamples.find(r =>
                            String(r?.hash ?? "").toLowerCase() === String(x?.hash ?? "").toLowerCase()
                        )
                        return {
                            timestamp: x.timestamp,
                            blockNumber: x.blockNumber,
                            hash: x.hash,
                            incomingHex: x.incomingHex,
                            accepted: x.accepted,
                            rejectionReason: x.accepted ? null : (reject?.reason ?? "unclassified"),
                            method: x.method,
                            nativePls: x.nativePls,
                            outgoingPaymentTransferCount: x.outgoingPaymentTransferCount,
                            outgoingPayments: x.outgoingPayments
                        }
                    })
                    .sort((a, b) => (a.blockNumber ?? 0) - (b.blockNumber ?? 0))
                const v127July = v127Rows.filter(x => {
                    const ts = Date.parse(x.timestamp ?? "")
                    return Number.isFinite(ts) && ts >= Date.parse("2025-07-01T00:00:00Z") && ts < Date.parse("2025-08-01T00:00:00Z")
                })

                // v130: compact Wallet #4 reject-only diagnostic. Discovery already sees the
                // full ~11.395M incoming HEX set, so stop dumping hundreds of metadata rows and
                // show only the incoming-HEX transactions that classification discarded.
                const v130Rejected = v127Rows.filter(x => !x.accepted)
                const v130ReasonCounts = v130Rejected.reduce((counts, x) => {
                    const reason = x.rejectionReason ?? "unclassified"
                    counts[reason] = (counts[reason] ?? 0) + 1
                    return counts
                }, {})

                // v168 parity-stage diagnostic: v167 proved that Electron and the browser can
                // finish with different PulseChain ledgers. Log the exact hash set at the two
                // stages immediately before the final ledger: discovery candidates and accepted
                // classification. This is diagnostic-only; it does not change purchase rules,
                // Ethereum discovery, pricing, caching, or DCA math.
                try {
                    const v168Environment = (typeof navigator !== "undefined" && /electron/i.test(navigator.userAgent || ""))
                        ? "ELECTRON"
                        : "WEB"
                    const v168CandidateRows = pulsechainCandidates
                        .map(candidate => ({
                            wallet: normalizeAddress(candidate?.wallet),
                            hash: String(candidate?.hash ?? "").toLowerCase(),
                            block: Number(candidate?.activity?.blockNumber ?? candidate?.activity?.block_number ?? 0) || 0,
                            source: candidate?.discoverySource ?? candidate?.source ?? "unknown",
                            activityHasHex: (() => {
                                try { return JSON.stringify(candidate?.activity ?? {}).toLowerCase().includes(HEX_ADDRESS) }
                                catch { return false }
                            })()
                        }))
                        .filter(row => row.hash)
                        .sort((a, b) => a.wallet.localeCompare(b.wallet) || a.block - b.block || a.hash.localeCompare(b.hash))
                    const v168AcceptedRows = v125PulsePurchases
                        .map(purchase => ({
                            wallet: normalizeAddress(purchase?.wallet),
                            hash: v125Hash(purchase),
                            block: Number(purchase?.blockNumber ?? purchase?.block ?? 0) || 0,
                            hex: v125Hex(purchase)
                        }))
                        .filter(row => row.hash)
                        .sort((a, b) => a.wallet.localeCompare(b.wallet) || a.block - b.block || a.hash.localeCompare(b.hash))
                    const v168IncomingRows = v126PulsePreFilterTrace
                        .filter(row => Number(row?.incomingHex ?? 0) > 0)
                        .map(row => ({
                            wallet: normalizeAddress(row?.wallet),
                            hash: String(row?.hash ?? "").toLowerCase(),
                            block: Number(row?.blockNumber ?? 0) || 0,
                            incomingHex: Number(row?.incomingHex ?? 0) || 0,
                            accepted: Boolean(row?.accepted)
                        }))
                        .filter(row => row.hash)
                        .sort((a, b) => a.wallet.localeCompare(b.wallet) || a.block - b.block || a.hash.localeCompare(b.hash))
                    const hashes = rows => rows.map(row => row.hash).join("\n")
                    dcaDiagnostic(`[HEX DCA V168 ${v168Environment}] PulseChain parity stages`)
                    dcaDiagnostic(`[HEX DCA V168 CANDIDATE HASHES ${v168Environment}] ${v168CandidateRows.length} candidates\n${hashes(v168CandidateRows)}`)
                    dcaDiagnostic(`[HEX DCA V168 INCOMING HEX HASHES ${v168Environment}] ${v168IncomingRows.length} incoming-HEX candidates\n${hashes(v168IncomingRows)}`)
                    dcaDiagnostic(`[HEX DCA V168 ACCEPTED HASHES ${v168Environment}] ${v168AcceptedRows.length} accepted purchases\n${hashes(v168AcceptedRows)}`)
                    dcaDiagnostic(`[HEX DCA V168 SUMMARY ${v168Environment}]`, {
                        pulseCandidates: v168CandidateRows.length,
                        incomingHexCandidates: v168IncomingRows.length,
                        acceptedPurchases: v168AcceptedRows.length,
                        rejectedIncomingHex: v168IncomingRows.filter(row => !row.accepted).length,
                        candidateWalletCounts: Object.fromEntries([...new Set(v168CandidateRows.map(row => row.wallet))].map(wallet => [wallet, v168CandidateRows.filter(row => row.wallet === wallet).length])),
                        acceptedWalletCounts: Object.fromEntries([...new Set(v168AcceptedRows.map(row => row.wallet))].map(wallet => [wallet, v168AcceptedRows.filter(row => row.wallet === wallet).length]))
                    })
                    dcaDiagnostic()
                } catch (v168DiagnosticError) {
                    console.warn("[HEX DCA V168] parity-stage diagnostic failed", v168DiagnosticError)
                }

                if (cancelled) {
                    return
                }

               
                setProgress({
                    current: 0,
                    total: foundPurchases.length,
                    stage: "pricing",
                    showPhases: showFullScanPhases
                })

                // v112: Historical pricing used to run completely serially. Keep a
                // modest four-worker pool: enough to remove minutes of idle network wait,
                // but low enough to avoid turning transient provider limits into missing prices.
                const pricedPurchases = new Array(foundPurchases.length)
                const PRICE_WORKERS = Math.min(4, Math.max(1, foundPurchases.length))
                let nextPriceIndex = 0
                let completedPrices = 0

                const priceWorker = async workerIndex => {
                    if (workerIndex > 0) {
                        await new Promise(resolve => setTimeout(resolve, workerIndex * 125))
                    }
                    while (!cancelled) {
                        const index = nextPriceIndex++
                        if (index >= foundPurchases.length) return
                        try {
                            pricedPurchases[index] = await pricePurchase(foundPurchases[index])
                        } catch (error) {
                            pricedPurchases[index] = {
                                ...foundPurchases[index],
                                pricingError: error?.message ?? "Unable to retrieve historical USD pricing"
                            }
                        } finally {
                            completedPrices += 1
                            if (!cancelled) {
                                setProgress({ current: completedPrices, total: foundPurchases.length, stage: "pricing", showPhases: showFullScanPhases })
                            }
                        }
                    }
                }

                await Promise.all(Array.from({ length: PRICE_WORKERS }, (_, workerIndex) => priceWorker(workerIndex)))
                if (cancelled) return

                // v115: retry only purchases that failed historical pricing. This keeps the
                // fast four-worker first pass while giving transient Gecko/provider failures
                // one clean second chance without rescanning or touching Ethereum discovery.
                const failedPriceIndexes = pricedPurchases
                    .map((purchase, index) => purchase?.pricingError ? index : -1)
                    .filter(index => index >= 0)
                if (failedPriceIndexes.length > 0) {
                    // v120: the retry pass used to be fully serial, so a handful of
                    // slow historical-price requests could make "Calculating" sit for
                    // minutes after verification had finished. Retry two at a time to
                    // reduce the tail without aggressively hitting the price provider.
                    const PRICE_RETRY_WORKERS = Math.min(2, failedPriceIndexes.length)
                    let nextRetryPosition = 0
                    const retryWorker = async workerIndex => {
                        if (workerIndex > 0) await wait(175)
                        while (!cancelled) {
                            const position = nextRetryPosition++
                            if (position >= failedPriceIndexes.length) return
                            const index = failedPriceIndexes[position]
                            try {
                                pricedPurchases[index] = await pricePurchase(foundPurchases[index])
                            } catch (error) {
                                pricedPurchases[index] = {
                                    ...foundPurchases[index],
                                    pricingError: error?.message ?? "Unable to retrieve historical USD pricing"
                                }
                            }
                        }
                    }
                    await Promise.all(Array.from({ length: PRICE_RETRY_WORKERS }, (_, workerIndex) => retryWorker(workerIndex)))
                }

                pricedPurchases.sort((a, b) => {
                    return (
                        (toUnixSeconds(a?.timestamp) ?? 0) -
                        (toUnixSeconds(b?.timestamp) ?? 0)
                    )
                })

                // v124 diagnostic: prove whether any verified PulseChain purchase is
                // disappearing during historical pricing before it reaches the wallet cache.
                const v124PulseLike = purchase => (
                    purchase?.network === "mainnet" ||
                    purchase?.network === "pulsechain" ||
                    purchase?.networkKey === "pulsechain" ||
                    purchase?.networkLabel === "PulseChain"
                )
                const v124PurchaseHash = purchase =>
                    String(purchase?.hash ?? purchase?.transactionHash ?? "").toLowerCase()
                const v124HexAmount = purchase =>
                    Number(purchase?.hexAmount ?? purchase?.purchasedHex ?? 0) || 0
                const v124FoundPulse = foundPurchases.filter(v124PulseLike)
                const v124PricedPulse = pricedPurchases.filter(v124PulseLike)
                const v124PricedHashes = new Set(v124PricedPulse.map(v124PurchaseHash).filter(Boolean))
                const v124LostDuringPricing = v124FoundPulse
                    .filter(p => !v124PricedHashes.has(v124PurchaseHash(p)))
                    .map(p => ({
                        wallet: p?.wallet,
                        hash: v124PurchaseHash(p),
                        hex: v124HexAmount(p),
                        network: p?.network,
                        networkKey: p?.networkKey,
                        networkLabel: p?.networkLabel
                    }))

                const finalWalletErrors =
                    combinedWalletErrors

                // Persist each refreshed wallet independently, then combine with
                // already-cached wallets. This is the DCA equivalent of the token
                // P&L per-wallet ledger cache.
                for (const wallet of staleWallets) {
                    const walletPurchases = pricedPurchases.filter(p => normalizeAddress(p?.wallet) === normalizeAddress(wallet))
                    const walletSpecificErrors = Object.fromEntries(Object.entries(finalWalletErrors).filter(([key]) => key.endsWith(`:${normalizeAddress(wallet)}`)))
                    const sourceGeneralErrors = Object.fromEntries(Object.entries(finalWalletErrors).filter(([key]) => key.endsWith(':general') || key === 'general'))
                    const walletErrorSubset = { ...sourceGeneralErrors, ...walletSpecificErrors }
                    const walletTxErrors = detailErrors.filter(e => normalizeAddress(e?.wallet) === normalizeAddress(wallet))
                    // v123: historical-price failures do not invalidate discovery.
                    // Preserve the discovered purchase ledger as the warm cache; an
                    // unpriced purchase can be retried later without rescanning history.
                    const walletScanComplete =
                        Object.keys(walletErrorSubset).length === 0 &&
                        walletTxErrors.length === 0

                    const previousCache = cachedWallets[normalizeAddress(wallet)]
                    const mergedByHash = new Map()
                    ;[...(previousCache?.purchases ?? []), ...walletPurchases].forEach(purchase => {
                        const hash = String(purchase?.hash ?? purchase?.transactionHash ?? "").toLowerCase()
                        const key = `${purchase?.networkKey ?? purchase?.network ?? "unknown"}:${hash}`
                        if (hash) mergedByHash.set(key, purchase)
                    })
                    const mergedWalletPurchases = [...mergedByHash.values()].sort((a, b) => (toUnixSeconds(a?.timestamp) ?? 0) - (toUnixSeconds(b?.timestamp) ?? 0))
                    const nextCheckpoints = { ...(previousCache?.scanCheckpoints ?? {}) }
                    for (const source of DCA_SOURCES) {
                        const head = Number(sourceHeads[source.key])
                        const sourceError = Object.entries(finalWalletErrors).some(([key]) =>
                            (key === `${source.key}:general` || key === `${source.key}:${normalizeAddress(wallet)}`)
                        )
                        const previousCheckpoint = Number(previousCache?.scanCheckpoints?.[source.key] ?? 0)
                        const sourceTxError = walletTxErrors.some(error => {
                            const errorSource = error?.networkKey ?? (error?.network === "ethereum" ? "ethereum" : "pulsechain")
                            const errorBlock = Number(error?.blockNumber ?? error?.block ?? 0)
                            // Only a failure in NEWLY discovered post-checkpoint data may hold
                            // back the checkpoint. Historical cached errors must not force the
                            // same block range to be scanned forever on every app launch.
                            return errorSource === source.key && Number.isFinite(errorBlock) && errorBlock > previousCheckpoint
                        })
                        if (!sourceError && !sourceTxError && Number.isFinite(head) && head > 0) {
                            nextCheckpoints[source.key] = head
                        }
                    }
                    const walletCache = writeDcaWalletCache(
                        wallet,
                        mergedWalletPurchases,
                        walletErrorSubset,
                        walletTxErrors,
                        walletScanComplete,
                        nextCheckpoints
                    )
                    cachedWallets[normalizeAddress(wallet)] = walletCache
                }

                const combinedPurchases = Object.values(cachedWallets).flatMap(item => item?.purchases ?? []).sort((a, b) => (toUnixSeconds(a?.timestamp) ?? 0) - (toUnixSeconds(b?.timestamp) ?? 0))
                const combinedErrors = Object.values(cachedWallets).reduce((acc, item) => ({ ...acc, ...(item?.walletErrors ?? {}) }), {})
                const combinedTxErrors = Object.values(cachedWallets).flatMap(item => item?.transactionErrors ?? [])

                // v124 diagnostic: compare the verified PulseChain ledger against the
                // exact combined ledger that is persisted and displayed after the scan.
                const v124CombinedPulse = combinedPurchases.filter(v124PulseLike)
                const v124CombinedHashes = new Set(v124CombinedPulse.map(v124PurchaseHash).filter(Boolean))
                const v124LostBeforeFinalCache = v124FoundPulse
                    .filter(p => !v124CombinedHashes.has(v124PurchaseHash(p)))
                    .map(p => ({
                        wallet: p?.wallet,
                        hash: v124PurchaseHash(p),
                        hex: v124HexAmount(p),
                        network: p?.network,
                        networkKey: p?.networkKey,
                        networkLabel: p?.networkLabel
                    }))

                // v165 parity diagnostic: print the exact final accepted PulseChain
                // purchase ledger. This intentionally does NOT change discovery,
                // verification, pricing, caching, or DCA math. Run the same wallets
                // in Electron and the browser, then compare these rows by wallet/hash.
                try {
                    const parityRows = v124CombinedPulse
                        .map(purchase => ({
                            wallet: normalizeAddress(purchase?.wallet),
                            hash: v124PurchaseHash(purchase),
                            block: Number(purchase?.blockNumber ?? purchase?.block ?? 0) || 0,
                            timestamp: toUnixSeconds(purchase?.timestamp) ?? 0,
                            hex: v124HexAmount(purchase),
                            usd: Number(purchase?.usdSpent ?? purchase?.spentUsd ?? purchase?.usdValue ?? purchase?.costUsd ?? 0) || 0,
                            network: purchase?.networkKey ?? purchase?.network ?? purchase?.networkLabel ?? "pulsechain"
                        }))
                        .sort((a, b) => a.wallet.localeCompare(b.wallet) || a.block - b.block || a.hash.localeCompare(b.hash))

                    const parityCompactRows = parityRows.map(row =>
                        `${row.wallet} | ${row.hash} | ${row.hex} | ${row.usd} | ${row.timestamp}`
                    )
                    const parityCompactText = [
                        `wallet | txHash | HEX | USD | timestamp`,
                        ...parityCompactRows
                    ].join("\n")
                    const parityHashList = parityRows.map(row => row.hash).filter(Boolean).join("\n")
                    const parityEnvironment = (typeof navigator !== "undefined" && /electron/i.test(navigator.userAgent || ""))
                        ? "ELECTRON"
                        : "WEB"

                    false && dcaDiagnostic(`[HEX DCA PARITY] Final PulseChain ledger: ${parityRows.length} accepted purchases`)
                    false && dcaDiagnostic(parityRows)
                    false && dcaDiagnostic("[HEX DCA PARITY] JSON", JSON.stringify(parityRows))
                    false && dcaDiagnostic(`[HEX DCA PARITY COPY ${parityEnvironment}] ${parityRows.length} purchases\n${parityCompactText}`)
                    false && dcaDiagnostic(`[HEX DCA PARITY HASHES ${parityEnvironment}] ${parityRows.length} purchases\n${parityHashList}`)
                    false && dcaDiagnostic(`[HEX DCA PARITY SUMMARY ${parityEnvironment}]`, {
                        purchases: parityRows.length,
                        wallets: [...new Set(parityRows.map(row => row.wallet))].length,
                        totalHex: parityRows.reduce((sum, row) => sum + (Number(row.hex) || 0), 0),
                        totalUsd: parityRows.reduce((sum, row) => sum + (Number(row.usd) || 0), 0)
                    })

                    // v173: compare the exact FINAL persisted/displayed ledger across BOTH
                    // chains. v172 reached the same overall purchase count in Web/Electron but
                    // different HEX/USD totals, which means count-only parity can hide a
                    // different transaction (or differently-priced transaction). Keep this
                    // diagnostic after combinedPurchases is assembled so it describes exactly
                    // what the UI and cache will use, without changing discovery or DCA math.
                    const v173Rows = combinedPurchases
                        .map(purchase => {
                            const networkRaw = String(purchase?.networkKey ?? purchase?.network ?? purchase?.networkLabel ?? "unknown").toLowerCase()
                            const network = networkRaw.includes("eth") ? "ethereum" : (networkRaw.includes("pulse") || networkRaw === "mainnet" ? "pulsechain" : networkRaw)
                            return {
                                network,
                                wallet: normalizeAddress(purchase?.wallet),
                                hash: String(purchase?.hash ?? purchase?.transactionHash ?? "").toLowerCase(),
                                block: Number(purchase?.blockNumber ?? purchase?.block ?? 0) || 0,
                                timestamp: toUnixSeconds(purchase?.timestamp) ?? 0,
                                hex: Number(purchase?.hexAmount ?? purchase?.purchasedHex ?? purchase?.hex ?? 0) || 0,
                                usd: Number(purchase?.usdSpent ?? purchase?.spentUsd ?? purchase?.usdValue ?? purchase?.costUsd ?? 0) || 0
                            }
                        })
                        .filter(row => row.hash)
                        .sort((a, b) => a.network.localeCompare(b.network) || a.wallet.localeCompare(b.wallet) || a.block - b.block || a.hash.localeCompare(b.hash))
                    const v173Line = row => `${row.network} | ${row.wallet} | ${row.hash} | ${row.hex} | ${row.usd} | ${row.timestamp}`
                    const v173Text = [
                        `network | wallet | txHash | HEX | USD | timestamp`,
                        ...v173Rows.map(v173Line)
                    ].join("\n")
                    const v173NetworkSummary = Object.fromEntries(["ethereum", "pulsechain"].map(network => {
                        const rows = v173Rows.filter(row => row.network === network)
                        return [network, {
                            purchases: rows.length,
                            totalHex: rows.reduce((sum, row) => sum + row.hex, 0),
                            totalUsd: rows.reduce((sum, row) => sum + row.usd, 0),
                            hashes: rows.map(row => row.hash)
                        }]
                    }))
                    const v173WalletSummary = Object.fromEntries([...new Set(v173Rows.map(row => row.wallet))].map(wallet => {
                        const rows = v173Rows.filter(row => row.wallet === wallet)
                        return [wallet, {
                            purchases: rows.length,
                            ethereum: rows.filter(row => row.network === "ethereum").length,
                            pulsechain: rows.filter(row => row.network === "pulsechain").length,
                            totalHex: rows.reduce((sum, row) => sum + row.hex, 0),
                            totalUsd: rows.reduce((sum, row) => sum + row.usd, 0)
                        }]
                    }))
                    false && dcaDiagnostic(`[HEX DCA V176 ${parityEnvironment}] Final cross-chain ledger: ${v173Rows.length} purchases`)
                    false && dcaDiagnostic(`[HEX DCA V176 COPY ${parityEnvironment}] ${v173Rows.length} purchases\n${v173Text}`)
                    false && dcaDiagnostic(`[HEX DCA V176 ETH HASHES ${parityEnvironment}] ${v173NetworkSummary.ethereum.purchases} purchases\n${v173NetworkSummary.ethereum.hashes.join("\n")}`)
                    false && dcaDiagnostic(`[HEX DCA V176 PULSE HASHES ${parityEnvironment}] ${v173NetworkSummary.pulsechain.purchases} purchases\n${v173NetworkSummary.pulsechain.hashes.join("\n")}`)
                    false && dcaDiagnostic(`[HEX DCA V176 NETWORK SUMMARY ${parityEnvironment}]`, v173NetworkSummary)
                    false && dcaDiagnostic(`[HEX DCA V176 WALLET SUMMARY ${parityEnvironment}]`, v173WalletSummary)
                    false && dcaDiagnostic(`[HEX DCA V176 TOTALS ${parityEnvironment}]`, {
                        purchases: v173Rows.length,
                        totalHex: v173Rows.reduce((sum, row) => sum + row.hex, 0),
                        totalUsd: v173Rows.reduce((sum, row) => sum + row.usd, 0)
                    })
                    dcaDiagnostic()
                    if (false && v124LostDuringPricing.length) console.warn("[HEX DCA PARITY] Lost during pricing", v124LostDuringPricing)
                    if (false && v124LostBeforeFinalCache.length) console.warn("[HEX DCA PARITY] Lost before final cache", v124LostBeforeFinalCache)
                    dcaDiagnostic()
                } catch (diagnosticError) {
                    console.warn("[HEX DCA PARITY] Diagnostic logging failed", diagnosticError)
                }

                // v201: deterministic classifier parity audit. V200 proved that Electron and
                // Web receive the same authoritative RPC discovery set, but one environment can
                // still accept one extra purchase. Print the COMPLETE PulseChain classification
                // result in a compact, hash-keyed form so the exact divergent transaction can be
                // identified without changing discovery, classification, pricing, or DCA math.
                try {
                    const v201FinalByKey = new Map()
                    combinedPurchases
                        .filter(p => (
                            p?.network === "mainnet" ||
                            p?.network === "pulsechain" ||
                            p?.networkKey === "pulsechain" ||
                            p?.networkLabel === "PulseChain"
                        ))
                        .forEach(p => {
                            const wallet = normalizeAddress(p?.wallet)
                            const hash = String(p?.hash ?? p?.transactionHash ?? "").toLowerCase()
                            if (!wallet || !hash) return
                            v201FinalByKey.set(`${wallet}:${hash}`, p)
                        })

                    const v201Rows = v177CandidateRows
                        .filter(row => row?.network === "pulsechain")
                        .map(row => {
                            const wallet = normalizeAddress(row?.wallet)
                            const hash = String(row?.hash ?? "").toLowerCase()
                            const fateKey = v178FateKey("pulsechain", wallet, hash)
                            const detail = v178CandidateFates.get(fateKey) ?? {}
                            const finalPurchase = v201FinalByKey.get(`${wallet}:${hash}`) ?? null
                            const accepted = Boolean(finalPurchase)
                            return {
                                wallet,
                                hash,
                                block: Number(row?.block ?? detail?.block ?? finalPurchase?.block ?? finalPurchase?.blockNumber ?? 0) || 0,
                                accepted,
                                fate: accepted ? "accepted-final" : String(detail?.fate ?? "not-observed"),
                                incomingHex: Number(detail?.incomingHexTransfers ?? 0) || 0,
                                paymentTransfers: Number(detail?.outgoingPaymentTransfers ?? 0) || 0,
                                nativeSpent: Number(detail?.nativeSpent ?? finalPurchase?.nativePlsSpent ?? 0) || 0,
                                hex: Number(finalPurchase?.purchasedHex ?? finalPurchase?.hexAmount ?? detail?.purchasedHex ?? 0) || 0,
                                usd: Number(finalPurchase?.usdSpent ?? finalPurchase?.spentUsd ?? detail?.usdSpent ?? 0) || 0
                            }
                        })
                        .filter(row => row.wallet && row.hash)
                        .sort((a, b) => a.wallet.localeCompare(b.wallet) || a.block - b.block || a.hash.localeCompare(b.hash))

                    const v201Accepted = v201Rows.filter(row => row.accepted)
                    const v201Rejected = v201Rows.filter(row => !row.accepted)
                    dcaDiagnostic(`[HEX DCA V201 ${v177Environment}] CLASSIFIER PARITY AUDIT`)
                    dcaDiagnostic(`[HEX DCA V201 ${v177Environment}] candidates=${v201Rows.length} accepted=${v201Accepted.length} rejected=${v201Rejected.length}`)
                    dcaDiagnostic(`[HEX DCA V201 ${v177Environment}] ACCEPTED HASHES (${v201Accepted.length})\n${v201Accepted.map(row => row.hash).join("\n")}`)
                    dcaDiagnostic(`[HEX DCA V201 ${v177Environment}] REJECTED HASHES + FATE (${v201Rejected.length})\n${v201Rejected.map(row => `${row.hash} | ${row.fate} | incomingHEX=${row.incomingHex} | payments=${row.paymentTransfers} | native=${row.nativeSpent}`).join("\n")}`)
                    const v203LedgerLines = v201Accepted.map(row => `${row.wallet}|${row.hash}|${row.block}|${row.hex}|${row.usd}`)
                    const v203LedgerSignature = v203LedgerLines.join("||")
                    dcaDiagnostic(`[HEX DCA V201 ${v177Environment}] ACCEPTED LEDGER\n${v201Accepted.map(row => `${row.hash} | block=${row.block} | HEX=${row.hex} | USD=${row.usd}`).join("\n")}`)
                    dcaDiagnostic(`[HEX DCA V203 ${v177Environment}] LEDGER SIGNATURE rows=${v201Accepted.length} chars=${v203LedgerSignature.length}\n${v203LedgerSignature}`)

                    // v206: diagnostics only. V205 changed discovery/classification behavior and
                    // admitted an extra purchase, so this patch intentionally restores the V204
                    // classifier path above. These fingerprints expose the exact accepted-ledger
                    // row(s) that differ between Web and Electron without touching DCA math.
                    const v206Fnv1a = (text) => {
                        let hash = 2166136261
                        const input = String(text ?? "")
                        for (let i = 0; i < input.length; i += 1) {
                            hash ^= input.charCodeAt(i)
                            hash = Math.imul(hash, 16777619) >>> 0
                        }
                        return hash.toString(16).padStart(8, "0")
                    }
                    const v206Rows = v201Accepted.map((row, index) => {
                        const canonical = `${row.wallet}|${row.hash}|${row.block}|${row.hex}|${row.usd}`
                        return {
                            n: index + 1,
                            wallet: row.wallet,
                            hash: row.hash,
                            block: row.block,
                            hex: row.hex,
                            usd: row.usd,
                            fp: v206Fnv1a(canonical)
                        }
                    })
                    const v206Overall = v206Fnv1a(v206Rows.map(row => row.fp).join("|"))
                    const v206Hex = v206Rows.reduce((sum, row) => sum + row.hex, 0)
                    const v206Usd = v206Rows.reduce((sum, row) => sum + row.usd, 0)
                    dcaDiagnostic(`[HEX DCA V206 ${v177Environment}] CANONICAL ROW DIFF`)
                    dcaDiagnostic(`[HEX DCA V206 ${v177Environment}] SUMMARY rows=${v206Rows.length} | HEX=${v206Hex.toFixed(8)} | USD=${v206Usd.toFixed(8)} | ledger=${v206Overall}`)
                    dcaDiagnostic(`[HEX DCA V206 ${v177Environment}] ROW FINGERPRINTS\n${v206Rows.map(row => `${String(row.n).padStart(2, "0")} | ${row.fp} | ${row.hash} | block=${row.block} | HEX=${row.hex} | USD=${row.usd}`).join("\n")}`)
                    dcaDiagnostic()
                    dcaDiagnostic()
                } catch (v201Error) {
                    console.warn("[HEX DCA V201] classifier parity audit failed", v201Error)
                }

                // v180 compact parity trace: only the three transactions that differed
                // in v178 are printed. No full candidate/hash/JSON dumps.
                try {
                    const finalKeys = new Set(combinedPurchases.map(p =>
                        v178FateKey(p?.networkKey ?? p?.network, p?.wallet, p?.hash ?? p?.transactionHash)
                    ))
                    const candidateByHash = new Map(v177CandidateRows.map(row => [row.hash, row]))
                    const traceRows = [...V180_TRACE_HASHES].map(hash => {
                        const candidate = candidateByHash.get(hash) ?? null
                        const wallet = candidate?.wallet ?? ""
                        const network = candidate?.network ?? "pulsechain"
                        const detail = wallet ? (v178CandidateFates.get(v178FateKey(network, wallet, hash)) ?? {}) : {}
                        const final = wallet ? finalKeys.has(v178FateKey(network, wallet, hash)) : false
                        return {
                            hash,
                            discovered: Boolean(candidate),
                            source: candidate?.source ?? "not-discovered",
                            block: candidate?.block ?? detail?.block ?? null,
                            receiptTransfers: detail?.receiptTransfers ?? detail?.transferCount ?? null,
                            incomingHexTransfers: detail?.incomingHexTransfers ?? null,
                            outgoingPaymentTransfers: detail?.outgoingPaymentTransfers ?? null,
                            nativeSpent: detail?.nativeSpent ?? null,
                            purchasedHex: detail?.purchasedHex ?? null,
                            usdSpent: detail?.usdSpent ?? null,
                            fate: final ? "accepted-final" : (detail?.fate ?? "not-observed"),
                            final
                        }
                    })
                    dcaDiagnostic(`[HEX DCA V183 ${v177Environment}] TARGETED PARITY TRACE`)
                    dcaDiagnostic(`[HEX DCA V183 SUMMARY ${v177Environment}] final purchases=${combinedPurchases.length}; candidates=${v177CandidateRows.length}; elapsed=${((Date.now()-v177ScanStartedAt)/1000).toFixed(3)}s`)
                    dcaDiagnostic(traceRows)
                    traceRows.forEach(row => dcaDiagnostic(
                        `[V183 ${v177Environment}] ${row.hash} | discovery=${row.discovered ? row.source : "NO"} | receipt=${row.receiptTransfers ?? "?"} transfers | incomingHEX=${row.incomingHexTransfers ?? "?"} | paymentTransfers=${row.outgoingPaymentTransfers ?? "?"} | nativeSpent=${row.nativeSpent ?? "?"} | fate=${row.fate}`
                    ))
                    dcaDiagnostic()
                } catch (v180Error) { console.warn("[HEX DCA V183] targeted diagnostic failed", v180Error) }

                // v184: discovery/count parity is now established. Audit the exact
                // accepted PulseChain ledger and its pricing inputs without changing
                // discovery, verification, pricing, cache behavior, or DCA math.
                // This is intentionally compact and deterministic so Electron/Web
                // output can be compared line-for-line.
                try {
                    const v184PulseRows = combinedPurchases
                        .filter(p => (
                            p?.network === "mainnet" ||
                            p?.network === "pulsechain" ||
                            p?.networkKey === "pulsechain" ||
                            p?.networkLabel === "PulseChain"
                        ))
                        .map(p => {
                            const payments = Array.isArray(p?.payments) ? p.payments : []
                            const paymentText = payments
                                .map(pay => `${String(pay?.symbol ?? pay?.name ?? pay?.tokenAddress ?? "?")}:${Number(pay?.amount ?? 0)}`)
                                .sort()
                                .join(",") || "none"
                            const hex = Number(p?.purchasedHex ?? p?.hexAmount ?? p?.hex ?? 0) || 0
                            const usd = Number(p?.usdSpent ?? p?.spentUsd ?? p?.usdValue ?? p?.costUsd ?? 0) || 0
                            return {
                                block: Number(p?.block ?? p?.blockNumber ?? 0) || 0,
                                hash: String(p?.hash ?? p?.transactionHash ?? "").toLowerCase(),
                                wallet: normalizeAddress(p?.wallet),
                                hex,
                                usd,
                                avg: hex > 0 && usd > 0 ? usd / hex : 0,
                                native: Number(p?.nativePlsSpent ?? 0) || 0,
                                payments: paymentText
                            }
                        })
                        .filter(row => row.hash)
                        .sort((a, b) => a.block - b.block || a.hash.localeCompare(b.hash))

                    const v184Totals = {
                        purchases: v184PulseRows.length,
                        hex: v184PulseRows.reduce((sum, row) => sum + row.hex, 0),
                        usd: v184PulseRows.reduce((sum, row) => sum + row.usd, 0)
                    }
                    v184Totals.dca = v184Totals.hex > 0 ? v184Totals.usd / v184Totals.hex : 0

                    dcaDiagnostic(`[HEX DCA V184 ${v177Environment}] PULSE PRICING AUDIT`)
                    dcaDiagnostic(`[HEX DCA V184 TOTAL ${v177Environment}] purchases=${v184Totals.purchases} | HEX=${v184Totals.hex.toFixed(8)} | USD=${v184Totals.usd.toFixed(8)} | DCA=${v184Totals.dca.toFixed(12)}`)
                    v184PulseRows.forEach((row, index) => dcaDiagnostic(
                        `[V184 ${v177Environment} ${String(index + 1).padStart(2, "0")}] block=${row.block} | ${row.hash} | HEX=${row.hex} | USD=${row.usd} | AVG=${row.avg} | native=${row.native} | payments=${row.payments}`
                    ))
                    dcaDiagnostic()
                } catch (v184Error) {
                    console.warn("[HEX DCA V184] pricing audit failed", v184Error)
                }

                writeCachedDcaResult(resultCacheKey, { purchases: combinedPurchases, walletErrors: combinedErrors, transactionErrors: combinedTxErrors })

                setPurchases(combinedPurchases)
                setWalletErrors(combinedErrors)
                setTransactionErrors(combinedTxErrors)
            } catch (error) {
                if (cancelled) {
                    return
                }

                setWalletErrors({
                    general:
                        error?.message ??
                        "Unable to calculate HEX purchase history"
                })
            } finally {
                if (!cancelled) {
                    setLoading(false)
                    setProgress(current => ({
                        ...current,
                        stage: "complete",
                        diagnostic: ""
                    }))
                }
            }
        }

        loadHexPurchases()

        return () => {
            cancelled = true
        }
    }, [
        walletKey,
        settings
    ])

    const stats = useMemo(() => {
    const normalizedHiddenWallets = new Set(
        (hiddenWallets ?? []).map(normalizeAddress)
    )

    const visiblePurchases = purchases.filter(purchase => {
        return !normalizedHiddenWallets.has(
            normalizeAddress(purchase?.wallet)
        )
    })

    const summarizePurchases = purchaseList => {
        const totalHexPurchased = purchaseList.reduce(
            (total, purchase) => {
                return (
                    total +
                    Number(purchase?.purchasedHex ?? 0)
                )
            },
            0
        )

        const pricedPurchases = purchaseList.filter(
            purchase => {
                const usdSpent =
                    Number(purchase?.usdSpent)

                return (
                    Number.isFinite(usdSpent) &&
                    usdSpent > 0
                )
            }
        )

        const totalUsdSpent = pricedPurchases.reduce(
            (total, purchase) => {
                return (
                    total +
                    Number(purchase?.usdSpent ?? 0)
                )
            },
            0
        )

        const pricedHexPurchased =
            pricedPurchases.reduce(
                (total, purchase) => {
                    return (
                        total +
                        Number(
                            purchase?.purchasedHex ?? 0
                        )
                    )
                },
                0
            )

        const averagePrice =
            pricedHexPurchased > 0
                ? totalUsdSpent / pricedHexPurchased
                : null

        const unpricedPurchases =
            purchaseList.filter(purchase => {
                const usdSpent =
                    Number(purchase?.usdSpent)

                return (
                    !Number.isFinite(usdSpent) ||
                    usdSpent <= 0
                )
            })

        return {
            purchaseCount: purchaseList.length,
            totalHexPurchased,
            totalUsdSpent,
            averagePrice,
            pricedHexPurchased,
            pricedPurchaseCount:
                pricedPurchases.length,
            unpricedPurchaseCount:
                unpricedPurchases.length,
            pricingErrors: unpricedPurchases
                .map(purchase => {
                    return purchase?.pricingError
                })
                .filter(Boolean)
        }
    }

    const ethereumPurchases =
        visiblePurchases.filter(purchase => {
            return (
                purchase?.network === "ethereum" ||
                purchase?.networkKey === "ethereum"
            )
        })

    const pulsechainPurchases =
        visiblePurchases.filter(purchase => {
            // v123: older/newer discovery paths do not all stamp the same network
            // fields. The verifier already recognizes all of these as PulseChain;
            // the stats layer must do the same or a valid purchase can disappear
            // from the displayed PulseChain HEX total/DCA after verification.
            return (
                purchase?.network === "mainnet" ||
                purchase?.network === "pulsechain" ||
                purchase?.networkKey === "pulsechain" ||
                purchase?.networkLabel === "PulseChain"
            )
        })

    const combinedStats =
        summarizePurchases(visiblePurchases)

    const ethereumStats =
        summarizePurchases(ethereumPurchases)

    const pulsechainStats =
        summarizePurchases(pulsechainPurchases)

    const purchasesByWallet = new Map()

    visiblePurchases.forEach(purchase => {
        const wallet =
            normalizeAddress(purchase?.wallet)

        if (!wallet) {
            return
        }

        const walletPurchases =
            purchasesByWallet.get(wallet) ?? []

        walletPurchases.push(purchase)
        purchasesByWallet.set(
            wallet,
            walletPurchases
        )
    })

    const walletStats = [
        ...purchasesByWallet.entries()
    ]
        .map(([wallet, walletPurchases]) => {
            const walletEthereumPurchases =
                walletPurchases.filter(purchase => {
                    return (
                        purchase?.network === "ethereum" ||
                        purchase?.networkKey === "ethereum"
                    )
                })

            const walletPulsechainPurchases =
                walletPurchases.filter(purchase => {
                    return (
                        purchase?.network === "mainnet" ||
                        purchase?.networkKey === "pulsechain"
                    )
                })

            return {
                wallet,

                ...summarizePurchases(
                    walletPurchases
                ),

                ethereum:
                    summarizePurchases(
                        walletEthereumPurchases
                    ),

                pulsechain:
                    summarizePurchases(
                        walletPulsechainPurchases
                    )
            }
        })
        .sort((a, b) => {
            return (
                Number(b.totalUsdSpent ?? 0) -
                Number(a.totalUsdSpent ?? 0)
            )
        })

    const hasWalletErrors =
        Object.keys(walletErrors).length > 0

    const hasTransactionErrors =
        transactionErrors.length > 0

    return {
        ...combinedStats,

        combined: combinedStats,

        ethereum: {
            key: "ethereum",
            network: "ethereum",
            label: "Ethereum",
            ...ethereumStats
        },

        pulsechain: {
            key: "pulsechain",
            network: "mainnet",
            label: "PulseChain",
            ...pulsechainStats
        },

        walletStats,

        complete:
            !hasWalletErrors &&
            !hasTransactionErrors &&
            combinedStats.unpricedPurchaseCount === 0
    }
}, [
    purchases,
    hiddenWallets,
    walletErrors,
    transactionErrors
])

    return {
        purchases,
        stats,
        loading,
        progress,
        walletErrors,
        transactionErrors
    }
}