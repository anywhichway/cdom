export default function (val, fn) {
    if (!Array.isArray(val)) return [];
    return [...val].sort(fn);
}
