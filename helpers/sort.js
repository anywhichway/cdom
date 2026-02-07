// Example: { p: { "=sort": [[3, 1, 2]] } }
export default function (val, fn) {
    if (!Array.isArray(val)) return [];
    return [...val].sort(fn);
}
