export default function (val, fn) {
    return Array.isArray(val) ? val.some(fn) : false;
}
