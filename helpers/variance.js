export default function (...args) {
    const nums = args.flat(Infinity).map(Number).filter(n => !isNaN(n));
    if (nums.length === 0) return 0;
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    return nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / nums.length;
}
