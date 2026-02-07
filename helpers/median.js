// Example: { p: { "=median": [10, 20, 30] } }
export default function (...args) {
    const nums = args.flat(Infinity).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (nums.length === 0) return 0;
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}
