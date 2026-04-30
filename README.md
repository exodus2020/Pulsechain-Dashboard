# 🚀 PulseChain Dashboard

Privacy-first portfolio tracker for PulseChain assets with real-time pricing and historical charting.

> Built for privacy. Runs locally. No tracking. No middlemen.

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

* 📊 Track PulseChain token balances
* 💧 Monitor PulseX liquidity positions
* 🌾 View farming positions and rewards
* 🔐 Fully local + encrypted data storage
* ⚡ Real-time price updates
* 🧾 HEX stake tracking and analytics
* 🔧 Custom RPC endpoints
* 📁 Import / export encrypted portfolios
* 🖥️ Cross-platform (Windows, MacOS, Linux)

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
npm start
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
