# 🚀 PulseChain Dashboard

Privacy-first PulseChain portfolio tracker with real-time pricing,
historical cost basis, P&L analytics, HEX staking, liquidity tracking,
and multi-wallet support.

> Built for privacy. Runs locally. No tracking. No middlemen.

## 🚀 v2.4.0 --- Scenario Mode & Saved Price Presets

Version 2.4.0 introduces **Scenario Mode**, a forward-looking portfolio
simulator for exploring hypothetical PulseChain token prices without
changing wallet balances, token quantities, or protocol reward rates.

### 🔮 Scenario Mode

-   Added a dedicated Scenario Mode for modeling hypothetical portfolio
    values.
-   Set individual target prices for **PLS, PLSX, HEX, INC, and PRVX**.
-   Added quick **2x, 5x, 10x, 25x, and 100x** multiplier presets based
    on current live core-token prices.
-   Added a Global multiplier field for custom portfolio-wide price
    scenarios.
-   Scenario values propagate through portfolio totals, Token Watchlist
    values, HEX Miner analytics, liquidity positions, and farm reward
    USD estimates.
-   Live market prices remain visible for reference while Scenario Mode
    is active.

### 💾 Saved Scenarios & ATH Preset

-   Added named scenario presets that can be saved, loaded, updated, and
    deleted.
-   Added a built-in **ATH 🔒** preset using recorded PulseChain
    all-time-high prices for the core tokens.
-   The ATH preset is protected from deletion so it is always available
    after updating or installing the dashboard.
-   ATH values remain editable while loaded, allowing them to be used as
    a starting point for custom scenarios.
-   Editing ATH does not overwrite the protected preset; enter a new
    scenario name to save the modified values as a separate preset.

### ⛏️ HEX Miner Scenario Analytics

-   HEX Miner principal, mined value, and estimated P&L respond to the
    selected scenario HEX price.
-   Stake quantities, T-Shares, average length, and reconstructed DCA
    remain unchanged.
-   Scenario styling clearly distinguishes projected values from live
    portfolio data.

### 💧 Liquidity & Farm Scenarios

-   Liquidity-pool values update using scenario token prices while
    underlying LP quantities remain unchanged.
-   Farm reward USD estimates respond to the scenario INC price.
-   INC/day token emission rates remain unchanged, keeping projected
    reward values separate from protocol reward assumptions.

### 🎨 UI & Reliability

-   Added gold Scenario styling and labels throughout affected portfolio
    sections.
-   Scenario calculations are derived from the selected target prices
    rather than repeatedly multiplying previously projected values.
-   Switching between multipliers, saved scenarios, custom values, and
    Reset now returns consistent portfolio totals.
-   Reset restores current live core-token prices.

### 📸 Scenario Mode

```{=html}
<table>
```
```{=html}
<tr>
```
```{=html}
<td align="center">
```
`<strong>`{=html}Scenario Portfolio Overview`</strong>`{=html}
```{=html}
</td>
```
```{=html}
<td align="center">
```
`<strong>`{=html}Custom Scenarios & ATH Preset`</strong>`{=html}
```{=html}
</td>
```
```{=html}
</tr>
```
```{=html}
<tr>
```
```{=html}
<td align="center">
```
`<img src="public/Screenshots/2.4.0/Scenario%20Mode%20Overview.png" width="500" alt="PulseChain Dashboard Scenario Mode Overview">`{=html}
```{=html}
</td>
```
```{=html}
<td align="center">
```
`<img src="public/Screenshots/2.4.0/Custom%20Scenarios.png" width="500" alt="PulseChain Dashboard Custom Scenarios and ATH Preset">`{=html}
```{=html}
</td>
```
```{=html}
</tr>
```
```{=html}
<tr>
```
```{=html}
<td align="center">
```
Model hypothetical token prices and see the projected portfolio, HEX
Miner, and token values update together.
```{=html}
</td>
```
```{=html}
<td align="center">
```
Load the protected ATH preset, edit its prices, or save completely
custom target-price scenarios.
```{=html}
</td>
```
```{=html}
</tr>
```
```{=html}
</table>
```
```{=html}
<p align="center">
```
`<strong>`{=html}Scenario Liquidity & Farm
Rewards`</strong>`{=html}`<br>`{=html}`<br>`{=html}
`<img src="public/Screenshots/2.4.0/Scenario%20Farm%20Rewards.png" width="750" alt="PulseChain Dashboard Scenario Liquidity Pools and Farm Rewards">`{=html}`<br>`{=html}
Project liquidity values and farm reward USD estimates while keeping
protocol token reward rates unchanged.
```{=html}
</p>
```

