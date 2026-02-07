// Example: { p: { "=includes": [[1, 2, 3], 2] } }
export default function (val, search, position) {
    if (Array.isArray(val) || typeof val === 'string') {
        return val.includes(search, position);
    }
    return false;
}
