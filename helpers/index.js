export default function (val, idx) {
    if (Array.isArray(val)) return val[idx];
    if (val && typeof val === 'object') return val[idx];
    return undefined;
}
