// Example: { p: { "=reverse": [[1, 2, 3]] } }
export default function (val) {
    if (!Array.isArray(val)) return [];
    return [...val].reverse();
}
