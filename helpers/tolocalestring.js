export default function (val, locales, options) {
    return Number(val).toLocaleString(locales, options);
}
