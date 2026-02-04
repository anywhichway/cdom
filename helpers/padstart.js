export default function (val, targetLength, padString) {
    return String(val).padStart(targetLength, padString);
}
