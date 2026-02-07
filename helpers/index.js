// Example: { p: { "=index": [[10, 20, 30], 1] } }
export default function (val, idx) {
    if (Array.isArray(val)) return val[idx];
    if (val && typeof val === 'object') return val[idx];
    return undefined;
}
