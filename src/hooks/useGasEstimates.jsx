// useGasEstimates.jsx
import { useState, useEffect } from "react";
import { calculateFeeOptions } from "../lib/gasEstimator";
import { estimateFees } from '@pulsechainorg/gas-estimation';
import { defaultSettings } from "../config/settings";

export const useGasEstimates = (settings = defaultSettings) => {
  const [estimatedFees, setEstimatedFees] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const providerURL = settings.rpcs.mainnet[0];

  useEffect(() => {
    const fetchGasEstimates = async () => {
      setLoading(true);
      setError(null);

      try {
        try {
          const fees = await estimateFees(providerURL);
          const feeOptions = calculateFeeOptions(fees);
          setEstimatedFees(feeOptions);
        } catch (err) {
          const fees = await estimateFees('https://rpc.pulsechain.com');
          const feeOptions = calculateFeeOptions(fees);
          setEstimatedFees(feeOptions);
        }
      } catch (err) {
        console.error("Gas estimation failed:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchGasEstimates();

    // Optional: Refresh gas estimates every 30 seconds
    const interval = setInterval(fetchGasEstimates, 30_000);
    return () => clearInterval(interval);
  }, [ settings ]);

  return { estimatedFees, loading, error };
};