------------------------------------------------------------------------

## 📸 Screenshots

PulseChain Dashboard provides an all-in-one desktop interface for
tracking portfolios, token P&L and cost basis, HEX staking, liquidity
positions, farming rewards, and multi-wallet analytics.

`<br>`{=html}

```{=html}
<table>
```
```{=html}
<tr>
```
```{=html}
<td align="center">
```
`<strong>`{=html}Portfolio Overview & Token P&L`</strong>`{=html}
```{=html}
</td>
```
```{=html}
<td align="center">
```
`<strong>`{=html}Token Cost Basis & P&L`</strong>`{=html}
```{=html}
</td>
```
```{=html}
</tr>
```
```{=html}
<tr>
```
```{=html}
<td align="center">
```
`<img src="public/Screenshots/2.3.0/Dashboard%20Overview.png" width="500" alt="PulseChain Dashboard Portfolio Overview and Token P&L">`{=html}
```{=html}
</td>
```
```{=html}
<td align="center">
```
`<img src="public/Screenshots/2.3.0/Token%20P%26L%20Cost-Basis%20Tooltip.png" width="500" alt="Token P&L Cost Basis Details">`{=html}
```{=html}
</td>
```
```{=html}
</tr>
```
```{=html}
<tr>
```
```{=html}
<td align="center">
```
Track your complete PulseChain portfolio with real-time balances, token
prices, estimated cost basis, and profit/loss.
```{=html}
</td>
```
```{=html}
<td align="center">
```
View reconstructed average entry, cost basis, current value, and
estimated P&L using historical on-chain activity and market pricing.
```{=html}
</td>
```
```{=html}
</tr>
```
```{=html}
<tr>
```
```{=html}
<td height="25">
```
```{=html}
</td>
```
```{=html}
<td>
```
```{=html}
</td>
```
```{=html}
</tr>
```
```{=html}
<tr>
```
```{=html}
<td align="center">
```
`<strong>`{=html}HEX Miner Analytics`</strong>`{=html}
```{=html}
</td>
```
```{=html}
<td align="center">
```
`<strong>`{=html}Multiple Wallet Tracking`</strong>`{=html}
```{=html}
</td>
```
```{=html}
</tr>
```
```{=html}
<tr>
```
```{=html}
<td align="center">
```
`<img src="public/Screenshots/2.3.0/HEX%20Miners%20Dashboard.png" width="500" alt="HEX Miner Analytics Dashboard">`{=html}
```{=html}
</td>
```
```{=html}
<td align="center">
```
`<img src="public/Screenshots/2.3.0/Multiple%20Wallet%20Tracking.png" width="500" alt="Multiple Wallet Tracking">`{=html}
```{=html}
</td>
```
```{=html}
</tr>
```
```{=html}
<tr>
```
```{=html}
<td align="center">
```
Monitor active HEX stakes with principal, mined HEX, T-Shares, staking
ladder, weighted DCA price, and estimated P&L.
```{=html}
</td>
```
```{=html}
<td align="center">
```
Track multiple wallets simultaneously with individual holdings, stakes,
farms, liquidity positions, and combined portfolio analytics.
```{=html}
</td>
```
```{=html}
</tr>
```
```{=html}
</table>
```

------------------------------------------------------------------------

## v2.3.0 --- Portfolio P&L & Cost Basis

Version 2.3.0 introduces historical cost-basis tracking and portfolio
profit/loss calculations to the PulseChain Dashboard.

### 📊 Token P&L Tracking

-   Added estimated Profit & Loss (P&L) for tokens in the Token
    Watchlist.
