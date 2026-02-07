// Example: { p: { "=every": [[true, true], Boolean] } }
export default function (val, fn) {
    return Array.isArray(val) ? val.every(fn) : false;
}
