// Example: { p: { "=or": [true, false] } }
export default function (...args) {
    return args.some(Boolean);
}
