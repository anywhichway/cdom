// Example: { p: { "=unique": [[1, 2, 2, 3]] } }
export default function (val) {
    return Array.isArray(val) ? [...new Set(val)] : [val];
}
