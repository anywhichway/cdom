// Example: { p: { "=slice": [[1, 2, 3, 4, 5], 1, 3] } }
export default function (val, start, end) {
    if (Array.isArray(val) || typeof val === 'string') {
        return val.slice(start, end);
    }
    return val;
}
