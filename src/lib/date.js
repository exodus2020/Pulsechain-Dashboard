export function formatDatetime(date) {
    const options = {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true // Ensures the time is in 12-hour format with AM/PM
    };

    // Format the date using Intl.DateTimeFormat
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(date);

    // Extract components
    const month = parts.find(part => part.type === 'month').value;
    const day = parts.find(part => part.type === 'day').value;
    const year = parts.find(part => part.type === 'year').value;
    const hour = parts.find(part => part.type === 'hour').value;
    const minute = parts.find(part => part.type === 'minute').value;
    const dayPeriod = parts.find(part => part.type === 'dayPeriod').value.toLowerCase();

    // Return the formatted string
    return `${month}/${day}/${year} ${hour}:${minute}${dayPeriod}`;
}