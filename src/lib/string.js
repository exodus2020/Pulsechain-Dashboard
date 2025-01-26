export function shortenString(str) {
    if (str.length < 9) {
        return str;
    }
    return str.slice(0, 4) + "..." + str.slice(-4);
}

export function normalizeSpacing(input) {
    return input
        .replace(/\s+/g, ' ') // Replace multiple spaces, tabs, or line breaks with a single space
        .trim(); // Remove leading and trailing spaces
}
export function formatQuery(input) {
    const singleSpaced = input
        .replace(/\s+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(); // Remove leading and trailing spaces

    return singleSpaced; // Encode the string for use in a URL
}