// Example: { p: { "=sum": [10, 20, 30] } }
export default function (...args) {
    return args.flat(Infinity).reduce((a, b) => a + (Number(b) || 0), 0);
}
