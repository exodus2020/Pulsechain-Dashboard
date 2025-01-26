import { useState, useEffect } from 'react'
import { ethers } from 'ethers'

export function useValidateRpc(rpcUrl = null) {
    const [isValid, setIsValid] = useState(false)
    const [isChecking, setIsChecking] = useState(false)
    const [error, setError] = useState(null)

    const validateRpc = async (url) => {
        if (!url) return false
        setIsChecking(true)
        setError(null)

        try {
            const provider = new ethers.providers.JsonRpcProvider(url)
            
            // Try to get network and block number to validate connection
            const [network, blockNumber] = await Promise.all([
                provider.getNetwork(),
                provider.getBlockNumber()
            ])

            // Verify it's PulseChain (chainId: 369)
            if (network.chainId !== 369) {
                setError('Not a PulseChain RPC endpoint')
                setIsValid(false)
                return false
            }

            setIsValid(true)
            return true
        } catch (err) {
            setError(err.message)
            setIsValid(false)
            return false
        } finally {
            setIsChecking(false)
        }
    }

    useEffect(() => {
        if (rpcUrl) {
            validateRpc(rpcUrl)
        }
    }, [rpcUrl])

    return { isValid, isChecking, error, validateRpc }
} 