// Example: { p: { "=length": [[1, 2, 3]] } }
export default function (val) {
    if (Array.isArray(val) || typeof val === 'string') return val.length;
    if (val && typeof val === 'object') return Object.keys(val).length;
    return 0;
}
