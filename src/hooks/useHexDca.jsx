// useHexDca.jsx
import { useEffect, useMemo, useState } from "react"
import { ethers } from "ethers"
import {
    batchFetchCompleteActivities,
    batchFetchTokenInfo,
    decodeTransferLogs,
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
const DCA_TRANSACTION_CACHE_VERSION = 5

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
const DCA_RESULT_CACHE_VERSION = 7
const DCA_RESULT_CACHE_MAX_AGE = 6 * 60 * 60 * 1000

const DCA_WALLET_CACHE_VERSION = 2
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

            const result = await Promise.race([
                window.electron.fetchJson(url),

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

            if (attempt < attempts - 1) {
                const retryDelay =
                    error?.status === 429
                        ? 3000 * (attempt + 1)
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
        const json = await fetchJsonWithRetry(url)

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

} catch {
    // Fall through to hourly pricing.
}

if (!price) {
    try {


        const hourlyCandles = await fetchCandles("hour")

        price = selectClosestCandlePrice(
            hourlyCandles,
            unixTimestamp
        )


    } catch {
        return null
    }
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

    const historicalPrice =
        await fetchHistoricalTokenPrice(
            payment?.tokenAddress,
            purchase?.timestamp,
            payment?.symbol,
            source
        )

    if (!Number.isFinite(historicalPrice) || historicalPrice <= 0) {
            return {
                ...purchase,
                pricingError:
                    `Historical USD price unavailable for ` +
                    `${payment?.symbol || payment?.tokenAddress || "payment token"}`
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

    const method =
        (activity?.method ?? "").toLowerCase()

    // Routed swaps and multicalls must be inspected through the RPC receipt.
    // Their lightweight explorer summaries may not show the final HEX transfer.
    if (
        method.includes("swap") ||
        method.includes("multicall")
    ) {
        return true
    }

    const activityTransfers =
        Array.isArray(activity?.token_transfers)
            ? activity.token_transfers
            : []

    return activityTransfers.some(transfer => {
        const fromAddress = getAddress(transfer?.from)

        return (
            getTokenAddress(transfer) === HEX_ADDRESS &&
            getAddress(transfer?.to) === walletAddress &&
            getTransferType(transfer) === "token_transfer" &&
            fromAddress !== ZERO_ADDRESS
        )
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

    if (
        !Array.isArray(rpcTransfers) ||
        rpcTransfers.length === 0 ||
        isExcludedTransaction(activity)
    ) {
        return null
    }

    if (
        !rpcTimestamp ||
        !Number.isFinite(Number(rpcBlockNumber))
    ) {
        throw new Error(
            `${source.label} RPC transaction metadata was unavailable.`
        )
    }

    const numericBlockNumber =
        Number(rpcBlockNumber)

    if (
        Number.isFinite(source?.minimumBlock) &&
        numericBlockNumber < source.minimumBlock
    ) {
        return null
    }

    if (
        Number.isFinite(source?.maximumBlock) &&
        numericBlockNumber > source.maximumBlock
    ) {
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
    const cacheComplete = cached?.complete === true
    if (cached) cachedWallets[wallet] = cached
    // V45: failed/partial DCA scans must retry on the next launch instead of
    // masquerading as a valid empty wallet cache for six hours.
    if (!cached || !cacheComplete || age >= DCA_RESULT_CACHE_MAX_AGE) staleWallets.push(wallet)
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
    return
}
            setLoading(Object.keys(cachedWallets).length === 0)

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

    for (const source of DCA_SOURCES) {
        if (cancelled) {
            return
        }

        setProgress({
            current:
                DCA_SOURCES.indexOf(source),
            total: DCA_SOURCES.length,
            stage: "history"
        })

        let historyResult

        try {
            historyResult =
                await batchFetchCompleteActivities(
                    staleWallets,
                    source.network,
                    settings,
                    {
                        maxPages: 250,
                        delayBetweenPages: 500,
                        retryAttempts: 6,

                        onProgress: progress => {
                            setProgress({
                                stage: "history",

                                network:
                                    progress.network,

                                current:
                                    progress.page,

                                collected:
                                    progress.collected
                            })
                        }
                    }
                )
        } catch (error) {
            combinedWalletErrors[
                `${source.key}:general`
            ] =
                error?.message ??
                `Unable to retrieve ${source.label} history`

            continue
        }

        if (cancelled) {
            return
        }

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
    }

    if (cancelled) {
        return
    }

    setWalletErrors(combinedWalletErrors)

    const uniqueCandidates = [
                    ...new Map(
                        candidates.map(candidate => {
                            const key =
                                `${candidate.network}:` +
                                `${candidate.wallet}:` +
                                `${candidate.hash?.toLowerCase()}`

                            return [key, candidate]
                        })
                    ).values()
                ]
                
                setProgress({
                    current: 0,
                    total: uniqueCandidates.length,
                    stage: "transactions"
                })

                const foundPurchases = []
                const detailErrors = []

                for (
                    let index = 0;
                    index < uniqueCandidates.length;
                    index += 1
                ) {
                    if (cancelled) {
                        return
                    }

                    const candidate = uniqueCandidates[index]

                    const transactionCacheKey =
                        getTransactionCacheKey({
                            network: candidate.network,
                            wallet: candidate.wallet,
                            hash: candidate.hash
                        })

                    const cachedResult =
                        readCachedTransactionResult(
                            transactionCacheKey
                        )

                    let usedTransactionCache = false

                    try {
                        let purchase = null

                        if (cachedResult.hit) {
                            usedTransactionCache = true
                            purchase = cachedResult.purchase
                        } else {
                            const rpcResult =
                                await decodeTransferLogs(
                                    candidate.hash,
                                    candidate.network,
                                    settings,
                                    {
                                        includeMetadata: true
                                    }
                                )

                            const rpcTransfers =
                                Array.isArray(rpcResult?.transfers)
                                    ? rpcResult.transfers
                                    : []

                            purchase =
                                await extractRpcHexPurchase({
                                    rpcTransfers,
                                    rpcTimestamp: rpcResult?.timestamp,
                                    rpcBlockNumber: rpcResult?.blockNumber,
                                    activity: candidate.activity,
                                    walletAddress: candidate.wallet,
                                    network: candidate.network,
                                    settings
                                })

                            // Cache both purchases and confirmed non-purchases.
                            // A blockchain receipt cannot change after confirmation.
                            writeCachedTransactionResult(
                                transactionCacheKey,
                                purchase
                            )
                        }

                        if (purchase) {
                            foundPurchases.push(purchase)
                        }
                    } catch (error) {

                        detailErrors.push({
                            network: candidate.network,
                            networkKey: candidate.networkKey,
                            networkLabel: candidate.networkLabel,
                            wallet: candidate.wallet,
                            hash: candidate.hash,
                            message:
                                error?.message ??
                                "Unable to fetch transaction details"
                        })
                    }
                    
                    if (!cancelled) {
                        setProgress({
                            current: index + 1,
                            total: uniqueCandidates.length,
                            stage: "transactions"
                        })
                    }

                    if (
                        !usedTransactionCache &&
                        index < uniqueCandidates.length - 1
                    ) {
                        await wait(50)
                    }
                }
                
                if (cancelled) {
                    return
                }

               
                setProgress({
                    current: 0,
                    total: foundPurchases.length,
                    stage: "pricing"
                })

                const pricedPurchases = []

                for (
                    let index = 0;
                    index < foundPurchases.length;
                    index += 1
                ) {
                    if (cancelled) {
                        return
                    }

                   try {
                        pricedPurchases.push(
                            await pricePurchase(foundPurchases[index])
                        )
                    } catch (error) {
                        pricedPurchases.push({
                            ...foundPurchases[index],
                            pricingError:
                                error?.message ??
                                "Unable to retrieve historical USD pricing"
                        })
                    }

                    if (!cancelled) {
                        setProgress({
                            current: index + 1,
                            total: foundPurchases.length,
                            stage: "pricing"
                        })
                    }
                }

                pricedPurchases.sort((a, b) => {
                    return (
                        (toUnixSeconds(a?.timestamp) ?? 0) -
                        (toUnixSeconds(b?.timestamp) ?? 0)
                    )
                })

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
                    const hasUnpricedPurchases = walletPurchases.some(p => Boolean(p?.pricingError))
                    const walletScanComplete =
                        Object.keys(walletErrorSubset).length === 0 &&
                        walletTxErrors.length === 0 &&
                        !hasUnpricedPurchases

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
            return (
                purchase?.network === "mainnet" ||
                purchase?.networkKey === "pulsechain"
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