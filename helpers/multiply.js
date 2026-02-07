// Example: { p: { "=multiply": [2, 3, 4] } }
export default function (...args) {
    return args.flat(Infinity).reduce((a, b) => a * (Number(b) || 0), 1);
}
