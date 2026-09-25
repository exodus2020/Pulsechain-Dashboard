# 🚀 PulseChain Dashboard

Privacy-first PulseChain portfolio tracker with real-time pricing, historical cost basis, P&L analytics, HEX staking, liquidity tracking, and multi-wallet support.

> Built for privacy. Runs locally. No tracking. No middlemen.

## 🚀 v2.4.2 — HEX DCA Accuracy, Purchase Timeline & Portfolio Reliability

Version 2.4.2 is a major reliability and accuracy update for **HEX DCA/P&L, fresh-wallet discovery, token tracking, and cached portfolio restoration**. It also adds a visual HEX purchase-history timeline and more efficient incremental DCA scans.

### 🎯 More Accurate HEX DCA & P&L
- Improved historical HEX cost-basis reconstruction using **hour-level historical pricing** for supported purchase paths instead of relying on coarse daily pricing.
- Historical swaps are valued using the asset exchanged for HEX at approximately the transaction hour, improving reconstructed USD spend and average entry calculations.
- Corrected liquid HEX P&L so current HEX that was not represented by a paid purchase does not incorrectly create a near-zero cost basis or absurd percentage returns.
- Refined HEX Miner fallback cost-basis handling so active-stake P&L remains tied to reconstructed lifetime HEX purchase history when a more specific basis cannot be established.
- HEX DCA remains separated by **Ethereum and PulseChain**, with network-specific HEX purchased, historical spend, average entry price, and purchase counts.
- DCA/P&L values remain estimates reconstructed from available on-chain history and historical market pricing and are intended for portfolio analytics rather than tax accounting.

### 📊 HEX Purchase History Timeline
- Added a dedicated **Details** view beneath HEX Miner DCA for visualizing reconstructed HEX purchases over time.
- Ethereum and PulseChain purchases share the same time axis for direct chronological comparison.
- Ethereum purchases extend **above** the center line in blue while PulseChain purchases extend **below** it in purple.
- Purchases occurring on the same day are combined into a single bar.
- Hovering a purchase bar immediately shows the date, total HEX purchased, total USD paid, and average price per HEX.
- Purchase-bar heights use adaptive logarithmic scaling so both small and large purchases remain visually distinguishable.
- Ethereum and PulseChain magnitudes are scaled independently using the currently visible wallets, and the chart automatically rescales when wallets are shown or hidden.
- Increased chart height and hover targets for easier inspection of individual purchase days.

### 🔎 Expanded DCA Details & Progress
- Added summary cards for total HEX purchased, total historical spend, purchase count, and current HEX price.
- Restored network-specific DCA information in the DCA tooltip.
- Moved the DCA **Details** control beneath the DCA card and kept it persistent alongside HEX Miner Details.
- Full or newly required DCA reconstruction once again exposes the **Scanning → Verifying → Calculating** workflow instead of silently rebuilding in the background.
- Adding a new wallet now triggers visible DCA progress when that wallet requires new historical data, while already cached wallets remain reusable.
- New-wallet rebuilds display the same detailed **Scanning → Verifying → Calculating** status information used during a cold-cache reconstruction, including scan progress beneath the DCA card.

### ⚡ Persistent & Incremental HEX DCA Cache
- HEX purchase history is saved persistently after a completed historical reconstruction.
- On later launches, the dashboard restores saved DCA/history immediately and checks only the blockchain range after the saved scan checkpoint for new purchases.
- Incremental checks use narrow RPC log ranges rather than repeating the full lifetime reconstruction.
- Scan checkpoints advance after successful checks so subsequent launches inspect only newly created blocks.
- Clearing the application cache intentionally removes the saved reconstruction and triggers a full historical HEX purchase scan again.
- Improved incremental-refresh diagnostics and fallback handling while preserving the known-good lifetime reconstruction path for a cold scan.

### 🪙 Token Discovery, Watchlist & Pricing Fixes
- Fresh installs and erased-data starts now populate the **five core tokens — PLS/WPLS, PLSX, INC, HEX, and PRVX —** in the Token Watchlist even before a wallet is added.
- Tokens discovered in tracked wallets are automatically added to the watchlist and can still be hidden later.
- Fixed duplicate watchlist entries caused by the same token being discovered through multiple liquidity/pair sources; discovered tokens are deduplicated by chain and contract.
- Improved PRVX price discovery so a clean start no longer leaves PRVX displaying an all-zero price when market data is available.
- Fixed clean-start portfolio restoration issues where wallet value could be visible in the wallet manager without appearing in the main portfolio total.
- HEX Miners now remains visible in its empty state even when no wallet or active HEX stake is present.

