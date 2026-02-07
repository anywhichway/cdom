// Example: { p: { "=endswith": ["/state/path1", "/state/path2"] } }
export default function (val, search, length) {
    return String(val).endsWith(search, length);
}
