export const copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text)
        return true
    } catch (err) {
        console.error('Failed to copy:', err)
        return false
    }
} 

export function rgbStringToHex(rgbString) {
    // Extract numbers from rgb(r, g, b) format
    const matches = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!matches) return null; // Return null for invalid format
  
    // Parse r, g, b values
    const [r, g, b] = matches.slice(1).map(Number);
  
    // Convert to hex and ensure two digits
    const toHex = (n) => {
      n = Math.max(0, Math.min(255, Math.round(n))); // Clamp to 0-255
      const hex = n.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
  
    // Return HEX color
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }