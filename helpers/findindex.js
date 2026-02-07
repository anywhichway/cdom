// Example: { p: { "=findindex": [[1, 2, 3], Boolean] } }
export default function (val, fn) {
    return Array.isArray(val) ? val.findIndex(fn) : -1;
}
