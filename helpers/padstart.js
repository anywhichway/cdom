// Example: { p: { "=padstart": ["hello", 10, "."] } }
export default function (val, targetLength, padString) {
    return String(val).padStart(targetLength, padString);
}
