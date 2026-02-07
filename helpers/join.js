// Example: { p: { "=join": [[1, 2, 3], "-"] } }
export default function (val, separator = ',') {
    return Array.isArray(val) ? val.join(separator) : String(val);
}
