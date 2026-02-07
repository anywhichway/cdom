// Example: { p: { "=first": [[1, 2, 3]] } }
export default function (val) {
    return Array.isArray(val) ? val[0] : val;
}
