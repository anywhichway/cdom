// Example: { p: { "=replace": ["Hello World", "World", "Universe"] } }
export default function (val, searchValue, replaceValue) {
    return String(val).replace(searchValue, replaceValue);
}
