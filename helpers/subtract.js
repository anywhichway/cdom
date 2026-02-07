// Example: { p: { "=subtract": [10, 5, 2] } }
export default function (...args) {
    const flat = args.flat(Infinity).map(v => Number(v) || 0);
    if (flat.length === 0) return 0;
    if (flat.length === 1) return -flat[0];
    return flat.reduce((a, b) => a - b);
}
