// useGasEstimates.jsx
import { useState, useEffect } from "react";
import { defaultSettings } from "../config/settings";

// Browser-safe PulseChain gas estimate. Keep the legacy slow/normal/instant
// shape because LeftNavigation displays slow.baseFee.
export const useGasEstimates = (settings = defaultSettings) => {
  const [estimatedFees, setEstimatedFees] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const providerURL = settings?.rpcs?.mainnet?.[0] || 'https://rpc.pulsechain.com';

  useEffect(() => {
    let cancelled = false;

    const rpc = async (method, params = []) => {
      const response = await fetch(providerURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
      const json = await response.json();
      if (json?.error) throw new Error(json.error.message || 'RPC error');
      return json?.result;
    };

    const fetchGasEstimates = async () => {
      if (!cancelled) { setLoading(true); setError(null); }
      try {
        let weiHex;
        try {
          const block = await rpc('eth_getBlockByNumber', ['latest', false]);
          weiHex = block?.baseFeePerGas;
        } catch {}
        if (!weiHex) weiHex = await rpc('eth_gasPrice');
        if (!weiHex) throw new Error('No gas price returned');

        const wei = BigInt(weiHex);
        const gwei = Number(wei) / 1e9;
        const result = {
          slow: { baseFee: gwei },
          normal: { baseFee: gwei * 1.2 },
          instant: { baseFee: gwei * 1.25 },
          gasPrice: wei.toString()
        };
        if (!cancelled) setEstimatedFees(result);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchGasEstimates();
    const interval = setInterval(fetchGasEstimates, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [providerURL]);

  return { estimatedFees, loading, error };
};
