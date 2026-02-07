// Example: { p: { "=flat": [[[1, 2], [3, 4]]] } }
export default function (val, depth = 1) {
    return Array.isArray(val) ? val.flat(depth) : [val];
}
