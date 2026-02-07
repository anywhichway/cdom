// Example: { p: { "=count": [[1, 2, 3, 4]] } }
export default function (...args) {
    return args.flat(Infinity).length;
}
