import React, { memo, useMemo, useState } from 'react'
import styled from 'styled-components'
import { addCommasToNumber, formatNumber } from '../../lib/numbers'

const Panel = styled.div`
    margin-top: 12px;
    padding: 14px 16px 16px;
    border: 1px solid rgba(227, 184, 92, 0.55);
    background: linear-gradient(to bottom, rgba(227, 184, 92, 0.10), rgba(227, 184, 92, 0.035));
    border-radius: 4px;

    .scenario-top-row {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 18px;
        flex-wrap: wrap;
    }

    .scenario-title {
        font-size: 16px;
        font-weight: 650;
        letter-spacing: .5px;
    }

    .scenario-note {
        margin-top: 4px;
        color: rgb(165,165,165);
        font-family: sans-serif;
        font-size: 11px;
        line-height: 1.4;
    }

    .scenario-multiplier {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
    }

    .scenario-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 8px;
        margin-top: 14px;
    }

    .scenario-token {
        padding: 8px;
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(0,0,0,.22);
        border-radius: 4px;
    }

    .scenario-token-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        margin-bottom: 6px;
        font-size: 12px;
    }

    .scenario-live {
        color: rgb(140,140,140);
        font-size: 10px;
        white-space: nowrap;
    }

    input {
        box-sizing: border-box;
        width: 100%;
        height: 30px;
        padding: 5px 8px;
        color: white;
        background: rgb(19,19,19);
        border: 1px solid rgb(75,75,75);
        border-radius: 3px;
        outline: none;
        font-family: 'Oswald', sans-serif;
        letter-spacing: .5px;
    }

    input:focus {
        border-color: rgba(227, 184, 92, .85);
    }

    .scenario-presets {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-wrap: wrap;
    }

    .scenario-preset-button {
        height: 30px;
        min-width: 38px;
        padding: 0 8px;
        color: rgb(215,215,215);
        background: rgba(255,255,255,.04);
        border: 1px solid rgb(70,70,70);
        border-radius: 3px;
        cursor: pointer;
        font-family: 'Oswald', sans-serif;
    }

    .scenario-preset-button:hover, .scenario-preset-button.active {
        color: rgb(240,205,130);
        border-color: rgba(227,184,92,.85);
        background: rgba(227,184,92,.10);
    }

    .scenario-actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .scenario-saved-row {
        display: grid;
        grid-template-columns: minmax(160px, 1.2fr) auto minmax(180px, 1fr) auto auto;
        gap: 7px;
        align-items: center;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(227,184,92,.20);
    }

    .scenario-saved-row select {
        height: 30px;
        min-width: 0;
        padding: 4px 8px;
        color: white;
        background: rgb(19,19,19);
        border: 1px solid rgb(75,75,75);
        border-radius: 3px;
        outline: none;
        font-family: 'Oswald', sans-serif;
    }

    .scenario-saved-row select:focus {
        border-color: rgba(227,184,92,.85);
    }

    .scenario-save-status {
        margin-top: 6px;
        min-height: 14px;
        color: rgb(240,205,130);
        font-family: sans-serif;
        font-size: 10px;
    }

    .scenario-small-button {
        height: 30px;
        padding: 0 10px;
        color: rgb(215,215,215);
        background: rgba(255,255,255,.05);
        border: 1px solid rgb(75,75,75);
        border-radius: 3px;
        cursor: pointer;
        white-space: nowrap;
    }

    .scenario-small-button:hover {
        border-color: rgba(227, 184, 92, .75);
    }

    @media (max-width: 825px) {
        .scenario-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .scenario-saved-row {
            grid-template-columns: 1fr auto;
        }
        .scenario-saved-row select {
            grid-column: 1 / 2;
        }
    }
`

