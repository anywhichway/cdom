// Example: { p: { "=keys": [{"a": 1, "b": 2}] } }
export default function (val) {
    return (val && typeof val === 'object') ? Object.keys(val) : [];
}
