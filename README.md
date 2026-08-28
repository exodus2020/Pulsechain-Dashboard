# 🚀 PulseChain Dashboard

Privacy-first PulseChain portfolio tracker with real-time pricing, historical cost basis, P&L analytics, HEX staking, liquidity tracking, and multi-wallet support.

> Built for privacy. Runs locally. No tracking. No middlemen.

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
<img src="public/Screenshots/2.3.0/Multiple%20Wallet%20Tracking%281%29.png" width="500" alt="Multiple Wallet Tracking">
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

## 🚀 v2.2.0 — Lifetime HEX DCA & Multi-Chain Purchase Tracking

This release introduces one of the biggest upgrades to PulseChain Dashboard yet: **lifetime HEX dollar-cost averaging (DCA)** with historical purchase reconstruction across both Ethereum and PulseChain.

### ✨ New Features

- 📈 Lifetime HEX Dollar-Cost Average (DCA) tracking
- ⛓️ Automatic reconstruction of lifetime HEX purchases across Ethereum and PulseChain
- 💰 Historical pricing using archived market data with automatic fallbacks
- 🧮 Weighted lifetime average entry price calculation
- 🌐 Combined multi-chain purchase history
- 📊 Network-by-network purchase breakdown
- 👛 Wallet-by-wallet DCA breakdown
- 📉 Current profit/loss and return percentage based on your average entry

### ⚡ Performance

- Persistent caching of transaction history for dramatically faster reloads
- Cached historical pricing to reduce API requests
- Live progress updates while scanning wallet history
- Improved reliability when processing large transaction histories

### 🎨 UI / UX

- Added **DCA Price** card to the HEX Miners dashboard
- Detailed hover tooltip showing:
  - Average Entry
  - Current Price
  - Current Value
  - Total Spent
  - Total HEX Purchased
  - Network Breakdown
  - Wallet Breakdown
- Improved tooltip positioning for large data sets

### 🛠 Under the Hood

- Added Ethereum pre-PulseChain transaction scanning
- Added dual-chain transaction scanning across Ethereum and PulseChain
- Improved transaction parsing for routed swaps and multicall transactions
- Added historical price lookup fallbacks for improved pricing accuracy
- Improved error handling and recovery when historical pricing is unavailable
- Reduced unnecessary blockchain requests through smarter caching

---

## 🚀 v2.1.3 — Price Accuracy & Metrics Sync

This update focuses on improving price accuracy, percent tracking, and overall calculation reliability.

### 🔧 Improvements
- Synced % change calculations with **PulseCoinList** for consistent market data
- Improved reliability of **1H / 6H / 24H / 7D / 30D** calculations across all tokens
- Better handling of USD vs WPLS conversions using stable pair logic
- Enhanced fallback logic for missing or inconsistent historical data

### 📊 Accuracy Fixes
- Fixed issue where % changes were stuck at **0.0%**
- Fixed incorrect **24H calculations** drifting from real market values
- Fixed mismatch between dashboard values and external data sources
- Improved handling of candle-based vs API-based price anchoring

### 🧠 Under the Hood
- Integrated PulseCoinList metrics as a **reliable override layer**
- Added caching for last known good % values to prevent flickering/resetting
- Improved denominator stability to prevent calculation collapse
- Cleaned up debug logging and reduced console noise

---

## 🚀 v2.1.2 — UX & Watchlist Upgrade

This release improves token management, hidden-token recovery, and bulk watchlist workflows.

### ✨ New Features
- Added **Add All Results** button for fast bulk token imports
- Hidden tokens now reappear during **Scan** so they can be restored
- Added seamless restore flow for previously hidden default tokens

### 🎨 UI/UX
- Default tokens can now be hidden instead of silently failing to remove
- Improved Token Watchlist layout with balanced action buttons
- Hidden tokens are clearly labeled in scan results
- Cleaner token management workflow

### 🐛 Fixes
- Fixed issue where default tokens from Ethereum could not be removed
- Fixed hidden-token recovery and re-add behavior
- Improved watchlist consistency when adding multiple scan results

---

## 🚀 v2.1.1 — Performance & Accuracy Patch

This patch focuses on improving performance, fixing calculation edge cases, and polishing the overall user experience.

### 🔧 Improvements
- Added smart candle caching for faster startup and reduced API calls
- Wallet % change now calculated across **all tokens**, not just core assets
- Improved reliability of price calculations using historical data
- Automatic update check on startup (no manual interaction required)

### 🎨 UI/UX
- Added **“Support the developer”** section with copy-to-clipboard
- Improved loading indicator positioning and alignment
- Fixed sidebar layout issues and spacing inconsistencies
- Better visual feedback for update status (“Up To Date” / “Update Available”)

### 🐛 Fixes
- Fixed PRVX % showing incorrect values (including -100% bug)
- Fixed WPLS % inconsistencies and delayed calculations
- Fixed chart-related crashes when loading certain tokens
- Resolved multiple console errors and edge case failures

---

## 🚀 v2.1.0 — Stability & Charting Update

This release focuses on improving reliability, performance, and overall user experience.

### 🔧 Improvements
- Fixed incorrect % changes (1H, 6H, 24H, 7D, 30D)
- Standardized chart logic using hourly candle data
- Improved chart loading behavior for non-core tokens
- Added fallback handling for tokens missing price data
- Fixed duplicate tokens appearing in wallet scans
- Allow removal of tokens even if they fail to load
- Improved token image loading with better fallback logic

### 🎨 UI/UX
- Improved spacing and layout consistency
- Fixed token row alignment issues
- Version display now reflects actual app version dynamically

### 🛠️ Under the Hood
- Reduced reliance on unreliable external price sources
- Improved caching behavior for chart data
- Stabilized modal + chart rendering

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

## 🌐 Web Version

Prefer browser access?
👉 https://plsdashboard.link/

---

## 🧠 What is PulseChain Dashboard?

PulseChain Dashboard is an open-source desktop application that lets you track your PulseChain portfolio and interact with the ecosystem — without relying on centralized services.

All data is stored locally and encrypted for maximum privacy.

---

## ✨ Features

* 📊 Track PulseChain token balances and portfolio value
* 💰 Estimated token Profit & Loss (P&L) with historical cost-basis reconstruction
* 📈 Amount-weighted average entry prices across multiple wallets
* 👛 Track and combine multiple wallets with independent cost-basis accounting
* 🔄 Cost-basis preservation across wallet-to-wallet token transfers
* ⚡ Persistent P&L caching for faster startup and wallet switching
* 💧 Monitor PulseX liquidity positions
* 🌾 View farming positions, rewards, and estimated INC/day
* 🧾 HEX stake tracking and analytics
* ⛏️ Active HEX Miner DCA, cost basis, and P&L tracking
* 📈 Lifetime HEX DCA tracking across Ethereum & PulseChain
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
