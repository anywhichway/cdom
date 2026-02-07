// Example: { p: { "=toslugcase": ["Hello World!"] } }
export default function (val) {
    return String(val)
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