-   Displays both USD profit/loss and percentage return.
-   Reconstructs historical cost basis using wallet transaction history
    and historical PulseChain pricing.
-   Calculates average entry price using amount-weighted cost basis.
-   Supports combined P&L across multiple visible wallets.

### 👛 Multi-Wallet Accounting

-   P&L is calculated independently for each wallet and aggregated when
    multiple wallets are visible.
-   Wallet-to-wallet transfers preserve the original token cost basis.
-   Hiding or showing wallets instantly recalculates portfolio totals
    using cached wallet data.
-   Improved handling of external token transfers and incomplete
    transaction histories.

### ⚡ Faster P&L Loading & Persistent Caching

-   Added persistent per-wallet/token P&L caching.
-   Previously calculated wallet histories can be restored after
    restarting the application.
-   Historical calculations are reused when changing visible wallets.
-   Token calculations run concurrently to improve initial loading speed
    while limiting RPC/API pressure.
-   Added a visible P&L calculation progress bar to the Token Watchlist.

### ⛏️ HEX Miner Cost Basis

-   Improved HEX Miner DCA and P&L calculations.
-   HEX cost basis is preserved when HEX enters an active stake.
-   Stake principal retains its original investment basis.
-   Yield generated from completed stakes is treated separately from
    invested principal.
-   Miner DCA now uses reconstructed active-stake cost basis when
    available.

### 💎 PLS / WPLS Accounting

-   Improved historical accounting for native PLS and Wrapped PLS.
-   Native PLS and WPLS holdings are reconciled with the dashboard's
    combined Pulse balance.
-   Added fallback historical pricing for older Pulse positions where
    complete explorer history is unavailable.
-   P&L estimates remain available when historical transaction coverage
    is incomplete.

### 🔷 PRVX Cost Basis

-   Added cost-basis handling for PRVX sacrifice distributions.
-   Sacrifice distributions use the maximum sacrifice multiplier when
    reconstructing estimated investment basis.
-   Normal PRVX purchases continue to use their actual reconstructed
    purchase cost when available.

### 🌱 Mined & Reward Tokens

-   Improved handling of tokens received through mining, farming,
    staking rewards, or similar zero-cost distributions.
-   Zero-cost holdings can now correctly display P&L instead of
    appearing as unavailable.

### 🎨 UI & Quality-of-Life Improvements

-   Added P&L information directly to Token Watchlist entries.
-   Added detailed tooltips explaining estimated or reconstructed cost
    basis.
-   Removed unnecessary approximation symbols from the main P&L display.
-   Added a prominent progress indicator while historical P&L is being
    calculated.
-   Portfolio percentage and USD change now remain visible while
    balances refresh, preventing layout movement.
-   Improved overall stability when switching between wallets and
    refreshing portfolio data.

### 🛠️ Reliability Improvements

-   Fixed incomplete PulseChain token-transfer history caused by
    explorer pagination limits.
-   Improved historical PulseX price reconstruction using on-chain
    liquidity pools.
-   Added additional safeguards for incomplete or unusual wallet
    histories.
-   Improved P&L handling for transferred, staked, rewarded, and
    partially reconstructed positions.
-   Expanded caching and recovery logic to reduce unnecessary historical
    queries.

> **Note:** P&L and cost-basis values are estimates reconstructed from
> available on-chain transaction history and historical market data.
> Complex DeFi activity, incomplete explorer history, sacrifice
> distributions, bridged assets, or other unusual transactions may
> result in differences from actual tax or accounting cost basis.

## 🚀 v2.2.1 --- RPC Reliability & Farm Reward Accuracy

This patch improves startup reliability and fixes INC/day farm reward
estimates.

### 🔧 Reliability

-   Replaced the unavailable PulseChain RPC endpoint
-   Added automatic migration for existing installs still using the
    obsolete RPC
-   Preserved user-configured custom RPC endpoints during migration
-   Improved startup behavior when loading saved RPC settings

### 🌾 Farm Rewards

-   Fixed inaccurate INC/day estimates
-   INC/day is now calculated directly from on-chain farm emissions,
    allocation points, and the user's share of staked LP
