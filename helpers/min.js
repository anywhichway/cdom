export default function (...args) {
    const nums = args.flat(Infinity).map(Number).filter(n => !isNaN(n));
    return Math.min(...nums);
}
