export default function (start, end, unit = 'days') {
    const d1 = new Date(start);
    const d2 = new Date(end);
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
