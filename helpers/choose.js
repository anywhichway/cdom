// Example: { p: { "=choose": [2, "A", "B", "C"] } }
export default function (index, ...args) {
    const i = parseInt(index);
    return args[i - 1];
}
