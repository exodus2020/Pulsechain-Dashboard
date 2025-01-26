# PulseChain Dashboard - Privacy-First PulseChain Dashboard

PulseChain Dashboard is an open-source desktop application that enables users to track their PulseChain portfolio and interact with the PulseChain ecosystem without the need to rely on a centralized service or entity. Built with privacy in mind, all data is stored and encrypted locally. All official dApps pull from the official PulseChain repos and allow users to easily run them from a single location.

## Features

- Track PulseChain token balances
- Monitor PulseX liquidity positions
- View PulseX farming positions and rewards
- All wallets, watchlists, and data stored locally and encrypted
- Cross-platform support (Windows, MacOS, Linux)
- Privacy-focused design
- Real-time price updates and INC rewards
- Customizable RPC endpoints


## Latest Release (Precompiled Binaries)
 - Windows: [Latest Release (exe)](https://drive.proton.me/urls/1CYZE0N5NG#6L69iqAONhTi)
 - MacOS (arm64): [Latest Release (zip)](https://drive.proton.me/urls/FWZ18FK220#6EgzyrkDGuKR)
 - MacOS (x64): [Latest Release (zip)](https://drive.proton.me/urls/8DX35F0J1G#6H72oWbgAR57)

Note: These binaries are not signed.
 - On Windows, you may get a security popup. Click More Info -> Run Anyway.
 - On MacOS, uncompress the zip and run the ./run-app.sh file (instructions included in README.txt)

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher) - Download and install from nodejs.org
- npm (v7 or higher) - Included with Node.js installation
- [Git](https://git-scm.com/downloads) - Download and install from git-scm.com
- Python (v3.7 or higher) and pip - Required for some build dependencies

For Windows users:
- Download [Node.js LTS](https://nodejs.org/en/download/)
- Download [Git for Windows](https://gitforwindows.org/)
- Download [Python](https://www.python.org/downloads/) (Make sure to check "Add Python to PATH" during installation)
- Install Python dependencies:
  ```bash
  pip install setuptools wheel
  ```

For MacOS users:
- Install via [Homebrew](https://brew.sh/):
  ```bash
  brew install node git python
  pip3 install setuptools wheel
  ```
- Or download directly from the websites above

For Linux users:
- Use your distribution's package manager
- Ubuntu/Debian:
  ```bash
  sudo apt install nodejs npm git python3 python3-pip
  pip3 install setuptools wheel
  ```
- Fedora:
  ```bash
  sudo dnf install nodejs npm git python3 python3-pip
  pip3 install setuptools wheel
  ```

### Installation Steps

1. Clone the repository
```bash
git clone https://gitlab.com/pulsechain-lunagray/pulsechain-dashboard.git
cd pulsechain-dashboard
```

2. Install dependencies
```bash
npm install
```

3. Build the application

For Windows:
```bash
npm run electron:build:win
```

For MacOS:
```bash
npm run electron:build:mac
```

For Linux:
```bash
npm run electron:build:linux
```

The built application will be available in the `dist_electron` directory.

### Development

To run the application in development mode:

1. Start the development server:
```bash
npm run dev
```

2. In a separate terminal, start the electron application:
```bash
npm start
```

## Security

PulseChain Dashboard is designed with privacy as a primary concern:
- All data is stored locally and encrypted
- No external tracking or analytics
- User-configurable RPC endpoints
- dApps are always updated on-demand from the official PulseChain repos


## Disclaimer

This is an open-source independent project and is not officially affiliated with PulseChain.
