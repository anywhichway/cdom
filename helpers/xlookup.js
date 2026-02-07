// Example: { p: { "=xlookup": [1, [1, 2, 3], ["A", "B", "C"]] } }
export default function (lookup_val, lookup_array, return_array, if_not_found = undefined) {
    if (!Array.isArray(lookup_array) || !Array.isArray(return_array)) return if_not_found;
    const idx = lookup_array.indexOf(lookup_val);
    return idx !== -1 ? return_array[idx] : if_not_found;
}
