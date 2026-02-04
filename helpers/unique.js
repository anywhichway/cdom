export default function (val) {
    return Array.isArray(val) ? [...new Set(val)] : [val];
}
