export default function (val) {
    if (!Array.isArray(val)) return [];
    return [...val].reverse();
}
