export default function (val, fn) {
    return Array.isArray(val) ? val.filter(fn) : [];
}
