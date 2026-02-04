export default function (val, targetLength, padString) {
    return String(val).padEnd(targetLength, padString);
}
