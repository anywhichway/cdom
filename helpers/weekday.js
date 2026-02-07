// Example: { p: { "=weekday": ["2023-05-01"] } }
export default function (val) {
    return new Date(val).getDay();
}
