//stake component
import styled from "styled-components"
import { useEffect } from "react"
import { addCommasToNumber, fUnit } from "../../lib/numbers"
import ImageContainer from "../ImageContainer"
import imgHex from '../../icons/hex.png'
import Icon from "../Icon"
import { icons_list } from "../../config/icons"
import { parseHexStats } from "../../lib/hex"
import Tooltip from "../../shared/Tooltip"
import { shortenString } from "../../lib/string"

const Wrapper = styled.div`
    color: white;
    min-width: 825px;
    max-width: 825px;
    justify-self: center;
    font-family: 'Oswald', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

    button {
        &:hover {
            transform: scale(1);
        }
    }
    
    .hex-grid {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        align-items: stretch;
        gap: 8px;
    }

    .hex-grid > * {
        width: 100%;
        height: 100%;
        min-width: 0;
    }
    .hex-title {
        position: relative;
        padding-bottom: 15px;
        letter-spacing: 0.5px;
    }

    @media (max-width: 825px) {
        min-width: calc( 100dvw - 40px );
        max-width: calc( 100dvw - 40px );

        .hex-grid {
            grid-template-columns: 1fr 1fr;
        }

        .hex-title {
            position: relative;
            padding-bottom: 35px;
            letter-spacing: 0.5px;
        }

    }
`

const Row = styled.div`
    border: 1px solid ${props => props.$scenario ? 'rgba(227, 184, 92, .65)' : 'transparent'};
    background: ${props => props.$scenario ? 'linear-gradient(to bottom, rgba(227, 184, 92, 0.12), rgba(227, 184, 92, 0.035))' : 'transparent'};
    box-shadow: ${props => props.$scenario ? '0 0 12px rgba(227, 184, 92, .10), 0 1px 4px rgba(255, 255, 255, 0.1)' : '0 1px 4px rgba(255, 255, 255, 0.1)'};
    width: 100%;
    height: 100%;
    min-height: 100px;
    box-sizing: border-box;
    text-align: center;
    padding: 12px 8px;
    border-radius: 10px;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    .icon-mute {
        svg path {
            fill: rgb(120,120,120) !important;
        }
    }
`

