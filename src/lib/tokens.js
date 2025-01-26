import ImgHEX from "../icons/hex.png"
import ImgPLSX from "../icons/plsx.png"
import ImgINC from "../icons/inc.png"
import ImgPLS from "../icons/pls.png"
import ImgDAI from "../icons/dai.png"
import ImgUSDC from "../icons/usdc.png"
import ImgUSDT from "../icons/usdt.png"
import ImgWETH from "../icons/weth.png"
import ImgWBTC from "../icons/wbtc.png"
import axios from "axios"

export const liquidityPairs = {
      '0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9': {
        "id": "0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9",
        "a": '0x95b303987a60c71504d99aa1b13b4da07b0790ab',
        "name": "PLSX-WPLS",
        "reserve0": "0",
        "reserve1": "0",
        "token0": {
          "id": "0x95b303987a60c71504d99aa1b13b4da07b0790ab",
          "name": "PulseX",
          "symbol": "PLSX",
          "decimals": "18"
        },
        "token1": {
          "id": "0xa1077a294dde1b09bb078844df40758a5d0f9a27",
          "name": "Wrapped Pulse",
          "symbol": "WPLS",
          "decimals": "18"
        }
      },
    '0xf808bb6265e9ca27002c0a04562bf50d4fe37eaa': {
        "id": "0xf808bb6265e9ca27002c0a04562bf50d4fe37eaa",
        "a": '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d',
        "name": "INC-WPLS",
        "reserve0": "7918690.61403274551045319",
        "reserve1": "317322218800.223206707510672627",
        "token0": {
          "id": "0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d",
          "name": "Incentive",
          "symbol": "INC",
          "decimals": "18"
        },
        "token1": {
          "id": "0xa1077a294dde1b09bb078844df40758a5d0f9a27",
          "name": "Wrapped Pulse",
          "symbol": "WPLS",
          "decimals": "18"
        }
      },
    '0xf1f4ee610b2babb05c635f726ef8b0c568c8dc65': {
        "id": "0xf1f4ee610b2babb05c635f726ef8b0c568c8dc65",
        "a": '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39',
        "name": "HEX-WPLS",
        "reserve0": "783445045.6275021",
        "reserve1": "232206200766.1306351796842327",
        "token0": {
          "id": "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39",
          "name": "HEX",
          "symbol": "HEX",
          "decimals": "8"
        },
        "token1": {
          "id": "0xa1077a294dde1b09bb078844df40758a5d0f9a27",
          "name": "Wrapped Pulse",
          "symbol": "WPLS",
          "decimals": "18"
        }
      },
      '0xe56043671df55de5cdf8459710433c10324de0ae': {
        "id": "0xe56043671df55de5cdf8459710433c10324de0ae",
        "a": '0xefd766ccb38eaf1dfd701853bfce31359239f305',
        "name": "WPLS-DAI",
        "reserve0": "0",
        "reserve1": "0",
        "token0": {
          "id": "0xa1077a294dde1b09bb078844df40758a5d0f9a27",
          "name": "Wrapped Pulse",
          "symbol": "WPLS",
          "decimals": "18"
        },
        "token1": {
          "id": "0xefd766ccb38eaf1dfd701853bfce31359239f305",
          "name": "Dai Stablecoin from Ethereum",
          "symbol": "DAI",
          "decimals": "18"
        },
      },
      '0x42abdfdb63f3282033c766e72cc4810738571609': {
        'id': '0x42abdfdb63f3282033c766e72cc4810738571609',
        "a": '0x02dcdd04e3f455d838cd1249292c58f3b79e3c3c',
        'name': 'WETH-WPLS',
        'reserve0': '0',
        'reserve1': '0',
        'token0': {
          'id': '0x02dcdd04e3f455d838cd1249292c58f3b79e3c3c',
          'name': 'Wrapped Ether from Ethereum',
          'symbol': 'WETH',
          'decimals': "18",
        },
        "token1": {
          "id": "0xa1077a294dde1b09bb078844df40758a5d0f9a27",
          "name": "Wrapped Pulse",
          "symbol": "WPLS",
          "decimals": "18"
        }
      },
      '0xdb82b0919584124a0eb176ab136a0cc9f148b2d1': {
        'id': '0xdb82b0919584124a0eb176ab136a0cc9f148b2d1',
        "a": '0xb17d901469b9208b17d916112988a3fed19b5ca1',
        'name': 'WBTC-WPLS',
        'reserve0': '0',
        'reserve1': '0',
        'token1': {
          'id': '0xb17d901469b9208b17d916112988a3fed19b5ca1',
          'name': 'Wrapped BTC from Ethereum',
          'symbol': 'WBTC',
          'decimals': "8",
        },
        "token0": {
          "id": "0xa1077a294dde1b09bb078844df40758a5d0f9a27",
          "name": "Wrapped Pulse",
          "symbol": "WPLS",
          "decimals": "18"
        }
      },
      '0x6753560538eca67617a9ce605178f788be7e524e': {
        'id':'0x6753560538eca67617a9ce605178f788be7e524e',
        'a': '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07',
        'name': 'USDC-WPLS',
        'reserve0': "0",
        'reserve1': "0",
        'token0': {
          'id': '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07',
          'name': 'USD Coin from Ethereum',
          'symbol': 'USDC',
          'decimals': "6",
        },
        "token1": {
          "id": "0xa1077a294dde1b09bb078844df40758a5d0f9a27",
          "name": "Wrapped Pulse",
          "symbol": "WPLS",
          "decimals": "18"
        }
      },
      '0x322df7921f28f1146cdf62afdac0d6bc0ab80711': {
        'id':'0x322df7921f28f1146cdf62afdac0d6bc0ab80711',
        'a': '0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f',
        'name': 'USDT-WPLS',
        'reserve0': "0",
        'reserve1': "0",
        'token0': {
          'id': '0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f',
          'name': 'Tether USD from Ethereum',
          'symbol': 'USDT',
          'decimals': "6",
        },
        "token1": {
          "id": "0xa1077a294dde1b09bb078844df40758a5d0f9a27",
          "name": "Wrapped Pulse",
          "symbol": "WPLS",
          "decimals": "18"
        }
      }
}

