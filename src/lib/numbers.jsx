const fSci = (n, p) => {
	if (n >= 1e16) return (n / 1e15).toFixed(p) + 'Q'
	if (n >= 1e16 * 0.2) return (n / 1e14 / 10).toFixed(p) + 'Q'
	if (n >= 1e16 * 0.09995) return (n / 1e13 / 100).toFixed(p) + 'Q'
  
	if (n >= 1e13) return (n / 1e12).toFixed(p) + 'T'
	if (n >= 1e13 * 0.2) return (n / 1e11 / 10).toFixed(p) + 'T'
	if (n >= 1e13 * 0.09995) return (n / 1e10 / 100).toFixed(p) + 'T'
  
	if (n >= 1e10) return (n / 1e9).toFixed(p) + 'B'
	if (n >= 1e10 * 0.2) return (n / 1e8 / 10).toFixed(p) + 'B'
	if (n >= 1e10 * 0.09995) return (n / 1e7 / 100).toFixed(p) + 'B'
  
	if (n >= 1e7) return (n / 1e6).toFixed(p) + 'M'
	if (n >= 1e7 * 0.2) return (n / 1e5 / 10).toFixed(p) + 'M'
	if (n >= 1e7 * 0.09995) return (n / 1e4 / 100).toFixed(p) + 'M'
  
	if (n >= 1e4) return (n / 1e3).toFixed(p) + 'K'
	if (n >= 1e4 * 0.2) return (n / 1e2 / 10).toFixed(p) + 'K'
	if (n >= 1e4 * 0.09995) return (n / 1e1 / 100).toFixed(p) + 'K'
  
	// if (n >= 10 || n < .005) return (n).toFixed(p)
  
	//return n.toFixed(p)
	return parseInt(n)
}

export const fScientific = (n, p) => {
	n = parseFloat(`${n}`)
	if (isNaN(n)) return '0'
  
	const x = fSci(n, p)
	if (x !== null) return x
  
	return ((n * 100) / 100).toString()
}

export function addCommasToNumber(num) {
    // Convert the number to a string to split by the decimal point
    const [integerPart, decimalPart] = num.toString().split('.');

    // Use regex to add commas to the integer part
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // Combine the formatted integer with the decimal part (if it exists)
    return decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger;
}

export function fUnit(number, decimals = 0) {
    const units = ["", "k", "m", "b", "t", "q", "Q", "T", "B", "M", "K"];
    let unitIndex = 0;

    // Determine the appropriate unit
    while (number >= 1000 && unitIndex < units.length - 1) {
        number /= 1000;
        unitIndex++;
    }

    // Format the number to the specified number of decimals
    const formattedNumber = number.toFixed(decimals);

    // Append the unit
    return `${formattedNumber}${units[unitIndex]}`;
}

export function formatNumber(number, useCommas = true, useSub = false) {
    if (isNaN(Number(number))) return number

    const num = parseFloat(parseFloat(number ?? 0).toFixed(12))
    
    const formattedNumber = num > 0.98 ? parseFloat(num).toFixed(2) 
        : num > 0.001 ? parseFloat(num).toFixed(5)
        : num > 0.0000001 ? parseFloat(num).toFixed(8) 
        : num.toFixed(12)

    if (useSub) {
        return formattedNumber < 0.0000001 ? fUnitSub(formattedNumber, 4) : useCommas ? addCommasToNumber(formattedNumber) : formattedNumber
    }

    return useCommas ? addCommasToNumber(formattedNumber) : formattedNumber
}

export function fUnitSub(number = 0, decimals = 0) {
    const leadingZeros = countLeadingZerosAfterDecimal(number)
    const numberAfterZeros = getNumberAfterLeadingZeros(number, 4)

    if (leadingZeros === 0 ) return parseFloat(number).toFixed(2)

    return <>0.0<sub>{leadingZeros}</sub>{numberAfterZeros}</>
}

export function countLeadingZerosAfterDecimal(input) {
    // Convert the input to a string
    const numStr = input.toString();

    // Check if there's a decimal point
    const decimalIndex = numStr.indexOf('.');
    if (decimalIndex === -1) {
        return 0; // No decimal point, no leading zeros after decimal
    }

    // Extract the part after the decimal point
    const decimalPart = numStr.slice(decimalIndex + 1);

    // Match consecutive zeros at the start of the decimal part
    const leadingZeros = decimalPart.match(/^0+/);

    // Return the number of leading zeros or 0 if none are found
    return leadingZeros ? leadingZeros[0].length : 0;
}

export function getNumberAfterLeadingZeros(input, decimal = null) {
    // Convert the input to a string
    const numStr = input.toString();

    // Check if there's a decimal point
    const decimalIndex = numStr.indexOf('.');
    if (decimalIndex === -1) {
        return numStr; // No decimal point, return the input as is
    }

    // Extract the part after the decimal point
    const decimalPart = numStr.slice(decimalIndex + 1);

    // Remove leading zeros using a regular expression
    const result = decimalPart.replace(/^0+/, '');

    // If all characters after the decimal were zeros, return "0"
    const cleanedResult = result || '0';

    // Apply the decimal limit if provided
    if (decimal !== null) {
        return cleanedResult.slice(0, decimal);
    }

    return cleanedResult;
}

export function calculateScaledResultForChart(numChunks) {
    const baseChunks = 168; // Starting point for scaling
    const baseResult = 24;  // Initial result at baseChunks

    // Scale the result based on the ratio of numChunks to baseChunks
    const scaledResult = baseResult * (numChunks / baseChunks);

    // Apply Math.floor to the result
    return Math.floor(scaledResult);
}
