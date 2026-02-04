export default function (val, fn) {
    return Array.isArray(val) ? val.findIndex(fn) : -1;
}
