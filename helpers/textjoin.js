// Example: { p: { "=textjoin": [", ", true, "a", "b", "c"] } }
export default function (delimiter, ignore_empty, ...args) {
    const items = args.flat(Infinity).filter(item => !ignore_empty || (item !== null && item !== undefined && item !== ''));
    return items.join(delimiter);
}
