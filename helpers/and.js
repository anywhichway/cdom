// Example: { p: { "=and": [true, true] } }
export default function (...args) {
    return args.every(Boolean);
}
