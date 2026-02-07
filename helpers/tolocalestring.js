// Example: { p: { "=tolocalestring": [1234567.89, "en-US"] } }
export default function (val, locales, options) {
    return Number(val).toLocaleString(locales, options);
}
