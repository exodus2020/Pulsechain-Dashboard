//stake component
import styled from "styled-components"
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
    width: 100%;
    height: 100%;
    min-height: 100px;
    box-sizing: border-box;
    text-align: center;
    box-shadow: 0 1px 4px rgba(255, 255, 255, 0.1);
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

export function StakeComponent({hexData, hexDcaData, hexTokenPnl, hexPrice, hiddenWallets, disabled, visibleWallets}) {

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

        if (!dcaLoading) {
            return ""
        }

        if (dcaProgress.stage === "history") {

            const network =
                dcaProgress.network === "ethereum"
                    ? "Ethereum"
                    : "PulseChain"

            const collected =
                Number(
                    dcaProgress.collected ?? 0
                )

            return current > 0
                ? `${network} • Page ${current}${
                    collected > 0
                        ? ` (${collected} tx)`
                        : ""
                }`
                : `Fetching ${network} history`
        }

        if (dcaProgress.stage === "transactions") {
            return total > 0
                ? `Checking transaction ${current} of ${total}`
                : "Finding HEX purchases"
        }

        if (dcaProgress.stage === "pricing") {
            return total > 0
                ? `Pricing purchase ${current} of ${total}`
                : "Retrieving historical prices"
        }

        return "Preparing DCA calculation"
    })()

    const dcaPrice =
        Number(hexDcaData?.stats?.averagePrice)

    const hasDcaPrice =
        Number.isFinite(dcaPrice) &&
        dcaPrice > 0

    // V33: if the direct HEX-purchase scanner cannot classify an old/large
    // wallet, prefer the cost basis that was actually carried into active HEX
    // stakes. Falling back to the LIQUID HEX average alone made large staking
    // wallets show absurdly tiny DCA prices and also poisoned the all-wallet
    // aggregate. The token P&L ledger now preserves stake-start basis separately.
    const reconstructedStakeUnits = Number(hexTokenPnl?.stakedUnits ?? 0)
    const reconstructedStakeBasis = Number(hexTokenPnl?.stakedCostBasisUsd ?? 0)
    const reconstructedStakeEntry =
        reconstructedStakeUnits > 0 && reconstructedStakeBasis > 0
            ? reconstructedStakeBasis / reconstructedStakeUnits
            : null
    const reconstructedHexEntry = Number(hexTokenPnl?.averageEntry)
    const fallbackHexEntry =
        Number.isFinite(reconstructedStakeEntry) && reconstructedStakeEntry > 0
            ? reconstructedStakeEntry
            : (Number.isFinite(reconstructedHexEntry) && reconstructedHexEntry > 0
                ? reconstructedHexEntry
                : null)
    const hasReconstructedHexEntry = Number.isFinite(fallbackHexEntry) && fallbackHexEntry > 0

    // V34: the miner cards must use one basis source consistently. The per-wallet
    // token ledger carries basis into active stakes and aggregates it by summing
    // cost basis + principal units, which gives the correct amount-weighted DCA.
    // Prefer that ledger whenever active stake basis is available; only fall back
    // to the legacy purchase scanner when no reconstructed stake basis exists.
    const usesReconstructedDca =
        reconstructedStakeUnits > 0 && reconstructedStakeBasis > 0 && hasReconstructedHexEntry
    const effectiveDcaPrice = usesReconstructedDca
        ? reconstructedStakeEntry
        : (hasDcaPrice ? dcaPrice : (hasReconstructedHexEntry ? fallbackHexEntry : null))
    const hasEffectiveDcaPrice = Number.isFinite(effectiveDcaPrice) && effectiveDcaPrice > 0

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

    const directDcaCurrentValue = dcaPricedHex * Number(hexUsd ?? 0)
    const directDcaBasis = Number(hexDcaData?.stats?.totalUsdSpent ?? 0)

    // For reconstructed stake basis, P&L is the active principal's current
    // value minus the cost basis carried into that principal. This keeps the
    // miner P&L card aligned with the currently selected wallet(s).
    const reconstructedStakeCurrentValue = reconstructedStakeUnits * Number(hexUsd ?? 0)
    const dcaCurrentValue = usesReconstructedDca && reconstructedStakeUnits > 0
        ? reconstructedStakeCurrentValue
        : directDcaCurrentValue
    const effectiveDcaBasis = usesReconstructedDca && reconstructedStakeBasis > 0
        ? reconstructedStakeBasis
        : directDcaBasis
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
    const dcaDisplay =
        dcaLoading
            ? "Loading"
            : hasEffectiveDcaPrice
                ? `$ ${effectiveDcaPrice.toFixed(6)}`
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
                <strong>{usesReconstructedDca ? "Estimated Average Entry" : "Average Entry"}</strong>
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

                <strong>HEX Purchased</strong>
                <br/>
                {addCommasToNumber(
                    (usesReconstructedDca && reconstructedStakeUnits > 0
                        ? reconstructedStakeUnits
                        : dcaTotalHex).toFixed(0)
                )}

                <br/><br/>

                {dcaPurchaseCount} purchase{
                    dcaPurchaseCount === 1 ? "" : "s"
                }
                <div
                    style={{
                        borderTop:
                            "1px solid rgba(255,255,255,0.2)",
                        margin: "16px 0 12px"
                    }}
                />

                <strong>Network Breakdown</strong>

                <div style={{ marginTop: 14 }}>
                    <strong>Ethereum</strong>

                    <br/>

                    Avg: {
                        formatNetworkAverage(
                            ethereumDcaStats
                        )
                    }

                    <br/>

                    Spent: $ {
                        formatNetworkSpent(
                            ethereumDcaStats
                        )
                    }

                    <br/>

                    {
                        formatNetworkHex(
                            ethereumDcaStats
                        )
                    } HEX

                    <br/>

                    {
                        formatNetworkPurchaseCount(
                            ethereumDcaStats
                        )
                    }
                </div>

                <div style={{ marginTop: 14 }}>
                    <strong>PulseChain</strong>

                    <br/>

                    Avg: {
                        formatNetworkAverage(
                            pulsechainDcaStats
                        )
                    }

                    <br/>

                    Spent: $ {
                        formatNetworkSpent(
                            pulsechainDcaStats
                        )
                    }

                    <br/>

                    {
                        formatNetworkHex(
                            pulsechainDcaStats
                        )
                    } HEX

                    <br/>

                    {
                        formatNetworkPurchaseCount(
                            pulsechainDcaStats
                        )
                    }
                </div>
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

                        <strong>Wallet Breakdown</strong>

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
                HEX Miners ({stats?.totalStakes ?? 0}) • <span style={{ letterSpacing: 1 }}> $ { addCommasToNumber(parseFloat( parseFloat(hexBalanceUsd ?? 0)).toFixed(2)) }</span>
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
                    <Row>
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
                    <Row>
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
                                marginTop: 6,
                                fontSize: dcaLoading ? 20 : 25
                            }}
                        >
                            {dcaDisplay}

                            {dcaLoading && dcaProgressText && (
                                <div
                                    style={{
                                        marginTop: 7,
                                        fontSize: 12,
                                        opacity: 0.7,
                                        lineHeight: 1.25
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
                        Estimated P&amp;L on historically priced HEX purchases at the current HEX price.<br/><br/>
                        Current value: $ {addCommasToNumber(dcaCurrentValue.toFixed(2))}<br/>
                        Cost basis: $ {addCommasToNumber(Number(effectiveDcaBasis ?? 0).toFixed(2))}
                        {usesReconstructedDca && <><br/><br/>Fallback uses basis carried into active HEX stakes when direct purchase history cannot be fully classified.</>}
                    </div>}
                    placement="right"
                >
                    <Row>
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