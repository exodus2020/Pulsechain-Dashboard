// useGasEstimates.jsx
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { defaultSettings } from "../config/settings";

// V155: the previous @pulsechainorg/gas-estimation helper occasionally asked
// eth_feeHistory for a block just beyond the RPC head, then printed noisy retry
// warnings. The dashboard only needs a current fee estimate, so use ethers'
// provider-native fee data and fall back quietly to eth_gasPrice.
export const useGasEstimates = (settings = defaultSettings) => {
  const [estimatedFees, setEstimatedFees] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const providerURL = settings?.rpcs?.mainnet?.[0] || 'https://rpc.pulsechain.com';

  useEffect(() => {
    let cancelled = false;
    const fetchGasEstimates = async () => {
      if (!cancelled) { setLoading(true); setError(null); }
      try {
        const provider = new ethers.providers.JsonRpcProvider(providerURL);
        let feeData = await provider.getFeeData();
        let gasPrice = feeData?.gasPrice || feeData?.maxFeePerGas;
        if (!gasPrice) gasPrice = await provider.getGasPrice();
        const base = gasPrice || ethers.BigNumber.from(0);
        const result = {
          low: base.mul(90).div(100).toString(),
          medium: base.toString(),
          high: base.mul(120).div(100).toString(),
          gasPrice: base.toString(),
          maxFeePerGas: feeData?.maxFeePerGas?.toString?.() || base.toString(),
          maxPriorityFeePerGas: feeData?.maxPriorityFeePerGas?.toString?.() || '0'
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
