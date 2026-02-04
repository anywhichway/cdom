export default function (val, depth = 1) {
    return Array.isArray(val) ? val.flat(depth) : [val];
}
