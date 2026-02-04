export default function (val) {
    return typeof val === 'number' && !isNaN(val);
}
