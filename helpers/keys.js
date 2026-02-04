export default function (val) {
    return (val && typeof val === 'object') ? Object.keys(val) : [];
}
