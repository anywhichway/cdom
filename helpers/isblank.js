// Example: { p: { "=isblank": [null] } }
export default function (val) {
    return val === null || val === undefined || val === '';
}