-   Improved INC/day behavior after claiming pending farm rewards
-   Removed reliance on short-term reward extrapolation and cached
    estimates

### 🐛 Fixes

-   Fixed an issue that could leave the dashboard stuck on **Retrieving
    Latest Prices**
-   Fixed INC/day values becoming wildly inaccurate after refreshes or
    delayed farm updates

------------------------------------------------------------------------

## 📦 Download

👉 **Latest Release:**
https://github.com/exodus2020/Pulsechain-Dashboard/releases

-   **Windows Installer** (recommended)
-   **Portable Version** (no install required)

⚠️ Notes:

-   This app is not code-signed yet
-   Windows may show a security warning → click **More Info → Run
    Anyway**

------------------------------------------------------------------------

## 🌐 Web Version

Prefer browser access? 👉 https://plsdashboard.link/

------------------------------------------------------------------------

## 🧠 What is PulseChain Dashboard?

PulseChain Dashboard is an open-source desktop application that lets you
track your PulseChain portfolio and interact with the ecosystem ---
without relying on centralized services.

All data is stored locally and encrypted for maximum privacy.

------------------------------------------------------------------------

## ✨ Features

-   📊 Track PulseChain token balances and portfolio value

-   🔮 Scenario Mode for hypothetical token prices and projected
    portfolio values

-   💾 Save custom price scenarios and load the protected built-in ATH
    preset

-   💰 Estimated token Profit & Loss (P&L) with historical cost-basis
    reconstruction

-   📈 Amount-weighted average entry prices across multiple wallets

-   👛 Track and combine multiple wallets with independent cost-basis
    accounting

-   🔄 Cost-basis preservation across wallet-to-wallet token transfers

-   ⚡ Persistent P&L caching for faster startup and wallet switching

-   💧 Monitor PulseX liquidity positions

-   🌾 View farming positions, rewards, and estimated INC/day

-   🧾 HEX stake tracking and analytics

-   ⛏️ Active HEX Miner DCA, cost basis, and P&L tracking

-   📈 Lifetime HEX DCA tracking across Ethereum & PulseChain

-   📉 Real-time token pricing and historical price charts

-   🔎 Scan wallets for PulseChain tokens and manage custom watchlists

-   🔐 Fully local + encrypted portfolio storage

-   📁 Import / export encrypted portfolios

-   🔧 Custom RPC endpoints

-   🌐 Built-in PulseChain ecosystem dApp access

-   ## 🖥️ Cross-platform support (Windows, macOS, Linux)

## 🛠️ Run from Source

### Prerequisites

-   Node.js (v16+)
-   npm (v7+)
-   Git
-   Python (v3.7+) + pip (for build dependencies)

Install Python dependencies:

``` bash
pip install setuptools wheel
```

------------------------------------------------------------------------

### 1. Clone the repository

``` bash
git clone https://github.com/exodus2020/Pulsechain-Dashboard.git
cd Pulsechain-Dashboard
```

------------------------------------------------------------------------

### 2. Install dependencies

``` bash
npm install
```

------------------------------------------------------------------------

### 3. Run in development

``` bash
npm run dev
```

------------------------------------------------------------------------

### 4. Build the application

``` bash
npm run electron:build
```

Output will be located in:

``` bash
dist_electron/
```

------------------------------------------------------------------------

## 🧪 Platform Notes (Optional)

If you prefer manual setup:

**MacOS (Homebrew):**

``` bash
brew install node git python
pip3 install setuptools wheel
```

**Ubuntu / Debian:**

``` bash
sudo apt install nodejs npm git python3 python3-pip
pip3 install setuptools wheel
```

**Fedora:**

``` bash
sudo dnf install nodejs npm git python3 python3-pip
pip3 install setuptools wheel
```

------------------------------------------------------------------------

## 🔐 Security

PulseChain Dashboard is designed with privacy as a core principle:

-   All data is stored locally
-   No external tracking or analytics
-   User-controlled RPC endpoints
-   dApps loaded from official sources only

------------------------------------------------------------------------

## ⚠️ Disclaimer

This is an independent open-source project and is not officially
affiliated with PulseChain.
