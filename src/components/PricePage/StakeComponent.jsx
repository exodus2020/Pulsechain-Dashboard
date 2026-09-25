//stake component
import styled from "styled-components"
import { useEffect, useState } from "react"
import { addCommasToNumber, fUnit } from "../../lib/numbers"
import ImageContainer from "../ImageContainer"
import imgHex from '../../icons/hex.png'
import Icon from "../Icon"
import { icons_list } from "../../config/icons"
import { parseHexStats } from "../../lib/hex"
import Tooltip from "../../shared/Tooltip"
import { shortenString } from "../../lib/string"
import Button from "../Button"

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

const HexPurchaseTimeline = ({ purchases = [], hiddenWallets = [], visibleWallets = {}, summary = {} }) => {
    const [hoveredBar, setHoveredBar] = useState(null)
    const hidden = new Set((hiddenWallets ?? []).map(address => String(address ?? "").toLowerCase()))
    const visible = new Set(Object.keys(visibleWallets ?? {}).map(address => String(address ?? "").toLowerCase()))
    const sourceRows = (purchases ?? [])
        .filter(p => {
            const wallet = String(p?.wallet ?? "").toLowerCase()
            return !hidden.has(wallet) && (visible.size === 0 || visible.has(wallet))
        })
        .map(p => {
            const raw = p?.timestamp
            const numeric = Number(raw)
            const ms = Number.isFinite(numeric) ? (numeric > 1e12 ? numeric : numeric * 1000) : new Date(raw).getTime()
            const amount = Number(p?.purchasedHex ?? p?.hexAmount ?? 0)
            const isEthereum = p?.network === "ethereum" || p?.networkKey === "ethereum"
            const isPulse = p?.network === "mainnet" || p?.network === "pulsechain" || p?.networkKey === "pulsechain" || p?.networkLabel === "PulseChain"
            return { ...p, ms, amount, chain: isEthereum ? "ethereum" : isPulse ? "pulsechain" : null }
        })
        .filter(p => p.chain && Number.isFinite(p.ms) && Number.isFinite(p.amount) && p.amount > 0)

    // One bar per chain/day. Multiple purchases on the same day are combined.
    const daily = new Map()
    sourceRows.forEach(p => {
        const d = new Date(p.ms)
        const dayMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
        const key = `${p.chain}:${dayMs}`
        const spent = Number(p?.usdSpent)
        const current = daily.get(key) ?? { chain: p.chain, ms: dayMs, amount: 0, usdSpent: 0, pricedHex: 0, count: 0 }
        current.amount += p.amount
        current.count += 1
        if (Number.isFinite(spent) && spent > 0) {
            current.usdSpent += spent
            current.pricedHex += p.amount
        }
        daily.set(key, current)
    })
    const rows = [...daily.values()].sort((a, b) => a.ms - b.ms)

    if (!rows.length) return <div style={{ padding: 24, textAlign: "center" }} className="mute">No cached HEX purchases available to graph.</div>

    const minPurchase = rows[0].ms
    const maxPurchase = rows[rows.length - 1].ms
    const day = 86400000
    const rawSpan = Math.max(day, maxPurchase - minPurchase)
    const pad = Math.max(14 * day, rawSpan * 0.035)
    const minTime = minPurchase - pad
    const maxTime = maxPurchase + pad
    const span = Math.max(day, maxTime - minTime)
    const width = 800
    const height = 585
    const left = 92
    const right = 18
    const plotWidth = width - left - right
    // One shared zero line: Ethereum grows upward, PulseChain grows downward.
    // Each side still has its own independent Y scale based on the visible wallets.
    const sharedBase = 270
    const maxBarHeight = 200
    const minBarHeight = 3
    const barWidth = Math.max(1.25, Math.min(2.1, plotWidth / Math.max(rows.length * 7.5, 1)))
    const ethAmounts = rows.filter(p => p.chain === "ethereum" && p.amount > 0).map(p => p.amount)
    const pulseAmounts = rows.filter(p => p.chain === "pulsechain" && p.amount > 0).map(p => p.amount)
    const ethMaxAmount = Math.max(...ethAmounts, 1)
    const pulseMaxAmount = Math.max(...pulseAmounts, 1)
    const ethMinAmount = Math.min(...ethAmounts, ethMaxAmount)
    const pulseMinAmount = Math.min(...pulseAmounts, pulseMaxAmount)
    const xFor = ms => left + ((ms - minTime) / span) * plotWidth
    // Ethereum and PulseChain use independent Y scales. Wallet visibility is already
    // applied above, so toggling wallets immediately recomputes both chain maxima.
    const barHeight = (amount, chain) => {
        const chainMax = chain === "ethereum" ? ethMaxAmount : pulseMaxAmount
        const chainMin = chain === "ethereum" ? ethMinAmount : pulseMinAmount
        const safeAmount = Math.max(Number(amount) || 0, 0)
        const safeMax = Math.max(Number(chainMax) || 0, 1)
        const safeMin = Math.max(Math.min(Number(chainMin) || 1, safeMax), Number.EPSILON)

        // True dynamic log scale across the currently visible purchases on each chain.
        // The smallest visible purchase gets a short bar, the largest gets full height,
        // and purchases between them spread across the available height logarithmically.
        // The separate transparent hover target below remains at least 14px tall.
        if (safeAmount <= 0) return minBarHeight
        if (safeMax <= safeMin) return maxBarHeight
        const normalized = Math.log(safeAmount / safeMin) / Math.log(safeMax / safeMin)
        return minBarHeight + Math.max(0, Math.min(1, normalized)) * (maxBarHeight - minBarHeight)
    }
    const tickCount = 6
    const ticks = Array.from({ length: tickCount }, (_, i) => minTime + (span * i) / (tickCount - 1))
    const dateLabel = ms => new Date(ms).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    const fullDate = ms => new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })

    return <div style={{ marginTop: 14, padding: "16px 14px 12px", borderRadius: 10, background: "rgba(0,0,0,.42)", boxShadow: "0 1px 4px rgba(255,255,255,.1)" }}>
        <div style={{ fontSize: 18, letterSpacing: .5, marginBottom: 4 }}>HEX Purchase History</div>
        <div className="mute" style={{ fontSize: 12, marginBottom: 8 }}>Shared timeline • one bar per purchase day • hover a bar for purchase details</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, margin: "10px 0 14px" }}>
            {[
                ["HEX Purchased", summary.totalHex != null ? addCommasToNumber(Number(summary.totalHex).toFixed(0)) : "—"],
                ["Total Spent", summary.totalSpent != null ? `$ ${addCommasToNumber(Number(summary.totalSpent).toFixed(2))}` : "—"],
                ["Purchases", summary.purchaseCount ?? sourceRows.length],
                ["Current HEX", summary.currentPrice != null ? `$ ${Number(summary.currentPrice).toFixed(6)}` : "—"]
            ].map(([label, value]) => <div key={label} style={{ padding: "8px 10px", border: "1px solid rgba(255,255,255,.08)", borderRadius: 7, textAlign: "center" }}>
                <div className="mute" style={{ fontSize: 11 }}>{label}</div>
                <div style={{ fontSize: 15, marginTop: 2 }}>{value}</div>
            </div>)}
        </div>
        <div style={{ position: "relative" }}>
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Ethereum and PulseChain HEX purchase history on a shared timeline">
                {ticks.map((tick, index) => {
                    const x = xFor(tick)
                    return <g key={tick}>
                        <line x1={x} x2={x} y1="28" y2="527" stroke="rgba(255,255,255,.07)" strokeWidth="1"/>
                        <text x={x} y="552" fill="rgb(145,145,145)" fontSize="11" textAnchor={index === 0 ? "start" : index === tickCount - 1 ? "end" : "middle"}>{dateLabel(tick)}</text>
                    </g>
                })}
                <text x="8" y="112" fill="#8fbfff" fontSize="14">Ethereum</text>
                <text x="8" y="438" fill="#c59cff" fontSize="14">PulseChain</text>
                <line x1={left} x2={width-right} y1={sharedBase} y2={sharedBase} stroke="rgba(255,255,255,.42)" strokeWidth="1"/>
                {rows.map((p, index) => {
                    const h = barHeight(p.amount, p.chain)
                    const fill = p.chain === "ethereum" ? "#8fbfff" : "#c59cff"
                    const x = xFor(p.ms)
                    const visibleY = p.chain === "ethereum" ? sharedBase - h : sharedBase
                    const hoverH = Math.max(h, 14)
                    const hoverY = p.chain === "ethereum" ? sharedBase - hoverH : sharedBase
                    return <g key={`${p.chain}-${p.ms}-${index}`}>
                        <rect x={x - barWidth/2} y={visibleY} width={barWidth} height={h} rx="1" fill={fill} opacity=".9"/>
                        <rect
                            x={x - 5} y={hoverY} width="10" height={hoverH}
                            fill="transparent" style={{ cursor: "pointer" }}
                            onMouseEnter={e => setHoveredBar({ p, clientX: e.clientX, clientY: e.clientY })}
                            onMouseMove={e => setHoveredBar({ p, clientX: e.clientX, clientY: e.clientY })}
                            onMouseLeave={() => setHoveredBar(null)}
                        />
                    </g>
                })}
                <text x={(left + width-right)/2} y="578" fill="rgb(175,175,175)" fontSize="12" textAnchor="middle">Time</text>
            </svg>
            {hoveredBar && (() => {
                const p = hoveredBar.p
                const avg = p.pricedHex > 0 && p.usdSpent > 0 ? p.usdSpent / p.pricedHex : null
                return <div style={{
                    position: "fixed", left: hoveredBar.clientX + 12, top: hoveredBar.clientY + 12,
                    zIndex: 99999, pointerEvents: "none", background: "rgba(24,24,24,.98)", color: "white",
                    border: "1px solid rgba(255,255,255,.18)", borderRadius: 7, padding: "9px 11px",
                    fontSize: 12, lineHeight: 1.55, boxShadow: "0 4px 18px rgba(0,0,0,.45)", whiteSpace: "nowrap"
                }}>
                    <div>{fullDate(p.ms)}</div>
                    <div>Total HEX Purchased: {addCommasToNumber(p.amount.toFixed(0))}</div>
                    <div>Dollar Amount Paid: {p.usdSpent > 0 ? `$ ${addCommasToNumber(p.usdSpent.toFixed(2))}` : "N/A"}</div>
                    <div>Avg/HEX: {avg ? `$ ${avg.toFixed(6)}` : "N/A"}</div>
                </div>
            })()}
        </div>
    </div>
}

