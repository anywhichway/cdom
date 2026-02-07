// Example: { p: { "=substring": ["Hello World", 0, 5] } }
export default function (val, start, end) {
    return String(val).substring(start, end);
}
