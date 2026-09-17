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
const DCA_TRANSACTION_CACHE_VERSION = 15 // v76: reuse proven v74 per-transaction results; only new PLS union hashes are fetched

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
    } catch {
        // DCA still works without persistent caching.
    }
}
const DCA_RESULT_CACHE_VERSION = 8
const DCA_RESULT_CACHE_MAX_AGE = 6 * 60 * 60 * 1000

const DCA_WALLET_CACHE_VERSION = 9 // v123: preserve v122 wallet cache; refresh policy no longer discards a usable saved DCA
const getDcaWalletCacheKey = wallet => `hex_dca_wallet_v${DCA_WALLET_CACHE_VERSION}:${normalizeAddress(wallet)}`
const readDcaWalletCache = wallet => {
    try {
        const raw = safeLocalStorageGet(getDcaWalletCacheKey(wallet))
        if (!raw) return null
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed?.purchases) ? parsed : null
    } catch { return null }
}
const writeDcaWalletCache = (wallet, purchases, walletErrors = {}, transactionErrors = [], complete = true) => {
    // V45: only a fully successful wallet scan is allowed to become a warm
    // six-hour DCA cache. A transient explorer/RPC/pricing failure used to be
    // persisted exactly like a successful zero-purchase wallet, which could
    // make a packaged restart show DCA/P&L as N/A until the cache expired.
    const payload = { purchases, walletErrors, transactionErrors, complete: complete === true, cachedAt: Date.now() }
    safeLocalStorageSet(getDcaWalletCacheKey(wallet), JSON.stringify(payload))
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
            if (!window?.electron?.fetchJson) {
                throw new Error(
                    "Electron JSON fetch bridge is unavailable"
                )
            }

            let sharedRequest = v134InFlightPriceRequests.get(url)
            if (!sharedRequest) {
                sharedRequest = v134RunPriceRequest(() => window.electron.fetchJson(url))
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
    const unixTimestamp = toUnixSeconds(timestamp)

    if (!unixTimestamp) {
        return null
    }

    const date = new Date(unixTimestamp * 1000)

    const year = date.getUTCFullYear()
    const month = String(
        date.getUTCMonth() + 1
    ).padStart(2, "0")
    const day = String(
        date.getUTCDate()
    ).padStart(2, "0")

    const cacheKey = `eth:${year}-${month}-${day}`

    if (priceMemoryCache.has(cacheKey)) {
        return priceMemoryCache.get(cacheKey)
    }

    const storageKey = `hex_dca_price_${cacheKey}`
    const storedPrice = Number(
        safeLocalStorageGet(storageKey)
    )

    if (
        Number.isFinite(storedPrice) &&
        storedPrice > 0
    ) {
        priceMemoryCache.set(cacheKey, storedPrice)
        return storedPrice
    }

    const startOfDay = Date.UTC(
        year,
        date.getUTCMonth(),
        date.getUTCDate()
    )

    const endOfDay =
        startOfDay + 86400000 - 1

    const url =
        `https://data-api.binance.vision/api/v3/klines` +
        `?symbol=ETHUSDT` +
        `&interval=1d` +
        `&startTime=${startOfDay}` +
        `&endTime=${endOfDay}` +
        `&limit=1`

    try {
        const json = await fetchJsonWithRetry(url, {
            attempts: 3,
            delay: 1000
        })

        const candle =
            Array.isArray(json) && Array.isArray(json[0])
                ? json[0]
                : null

        // Binance kline layout:
        // 0 open time, 1 open, 2 high, 3 low, 4 close.
        const price = Number(candle?.[4])

        if (
            !Number.isFinite(price) ||
            price <= 0
        ) {
            return null
        }

        priceMemoryCache.set(cacheKey, price)
        safeLocalStorageSet(
            storageKey,
            String(price)
        )

        return price
    } catch (error) {
        console.error(
            "ETH PRICE FALLBACK FAILED:",
            {
                timestamp,
                url,
                status: error?.status,
                message: error?.message
            }
        )

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
    const unixTimestamp = toUnixSeconds(timestamp)
    if (!normalizedToken || !unixTimestamp) return null

    const llamaChain = source?.key === "ethereum" ? "ethereum" : "pulsechain"
    const coinKey = `${llamaChain}:${normalizedToken}`
    const dayBucket = Math.floor(unixTimestamp / 86400)
    const cacheKey = `llama:${coinKey}:${dayBucket}`

    if (priceMemoryCache.has(cacheKey)) {
        return priceMemoryCache.get(cacheKey)
    }

    const storageKey = `hex_dca_price_${cacheKey}`
    const storedPrice = Number(safeLocalStorageGet(storageKey))
    if (Number.isFinite(storedPrice) && storedPrice > 0) {
        priceMemoryCache.set(cacheKey, storedPrice)
        return storedPrice
    }

    try {
        const url =
            `https://coins.llama.fi/prices/historical/${unixTimestamp}/` +
            encodeURIComponent(coinKey)
        const result = await window.electron.fetchJson(url)
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

    if (!normalizedToken || !unixTimestamp) {
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

    // Cache one historical price per token per UTC day.
    // Many HEX purchases are separate multicalls made minutes apart, so this
    // prevents repeatedly requesting nearly identical historical prices.
    const dayBucket =
        Math.floor(unixTimestamp / 86400)

    const networkKey =
        source?.key ??
        source?.network ??
        "pulsechain"

    const cacheKey =
        `${networkKey}:${normalizedToken}:${dayBucket}`

    if (priceMemoryCache.has(cacheKey)) {
        return priceMemoryCache.get(cacheKey)
    }

    const storageKey = `hex_dca_price_${cacheKey}`
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
        const beforeTimestamp = unixTimestamp + intervalSeconds
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

    // Daily pricing is accurate enough for a cost-basis estimate and allows
    // every purchase of the same token on the same day to share one cached price.
    try {

    const dailyCandles = await fetchCandles("day")

    price = selectClosestCandlePrice(
        dailyCandles,
        unixTimestamp
    )

} catch (dailyError) {
    // Fall through to hourly pricing. Keep the error in case the fallback also fails.
    try {
        const hourlyCandles = await fetchCandles("hour")
        price = selectClosestCandlePrice(hourlyCandles, unixTimestamp)
    } catch (hourlyError) {
        throw hourlyError ?? dailyError
    }
}

if (!price) {
    const hourlyCandles = await fetchCandles("hour")
    price = selectClosestCandlePrice(hourlyCandles, unixTimestamp)
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
        return null
    }
    if (isExcludedTransaction(activity)) {
        if (network === "ethereum") ethDcaRejectAudit.excluded += 1
        if (network === "pulsechain" || network === "mainnet") {
            pulseDcaRejectAudit.excluded += 1
            recordPulseReject("excluded", activity, { transferCount: rpcTransfers.length })
        }
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
        stage: "idle"
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
const staleWallets = []

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
    const age = cached?.cachedAt ? Date.now() - cached.cachedAt : Infinity
    if (cached) cachedWallets[wallet] = cached
    // v123: a saved DCA is a usable snapshot even when a few historical prices
    // failed or the diagnostic scan was partial. Do NOT throw it away and launch
    // another multi-minute history crawl on Ctrl+R. Keep showing the saved result
    // until the normal cache age expires (or the user explicitly clears cache).
    if (!cached || age >= DCA_RESULT_CACHE_MAX_AGE) staleWallets.push(wallet)
}

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

if (staleWallets.length === 0) {
    // v135: A warm wallet cache should not freeze historical-pricing failures
    // for six hours. Reprice only the failed rows in-place; do NOT rescan chain
    // history and do NOT require the user to clear cache.
    let cachedUnpriced = warmPurchases.filter(p => p?.pricingError)
    if (cachedUnpriced.length === 0) return

    // v140: Repair already-saved caches without forcing a chain-history rescan.
    // Only unresolved rows are inspected. If the sole outgoing token is an LP
    // token transferred back to its own pair contract, the incoming HEX is
    // liquidity being redeemed, not HEX being purchased. Remove that row from
    // the purchase ledger and persist the corrected wallet cache.
    const cachedLiquidityRedemptionKeys = new Set()
    for (const candidate of cachedUnpriced) {
        try {
            if (Number(candidate?.nativePlsSpent ?? 0) > 0) continue
            const payments = Array.isArray(candidate?.payments) ? candidate.payments : []
            if (payments.length !== 1 || !payments[0]?.tokenAddress) continue

            const network = candidate?.network ?? "mainnet"
            const tokenAddress = normalizeAddress(payments[0].tokenAddress)
            const wallet = normalizeAddress(candidate?.wallet)
            const txHash = candidate?.hash ?? candidate?.transactionHash
            const metadata = await batchFetchTokenInfo([tokenAddress], network, settings)
            const info = metadata?.[tokenAddress] ?? {}
            const symbol = String(info?.symbol ?? payments[0]?.symbol ?? "").toUpperCase()
            const name = String(info?.name ?? payments[0]?.name ?? "").toLowerCase()
            const looksLikeLpToken =
                symbol === "PLP" ||
                symbol.includes("LP") ||
                name.includes("lp") ||
                name.includes("liquidity")
            if (!looksLikeLpToken) continue

            const transfers = await decodeTransferLogs(txHash, network, settings)
            const matchingOutgoing = (Array.isArray(transfers) ? transfers : []).filter(transfer =>
                normalizeAddress(transfer?.from) === wallet &&
                normalizeAddress(transfer?.tokenAddress) === tokenAddress
            )
            const sentBackToPair = matchingOutgoing.length > 0 && matchingOutgoing.every(transfer =>
                normalizeAddress(transfer?.to) === tokenAddress
            )
            if (!sentBackToPair) continue

            const key = `${wallet}:${String(txHash ?? "").toLowerCase()}`
            cachedLiquidityRedemptionKeys.add(key)
        } catch (error) {
        }
    }

    let v140WarmPurchases = warmPurchases
    if (cachedLiquidityRedemptionKeys.size > 0) {
        v140WarmPurchases = warmPurchases.filter(p => {
            const key = `${normalizeAddress(p?.wallet)}:${String(p?.hash ?? p?.transactionHash ?? "").toLowerCase()}`
            return !cachedLiquidityRedemptionKeys.has(key)
        })
        cachedUnpriced = v140WarmPurchases.filter(p => p?.pricingError)

        for (const wallet of walletAddresses) {
            const oldCache = cachedWallets[wallet]
            if (!oldCache) continue
            const walletPurchases = v140WarmPurchases.filter(
                p => normalizeAddress(p?.wallet) === normalizeAddress(wallet)
            )
            cachedWallets[wallet] = writeDcaWalletCache(
                wallet,
                walletPurchases,
                oldCache?.walletErrors ?? {},
                oldCache?.transactionErrors ?? [],
                oldCache?.complete === true
            )
        }

        setPurchases(v140WarmPurchases)
        setProgress({ current: v140WarmPurchases.length, total: v140WarmPurchases.length, stage: "complete" })
    }

    if (cachedUnpriced.length === 0) {
        setLoading(false)
        return
    }

    setLoading(true)
    setProgress({ current: 0, total: cachedUnpriced.length, stage: "pricing" })

    const recoveredByKey = new Map()
    for (let i = 0; i < cachedUnpriced.length && !cancelled; i += 1) {
        const original = cachedUnpriced[i]
        let recovered = original
        try {
            recovered = await pricePurchase({
                ...original,
                // force pricePurchase to retry a previously failed row
                usdSpent: null
            })
        } catch (error) {
            recovered = {
                ...original,
                pricingError: error?.message ?? original?.pricingError ?? "Unable to retrieve historical USD pricing"
            }
        }
        const key = `${normalizeAddress(original?.wallet)}:${String(original?.hash ?? original?.transactionHash ?? "").toLowerCase()}`
        recoveredByKey.set(key, recovered)
        setProgress({ current: i + 1, total: cachedUnpriced.length, stage: "pricing" })
    }

    if (cancelled) return

    const repricedPurchases = v140WarmPurchases.map(p => {
        const key = `${normalizeAddress(p?.wallet)}:${String(p?.hash ?? p?.transactionHash ?? "").toLowerCase()}`
        return recoveredByKey.get(key) ?? p
    })

    for (const wallet of walletAddresses) {
        const oldCache = cachedWallets[wallet]
        if (!oldCache) continue
        const walletPurchases = repricedPurchases.filter(
            p => normalizeAddress(p?.wallet) === normalizeAddress(wallet)
        )
        cachedWallets[wallet] = writeDcaWalletCache(
            wallet,
            walletPurchases,
            oldCache?.walletErrors ?? {},
            oldCache?.transactionErrors ?? [],
            oldCache?.complete === true
        )
    }

    setPurchases(repricedPurchases)
    setProgress({ current: repricedPurchases.length, total: repricedPurchases.length, stage: "complete" })
    setLoading(false)
    return
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
                stage: "history"
            })

            try {
    const candidates = []
    const combinedWalletErrors = {}

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
                    try {
                        activities[normalizedWallet] = await fetchIncomingTokenTransferTransactions(
                            normalizedWallet,
                            HEX_ADDRESS,
                            source.network,
                            settings,
                            {
                                maxPages: 100,
                                delayBetweenPages: 450,
                                retryAttempts: 2,
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
                    const merged = new Map()
                    let successfulDiscoverySources = 0

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
                        incomingHex.forEach(row => {
                            const hash = String(row?.hash ?? "").toLowerCase()
                            if (hash && !merged.has(hash)) merged.set(hash, row)
                        })
                    } catch (error) {
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
                                startBlock: source.minimumBlock ?? 0,
                                endBlock: source.maximumBlock ?? 99999999,
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
                        let added = 0
                        legacyHexTransfers
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
                        console.warn("HEX DCA PulseChain legacy index failed", {
                            wallet: normalizedWallet,
                            message: error?.message ?? String(error)
                        })
                    }

                    // v109 PulseChain-only recovery: add the known-good v106 wallet-activity
                    // discovery as a THIRD source, but only after the two HEX-specific indexes.
                    // This is deliberately scoped to PulseChain; the locked Ethereum v106 path
                    // above is byte-for-byte unchanged. The activity source can expose router /
                    // internal purchase transactions that are absent from token-transfer indexes.
                    try {
                        const activitySupplement = await batchFetchCompleteActivities(
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
                        )
                        const activityRows = activitySupplement?.activities?.[normalizedWallet] ?? []
                        let activityAdded = 0
                        activityRows.forEach(row => {
                            const hash = String(row?.hash ?? row?.transaction_hash ?? "").toLowerCase()
                            if (!hash || merged.has(hash)) return
                            merged.set(hash, row)
                            activityAdded += 1
                        })
                        successfulDiscoverySources += 1
                    } catch (error) {
                        console.warn("HEX DCA PulseChain activity supplement failed", {
                            wallet: normalizedWallet,
                            message: error?.message ?? String(error)
                        })
                    }

                    activities[normalizedWallet] = [...merged.values()]
                    if (successfulDiscoverySources === 0) {
                        errors[normalizedWallet] = "Unable to retrieve PulseChain HEX transfer history"
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
                    stage: "transactions"
                })

                const foundPurchases = []
                const detailErrors = []
                resetEthDcaRejectAudit()
            resetPulseDcaRejectAudit()

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
                const PULSECHAIN_TRANSACTION_WORKERS = 10
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

                const inspectCandidate = async candidate => {
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
                    const usableCachedResult =
                        cachedResult.hit && !(isPulseChainCandidate && !cachedResult.purchase)

                    try {
                        let purchase = null
                        if (usableCachedResult) {
                            cachedCandidateCount += 1
                            purchase = cachedResult.purchase
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
                                            !Array.isArray(effectiveResult?.transfers) ||
                                            effectiveResult.transfers.length === 0 ||
                                            v129MissingPulseMetadata
                                        )
                                    ) {
                                        try {
                                            const explorerTx = await fetchExplorerTransaction(
                                                candidate.hash,
                                                candidate.network,
                                                settings,
                                                { retryAttempts: 2 }
                                            )
                                            const explorerTransfers = Array.isArray(explorerTx?.token_transfers)
                                                ? explorerTx.token_transfers.map(transfer => ({
                                                    tokenAddress: getTokenAddress(transfer),
                                                    from: getAddress(transfer?.from),
                                                    to: getAddress(transfer?.to),
                                                    value: transfer?.total?.value ?? transfer?.value ?? "0"
                                                })).filter(transfer => transfer.tokenAddress && transfer.from && transfer.to)
                                                : []

                                            // Keep the RPC transfers when they were already decoded successfully;
                                            // in the metadata-only failure case we only need the explorer's block/time.
                                            // If RPC was empty, use explorer token_transfers as before.
                                            const existingTransfers = Array.isArray(effectiveResult?.transfers)
                                                ? effectiveResult.transfers
                                                : []
                                            const recoveredTransfers = existingTransfers.length > 0
                                                ? existingTransfers
                                                : explorerTransfers

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
                                stage: "transactions"
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
                    runCandidatePool(pulsechainCandidates, PULSECHAIN_TRANSACTION_WORKERS, 60),
                    runCandidatePool(otherCandidates, 3, 100)
                ])


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

                
                if (cancelled) {
                    return
                }

               
                setProgress({
                    current: 0,
                    total: foundPurchases.length,
                    stage: "pricing"
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
                                setProgress({ current: completedPrices, total: foundPurchases.length, stage: "pricing" })
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

                    const walletCache = writeDcaWalletCache(
                        wallet,
                        walletPurchases,
                        walletErrorSubset,
                        walletTxErrors,
                        walletScanComplete
                    )
                    cachedWallets[wallet] = walletCache
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
                        stage: "complete"
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