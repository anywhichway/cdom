// Example: { p: { "=startswith": ["Hello World", "Hell"] } }
export default function (val, search, position) {
    return String(val).startsWith(search, position);
}
