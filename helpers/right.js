// Example: { p: { "=right": ["Hello World", 5] } }
export default function (text, num_chars = 1) {
    if (typeof text !== 'string') text = String(text);
    return text.substring(text.length - num_chars);
}