export const defaultTokenInformation = {
    '0xa1077a294dde1b09bb078844df40758a5d0f9a27': {
        name: 'PulseChain',
        symbol: 'WPLS',
        decimals: 18,
        factor: 1,
        icon: ImgPLS
    },
    '0x95b303987a60c71504d99aa1b13b4da07b0790ab': {
        name: 'PulseX',
        symbol: 'PLSX',
        decimals: 18,
        factor: .1,
        icon: ImgPLSX
    },
    '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d': {
        name: 'Incentive',
        symbol: 'INC',
        decimals: 18,
        factor: .1,
        icon: ImgINC
    },
    '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39': {
        name: 'HEX',
        symbol: 'HEX',
        decimals: 8,
        factor: 10**9,
        icon: ImgHEX
    },
    '0xefd766ccb38eaf1dfd701853bfce31359239f305': {
      name: 'DAI Stablecoin from Ethereum',
      symbol: 'DAI',
      decimals: 18,
      factor: .1,
      icon: ImgDAI
    },
    '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07': {
        name: 'USD Coin from Ethereum',
        symbol: 'USDC',
        decimals: 6,
        factor: .1,
        icon: ImgUSDC
    },
    '0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f': {
        name: 'Tether USD from Ethereum',
        symbol: 'USDT',
        decimals: 6,
        factor: .1,
        icon: ImgUSDT
    },
    '0x02dcdd04e3f455d838cd1249292c58f3b79e3c3c': {
        name: 'Wrapped Ether from Ethereum',
        symbol: 'WETH',
        decimals: 18,
        factor: .1,
        icon: ImgWETH

    },
    '0xb17d901469b9208b17d916112988a3fed19b5ca1': {
      name: 'Wrapped BTC from Ethereum',
      symbol: 'WBTC',
      decimals: 8,
      factor: .1,
      icon: ImgWBTC
    }
}

export const wplsRawToNormalized = (raw) => {
  try {
    const rawValue = BigInt(raw)
    const normalizedValue = parseFloat( parseFloat( rawValue / BigInt(10**14) ).toFixed(4) / 10**4 ).toFixed(4)
    return normalizedValue
  } catch {
    return 
  }
}

export const tokenRawToNormalized = (raw, decimals) => {
  try {
    const rawValue = BigInt(raw)
    const normalizedValue = parseFloat( parseFloat( rawValue / BigInt(10**decimals - 4) ).toFixed(4) / 10**4 ).toFixed(4)
    return normalizedValue
  } catch {
    return 
  }
}


export const convertPricePairToPrice = (pricePair, decimals0 = 18, decimals1 = 18, scale = 1e18) => {
    const reserve0BigInt = BigInt(pricePair.reserve0) * BigInt(10**decimals0);
    const reserve1BigInt = BigInt(pricePair.reserve1) * BigInt(10**decimals1);

    // Perform division using BigInt
    // Multiplying by 1e18 (or another scaling factor) to maintain precision
    const scalingFactor = BigInt(scale);
    const priceBigInt = (reserve1BigInt * scalingFactor) / (reserve0BigInt ?? BigInt(1));
    const price = Number(priceBigInt) / (scale ?? 1);
    return price
}

export const convertInvertedPricePairToPrice = (pricePair, scale = 1e18) => {
  const reserve0BigInt = BigInt(pricePair.reserve1);
  const reserve1BigInt = BigInt(pricePair.reserve0);

  // Perform division using BigInt
  // Multiplying by 1e18 (or another scaling factor) to maintain precision
  const scalingFactor = BigInt(scale);
  const priceBigInt = (reserve1BigInt * scalingFactor) / (reserve0BigInt ?? BigInt(1));
  const price = Number(priceBigInt) / (scale ?? 1);
  return price
}


export const getPairPrice = (reserve0, reserve1, scale = 1) => {
    const reserve0BigInt = BigInt(reserve0);
    const reserve1BigInt = BigInt(reserve1);

    // Perform division using BigInt
    // Multiplying by 1e18 (or another scaling factor) to maintain precision
    const scalingFactor = BigInt(1e18);
    const priceBigInt = (reserve1BigInt * scalingFactor) / (reserve0BigInt ?? BigInt(1));
    const price = Number(priceBigInt) / 1e18 / scale;
    return price
}

export const formatTokens = (response) => {
  const result =  response?.data?.tokens?.map(token => ({
    address: (token?.address ?? '').toLowerCase(),
    url: token?.logoURI,
    symbol: token?.symbol ?? '',
    name: token?.name ?? ''
  })) ?? [];

  return result
};

export const fetchTokenList = async (url) => {
  try {
    const response = await axios.get(url);
    return formatTokens(response);
  } catch (err) {
    console.warn(`Failed to fetch tokens from ${url}:`, err);
    return [];
  }
};