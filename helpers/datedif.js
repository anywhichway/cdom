import datediff from './datediff.js';
export default function (start, end, unit = 'D') {
    // Excel DATEDIF units: Y, M, D, MD, YM, YD
    // For now, simpler implementation for primary units
    const mapping = { Y: 'years', M: 'months', D: 'days' };
    if (unit === 'Y') return new Date(end).getFullYear() - new Date(start).getFullYear();
    if (unit === 'M') {
        const d1 = new Date(start);
        const d2 = new Date(end);
        return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    }
    return datediff(start, end, 'days');
}
