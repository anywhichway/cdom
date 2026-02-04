export default function (val, fn) {
    return Array.isArray(val) ? val.find(fn) : undefined;
}