### ⚙️ Settings & Clean-Start Behavior
- **External Token Images** now defaults to enabled for fresh/erased application data.
- PulseChain Explorer access required by dashboard calculations is no longer presented as an optional enable/disable setting.
- Custom PulseChain RPC configuration remains available for users who need to change RPC providers.
- Improved behavior after **Erase All Data** and cache clears so core UI sections repopulate consistently during a completely fresh start.

### 🎨 UI & Quality-of-Life
- Purchase-history Details and HEX Miner Details can remain independently open/available without hiding one another's controls.
- Refined chart spacing, bar widths, scaling, labels, and hover behavior for easier visual comparison across long wallet histories.
- Prevented temporary/incomplete DCA reconstruction states from being mistaken for the final reconstructed cost basis once the scan completes.
- Improved progress-state consistency when adding uncached wallets after DCA data has already been restored from cache.

### 📸 HEX Purchase History

<table>
<tr>
<td align="center"><strong>HEX Purchase History Timeline</strong></td>
<td align="center"><strong>Adaptive Logarithmic Purchase Scale</strong></td>
</tr>
<tr>
<td align="center"><img src="public/Screenshots/2.4.2/HEX%20Purchase%20History%20Chart.png" width="500" alt="HEX Purchase History Timeline"></td>
<td align="center"><img src="public/Screenshots/2.4.2/Logarithmic%20Scale%20for%20purchases.png" width="500" alt="HEX Purchase History Adaptive Logarithmic Scale"></td>
</tr>
<tr>
<td align="center">Compare Ethereum purchases above the shared timeline with PulseChain purchases below it, with one bar per purchase day.</td>
<td align="center">Adaptive logarithmic scaling keeps purchases of very different sizes visually distinct while preserving immediate hover details for each purchase day.</td>
</tr>
</table>

> **Note:** HEX DCA and P&L values are estimates reconstructed from available on-chain transaction history and historical pricing. They are intended for portfolio analytics and may differ from tax or accounting cost basis.

---

## 🚀 v2.4.1 — HEX DCA, Active-Stake Cost Basis & Performance

Version 2.4.1 focuses on **HEX cost-basis accuracy, active-stake P&L, multi-wallet accounting, and dramatically faster cached startup**, while preserving the Scenario Mode introduced in v2.4.0.

### ⛏️ Active HEX Stake Cost Basis & P&L
- Reworked HEX Miner cost basis so active stakes use the purchase basis associated with each selected wallet's live stake principal.
- Added wallet-by-wallet active-stake basis calculations and amount-weighted aggregation when multiple wallets are selected.
- Miner DCA now reflects the weighted entry price of the HEX principal represented by the currently visible active stakes.
- Active Stake P&L compares current stake-principal value against reconstructed historical spend.
- Wallet filtering now recalculates active-stake DCA and P&L using only the selected wallets.

### 🔎 Lifetime HEX Purchase History
- Expanded HEX purchase reconstruction across both **Ethereum and PulseChain**.
- Added separate Ethereum and PulseChain purchase counts, HEX purchased, historical spend, and average entry prices.
- Added a combined lifetime purchase-history summary without mixing it with the active-stake basis used by HEX Miner P&L.
- Preserved Ethereum HEX purchase discovery while improving PulseChain purchase-history handling.

### 👛 Multi-Wallet HEX Accounting
- Added per-wallet HEX purchase breakdowns in the Miner Details panel.
- Each wallet can display its reconstructed purchase DCA, historical spend, current principal value, return, HEX amount, and purchase count.
- Combined-wallet Miner DCA is weighted from the selected wallets' individual active-stake bases rather than treating all historical purchases as one undifferentiated pool.
- Wallet combinations update the HEX Miner analytics consistently as wallets are shown or hidden.

### ⚡ Caching & Startup Performance
- Improved reuse of reconstructed HEX history and cost-basis data between sessions.
- Cached portfolio data can now restore HEX DCA/P&L analytics without repeating the full historical scan.
- Reduced unnecessary historical requests and recalculation during wallet switching.
- Significantly improved warm/cached application startup and portfolio restoration.

### 🧾 Miner Details & Reliability
- Expanded the **Details** panel with Active Stake Weighted Entry, current price/value, total spent, active staked HEX, and active-stake P&L.
- Added a Lifetime Purchase History section with Ethereum and PulseChain network breakdowns.
- Added a Wallet Purchase Breakdown for easier validation of individual wallet cost bases.
- Improved handling of wallets with Ethereum-only, PulseChain-only, mixed-chain, or no active HEX stakes.
- Preserved Scenario Mode behavior: projected HEX prices affect stake values and P&L while historical DCA/cost basis remains unchanged.

