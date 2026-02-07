// Example: { p: { "=find": [[1, 2, 3], Boolean] } }
export default function (val, fn) {
    return Array.isArray(val) ? val.find(fn) : undefined;
}
