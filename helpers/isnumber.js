// Example: { p: { "=isnumber": [123] } }
export default function (val) {
    return typeof val === 'number' && !isNaN(val);
}
