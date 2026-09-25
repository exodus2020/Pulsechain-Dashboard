// SingleTokenButton.jsx
import React, { memo } from "react";
import Button from "../Button";
import ImageContainer from "../ImageContainer";
import { useAtom } from "jotai";
import { tokenModalAtom } from "../../store";
import LoadingWave from "../LoadingWave";
import { addCommasToNumber, formatNumber, fUnit, fUnitSub } from "../../lib/numbers";
import { useAppContext } from "../../shared/AppContext";
import Tooltip from "../../shared/Tooltip";

const HEX_ADDRESS = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39'

const background = 'linear-gradient(to bottom, rgba(50, 50, 50, 0.3), rgba(50, 50, 50, 0.1))'

export default memo(SingleTokenButton)
function SingleTokenButton ({ balances, prices, getImage, pairId, priceArray, watchlistData, tokenPnl, hexDcaData = null, tokenPnlLoading = false, token = undefined, tokenAddress = undefined, scenarioEnabled = false, scenarioPriceUsd = null, scenarioAffected = false }) {
    const [ singleTokenModal, setSingleTokenModal ] = useAtom(tokenModalAtom)
    const tokenAddresses = token ? [token] :priceArray.filter(f => prices[f]?.pairId === pairId);
    const context = useAppContext()

    const addressKey = tokenAddress?.toLowerCase()

    if (addressKey && context?.data?.hiddenTokens?.[addressKey]) {
        return null
    }
    if (tokenAddresses.length === 0 && watchlistData?.id) {
        const isToken0Wpls = watchlistData?.token0?.id == '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
        const tokenToUse = isToken0Wpls ? watchlistData?.token1 : watchlistData?.token0

        const image = getImage((tokenToUse?.id ?? '')?.toLowerCase())

        return <Button
            key={`p-${pairId}-${tokenToUse?.id}`}
            style={{
                marginTop: 5,
                padding: '15px 25px',
                position: 'relative',
                background: background
            }}
            onClick={() => {
                setSingleTokenModal(watchlistData)
            }}
        >
            <div className="price-button" style={{ position: 'relative' }}>
                <div style={{ width: 35 }}/>
                <div style={{ position: 'absolute', left: -5 }}>
                    <ImageContainer source={image} size={35}/>
                </div>
                <div>
                    <div style={{ fontSize: 18 }}>{tokenToUse?.name}</div>
                    <div
                        style={{
                            fontSize: 14,
                            marginTop: 5,
                            fontWeight: 400,
                        }}
                        className="mute"
                    >
                        {tokenToUse?.symbol ? `${tokenToUse?.symbol} • Updating Price...` : 'Fetching data...'}
                    </div>
                </div>
            </div>
            <div
                style={{
                    textAlign: 'right',
                    width: 125,
                    position: 'absolute',
                    right: 0,
                }}
            >
                <LoadingWave speed={100} numDots={8}/>
            </div>
        </Button>
    }

    if (tokenAddresses.length === 0) {
        return null
    }

    const image = getImage(tokenAddress?.toLowerCase());
    const priceInfo = prices?.[tokenAddress];
    const isLoading = !priceInfo
    const liveBalanceUsdRaw = parseFloat(balances?.[tokenAddress.toLowerCase()]?.usd ?? 0)
    const balanceTokensRaw = parseFloat( balances?.[tokenAddress.toLowerCase()]?.normalized ?? 0 )
    const balanceTokens = balanceTokensRaw.toFixed(2)
    const livePriceUsd = Number(priceInfo?.priceUsd ?? 0)
    const effectivePriceUsd = scenarioAffected && Number.isFinite(Number(scenarioPriceUsd))
        ? Number(scenarioPriceUsd)
        : livePriceUsd
    const balanceUsdRaw = scenarioAffected
        ? balanceTokensRaw * effectivePriceUsd
        : liveBalanceUsdRaw
    const balanceUsd = addCommasToNumber( balanceUsdRaw.toFixed(2) )
    const displayPriceUsd = formatNumber(effectivePriceUsd, true, true)

    const averageEntry = Number(tokenPnl?.averageEntry)
    const reconstructedUnits = Number(tokenPnl?.units ?? 0)
    const reconstructedStakeUnits = Number(tokenPnl?.stakedUnits ?? 0)
    const reconstructedStakeBasis = Number(tokenPnl?.stakedCostBasisUsd ?? 0)
    const stakeAverageEntry = reconstructedStakeUnits > 0 && reconstructedStakeBasis > 0
        ? reconstructedStakeBasis / reconstructedStakeUnits
        : null

    // V36: distinguish exact coverage from a useful estimate. A 98%+ match uses
    // the reconstructed liquid ledger directly. If at least half of the current
    // position is reconstructed, its weighted average entry can be extrapolated
    // to the remainder as an explicitly estimated basis. This prevents a small
    // historical indexing gap from blanking otherwise useful HEX/PLSX P&L while
    // still refusing to extrapolate from a tiny fragment of an old PLS/WPLS bag.
    const reconstructionCoverage =
        balanceTokensRaw > 0 && reconstructedUnits > 0
            ? Math.min(reconstructedUnits / balanceTokensRaw, balanceTokensRaw / reconstructedUnits)
            : 0
    const exactCoverage = reconstructionCoverage >= 0.98
    const estimateCoverage = reconstructionCoverage >= 0.50

    // V43: HEX can have a large state-derived history gap even after a complete
    // explorer scan (fork-copied state / legacy stake bookkeeping). If the
    // wallet's reconstructed sample is substantial, fully priced, and the scan
    // itself is complete, use that wallet's own weighted historical entry as an
    // explicitly labelled estimate rather than leaving P&L permanently N/A.
    //
    // This does not invent a market price. It extrapolates the average basis
    // already reconstructed from the wallet's real priced HEX history.
    const isHex = String(tokenAddress ?? '').toLowerCase() === HEX_ADDRESS
    const hasSubstantialHexSample =
        isHex &&
        tokenPnl?.complete === true &&
        Number(tokenPnl?.unpricedAcquisitionCount ?? 0) === 0 &&
        reconstructedUnits >= 1_000_000 &&
        reconstructionCoverage >= 0.25 &&
        Number.isFinite(averageEntry) &&
        averageEntry > 0

    // For HEX specifically, an active-stake ledger gives us an independent,
    // amount-weighted entry estimate even if explorer indexing left the liquid
    // ledger short. Prefer it when available.
    const canUseHexStakeFallback =
        isHex &&
        Number.isFinite(stakeAverageEntry) && stakeAverageEntry > 0

    const hasNormalLiquidEntry =
        Number.isFinite(averageEntry) &&
        averageEntry > 0 &&
        (exactCoverage || estimateCoverage)

    const effectiveAverageEntry = hasNormalLiquidEntry
        ? averageEntry
        : canUseHexStakeFallback
            ? stakeAverageEntry
            : hasSubstantialHexSample
                ? averageEntry
                : null

    const usedStakeFallback =
        !hasNormalLiquidEntry &&
        canUseHexStakeFallback

    const usedLiquidLedgerFallback =
        !hasNormalLiquidEntry &&
        !canUseHexStakeFallback &&
        hasSubstantialHexSample

    const usedPartialEstimate =
        !exactCoverage &&
        Number.isFinite(effectiveAverageEntry) &&
        effectiveAverageEntry > 0

    const rawLedgerBasis = Number(tokenPnl?.costBasisUsd ?? NaN)
    const hexDcaPaidBasis = Number(hexDcaData?.stats?.totalUsdSpent ?? 0)
    const hexDcaPaidPurchases = Number(hexDcaData?.stats?.pricedPurchaseCount ?? hexDcaData?.stats?.purchaseCount ?? 0)

    // V2.4.2 surgical HEX P&L rule: the dedicated HEX purchase scanner is the
    // authority for known paid HEX spend. Current HEX that is not represented by
    // those paid purchases (for example fork-copied/state-derived HEX) adds no
    // *new* purchase cost here. This intentionally leaves the DCA scanner itself
    // untouched and prevents a tiny generic-ledger basis from creating absurd
    // near-infinite percentage gains.
    const hasHexDcaBasis =
        isHex &&
        Number.isFinite(balanceTokensRaw) && balanceTokensRaw > 0 &&
        Number.isFinite(hexDcaPaidBasis) && hexDcaPaidBasis > 0 &&
        hexDcaPaidPurchases > 0

    const pnlAverageEntry = hasHexDcaBasis
        ? hexDcaPaidBasis / balanceTokensRaw
        : effectiveAverageEntry

    const hasPositiveBasis =
        Number.isFinite(pnlAverageEntry) &&
        pnlAverageEntry > 0 &&
        Number.isFinite(balanceTokensRaw) &&
        balanceTokensRaw > 0

    // Retained only as a defensive state for HEX when no usable dedicated paid
    // basis exists. A valid HEX DCA paid basis always wins over the generic ledger.
    const hasHexBasisConflict =
        isHex && !hasHexDcaBasis &&
        Number.isFinite(balanceTokensRaw) && balanceTokensRaw > 0 &&
        (!Number.isFinite(rawLedgerBasis) || rawLedgerBasis <= 0) &&
        Number.isFinite(hexDcaPaidBasis) && hexDcaPaidBasis > 0 &&
        hexDcaPaidPurchases > 0

    const hasKnownZeroBasis =
        !isHex &&
        exactCoverage &&
        Number.isFinite(balanceTokensRaw) && balanceTokensRaw > 0 &&
        rawLedgerBasis === 0 &&
        Number(tokenPnl?.pricedAcquisitionCount ?? 0) > 0 &&
        Number(tokenPnl?.unpricedAcquisitionCount ?? 0) === 0
    const hasPnl = !hasHexBasisConflict && (hasPositiveBasis || hasKnownZeroBasis)

    // Combined-wallet P&L stays properly amount weighted: the hook sums each
    // visible wallet's basis and units first. When a partial estimate is needed,
    // that aggregate weighted entry is applied to the selected balance.
    const pnlCostBasis = hasHexDcaBasis
        ? hexDcaPaidBasis
        : hasPositiveBasis
            ? pnlAverageEntry * balanceTokensRaw
            : hasKnownZeroBasis ? 0 : null

    const pnlUsd = hasPnl ? balanceUsdRaw - pnlCostBasis : null
    const pnlPercent = hasPositiveBasis && pnlCostBasis > 0
        ? (pnlUsd / pnlCostBasis) * 100
        : null
    const pnlApproximate = hasPnl && (usedPartialEstimate || reconstructionCoverage < 0.995)

    const pnlColor =
        !Number.isFinite(pnlUsd)
            ? 'rgb(130,130,130)'
            : pnlUsd > 0
                ? 'rgb(125,220,155)'
                : pnlUsd < 0
                    ? 'rgb(255,130,130)'
                    : 'rgb(200,200,200)'

    const formatPnlUsd = value => {
        if (!Number.isFinite(value)) return '—'

        return `${value >= 0 ? '+' : '-'}$ ${addCommasToNumber(
            Math.abs(value).toFixed(2)
        )}`
    }

    const isPrvxMaxMultiplierEstimate = tokenPnl?.basisMethod === 'prvx-max-multiplier-estimate'

    const pnlTooltip = hasPnl ? (
        <div style={{ textAlign: 'center', minWidth: 190 }}>
            <strong>Estimated P&L</strong>
            <br/><br/>
            Avg Entry<br/>
            {hasKnownZeroBasis ? '$ 0.00 (zero-basis receipt)' : <>$ {formatNumber(pnlAverageEntry, true, true)}</>}
            <br/><br/>
            Cost Basis<br/>
            $ {addCommasToNumber(Number(pnlCostBasis ?? 0).toFixed(2))}
            <br/><br/>
            {scenarioAffected ? 'Scenario Value' : 'Current Value'}<br/>
            $ {addCommasToNumber(balanceUsdRaw.toFixed(2))}
            {scenarioAffected ? <>
                <br/><span style={{ color: 'rgb(240,205,130)', fontSize: 11 }}>at ${formatNumber(effectivePriceUsd, true, true)}</span>
            </> : null}
            <br/><br/>
            <span className="mute">
                {isPrvxMaxMultiplierEstimate
                    ? 'PRVX sacrifice-distribution cost basis uses a maximum-multiplier baseline of 8.36M PRVX per $700 sacrificed. Ordinary PRVX purchases use their reconstructed spend when available.'
                    : 'P&L values are estimates reconstructed from on-chain transaction history and historical market pricing.'}
                {hasHexDcaBasis && !isPrvxMaxMultiplierEstimate ? ' HEX P&L uses the priced spend found by the dedicated HEX purchase history. Current HEX not represented by a paid purchase adds no new purchase cost; the DCA calculation itself is unchanged.' : ''}{!hasHexDcaBasis && usedStakeFallback && !isPrvxMaxMultiplierEstimate ? ' Liquid HEX basis uses the amount-weighted active-stake entry as a fallback because the liquid explorer history is incomplete.' : ''}{!hasHexDcaBasis && usedPartialEstimate && !usedStakeFallback && !isPrvxMaxMultiplierEstimate ? ` Current-position coverage is ${(reconstructionCoverage * 100).toFixed(1)}%; the weighted reconstructed entry is extrapolated to the selected balance.` : ''}
            </span>
        </div>
    ) : (
        <div style={{ textAlign: 'center', maxWidth: 250 }}>
            {tokenPnlLoading
                ? 'Reconstructing on-chain cost basis'
                : hasHexBasisConflict
                    ? `HEX purchase history contains $${addCommasToNumber(hexDcaPaidBasis.toFixed(2))} of priced purchases, but the generic token ledger returned a zero/unknown liquid basis. P&L is hidden rather than reporting a misleading near-infinite gain.`
                : tokenPnl && balanceTokensRaw > 0 && reconstructionCoverage < 0.50 && !canUseHexStakeFallback
                    ? `Cost-basis coverage is only ${(reconstructionCoverage * 100).toFixed(1)}%. P&L remains unavailable rather than extrapolating from less than half of the position.`
                    : tokenPnl?.complete === false && reconstructionCoverage < 0.98
                        ? 'Some acquisition history could not be priced. P&L is hidden until the remaining basis can be reconstructed.'
                        : 'Not enough historical purchase data to calculate P&L'}
        </div>
    )

    if (isLoading) {
        return <Button
            key={`p-${pairId}-${tokenAddress}`}
            style={{
                marginTop: 5,
                padding: '15px 25px',
                position: 'relative',
            }}
            onClick={() => {
                setSingleTokenModal(priceInfo || watchlistData);
            }}
        >
            <div className="price-button">
                <ImageContainer source={image} size={35} />
                <div style={{
                        textAlign: 'right',
                        width: 125,
                        position: 'absolute',
                        right: 0,
                    }}>
                    <LoadingWave speed={100} numDots={8}/>
                </div>
            </div>
        </Button>
    }

    return (
        <React.Fragment key={pairId}>
            <Button
                key={`p-${pairId}-${tokenAddress}`}
                style={{
                    marginTop: 5,
                    padding: '15px 25px',
                    position: 'relative',
                    background: scenarioAffected
                        ? 'linear-gradient(to bottom, rgba(227, 184, 92, 0.12), rgba(227, 184, 92, 0.035))'
                        : background,
                    border: scenarioAffected ? '1px solid rgba(227, 184, 92, .65)' : undefined
                }}
                onClick={() => {
                    setSingleTokenModal(priceInfo);
                }}
            >
                <div className="price-button" >
                    <div style={{ width: 35 }}/>
                    <div style={{ position: 'absolute', left: 15 }}>
                        <ImageContainer source={image} size={35}/>
                    </div>
                    <div>
                        <div style={{ fontSize: 18, width: 260 }} className="price-name">{priceInfo.name}</div>
                        <div
                            style={{
                                fontSize: 14,
                                marginTop: 5,
                                fontWeight: 400,
                                width: 260,
                                overflow: 'hidden',
                            }}
                            className="mute"
                        >
                            {priceInfo.symbol} • $
                            <span style={{ letterSpacing: 1 }}>
                                {displayPriceUsd || '-'}
                            </span>
                            {scenarioAffected ? <span style={{ marginLeft: 7, color: 'rgb(240,205,130)', fontSize: 10, letterSpacing: .5 }}>SCENARIO</span> : null}
                        </div>
                    </div>
                    <div
                        style={{
                            textAlign: 'right',
                            width: 125,
                            position: 'absolute',
                            right: 155,
                        }}
                    >
                        <div
                            style={{
                                fontSize: (scenarioAffected ? balanceUsd : String(priceInfo.otherValue || balanceUsd)).length > 12 ? 16 : 18,
                                letterSpacing: 1,
                                display: 'flex',
                                justifyContent: 'flex-end',
                                alignItems: 'baseline',
                                gap: 4,
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <span style={{ color: 'rgb(200,200,200)', flex: '0 0 auto' }}>$</span>
                            <span style={{ fontFamily: "'Oswald', sans-serif", flex: '0 0 auto' }} className="price-balance">
                                {scenarioAffected ? balanceUsd : (priceInfo.otherValue || balanceUsd)}
                            </span>
                        </div>
                        <div
                            style={{
                                fontSize: 14,
                                marginTop: 5,
                                letterSpacing: 1,
                                fontWeight: 400
                            }}
                            className="mute"
                        >
                            {fUnit(parseFloat(priceInfo.otherValue || balanceTokens || 0), 2)}
                        </div>
                    </div>

                    <Tooltip
                        content={pnlTooltip}
                        placement="left"
                        customStyle={{
                            position: 'absolute',
                            right: 20,
                            top: 12,
                            width: 125,
                            textAlign: 'right'
                        }}
                    >
                        <div style={{ width: '100%', textAlign: 'right' }}>
                            {tokenPnlLoading && !hasPnl ? (
                                <div
                                    style={{
                                        height: 38,
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'flex-end',
                                        overflow: 'visible'
                                    }}
                                >
                                    <LoadingWave
                                        speed={120}
                                        numDots={6}
                                        scale={0.18}
                                        transformOrigin="right center"
                                    />
                                </div>
                            ) : (
                                <>
                                    <div
                                        style={{
                                            fontSize: (() => {
                                                const len = String(formatPnlUsd(pnlUsd) ?? '').length
                                                if (len >= 18) return 11
                                                if (len >= 16) return 12
                                                if (len >= 14) return 13
                                                if (len >= 12) return 15
                                                return 17
                                            })(),
                                            letterSpacing: 0.25,
                                            color: pnlColor,
                                            whiteSpace: 'nowrap',
                                            width: '100%',
                                            overflow: 'hidden',
                                            textOverflow: 'clip'
                                        }}
                                    >
                                        {formatPnlUsd(pnlUsd)}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            marginTop: 5,
                                            letterSpacing: 0.5,
                                            fontWeight: 400,
                                            color: pnlColor
                                        }}
                                    >
                                        {Number.isFinite(pnlPercent)
                                            ? `${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%`
                                            : hasKnownZeroBasis ? 'Zero basis' : 'Unavailable'}
                                    </div>
                                </>
                            )}
                        </div>
                    </Tooltip>
                </div>
            </Button>
        </React.Fragment>
    );
}