> **Note:** HEX DCA and P&L values are estimates reconstructed from available on-chain transaction history and historical pricing. They are intended for portfolio analytics and may differ from tax or accounting cost basis.

---

## 🚀 v2.4.0 — Scenario Mode & Saved Price Presets

Version 2.4.0 introduces **Scenario Mode**, a forward-looking portfolio simulator for exploring hypothetical PulseChain token prices without changing wallet balances, token quantities, or protocol reward rates.

### 🔮 Scenario Mode
- Added a dedicated Scenario Mode for modeling hypothetical portfolio values.
- Set individual target prices for **PLS, PLSX, HEX, INC, and PRVX**.
- Added quick **2x, 5x, 10x, 25x, and 100x** multiplier presets based on current live core-token prices.
- Added a Global multiplier field for custom portfolio-wide price scenarios.
- Scenario values propagate through portfolio totals, Token Watchlist values, HEX Miner analytics, liquidity positions, and farm reward USD estimates.
- Live market prices remain visible for reference while Scenario Mode is active.

### 💾 Saved Scenarios & ATH Preset
- Added named scenario presets that can be saved, loaded, updated, and deleted.
- Added a built-in **ATH 🔒** preset using recorded PulseChain all-time-high prices for the core tokens.
- The ATH preset is protected from deletion so it is always available after updating or installing the dashboard.
- ATH values remain editable while loaded, allowing them to be used as a starting point for custom scenarios.
- Editing ATH does not overwrite the protected preset; enter a new scenario name to save the modified values as a separate preset.

### ⛏️ HEX Miner Scenario Analytics
- HEX Miner principal, mined value, and estimated P&L respond to the selected scenario HEX price.
- Stake quantities, T-Shares, average length, and reconstructed DCA remain unchanged.
- Scenario styling clearly distinguishes projected values from live portfolio data.

### 💧 Liquidity & Farm Scenarios
- Liquidity-pool values update using scenario token prices while underlying LP quantities remain unchanged.
- Farm reward USD estimates respond to the scenario INC price.
- INC/day token emission rates remain unchanged, keeping projected reward values separate from protocol reward assumptions.

### 🎨 UI & Reliability
- Added gold Scenario styling and labels throughout affected portfolio sections.
- Scenario calculations are derived from the selected target prices rather than repeatedly multiplying previously projected values.
- Switching between multipliers, saved scenarios, custom values, and Reset now returns consistent portfolio totals.
- Reset restores current live core-token prices.

### 📸 Scenario Mode

<table>
<tr>
<td align="center"><strong>Scenario Portfolio Overview</strong></td>
<td align="center"><strong>Custom Scenarios & ATH Preset</strong></td>
</tr>
<tr>
<td align="center"><img src="public/Screenshots/2.4.0/Scenario%20Mode%20Overview.png" width="500" alt="PulseChain Dashboard Scenario Mode Overview"></td>
<td align="center"><img src="public/Screenshots/2.4.0/Custom%20Scenarios.png" width="500" alt="PulseChain Dashboard Custom Scenarios and ATH Preset"></td>
</tr>
<tr>
<td align="center">Model hypothetical token prices and see the projected portfolio, HEX Miner, and token values update together.</td>
<td align="center">Load the protected ATH preset, edit its prices, or save completely custom target-price scenarios.</td>
</tr>
</table>

<p align="center">
<strong>Scenario Liquidity & Farm Rewards</strong><br><br>
<img src="public/Screenshots/2.4.0/Scenario%20Farm%20Rewards.png" width="750" alt="PulseChain Dashboard Scenario Liquidity Pools and Farm Rewards"><br>
Project liquidity values and farm reward USD estimates while keeping protocol token reward rates unchanged.
</p>

---

## 📸 Screenshots

PulseChain Dashboard provides an all-in-one desktop interface for tracking portfolios, token P&L and cost basis, HEX staking, liquidity positions, farming rewards, and multi-wallet analytics.

<br>

<table>
<tr>
<td align="center"><strong>Portfolio Overview & Token P&L</strong></td>
<td align="center"><strong>Token Cost Basis & P&L</strong></td>
</tr>

<tr>
<td align="center">
<img src="public/Screenshots/2.3.0/Dashboard%20Overview.png" width="500" alt="PulseChain Dashboard Portfolio Overview and Token P&L">
</td>
<td align="center">
<img src="public/Screenshots/2.3.0/Token%20P%26L%20Cost-Basis%20Tooltip.png" width="500" alt="Token P&L Cost Basis Details">
</td>
</tr>

