export function decodeTransaction (tx) {
    const toName = tx?.to?.name

    if(toName == 'PiteasRouter') return decodePiteas(tx)
    if(toName == 'PulseXRouter02' || toName == 'PulseXSwapRouter') return decodePulseX(tx)

    if (tx?.method == 'transfer' || tx?.method == 'transferAndCall') return decodeTransfer(tx)

    return
}

function decodeTransfer (tx) {
    const result = {}
    const parameters = tx?.decoded_input?.parameters
    result.addressIn = tx?.to?.hash
    result.addressOut = parameters?.find(f => f?.name == "to" || f?.name == "recipient")?.value
    result.amountSent = parameters?.find(f => f?.name == "amount")?.value
    result.type = 'transfer'

    return result    
}

function decodePiteas (tx) {
    if (tx?.method == 'swap') {
        const result = {}
        const inputs = tx?.decoded_input?.parameters?.[0]?.value
        result.addressIn = inputs?.[0] == '0x0000000000000000000000000000000000000000' ? '0xa1077a294dde1b09bb078844df40758a5d0f9a27' : inputs?.[0]
        result.addressOut = inputs?.[1] == '0x0000000000000000000000000000000000000000' ? '0xa1077a294dde1b09bb078844df40758a5d0f9a27' : inputs?.[1]
        result.amountSent = inputs?.[3]
        result.amountMinReceived = inputs?.[4]
        result.type = 'swap'
        return result
    }

    return
}

function decodePulseX (tx) {
    try {
        if (tx?.method == 'swapExactTokensForTokens') {
            const result = {}
            const inputs = tx?.decoded_input?.parameters
            const path = inputs.find(f => f.name == 'path')
            const amountIn = inputs.find(f => f.name == 'amountIn')
            const amountOutMin = inputs.find(f => f.name == 'amountOutMin')
            result.addressIn = path?.value?.[0] == '0x0000000000000000000000000000000000000000' ? '0xa1077a294dde1b09bb078844df40758a5d0f9a27' : path?.value?.[0]
            result.addressOut = path?.value?.[path.length - 1] == '0x0000000000000000000000000000000000000000' ? '0xa1077a294dde1b09bb078844df40758a5d0f9a27' : path?.value?.[path.value.length - 1]
            result.amountSent = amountIn?.value
            result.amountMinReceived = amountOutMin?.value
            result.type = 'swap'

            return result
        }

        if (tx?.method.startsWith('swapExactETHForTokens') || tx?.method.startsWith('swapExactTokensForETH')) {
            const result = {}
            const inputs = tx?.decoded_input?.parameters ?? []
            const path = inputs.find(f => f.name == 'path')
            const ammountIn = inputs.find(f => f.name == 'amountIn')
            const ammountOutMin = inputs.find(f => f.name == 'amountOutMin')
            result.addressIn = path?.value?.[0] == '0x0000000000000000000000000000000000000000' ? '0xa1077a294dde1b09bb078844df40758a5d0f9a27' : path?.value?.[0]
            result.addressOut = path?.value?.[path.length - 1] == '0x0000000000000000000000000000000000000000' ? '0xa1077a294dde1b09bb078844df40758a5d0f9a27' : path?.value?.[path.value.length - 1]
            result.amountSent = ammountIn?.value
            result.amountMinReceived = ammountOutMin?.value
            result.type = 'swap'
            return result
        }

    } catch (e) {
        return
    }

    return
}