const CORE = [
    { symbol: 'PLS', address: '0xa1077a294dde1b09bb078844df40758a5d0f9a27' },
    { symbol: 'PLSX', address: '0x95b303987a60c71504d99aa1b13b4da07b0790ab' },
    { symbol: 'INC', address: '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d' },
    { symbol: 'HEX', address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39' },
    { symbol: 'PRVX', address: '0xf6f8db0aba00007681f8faf16a0fda1c9b030b11' }
]

export { CORE as SCENARIO_CORE_TOKENS }

export default memo(function ScenarioPanel ({ multiplier, setMultiplier, manualPrices, setManualPrices, prices, onReset, savedScenarios = [], onSaveScenario, onLoadScenario, onDeleteScenario }) {
    const [scenarioName, setScenarioName] = useState('')
    const [selectedScenario, setSelectedScenario] = useState('')
    const [saveStatus, setSaveStatus] = useState('')

    const detachProtectedPreset = () => {
        const selected = (savedScenarios ?? []).find(item => item?.name === selectedScenario)
        if (!selected?.locked) return

        // Built-in presets are templates, not a read-only editing mode. As soon as
        // the user changes a target/multiplier, detach the working copy from the
        // protected preset so ATH itself stays immutable while the values remain
        // fully editable and can be saved under a new name.
        setSelectedScenario('')
        setScenarioName('')
        setSaveStatus('ATH values are now an editable working copy. Name it to save a new scenario.')
    }

    const updatePrice = (address, value) => {
        detachProtectedPreset()
        setManualPrices(prev => ({ ...prev, [address]: value }))
    }

    const savedNames = useMemo(() => (savedScenarios ?? []).map(item => item?.name).filter(Boolean), [savedScenarios])
    const selectedScenarioData = useMemo(() => (savedScenarios ?? []).find(item => item?.name === selectedScenario), [savedScenarios, selectedScenario])
    const selectedScenarioLocked = Boolean(selectedScenarioData?.locked)

    const currentTargetPrices = () => CORE.reduce((targets, { address }) => {
        const manualValue = manualPrices?.[address]
        const manualNumber = Number(manualValue)
        if (String(manualValue ?? '').trim() !== '' && Number.isFinite(manualNumber) && manualNumber >= 0) {
            targets[address] = String(manualNumber)
            return targets
        }

        const livePrice = Number(prices?.[address]?.priceUsd ?? 0)
        const multiplierNumber = Number(multiplier)
        if (livePrice > 0 && String(multiplier ?? '').trim() !== '' && Number.isFinite(multiplierNumber) && multiplierNumber >= 0) {
            targets[address] = String(livePrice * multiplierNumber)
        } else if (livePrice > 0) {
            targets[address] = String(livePrice)
        }
        return targets
    }, {})

    const handleSave = () => {
        const name = scenarioName.trim()
        if (!name) {
            setSaveStatus('Enter a scenario name first.')
            return
        }
        if (name.toLowerCase() === 'ath') {
            setSaveStatus('“ATH” is a built-in preset and cannot be overwritten.')
            return
        }
        const existed = savedNames.some(saved => saved.toLowerCase() === name.toLowerCase())
        const ok = onSaveScenario?.(name, currentTargetPrices(), multiplier)
        if (ok !== false) {
            setSelectedScenario(name)
            setScenarioName(name)
            setSaveStatus(existed ? `Updated “${name}”.` : `Saved “${name}”.`)
        }
    }

    const handleLoad = () => {
        if (!selectedScenario) return
        const loading = (savedScenarios ?? []).find(item => item?.name === selectedScenario)
        if (onLoadScenario?.(selectedScenario) !== false) {
            // Protected built-ins load as editable templates. Do not place their
            // reserved name in the Save field, otherwise it feels like the entire
            // scenario is locked. User scenarios still load with their name so
            // Save / Update continues to update them normally.
            setScenarioName(loading?.locked ? '' : selectedScenario)
            setSaveStatus(loading?.locked
                ? `Loaded “${selectedScenario}”. Values are editable; enter a new name to save a copy.`
                : `Loaded “${selectedScenario}”.`)
        }
    }

    const handleDelete = () => {
        if (!selectedScenario || selectedScenarioLocked) return
        const name = selectedScenario
        if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm(`Delete saved scenario “${name}”?`)) return
        onDeleteScenario?.(name)
        setSelectedScenario('')
        if (scenarioName === name) setScenarioName('')
        setSaveStatus(`Deleted “${name}”.`)
    }


    const buildTargetPrices = (multiplierValue) => {
        const multiplierNumber = Number(multiplierValue)
        if (!Number.isFinite(multiplierNumber) || multiplierNumber < 0) return {}

        return CORE.reduce((targets, { address }) => {
            const livePrice = Number(prices?.[address]?.priceUsd ?? 0)
            if (Number.isFinite(livePrice) && livePrice > 0) {
                targets[address] = String(livePrice * multiplierNumber)
            }
            return targets
        }, {})
    }

    const applyMultiplier = (value) => {
        detachProtectedPreset()
        const nextValue = String(value)
        const multiplierNumber = Number(nextValue)
        const validMultiplier = nextValue.trim() !== '' && Number.isFinite(multiplierNumber) && multiplierNumber >= 0

        // Store the calculated target prices explicitly. This makes a preset/custom
        // multiplier one coherent scenario update instead of briefly rendering with
        // the previous multiplier after manual overrides are cleared. It also keeps
        // every displayed target box identical to the price used by the calculator.
        setManualPrices(validMultiplier ? buildTargetPrices(nextValue) : {})
        setMultiplier(nextValue)
    }

    const applyPreset = (preset) => {
        applyMultiplier(preset)
    }

    return (
        <Panel>
            <div className="scenario-top-row">
                <div>
                    <div className="scenario-title">Scenario Mode</div>
                    <div className="scenario-note">
                        Multiplier presets populate editable target prices from the current live core-token prices.<br/>
                        Token quantities and protocol reward rates are not changed.
                    </div>
                </div>
                <div className="scenario-actions">
                    <div className="scenario-presets" aria-label="Scenario multiplier presets">
                        {[2, 5, 10, 25, 100].map(preset => (
                            <button
                                key={preset}
                                className={`scenario-preset-button ${String(multiplier) === String(preset) ? 'active' : ''}`}
                                onClick={() => applyPreset(preset)}
                                title={`Set all core tokens to ${preset}x live price`}
                            >
                                {preset}x
                            </button>
                        ))}
                    </div>
                    <div className="scenario-multiplier">
                        <span>Global</span>
                        <div style={{ position: 'relative', width: 92 }}>
                            <input
                                value={multiplier}
                                onChange={e => applyMultiplier(e.target.value)}
                                inputMode="decimal"
                                placeholder="e.g. 10"
                                aria-label="Scenario multiplier"
                                style={{ paddingRight: 24 }}
                            />
                            <span style={{ position: 'absolute', right: 8, top: 6, color: 'rgb(150,150,150)' }}>x</span>
                        </div>
                    </div>
                    <button className="scenario-small-button" onClick={() => { detachProtectedPreset(); onReset?.() }}>Reset</button>
                </div>
            </div>

            <div className="scenario-saved-row">
                <input
                    value={scenarioName}
                    onChange={e => { setScenarioName(e.target.value); setSaveStatus('') }}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                    placeholder="Scenario name (e.g. Bull Case)"
                    aria-label="Scenario name"
                />
                <button className="scenario-small-button" onClick={handleSave} title="Save the current target prices locally">Save / Update</button>
                <select
                    value={selectedScenario}
                    onChange={e => { setSelectedScenario(e.target.value); setSaveStatus('') }}
                    aria-label="Saved scenarios"
                >
                    <option value="">{savedNames.length ? 'Saved scenarios…' : 'No saved scenarios yet'}</option>
                    {(savedScenarios ?? []).filter(item => item?.name).map(item => <option key={item.name} value={item.name}>{item.name}{item.locked ? ' 🔒' : ''}</option>)}
                </select>
                <button className="scenario-small-button" onClick={handleLoad} disabled={!selectedScenario}>Load</button>
                <button className="scenario-small-button" onClick={handleDelete} disabled={!selectedScenario || selectedScenarioLocked} title={selectedScenarioLocked ? 'Built-in presets cannot be deleted' : 'Delete selected scenario'}>Delete</button>
            </div>
            <div className="scenario-save-status">{saveStatus}</div>

            <div className="scenario-grid">
                {CORE.map(({ symbol, address }) => {
                    const livePrice = Number(prices?.[address]?.priceUsd ?? 0)
                    const manualValue = manualPrices?.[address]
                    const hasManualValue = String(manualValue ?? '').trim() !== ''
                    const multiplierNumber = Number(multiplier)
                    const hasMultiplier = String(multiplier ?? '').trim() !== '' && Number.isFinite(multiplierNumber) && multiplierNumber >= 0
                    const calculatedValue = hasMultiplier && livePrice > 0
                        ? String(livePrice * multiplierNumber)
                        : ''
                    const value = hasManualValue ? manualValue : calculatedValue
                    return (
                        <div className="scenario-token" key={address}>
                            <div className="scenario-token-title">
                                <strong>{symbol}</strong>
                                <span className="scenario-live">
                                    live ${livePrice > 0 ? formatNumber(livePrice, true, true) : '—'}
                                </span>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: 8, top: 6, color: 'rgb(145,145,145)', fontSize: 12 }}>$</span>
                                <input
                                    value={value}
                                    onChange={e => updatePrice(address, e.target.value)}
                                    inputMode="decimal"
                                    placeholder={livePrice > 0 ? addCommasToNumber(livePrice.toString()) : 'Target price'}
                                    aria-label={`${symbol} scenario target price`}
                                    style={{ paddingLeft: 20 }}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>
        </Panel>
    )
})
