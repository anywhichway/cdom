// Example: { p: { "=tofixed": [123.456, 2] } }
export default function (val, decimals = 2) {
    return Number(val).toFixed(decimals);
}