<tr>
<td align="center">
Track your complete PulseChain portfolio with real-time balances, token prices, estimated cost basis, and profit/loss.
</td>
<td align="center">
View reconstructed average entry, cost basis, current value, and estimated P&L using historical on-chain activity and market pricing.
</td>
</tr>

<tr>
<td height="25"></td>
<td></td>
</tr>

<tr>
<td align="center"><strong>HEX Miner Analytics</strong></td>
<td align="center"><strong>Multiple Wallet Tracking</strong></td>
</tr>

<tr>
<td align="center">
<img src="public/Screenshots/2.3.0/HEX%20Miners%20Dashboard.png" width="500" alt="HEX Miner Analytics Dashboard">
</td>
<td align="center">
<img src="public/Screenshots/2.3.0/Multiple%20Wallet%20Tracking.png" width="500" alt="Multiple Wallet Tracking">
</td>
</tr>

<tr>
<td align="center">
Monitor active HEX stakes with principal, mined HEX, T-Shares, staking ladder, weighted DCA price, and estimated P&L.
</td>
<td align="center">
Track multiple wallets simultaneously with individual holdings, stakes, farms, liquidity positions, and combined portfolio analytics.
</td>
</tr>
</table>

---

## v2.3.0 — Portfolio P&L & Cost Basis

Version 2.3.0 introduces historical cost-basis tracking and portfolio profit/loss calculations to the PulseChain Dashboard.

### 📊 Token P&L Tracking
- Added estimated Profit & Loss (P&L) for tokens in the Token Watchlist.
- Displays both USD profit/loss and percentage return.
- Reconstructs historical cost basis using wallet transaction history and historical PulseChain pricing.
- Calculates average entry price using amount-weighted cost basis.
- Supports combined P&L across multiple visible wallets.

### 👛 Multi-Wallet Accounting
- P&L is calculated independently for each wallet and aggregated when multiple wallets are visible.
- Wallet-to-wallet transfers preserve the original token cost basis.
- Hiding or showing wallets instantly recalculates portfolio totals using cached wallet data.
- Improved handling of external token transfers and incomplete transaction histories.

### ⚡ Faster P&L Loading & Persistent Caching
- Added persistent per-wallet/token P&L caching.
- Previously calculated wallet histories can be restored after restarting the application.
- Historical calculations are reused when changing visible wallets.
- Token calculations run concurrently to improve initial loading speed while limiting RPC/API pressure.
- Added a visible P&L calculation progress bar to the Token Watchlist.

### ⛏️ HEX Miner Cost Basis
- Improved HEX Miner DCA and P&L calculations.
- HEX cost basis is preserved when HEX enters an active stake.
- Stake principal retains its original investment basis.
- Yield generated from completed stakes is treated separately from invested principal.
- Miner DCA now uses reconstructed active-stake cost basis when available.

### 💎 PLS / WPLS Accounting
- Improved historical accounting for native PLS and Wrapped PLS.
- Native PLS and WPLS holdings are reconciled with the dashboard's combined Pulse balance.
- Added fallback historical pricing for older Pulse positions where complete explorer history is unavailable.
- P&L estimates remain available when historical transaction coverage is incomplete.

### 🔷 PRVX Cost Basis
- Added cost-basis handling for PRVX sacrifice distributions.
- Sacrifice distributions use the maximum sacrifice multiplier when reconstructing estimated investment basis.
- Normal PRVX purchases continue to use their actual reconstructed purchase cost when available.

### 🌱 Mined & Reward Tokens
- Improved handling of tokens received through mining, farming, staking rewards, or similar zero-cost distributions.
- Zero-cost holdings can now correctly display P&L instead of appearing as unavailable.

### 🎨 UI & Quality-of-Life Improvements
- Added P&L information directly to Token Watchlist entries.
- Added detailed tooltips explaining estimated or reconstructed cost basis.
- Removed unnecessary approximation symbols from the main P&L display.
- Added a prominent progress indicator while historical P&L is being calculated.
- Portfolio percentage and USD change now remain visible while balances refresh, preventing layout movement.
- Improved overall stability when switching between wallets and refreshing portfolio data.

### 🛠️ Reliability Improvements
- Fixed incomplete PulseChain token-transfer history caused by explorer pagination limits.
- Improved historical PulseX price reconstruction using on-chain liquidity pools.
- Added additional safeguards for incomplete or unusual wallet histories.
- Improved P&L handling for transferred, staked, rewarded, and partially reconstructed positions.
- Expanded caching and recovery logic to reduce unnecessary historical queries.

