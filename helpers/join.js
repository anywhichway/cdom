export default function (val, separator = ',') {
    return Array.isArray(val) ? val.join(separator) : String(val);
}
