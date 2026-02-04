export default function (val, locale = 'en-US', currency = 'USD') {
    const num = Number(val);
    return isNaN(num) ? (0).toLocaleString(locale, { style: 'currency', currency }) : num.toLocaleString(locale, { style: 'currency', currency });
}
