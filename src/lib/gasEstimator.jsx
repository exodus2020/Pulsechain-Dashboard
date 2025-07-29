// eip1559.jsx
import Web3 from 'web3';

// Constants from original implementation
const GWEI = 1000000000n;
const MAX_GAS_FAST = 50000000n * GWEI;
const FEE_HISTORY_BLOCKS = 10;
const FEE_HISTORY_PERCENTILE = 5;
const PRIORITY_FEE_ESTIMATION_TRIGGER = 100n * GWEI;
const DEFAULT_PRIORITY_FEE = 3n * GWEI;
const FALLBACK_ESTIMATE = {
  maxFeePerGas: 20n * GWEI,
  maxPriorityFeePerGas: DEFAULT_PRIORITY_FEE,
  baseFee: undefined
};
const PRIORITY_FEE_INCREASE_BOUNDARY = 200;

// Cache for last successful estimate
let lastSuccessfulEstimate = null;

// Retry configuration
const RETRY_LIMIT = 5;
const INITIAL_BACKOFF_MS = 500;
const BACKOFF_MULTIPLIER = 2;
const MAX_BACKOFF_MS = 30000;

// Utility functions
const addHexPrefix = (str) => (str.slice(0, 2) === '0x' ? str : `0x${str}`);
const hexlify = (input) => addHexPrefix(input.toString(16));
const max = (values) => values.reduce((a, b) => (b > a ? b : a), 0n);
const round = (value, n) => (value / n + BigInt(value % n > n / 2n)) * n;
const roundToWholeGwei = (wei) => round(wei, GWEI);

const getBaseFeeMultiplier = (baseFee) => {
  if (baseFee <= 40n * GWEI) return 200n;
  if (baseFee <= 100n * GWEI) return 160n;
  if (baseFee <= 200n * GWEI) return 140n;
  return 120n;
};

const calculatePriorityFeeEstimate = (feeHistory) => {
  if (!feeHistory?.reward) return null;

  const rewards = feeHistory.reward
    .map((r) => BigInt(r[0]))
    .filter((r) => r > 0n)
    .sort();

  if (!rewards.length) return null;

  const percentageIncreases = rewards.reduce((acc, cur, i, arr) => {
    if (i === arr.length - 1) return acc;
    const next = arr[i + 1];
    const p = ((next - cur) / cur) * 100n;
    return [...acc, p];
  }, []);

  const highestIncrease = max(percentageIncreases);
  const highestIncreaseIndex = percentageIncreases.findIndex((p) => p === highestIncrease);

  const values =
    highestIncrease >= PRIORITY_FEE_INCREASE_BOUNDARY &&
    highestIncreaseIndex >= Math.floor(rewards.length / 2)
      ? rewards.slice(highestIncreaseIndex)
      : rewards;

  return values[Math.floor(values.length / 2)];
};

const calculateFees = (baseFee, feeHistory) => {
  try {
    const estimatedPriorityFee = calculatePriorityFeeEstimate(feeHistory);
    const maxPriorityFeePerGas = max([estimatedPriorityFee ?? 0n, DEFAULT_PRIORITY_FEE]);
    const multiplier = getBaseFeeMultiplier(baseFee);
    const potentialMaxFee = (baseFee * multiplier) / 100n;
    
    const maxFeePerGas =
      maxPriorityFeePerGas > potentialMaxFee
        ? potentialMaxFee + maxPriorityFeePerGas
        : potentialMaxFee;

    if (maxFeePerGas >= MAX_GAS_FAST || maxPriorityFeePerGas >= MAX_GAS_FAST) {
      throw new Error('Estimated gas fee was much higher than expected, erroring');
    }

    return {
      maxFeePerGas: roundToWholeGwei(maxFeePerGas),
      maxPriorityFeePerGas: roundToWholeGwei(maxPriorityFeePerGas),
      baseFee
    };
  } catch (err) {
    const newError = new Error(
      `calculateFees failed: ${err.message || 'unknown error'}`
    );
    newError.originalError = err;
    throw newError;
  }
};

// Main exported function
export const estimateFees = async (web3) => {
  const startTime = Date.now();
  let lastError = null;
  let retryCount = 0;
  let backoffDuration = INITIAL_BACKOFF_MS;

  while (retryCount < RETRY_LIMIT) {
    try {
      // Get latest block
      const latestBlock = await web3.eth.getBlock('latest');
      
      if (!latestBlock.baseFeePerGas) {
        throw new Error('An error occurred while fetching current base fee, falling back');
      }

      const baseFee = BigInt(latestBlock.baseFeePerGas);
      const blockNumber = BigInt(latestBlock.number);

      // Get fee history if needed
      let feeHistory;
      if (baseFee >= PRIORITY_FEE_ESTIMATION_TRIGGER) {
        feeHistory = await web3.eth.getFeeHistory(
          FEE_HISTORY_BLOCKS,
          hexlify(blockNumber),
          [FEE_HISTORY_PERCENTILE]
        );
      }

      // Calculate fees
      const fees = calculateFees(baseFee, feeHistory);
      lastSuccessfulEstimate = fees;
      return fees;

    } catch (err) {
      retryCount += 1;
      console.warn(
        `estimateFees error: Beginning retry attempt ${retryCount} in ${backoffDuration} milliseconds. Error details:`,
        err
      );
      lastError = err;

      await new Promise((resolve) => setTimeout(resolve, backoffDuration));
      backoffDuration = Math.min(backoffDuration * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
    }
  }

  const totalTime = Date.now() - startTime;
  const totalTimeInSeconds = (totalTime / 1000).toFixed(2);
  console.warn(
    `Fallback estimate used after ${retryCount} retries and a total time of ${totalTimeInSeconds} seconds due to an error in gas estimation:`,
    lastError
  );

  return lastSuccessfulEstimate || FALLBACK_ESTIMATE;
};

export const calculateFeeOptions = (feeEstimate) => {
  const { maxFeePerGas, maxPriorityFeePerGas, baseFee } = feeEstimate;

  // Multipliers as BigInts (80% for slow, 100% for normal, 125% for instant)
  const SLOW_MULTIPLIER = 100n;
  const INSTANT_MULTIPLIER = 120n;
  const INSTANT_PRIORITY_MULTIPLIER = 135n;

  // Calculate slow option (80% of recommended)
  const slow = {
    maxFeePerGas: (maxFeePerGas * SLOW_MULTIPLIER) / 100n,
    maxPriorityFeePerGas,
    baseFee: (parseFloat(baseFee) / 10**9 )* 1,
  };

  // Normal uses the recommended values directly
  const normal = {
    maxFeePerGas,
    maxPriorityFeePerGas,
    baseFee: (parseFloat(baseFee) / 10**9) * 1.2,
  };

  // Instant increases both fees
  const instant = {
    maxFeePerGas: (maxFeePerGas * INSTANT_MULTIPLIER) / 100n,
    maxPriorityFeePerGas: (maxPriorityFeePerGas * INSTANT_PRIORITY_MULTIPLIER) / 100n,
    baseFee: (parseFloat(baseFee) / 10**9) * 1.35,
  };

  return {
    slow,
    normal,
    instant
  };
};