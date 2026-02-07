// Example: { p: { "=isempty": [[]] } }
export default function (val) {
    if (Array.isArray(val)) return val.length === 0;
    if (val && typeof val === 'object') return Object.keys(val).length === 0;
    return !val;
}
