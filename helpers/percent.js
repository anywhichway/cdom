export default function (val, decimals = 0) {
    const num = Number(val);
    return isNaN(num) ? '0%' : (num * 100).toFixed(decimals) + '%';
}
