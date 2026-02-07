// Example: { p: { "=round": [123.456, 1] } }
export default function (val, decimals = 2) {
    const n = Number(val);
    if (isNaN(n)) return val;
    return n.toFixed(decimals);
}
