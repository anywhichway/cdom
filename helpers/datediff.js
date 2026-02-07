// Example: { p: { "=datediff": ["2023-01-01", "2024-01-01", "Y"] } }
export default function (start, end, unit = 'days') {
    const d1 = new Date(start);
    const d2 = new Date(end);

    // Excel DATEDIF units mapping
    if (unit === 'Y') return d2.getFullYear() - d1.getFullYear();
    if (unit === 'M') return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    if (unit === 'D') unit = 'days';

    const diff = d2 - d1;
    const units = {
        ms: 1,
        seconds: 1000,
        minutes: 1000 * 60,
        hours: 1000 * 60 * 60,
        days: 1000 * 60 * 60 * 24
    };
    return diff / (units[unit] || units.days);
}
