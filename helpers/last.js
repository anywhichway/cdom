// Example: { p: { "=last": [[1, 2, 3]] } }
export default function (val) {
    return Array.isArray(val) ? val[val.length - 1] : val;
}
