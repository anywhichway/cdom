// Example: { p: { "=padend": ["hello", 10, "."] } }
export default function (val, targetLength, padString) {
    return String(val).padEnd(targetLength, padString);
}