export function StakeComponent({hexData, hexDcaData, hexTokenPnl, hexWalletPositions = {}, walletBalances = {}, hexPrice, hiddenWallets, disabled, visibleWallets, liquidHexUnits = 0, scenarioEnabled = false}) {

    const formatTShares = (tShares) => hexData.stats.totalTShares < 100 ? tShares.toFixed(3) : `${fUnit(tShares, 2)}`
    const formatLength = (length) => length < 364 ? `${length}d` : `${parseFloat(length / 365).toFixed(2)}y`

    const red = 'rgb(255,130,130)'
    const warning = 'rgb(205,205,130)'

    const walletsToShow = Object.keys(visibleWallets ?? {}).map(key => key.toLowerCase())

    const stakes = hexData?.combinedStakes?.filter(stake => walletsToShow.includes(stake?.parent.toLowerCase() ?? ''))
    const stats = hiddenWallets.length > 0 ? parseHexStats(stakes) : hexData?.stats

    if (hexData?.combinedStakes?.length === 0) return ''
    
    const nextStakeAddress = stats?.nextStakeAddress ? shortenString(stats?.nextStakeAddress) : ''
    const nextStakeType = stats?.nextStakeType ? stats?.nextStakeType : ''

    const totalStakes = stats?.totalStakes ?? 0
    const activeStakes = stats?.totalActiveStakes ?? 0
    
    const hexUsd = hexPrice?.priceUsd

    const effectivePenalty = stats?.totalEffectivePenalty ?? 0
    const penaltyHexUsd = effectivePenalty * hexUsd

    const hexYield = stats?.totalHexYield ?? 0
    const hexYieldUsd = hexYield * hexUsd

    const stakedHex = stats.totalStakedHex ?? 0
    const stakedHexUsd = stakedHex * hexUsd

    const hexBalance = stats?.totalFinalHex ?? 0
    const hexBalanceUsd = hexBalance * hexUsd

    const displayPenalty = (fUnit((Number(effectivePenalty) ?? 0) * -1, 3))
    const dcaLoading =
        hexDcaData?.loading === true

    const dcaProgress =
        hexDcaData?.progress ?? {
            current: 0,
            total: 0,
            stage: "idle"
        }

    const dcaProgressText = (() => {
        const current = Number(dcaProgress.current ?? 0)
        const total = Number(dcaProgress.total ?? 0)

        if (!dcaLoading) return ""

        if (dcaProgress.stage === "history") {
            // v121: both discovery jobs run concurrently. Show both counters at
            // once instead of whichever network happened to report progress last.
            const hp = dcaProgress.historyProgress ?? {}
            const pulsechain = hp.pulsechain ?? hp.mainnet ?? { current: 0 }
            const ethereum = hp.ethereum ?? { current: 0 }
            const plsPage = Number(pulsechain.current ?? 0)
            const ethPage = Number(ethereum.current ?? 0)
            return `PulseChain History\nPage ${plsPage || 1}\nEthereum History\nPage ${ethPage || 1}`
        }

        if (dcaProgress.stage === "transactions") {
            const np = dcaProgress.networkProgress ?? {}
            const pulsechain = np.pulsechain ?? { current: 0, total: 0 }
            const mainnet = np.mainnet ?? { current: 0, total: 0 }
            const plsCurrent = Number(pulsechain.current ?? 0) + Number(mainnet.current ?? 0)
            const plsTotal = Number(pulsechain.total ?? 0) + Number(mainnet.total ?? 0)
            const eth = np.ethereum ?? { current: 0, total: 0 }
            return `PulseChain Purchases\n${plsCurrent} of ${plsTotal}\nEthereum Purchases\n${Number(eth.current ?? 0)} of ${Number(eth.total ?? 0)}`
        }

        if (dcaProgress.stage === "pricing") {
            return total > 0 ? `Pricing purchase\n${current} of ${total}` : "Retrieving historical prices"
        }

        return "Preparing DCA calculation"
    })()

    const dcaPrice =
        Number(hexDcaData?.stats?.averagePrice)

    const dcaPurchaseCount =
        Number(hexDcaData?.stats?.purchaseCount ?? 0)

    const dcaTotalHex =
        Number(
            hexDcaData?.stats?.totalHexPurchased ?? 0
        )

    const dcaComplete =
        hexDcaData?.stats?.complete !== false

    const dcaPricedHex =
        Number(
            hexDcaData?.stats?.pricedHexPurchased ?? 0
        )

    const directDcaBasis = Number(hexDcaData?.stats?.totalUsdSpent ?? 0)

    // V43: a direct DCA price is only valid when the scanner actually found and
    // priced purchases. Previously a fallback average could survive while the
    // tooltip correctly reported 0 purchases / $0 spent, producing a convincing
    // but internally contradictory DCA card. Refuse that state.
    const hasDcaPrice =
        Number.isFinite(dcaPrice) && dcaPrice > 0 &&
        dcaPurchaseCount > 0 &&
        dcaPricedHex > 0 &&
        Number.isFinite(directDcaBasis) && directDcaBasis > 0

    // The historical token ledger can preserve the basis carried into stakeStart.
    // It is useful for an amount-weighted miner entry, but explorer gaps can leave
    // old stakeEnd events unmatched. Never trust its *unit count* as the current
    // stake principal: reconcile the entry price against the principal that the
    // live HEX stake data says is actually present right now.
    const reconstructedStakeUnits = Number(hexTokenPnl?.stakedUnits ?? 0)
    const reconstructedStakeBasis = Number(hexTokenPnl?.stakedCostBasisUsd ?? 0)
    const reconstructedStakeEntry =
        reconstructedStakeUnits > 0 && reconstructedStakeBasis > 0
            ? reconstructedStakeBasis / reconstructedStakeUnits
            : null
    // Only trust the token-ledger stake basis when that visible-wallet ledger is
    // complete. An incomplete ledger can still contain a partial staked basis,
    // which previously overrode the valid DCA fallback and produced wildly wrong
    // miner DCA/P&L when some wallets were hidden.
    const reconstructedLedgerComplete = hexTokenPnl?.complete === true
    const hasReconstructedStakeEntry =
        reconstructedLedgerComplete &&
        Number.isFinite(reconstructedStakeEntry) && reconstructedStakeEntry > 0

    const actualStakeUnits = Math.max(0, Number(stakedHex ?? 0))
    const usesReconstructedDca =
        actualStakeUnits > 0 &&
        reconstructedStakeUnits > 0 &&
        reconstructedStakeBasis > 0 &&
        hasReconstructedStakeEntry

    // V45: If active-stake basis and direct purchase DCA are both unavailable,
    // allow a substantial, fully-priced liquid HEX ledger from the SAME visible
    // wallet set to provide an explicitly estimated entry for active principal.
    // This is preferable to inventing a stake-start market price and keeps the
    // miner estimate tied to the wallet's own reconstructed history.
    const reconstructedLiquidUnits = Number(hexTokenPnl?.units ?? 0)
    const reconstructedLiquidBasis = Number(hexTokenPnl?.costBasisUsd ?? 0)
    const reconstructedLiquidEntry =
        reconstructedLiquidUnits > 0 && reconstructedLiquidBasis > 0
            ? reconstructedLiquidBasis / reconstructedLiquidUnits
            : null
    const actualLiquidUnits = Math.max(0, Number(liquidHexUnits ?? 0))
    const liquidCoverage =
        actualLiquidUnits > 0 && reconstructedLiquidUnits > 0
            ? Math.min(
                reconstructedLiquidUnits / actualLiquidUnits,
                actualLiquidUnits / reconstructedLiquidUnits
            )
            : 0
    const canUseLiquidHexFallback =
        actualStakeUnits > 0 &&
        hexTokenPnl?.complete === true &&
        Number(hexTokenPnl?.unpricedAcquisitionCount ?? 0) === 0 &&
        reconstructedLiquidUnits >= 1_000_000 &&
        liquidCoverage >= 0.25 &&
        Number.isFinite(reconstructedLiquidEntry) &&
        reconstructedLiquidEntry > 0

    const usesLiquidHexFallback =
        !usesReconstructedDca &&
        !hasDcaPrice &&
        canUseLiquidHexFallback

    // V46: calculate each selected wallet's active-stake basis independently,
    // then add the dollar bases together. Never calculate one synthetic entry
    // price from an aggregate liquid ledger and apply it to every wallet's stake.
    //
    // This is important when wallet A and wallet B use different valid basis
    // sources/entry prices. Combined P&L must equal Σ(wallet P&L).
    const HEX_ADDRESS =
        "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39"

    const normalizeWallet = address =>
        String(address ?? "").toLowerCase().trim()

    const dcaWalletStatsByAddress = new Map(
        (Array.isArray(hexDcaData?.stats?.walletStats)
            ? hexDcaData.stats.walletStats
            : []
        ).map(item => [normalizeWallet(item?.wallet), item])
    )

    const getWalletStakeUnits = wallet => {
        const walletStakes = (hexData?.combinedStakes ?? []).filter(stake => {
            return normalizeWallet(stake?.parent) === normalizeWallet(wallet)
        })
        return Math.max(
            0,
            Number(parseHexStats(walletStakes)?.totalStakedHex ?? 0)
        )
    }

    const getWalletLiquidUnits = wallet => {
        const normalizedWallet = normalizeWallet(wallet)
        return Math.max(
            0,
            Number(
                walletBalances?.[normalizedWallet]?.balances?.[HEX_ADDRESS]
                    ?.normalized ??
                walletBalances?.[wallet]?.balances?.[HEX_ADDRESS]?.normalized ??
                0
            )
        )
    }

    const getWalletMinerBasis = wallet => {
        const normalizedWallet = normalizeWallet(wallet)
        const stakeUnits = getWalletStakeUnits(normalizedWallet)

        if (!(stakeUnits > 0)) {
            return {
                wallet: normalizedWallet,
                stakeUnits: 0,
                basisUsd: 0,
                entry: null,
                source: "no-active-stakes"
            }
        }

        const ledger =
            hexWalletPositions?.[normalizedWallet]?.[HEX_ADDRESS] ??
            hexWalletPositions?.[wallet]?.[HEX_ADDRESS] ??
            null

        const ledgerStakeUnits = Number(ledger?.stakedUnits ?? 0)
        const ledgerStakeBasis = Number(ledger?.stakedCostBasisUsd ?? 0)
        const ledgerStakeEntry =
            ledgerStakeUnits > 0 && ledgerStakeBasis > 0
                ? ledgerStakeBasis / ledgerStakeUnits
                : null

        const walletDca = dcaWalletStatsByAddress.get(normalizedWallet)
        const directEntry = Number(walletDca?.averagePrice ?? 0)
        const directSpent = Number(walletDca?.totalUsdSpent ?? 0)
        const directPricedHex = Number(walletDca?.pricedHexPurchased ?? 0)
        const directPurchases = Number(walletDca?.purchaseCount ?? 0)
        const hasDirectWalletDca =
            Number.isFinite(directEntry) &&
            directEntry > 0 &&
            directSpent > 0 &&
            directPricedHex > 0 &&
            directPurchases > 0

        // V47: prefer the wallet's directly reconstructed purchase DCA whenever
        // it exists. The active-stake ledger can contain a stakeStart market-price
        // estimate for principal that predates the explorer's usable liquid history.
        // That estimate is useful only as a last resort; treating it as an exact
        // acquisition basis caused old stakes (Wallet 4 exposed this) to inherit
        // stake-date HEX prices such as ~$0.075 instead of the wallet's actual
        // reconstructed purchase entry (~$0.006).
        if (hasDirectWalletDca) {
            return {
                wallet: normalizedWallet,
                stakeUnits,
                basisUsd: directEntry * stakeUnits,
                entry: directEntry,
                source: "wallet-purchase-dca",
                ledgerStakeEntry: Number.isFinite(ledgerStakeEntry) ? ledgerStakeEntry : null
            }
        }

        // If no direct purchase DCA exists, a complete active-stake ledger is the
        // next-best wallet-specific source.
        if (
            ledger?.complete === true &&
            Number.isFinite(ledgerStakeEntry) &&
            ledgerStakeEntry > 0
        ) {
            return {
                wallet: normalizedWallet,
                stakeUnits,
                basisUsd: ledgerStakeEntry * stakeUnits,
                entry: ledgerStakeEntry,
                source: "active-stake-ledger"
            }
        }

        const liquidUnits = Number(ledger?.units ?? 0)
        const liquidBasis = Number(ledger?.costBasisUsd ?? 0)
        const liquidEntry =
            liquidUnits > 0 && liquidBasis > 0
                ? liquidBasis / liquidUnits
                : null

        const actualLiquidUnits = getWalletLiquidUnits(normalizedWallet)
        const coverage =
            actualLiquidUnits > 0 && liquidUnits > 0
                ? Math.min(
                    liquidUnits / actualLiquidUnits,
                    actualLiquidUnits / liquidUnits
                )
                : 0

        const canUseLiquidFallback =
            ledger?.complete === true &&
            Number(ledger?.unpricedAcquisitionCount ?? 0) === 0 &&
            liquidUnits >= 1_000_000 &&
            coverage >= 0.25 &&
            Number.isFinite(liquidEntry) &&
            liquidEntry > 0

        if (canUseLiquidFallback) {
            return {
                wallet: normalizedWallet,
                stakeUnits,
                basisUsd: liquidEntry * stakeUnits,
                entry: liquidEntry,
                source: "wallet-liquid-history-estimate",
                coverage
            }
        }

        return {
            wallet: normalizedWallet,
            stakeUnits,
            basisUsd: 0,
            entry: null,
            source: "unavailable",
            coverage
        }
    }

    const selectedWalletMinerBasis = walletsToShow
        .map(getWalletMinerBasis)
        .filter(item => item.stakeUnits > 0)

    const allSelectedStakeBasisAvailable =
        selectedWalletMinerBasis.length > 0 &&
        selectedWalletMinerBasis.every(item =>
            Number.isFinite(item.entry) && item.entry > 0
        )

    const summedWalletStakeUnits = selectedWalletMinerBasis.reduce(
        (sum, item) => sum + Number(item.stakeUnits ?? 0),
        0
    )

    const summedWalletStakeBasis = selectedWalletMinerBasis.reduce(
        (sum, item) => sum + Number(item.basisUsd ?? 0),
        0
    )

    // Use wallet-by-wallet aggregation whenever every selected active-stake
    // wallet has a usable basis. Fall back to the old aggregate path only while
    // per-wallet ledgers are still loading.
    const usesWalletAggregation =
        allSelectedStakeBasisAvailable &&
        summedWalletStakeUnits > 0 &&
        summedWalletStakeBasis > 0

    const legacyEffectiveDcaPrice = usesReconstructedDca
        ? reconstructedStakeEntry
        : hasDcaPrice
            ? dcaPrice
            : usesLiquidHexFallback
                ? reconstructedLiquidEntry
                : null

    const effectiveDcaPrice = usesWalletAggregation
        ? summedWalletStakeBasis / summedWalletStakeUnits
        : legacyEffectiveDcaPrice

    const hasEffectiveDcaPrice =
        Number.isFinite(effectiveDcaPrice) &&
        effectiveDcaPrice > 0

    const activeStakeCurrentValue =
        actualStakeUnits * Number(hexUsd ?? 0)

    const activeStakeBasis = usesWalletAggregation
        ? summedWalletStakeBasis
        : hasEffectiveDcaPrice
            ? effectiveDcaPrice * actualStakeUnits
            : 0

    const dcaCurrentValue = activeStakeCurrentValue
    const effectiveDcaBasis = activeStakeBasis
    const dcaProfit = dcaCurrentValue - effectiveDcaBasis
    const dcaReturnPercent = effectiveDcaBasis > 0
        ? (dcaProfit / effectiveDcaBasis) * 100
        : null



    const dcaUnpricedCount =
        Number(
            hexDcaData?.stats?.unpricedPurchaseCount ?? 0
        )

    const dcaWalletStats =
        Array.isArray(hexDcaData?.stats?.walletStats)
            ? hexDcaData.stats.walletStats
            : []
        const ethereumDcaStats =
    hexDcaData?.stats?.ethereum ?? {}

const pulsechainDcaStats =
    hexDcaData?.stats?.pulsechain ?? {}

const formatNetworkAverage = networkStats => {
    const averagePrice =
        Number(networkStats?.averagePrice)

    return (
        Number.isFinite(averagePrice) &&
        averagePrice > 0
    )
        ? `$ ${averagePrice.toFixed(6)}`
        : "$ N/A"
}

const formatNetworkHex = networkStats => {
    return addCommasToNumber(
        Number(
            networkStats?.totalHexPurchased ?? 0
        ).toFixed(0)
    )
}

const formatNetworkSpent = networkStats => {
    return addCommasToNumber(
        Number(
            networkStats?.totalUsdSpent ?? 0
        ).toFixed(2)
    )
}

const formatNetworkPurchaseCount = networkStats => {
    const count =
        Number(networkStats?.purchaseCount ?? 0)

    return `${count} purchase${count === 1 ? "" : "s"}`
}

const normalizeWalletAddress = address => {
    return String(address ?? "")
        .toLowerCase()
        .trim()
}

const getWalletLabel = walletAddress => {
    const normalizedAddress =
        normalizeWalletAddress(walletAddress)

    const walletEntry =
        Object.entries(visibleWallets ?? {}).find(
            ([address]) => {
                return (
                    normalizeWalletAddress(address) ===
                    normalizedAddress
                )
            }
        )

    const walletData = walletEntry?.[1]

    const walletName =
        walletData?.name ??
        walletData?.label ??
        walletData?.nickname

    return walletName ||
        shortenString(walletEntry?.[0] ?? walletAddress)
}

const formatSignedUsd = amount => {
    const numericAmount = Number(amount ?? 0)

    return `${numericAmount >= 0 ? "+" : "-"}$ ${addCommasToNumber(
        Math.abs(numericAmount).toFixed(2)
    )}`
}

const fitPnlFontSize = value => {
    const length = String(value ?? "").length
    if (length >= 18) return 14
    if (length >= 16) return 15
    if (length >= 14) return 17
    if (length >= 12) return 19
    return 23
}
    const dcaLoadingLabel = (() => {
        if (!dcaLoading) return ""
        if (dcaProgress.stage === "history") return "Scanning"
        if (dcaProgress.stage === "transactions") return "Verifying"
        if (dcaProgress.stage === "pricing") return "Calculating"
        return "Loading"
    })()

    // V156: The DCA Price card represents the purchase-weighted DCA for the
    // currently visible wallet set.  Do not display the miner/stake basis here:
    // that basis is intentionally derived from active stake positions and can
    // remain unchanged when a wallet with no active stake is shown/hidden.
    // useHexDca already recomputes dcaPrice from visible purchases whenever
    // hiddenWallets changes, so the card must render that value directly.
    const dcaDisplay =
        dcaLoading
            ? dcaLoadingLabel
            : hasDcaPrice
                ? `$ ${dcaPrice.toFixed(6)}`
                : "$ N/A"

    const dcaTooltip = dcaLoading
    ? (
        <div style={{ textAlign: "center" }}>
            Retrieving lifetime HEX purchase history
        </div>
    )
    : hasEffectiveDcaPrice
        ? (
            <div
                style={{
                    textAlign: "center",
                    width: 280,
                    maxWidth: "calc(100vw - 32px)",
                    boxSizing: "border-box"
                }}
            >
                <strong>{usesWalletAggregation ? "Active Stake Weighted Entry" : usesReconstructedDca ? "Estimated Active Stake Entry" : "Active Stake Entry"}</strong>
                <br/>
                $ {effectiveDcaPrice.toFixed(6)}

                <br/><br/>

                <strong>Current Price</strong>
                <br/>
                $ {Number(hexUsd ?? 0).toFixed(6)}

                <br/><br/>

                <strong>Current Value</strong>
                <br/>
                $ {addCommasToNumber(
                    dcaCurrentValue.toFixed(2)
                )}

                <br/><br/>

                <strong>Total Spent</strong>
                <br/>
                $ {addCommasToNumber(
                    Number(effectiveDcaBasis ?? 0).toFixed(2)
                )}

                <br/><br/>

                <strong>Active Staked HEX</strong>
                <br/>
                {addCommasToNumber(
                    Number(actualStakeUnits ?? 0).toFixed(0)
                )}

                <br/><br/>
                <strong>Active Stake P&amp;L</strong>
                <br/>
                {dcaProfit >= 0 ? "+" : "-"}$ {addCommasToNumber(
                    Math.abs(Number(dcaProfit ?? 0)).toFixed(2)
                )}
                {Number.isFinite(dcaReturnPercent) && (
                    <>
                        <br/>
                        {dcaReturnPercent >= 0 ? "+" : ""}
                        {dcaReturnPercent.toFixed(2)}%
                    </>
                )}

                <br/><br/>

                {(usesWalletAggregation || usesReconstructedDca) && (
                    <>
                        <span className="mute">
                            {usesWalletAggregation
                                ? "Basis source: wallet-by-wallet active-stake basis, weighted by each selected wallet's live stake principal."
                                : "Basis source: amount-weighted active-stake ledger, reconciled to the live selected-wallet stake principal."}
                        </span>
                    </>
                )}

                {dcaPurchaseCount > 0 && (
                    <>
                        <div
                            style={{
                                borderTop:
                                    "1px solid rgba(255,255,255,0.2)",
                                margin: "18px 0 12px"
                            }}
                        />
                        <strong>Lifetime Purchase History</strong>
                        <br/><br/>
                        <strong>HEX Purchased</strong>
                        <br/>
                        {addCommasToNumber(
                            Number(dcaTotalHex ?? 0).toFixed(0)
                        )}
                        <br/><br/>
                        {dcaPurchaseCount} purchase{
                            dcaPurchaseCount === 1 ? "" : "s"
                        }
                        <br/><br/>
                        <strong>Network Breakdown</strong>

                        <div style={{ marginTop: 14, color: "#8fbfff" }}>
                            <strong>Ethereum</strong>
                            <br/>
                            Avg: {formatNetworkAverage(ethereumDcaStats)}
                            <br/>
                            Spent: $ {formatNetworkSpent(ethereumDcaStats)}
                            <br/>
                            {formatNetworkHex(ethereumDcaStats)} HEX
                            <br/>
                            {formatNetworkPurchaseCount(ethereumDcaStats)}
                        </div>

                        <div style={{ marginTop: 14, color: "#c59cff" }}>
                            <strong>PulseChain</strong>
                            <br/>
                            Avg: {formatNetworkAverage(pulsechainDcaStats)}
                            <br/>
                            Spent: $ {formatNetworkSpent(pulsechainDcaStats)}
                            <br/>
                            {formatNetworkHex(pulsechainDcaStats)} HEX
                            <br/>
                            {formatNetworkPurchaseCount(pulsechainDcaStats)}
                        </div>
                    </>
                )}
                {dcaUnpricedCount > 0 && (
                    <>
                        <br/><br/>
                        {dcaUnpricedCount} purchase{
                            dcaUnpricedCount === 1
                                ? ""
                                : "s"
                        } could not be historically priced
                    </>
                )}

                {!dcaComplete &&
                    dcaUnpricedCount === 0 && (
                        <>
                            <br/><br/>
                            Some transaction history could
                            not be retrieved
                        </>
                    )}

                {dcaWalletStats.length > 0 && (
                    <>
                        <div
                            style={{
                                borderTop:
                                    "1px solid rgba(255,255,255,0.2)",
                                margin: "16px 0 12px"
                            }}
                        />

                        <strong>Wallet Purchase Breakdown</strong>

                        {dcaWalletStats.map(walletStat => {
                            const walletAveragePrice =
                                Number(
                                    walletStat?.averagePrice
                                )

                            const walletSpent =
                                Number(
                                    walletStat?.totalUsdSpent ??
                                    0
                                )

                            const walletPricedHex =
                                Number(
                                    walletStat
                                        ?.pricedHexPurchased ??
                                    0
                                )

                            const walletCurrentValue =
                                walletPricedHex *
                                Number(hexUsd ?? 0)

                            const walletProfit =
                                walletCurrentValue -
                                walletSpent

                            const walletReturn =
                                walletSpent > 0
                                    ? (
                                        walletProfit /
                                        walletSpent
                                    ) * 100
                                    : null

                            const normalizedWalletStat =
                                normalizeWalletAddress(walletStat.wallet)

                            const minerBasisEntry =
                                selectedWalletMinerBasis.find(item =>
                                    normalizeWalletAddress(item.wallet) ===
                                    normalizedWalletStat
                                )

                            const minerBasisSourceLabel =
                                minerBasisEntry?.source === "wallet-purchase-dca"
                                    ? "Purchase DCA"
                                    : minerBasisEntry?.source === "active-stake-ledger"
                                        ? "Active-stake ledger"
                                        : minerBasisEntry?.source === "wallet-liquid-history-estimate"
                                            ? "Liquid-history estimate"
                                            : null

                            return (
                                <div
                                    key={walletStat.wallet}
                                    style={{
                                        marginTop: 14
                                    }}
                                >
                                    <strong>
                                        {getWalletLabel(
                                            walletStat.wallet
                                        )}
                                    </strong>

                                    {minerBasisSourceLabel && (
                                        <>
                                            <br/>
                                            <span className="mute">
                                                Miner basis: {minerBasisSourceLabel}
                                            </span>
                                        </>
                                    )}

                                    <br/>

                                    Avg: {
                                        Number.isFinite(
                                            walletAveragePrice
                                        ) &&
                                        walletAveragePrice > 0
                                            ? `$ ${walletAveragePrice.toFixed(6)}`
                                            : "$ N/A"
                                    }

                                    <br/>

                                    Spent: $ {
                                        addCommasToNumber(
                                            walletSpent.toFixed(2)
                                        )
                                    }

                                    <br/>

                                    Value: $ {
                                        addCommasToNumber(
                                            walletCurrentValue
                                                .toFixed(2)
                                        )
                                    }

                                    {Number.isFinite(
                                        walletReturn
                                    ) && (
                                        <>
                                            <br/>

                                            Return: {
                                                walletReturn >= 0
                                                    ? "+"
                                                    : ""
                                            }
                                            {walletReturn.toFixed(2)}
                                            %

                                            <br/>

                                            {formatSignedUsd(
                                                walletProfit
                                            )}
                                        </>
                                    )}

                                    <br/>

                                    {addCommasToNumber(
                                        Number(
                                            walletStat
                                                ?.totalHexPurchased ??
                                            0
                                        ).toFixed(0)
                                    )} HEX

                                    <br/>

                                    {Number(
                                        walletStat
                                            ?.purchaseCount ??
                                        0
                                    )} purchase{
                                        Number(
                                            walletStat
                                                ?.purchaseCount ??
                                            0
                                        ) === 1
                                            ? ""
                                            : "s"
                                    }
                                </div>
                            )
                        })}
                    </>
                )}
            </div>
        )
        : (
            <div style={{ textAlign: "center" }}>
                {dcaPurchaseCount === 0
                    ? "No HEX purchases found"
                    : `${dcaPurchaseCount} HEX purchase${
                        dcaPurchaseCount === 1
                            ? ""
                            : "s"
                    } found, but historical USD pricing is unavailable`
                }

                {!dcaComplete && (
                    <>
                        <br/><br/>
                        Some transaction history could not
                        be retrieved
                    </>
                )}
            </div>
        )
    
    return <Wrapper>
        <div style={disabled ? { color: 'rgb(120,120,120)', opacity: 0.5 } : {}}>
            <div className="hex-title">
                HEX Miners ({stats?.totalStakes ?? 0}) • <span style={{ letterSpacing: 1, color: scenarioEnabled ? 'rgb(240,205,130)' : undefined }}> $ { addCommasToNumber(parseFloat( parseFloat(hexBalanceUsd ?? 0)).toFixed(2)) }</span>{scenarioEnabled ? <span style={{ marginLeft: 8, fontSize: 10, color: 'rgb(240,205,130)', letterSpacing: .5 }}>SCENARIO</span> : null}
                <div style={{ position: 'absolute', top: '0', right: '0' }} className="mute">
                    <br className="mobile-only"/>
                    {totalStakes === 0 ? 'No Stakes' : activeStakes === 0 ? 'No Active Stakes' :(stats?.daysUntilNextStake ?? 0) < 0 
                        ? <span style={{ color: red }}>Late by: {Math.abs(stats?.daysUntilNextStake ?? 0)}d ({nextStakeAddress}{nextStakeType ? ' ' + nextStakeType : ''})</span>
                        : <span style={(stats?.daysUntilNextStake && stats?.daysUntilNextStake < 30) ? { color: warning } : {}}>Next Ending: {formatLength(stats?.daysUntilNextStake ?? 0)} ({nextStakeAddress}{nextStakeType ? ' ' + nextStakeType : ''})</span>
                    }
                </div>
            </div>
            <div className="hex-grid">
                <Row>
                    <div style={{ fontSize: 20, textAlign: 'center', width: '100%' }}>Avg Length</div>
                    <div style={{ marginTop: 6, fontSize: 28 }}>
                        {isNaN(stats?.averageStakeLength) ? '0' : formatLength(stats?.averageStakeLength ?? 0)}
                    </div>
                </Row>
                <Tooltip content={<div style={{ textAlign: 'center' }}>{addCommasToNumber(parseFloat(stats?.totalTShares ?? 0).toFixed(4))} T-Shares</div>}>
                    <Row>
                        <div style={{ fontSize: 20, textAlign: 'center', width: '100%' }}>T-Shares</div>
                        <div style={{ marginTop: 6, fontSize: 28 }}>
                            { formatTShares(stats?.totalTShares ?? 0) }
                        </div>
                    </Row>
                </Tooltip>
                <Tooltip content={<div style={{ textAlign: 'center' }}>$ {addCommasToNumber(parseFloat(stakedHexUsd ?? 0).toFixed(2))}<br/><br/>{addCommasToNumber(parseFloat(stakedHex ?? 0).toFixed(0))} HEX</div>}>
                    <Row $scenario={scenarioEnabled}>
                        <div style={{ fontSize: 20, textAlign: 'center', width: '100%' }}>Principal</div>
                        <div style={{ fontSize: 28, marginTop: 6, position: 'relative', textAlign: 'center' }}>
                            $ {fUnit( stakedHexUsd ?? 0, 1 )}
                            <div style={{ marginTop: 4, width: '100%' }} className="icon-mute">
                                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle', paddingTop: 0, fontSize: 16}} className="mute">
                                    {fUnit( stakedHex ?? 0, 3 )} <Icon icon={icons_list.hex} size={18} style={{marginLeft: 5}} />
                                </div>
                            </div>
                        </div>
                    </Row>
                </Tooltip>
                                <Tooltip content={<div style={{ textAlign: 'center' }}>$ {addCommasToNumber(parseFloat(hexYieldUsd ?? 0).toFixed(2))}<br/><br/>{addCommasToNumber(parseFloat(hexYield ?? 0).toFixed(0))} HEX</div>}>
                    <Row $scenario={scenarioEnabled}>
                        <div style={{ fontSize: 20, textAlign: 'center', width: '100%' }}>Mined</div>
                        <div style={{ fontSize: 28, marginTop: 6, position: 'relative', textAlign: 'center' }}>
                            $ {fUnit( hexYieldUsd ?? 0, 1 )}

                            <div style={{ marginTop: 4, width: '100%' }} className="icon-mute">
                                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle', paddingTop: 0, fontSize: 16}} className="mute">
                                    {fUnit( hexYield ?? 0, 3 )} <Icon icon={icons_list.hex} size={18} style={{marginLeft: 5}} />
                                </div>
                            </div>
                        </div>
                    </Row>
                </Tooltip>

                <Tooltip
                    content={dcaTooltip}
                    placement="right"
                    followCursor
                    fitViewport
                >
                    <Row>
                        <div
                            style={{
                                fontSize: 20,
                                textAlign: "center",
                                width: "100%"
                            }}
                        >
                            DCA Price
                        </div>

                        <div
                            style={{
                                marginTop: 1,
                                fontSize: dcaLoading ? 21 : 25,
                                lineHeight: 1
                            }}
                        >
                            {dcaDisplay}

                            {dcaLoading && dcaProgressText && (
                                <div
                                    style={{
                                        marginTop: 3,
                                        fontSize: 12,
                                        color: "#8f98a3",
                                        opacity: 1,
                                        lineHeight: 1.08,
                                        whiteSpace: "pre-line"
                                    }}
                                >
                                    {dcaProgressText}
                                </div>
                            )}
                        </div>
                    </Row>
                </Tooltip>

                <Tooltip
                    content={<div style={{ textAlign: "center" }}>
                        Estimated P&amp;L on historically priced HEX purchases at the {scenarioEnabled ? 'scenario' : 'current'} HEX price.<br/><br/>
                        Current value: $ {addCommasToNumber(dcaCurrentValue.toFixed(2))}<br/>
                        Cost basis: $ {addCommasToNumber(Number(effectiveDcaBasis ?? 0).toFixed(2))}
                        {usesReconstructedDca
                            ? <><br/><br/>Uses the amount-weighted basis carried into active HEX stakes, reconciled to the live active principal.</>
                            : hasDcaPrice
                                ? <><br/><br/>Fallback estimates active-stake basis using the wallet's reconstructed lifetime HEX average entry price.</>
                                : null}
                    </div>}
                    placement="right"
                >
                    <Row $scenario={scenarioEnabled}>
                        <div style={{ fontSize: 20, textAlign: "center", width: "100%" }}>P&amp;L</div>
                        <div style={{
                            marginTop: 6,
                            fontSize: fitPnlFontSize(hasEffectiveDcaPrice && Number.isFinite(dcaReturnPercent) ? formatSignedUsd(dcaProfit) : "$ N/A"),
                            whiteSpace: "nowrap",
                            maxWidth: "100%",
                            lineHeight: 1.05,
                            color: Number.isFinite(dcaReturnPercent) ? (dcaProfit >= 0 ? "#45e88d" : "#ff6868") : undefined
                        }}>
                            {hasEffectiveDcaPrice && Number.isFinite(dcaReturnPercent)
                                ? formatSignedUsd(dcaProfit)
                                : "$ N/A"}
                            {hasEffectiveDcaPrice && Number.isFinite(dcaReturnPercent) && (
                                <div style={{ marginTop: 5, fontSize: 15 }}>
                                    {dcaReturnPercent >= 0 ? "+" : ""}{dcaReturnPercent.toFixed(2)}%
                                </div>
                            )}
                        </div>
                    </Row>
                </Tooltip>
            </div>
        </div>
    </Wrapper>
}
