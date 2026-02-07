// Example: { p: { "=mid": ["Hello", 2, 3] } }
export default function (text, start, length) {
    if (typeof text !== 'string') text = String(text);
    // Excel MID is 1-indexed, but since we are following JS names primarily,
    // the helper loader redirects MID to charat.js or substring.js?
    // Actually, MID(text, start, num_chars)
    // Let's implement MID specifically.
    const s = parseInt(start);
    const n = parseInt(length);
    return text.substring(s - 1, s - 1 + n);
}
