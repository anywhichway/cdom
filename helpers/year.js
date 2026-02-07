// Example: { p: { "=year": ["2023-05-01"] } }
export default function (val) {
    return new Date(val).getFullYear();
}
