// Compatibility layer for the subset of Web3 v1 read-only contract calls used by
// PulseChain Dashboard. Uses ethers v5 and avoids Web3's retired Swarm packages.
import { ethers } from 'ethers'

function asWeb3Result(value) {
  if (ethers.BigNumber.isBigNumber(value)) return value.toString()
  if (Array.isArray(value)) {
    const output = value.map(asWeb3Result)
    // Preserve tuple names such as stake.stakedHearts and poolInfo.lpToken.
    for (const name of Object.getOwnPropertyNames(value)) {
      if (!/^\d+$/.test(name) && name !== 'length' && name !== '_isResult') {
        output[name] = asWeb3Result(value[name])
      }
    }
    return output
  }
  return value
}

export default class Web3Compat {
  constructor(rpcUrl) {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
    this.eth = {
      Contract: class {
        constructor(abi, address) {
          const contract = new ethers.Contract(address, abi, provider)
          this.methods = new Proxy({}, {
            get: (_target, method) => (...args) => {
              const run = async (options = {}) => {
                const overrides = options && typeof options === 'object' ? options : {}
                return asWeb3Result(await contract.functions[method](...args, overrides).then(result => result.length === 1 ? result[0] : result))
              }
              const call = (options) => run(options)
              call.request = (options, callback) => {
                const cb = typeof options === 'function' ? options : callback
                return async () => {
                  try { cb(null, await run(typeof options === 'function' ? {} : options)) }
                  catch (error) { cb(error, null) }
                }
              }
              return { call }
            }
          })
        }
      },
      getBalance: Object.assign(
        async (address, blockTag = 'latest') => (await provider.getBalance(address, blockTag)).toString(),
        { request: (address, callback) => async () => {
          try { callback(null, (await provider.getBalance(address)).toString()) }
          catch (error) { callback(error, null) }
        } }
      ),
      getBlock: async (blockTag) => {
        const block = await provider.getBlock(blockTag)
        return { ...block, baseFeePerGas: block.baseFeePerGas?.toString() }
      },
      getFeeHistory: async (count, newest, percentiles) => provider.send('eth_feeHistory', [ethers.utils.hexValue(count), newest, percentiles])
    }
    this.BatchRequest = class {
      constructor() { this.requests = [] }
      add(request) { this.requests.push(request) }
      execute() {
        // Bound concurrency prevents public RPCs from being flooded by hundreds
        // of calls; callback semantics remain identical to Web3 v1 batches.
        let cursor = 0
        const requests = this.requests
        const workers = Array.from({ length: Math.min(12, requests.length) }, async () => {
          while (cursor < requests.length) {
            const request = requests[cursor++]
            try { await request() } catch (error) { console.warn('RPC batch request failed', error) }
          }
        })
        return Promise.all(workers)
      }
    }
  }
}
