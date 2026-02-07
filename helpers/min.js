// Example: { p: { "=min": [10, 20, 30] } }
export default function (...args) {
    const nums = args.flat(Infinity).map(Number).filter(n => !isNaN(n));
    return Math.min(...nums);
}
