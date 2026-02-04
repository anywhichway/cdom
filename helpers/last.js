export default function (val) {
    return Array.isArray(val) ? val[val.length - 1] : val;
}