> **Note:** P&L and cost-basis values are estimates reconstructed from available on-chain transaction history and historical market data. Complex DeFi activity, incomplete explorer history, sacrifice distributions, bridged assets, or other unusual transactions may result in differences from actual tax or accounting cost basis.

## 🚀 v2.2.1 — RPC Reliability & Farm Reward Accuracy

This patch improves startup reliability and fixes INC/day farm reward estimates.

### 🔧 Reliability

- Replaced the unavailable PulseChain RPC endpoint
- Added automatic migration for existing installs still using the obsolete RPC
- Preserved user-configured custom RPC endpoints during migration
- Improved startup behavior when loading saved RPC settings

### 🌾 Farm Rewards

- Fixed inaccurate INC/day estimates
- INC/day is now calculated directly from on-chain farm emissions, allocation points, and the user's share of staked LP
- Improved INC/day behavior after claiming pending farm rewards
- Removed reliance on short-term reward extrapolation and cached estimates

### 🐛 Fixes

- Fixed an issue that could leave the dashboard stuck on **Retrieving Latest Prices**
- Fixed INC/day values becoming wildly inaccurate after refreshes or delayed farm updates

---


## 📦 Download

👉 **Latest Release:**
https://github.com/exodus2020/Pulsechain-Dashboard/releases

* **Windows Installer** (recommended)
* **Portable Version** (no install required)

⚠️ Notes:

* This app is not code-signed yet
* Windows may show a security warning → click **More Info → Run Anyway**

---

## 🧠 What is PulseChain Dashboard?

PulseChain Dashboard is an open-source desktop application that lets you track your PulseChain portfolio and interact with the ecosystem — without relying on centralized services.

All data is stored locally and encrypted for maximum privacy.

---

## ✨ Features

* 📊 Track PulseChain token balances and portfolio value
* 🔮 Scenario Mode for hypothetical token prices and projected portfolio values
* 💾 Save custom price scenarios and load the protected built-in ATH preset
* 💰 Estimated token Profit & Loss (P&L) with historical cost-basis reconstruction
* 📈 Amount-weighted average entry prices across multiple wallets
* 👛 Track and combine multiple wallets with independent cost-basis accounting
* 🔄 Cost-basis preservation across wallet-to-wallet token transfers
* ⚡ Persistent P&L and HEX DCA caching with incremental new-block purchase checks
* 💧 Monitor PulseX liquidity positions
* 🌾 View farming positions, rewards, and estimated INC/day
* 🧾 HEX stake tracking and analytics
* ⛏️ Active HEX Miner DCA, cost basis, and P&L tracking
* 🔎 Detailed active-stake and lifetime HEX purchase breakdowns by wallet and network
* 📈 Lifetime HEX DCA tracking across Ethereum & PulseChain with an interactive purchase timeline
* 📉 Real-time token pricing and historical price charts
* 🔎 Scan wallets for PulseChain tokens and manage custom watchlists
* 🔐 Fully local + encrypted portfolio storage
* 📁 Import / export encrypted portfolios
* 🔧 Custom RPC endpoints
* 🌐 Built-in PulseChain ecosystem dApp access
* 🖥️ Cross-platform support (Windows, macOS, Linux)
---

## 🛠️ Run from Source

### Prerequisites

* Node.js (v16+)
* npm (v7+)
* Git
* Python (v3.7+) + pip (for build dependencies)

Install Python dependencies:

```bash
pip install setuptools wheel
```

---

### 1. Clone the repository

```bash
git clone https://github.com/exodus2020/Pulsechain-Dashboard.git
cd Pulsechain-Dashboard
```

---

### 2. Install dependencies

```bash
npm install
```

---

### 3. Run in development

```bash
npm run dev
```

---

### 4. Build the application

```bash
npm run electron:build
```

Output will be located in:

```bash
dist_electron/
```

---

## 🧪 Platform Notes (Optional)

If you prefer manual setup:

**MacOS (Homebrew):**

```bash
brew install node git python
pip3 install setuptools wheel
```

**Ubuntu / Debian:**

```bash
sudo apt install nodejs npm git python3 python3-pip
pip3 install setuptools wheel
```

**Fedora:**

```bash
sudo dnf install nodejs npm git python3 python3-pip
pip3 install setuptools wheel
```

---

## 🔐 Security

PulseChain Dashboard is designed with privacy as a core principle:

* All data is stored locally
* No external tracking or analytics
* User-controlled RPC endpoints
* dApps loaded from official sources only

---

## ⚠️ Disclaimer

This is an independent open-source project and is not officially affiliated with PulseChain.