export function StakeComponent({hexData, hexDcaData, hexTokenPnl, hexWalletPositions = {}, walletBalances = {}, hexPrice, hiddenWallets, disabled, visibleWallets, liquidHexUnits = 0, scenarioEnabled = false, minerDetailsOpen = false, onToggleMinerDetails}) {
    const [showDcaDetails, setShowDcaDetails] = useState(false)

    const formatTShares = (tShares) => Number(hexData?.stats?.totalTShares ?? 0) < 100 ? Number(tShares ?? 0).toFixed(3) : `${fUnit(Number(tShares ?? 0), 2)}`
    const formatLength = (length) => length < 364 ? `${length}d` : `${parseFloat(length / 365).toFixed(2)}y`

    const red = 'rgb(255,130,130)'
    const warning = 'rgb(205,205,130)'

    const walletsToShow = Object.keys(visibleWallets ?? {}).map(key => key.toLowerCase())

    const stakes = hexData?.combinedStakes?.filter(stake => walletsToShow.includes(stake?.parent.toLowerCase() ?? ''))
    // Keep the HEX Miners summary visible even with zero tracked wallets/stakes.
    // The empty state is a useful baseline UI and should show zero values rather
    // than removing the entire section.
    const stats = (hiddenWallets?.length ?? 0) > 0 ? (parseHexStats(stakes) ?? {}) : (hexData?.stats ?? {})
    
    const nextStakeAddress = stats?.nextStakeAddress ? shortenString(stats?.nextStakeAddress) : ''
    const nextStakeType = stats?.nextStakeType ? stats?.nextStakeType : ''

    const totalStakes = stats?.totalStakes ?? 0
    const activeStakes = stats?.totalActiveStakes ?? 0
    
    const hexUsd = hexPrice?.priceUsd

    const effectivePenalty = stats?.totalEffectivePenalty ?? 0
    const penaltyHexUsd = effectivePenalty * hexUsd

    const hexYield = stats?.totalHexYield ?? 0
    const hexYieldUsd = hexYield * hexUsd

    const stakedHex = stats?.totalStakedHex ?? 0
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
    // Keep the persisted DCA visible while the incremental checker looks only
    // for purchases after the saved checkpoints. "Scanning" is reserved for a
    // true cold start where no cached DCA exists yet.
    const dcaDisplay =
        dcaLoading && dcaProgress?.showPhases
            ? dcaLoadingLabel
            : hasDcaPrice
                ? `$ ${dcaPrice.toFixed(6)}`
                : dcaLoading
                    ? dcaLoadingLabel
                    : "$ N/A"

    const visibleAddressSet = new Set(Object.keys(visibleWallets ?? {}).map(a => String(a).toLowerCase()))
    const hiddenAddressSet = new Set((hiddenWallets ?? []).map(a => String(a).toLowerCase()))
    const visibleDcaPurchases = (hexDcaData?.purchases ?? []).filter(p => {
        const wallet = String(p?.wallet ?? "").toLowerCase()
        return !hiddenAddressSet.has(wallet) && (visibleAddressSet.size === 0 || visibleAddressSet.has(wallet))
    })
    const chainHex = visibleDcaPurchases.reduce((acc, p) => {
        const amount = Number(p?.purchasedHex ?? p?.hexAmount ?? 0)
        if (!Number.isFinite(amount) || amount <= 0) return acc
        const isEth = p?.network === "ethereum" || p?.networkKey === "ethereum"
        if (isEth) acc.ethereum += amount
        else acc.pulsechain += amount
        return acc
    }, { ethereum: 0, pulsechain: 0 })

    const visibleChainStats = visibleDcaPurchases.reduce((acc, p) => {
        const amount = Number(p?.purchasedHex ?? p?.hexAmount ?? 0)
        const spent = Number(p?.usdSpent ?? 0)
        if (!Number.isFinite(amount) || amount <= 0) return acc
        const isEth = p?.network === "ethereum" || p?.networkKey === "ethereum"
        const key = isEth ? "ethereum" : "pulsechain"
        acc[key].hex += amount
        acc[key].count += 1
        if (Number.isFinite(spent) && spent > 0) {
            acc[key].spent += spent
            acc[key].pricedHex += amount
        }
        return acc
    }, { ethereum: { hex: 0, spent: 0, pricedHex: 0, count: 0 }, pulsechain: { hex: 0, spent: 0, pricedHex: 0, count: 0 } })
    const chainAvg = s => s.pricedHex > 0 ? s.spent / s.pricedHex : null
    const chainBreakdown = (label, stats, color) => <div style={{ marginTop: 12, color }}>
        <strong>{label}</strong><br/>
        Avg: {chainAvg(stats) ? `$ ${chainAvg(stats).toFixed(6)}` : "$ N/A"}<br/>
        Spent: $ {addCommasToNumber(stats.spent.toFixed(2))}<br/>
        {addCommasToNumber(stats.hex.toFixed(0))} HEX<br/>
        {stats.count} purchase{stats.count === 1 ? "" : "s"}
    </div>

    const dcaTooltip = dcaLoading
        ? <div style={{ textAlign: "center" }}>
            Checking for new HEX purchases since the saved scan checkpoint
            {dcaProgress?.diagnostic ? <><br/><span style={{ opacity: .75, fontSize: 11 }}>{dcaProgress.diagnostic}</span></> : null}
          </div>
        : hasDcaPrice
            ? <div style={{ textAlign: "center" }}>
                <strong>Lifetime HEX DCA</strong><br/>
                $ {Number(dcaPrice ?? 0).toFixed(6)}
                {chainBreakdown("Ethereum", visibleChainStats.ethereum, "#8fbfff")}
                {chainBreakdown("PulseChain", visibleChainStats.pulsechain, "#c59cff")}
                <br/>Open <strong>Details</strong> for the purchase timeline.
              </div>
            : <div style={{ textAlign: "center" }}>HEX DCA unavailable</div>
    
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
                                fontSize: dcaLoading && dcaProgress?.showPhases ? 21 : 25,
                                lineHeight: 1
                            }}
                        >
                            {dcaDisplay}

                            {dcaLoading && dcaProgress?.showPhases && dcaProgressText && (
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
            <div className="hex-detail-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8, marginTop: 0, alignItems: 'start' }}>
                <div style={{ gridColumn: '1 / 2', justifySelf: 'start' }}>
                    <Button
                        text="Details"
                        textAlign="center"
                        onClick={onToggleMinerDetails}
                        disabled={disabled || typeof onToggleMinerDetails !== 'function'}
                        parentStyle={{ width: 75, height: 30 }}
                        style={{ padding: "4px 8px", fontSize: 12 }}
                    />
                </div>
                <div style={{ gridColumn: '5 / 6', justifySelf: 'start' }}>
                    <Button
                        text="Details"
                        textAlign="center"
                        onClick={() => setShowDcaDetails(value => !value)}
                        disabled={!(hexDcaData?.purchases?.length > 0)}
                        parentStyle={{ width: 66, height: 30 }}
                        style={{ padding: "4px 8px", fontSize: 11 }}
                    />
                </div>
            </div>
            {showDcaDetails && (
                <HexPurchaseTimeline
                    purchases={hexDcaData?.purchases ?? []}
                    hiddenWallets={hiddenWallets}
                    visibleWallets={visibleWallets}
                    summary={{ totalHex: dcaTotalHex, totalSpent: directDcaBasis, purchaseCount: dcaPurchaseCount, currentPrice: hexUsd }}
                />
            )}
        </div>
    </Wrapper>
}
