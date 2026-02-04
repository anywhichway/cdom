export default function (val) {
    return String(val).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
