// Example: { p: { "=istext": ["Hello"] } }
export default function (val) {
    return typeof val === 'string';
}
