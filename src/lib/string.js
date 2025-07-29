export function shortenString(str, length = 8, shortenEnd = false) {
    if (str.length < length + 1) {
        return str;
    }
    if (shortenEnd) {
        return str.slice(0, length) + "...";
    } else {
        return str.slice(0, Math.ceil(length / 2)) + "..." + str.slice(-Math.ceil(length / 2));
    }
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