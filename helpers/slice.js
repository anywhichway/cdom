export default function (val, start, end) {
    if (Array.isArray(val) || typeof val === 'string') {
        return val.slice(start, end);
    }
    return val;
}
