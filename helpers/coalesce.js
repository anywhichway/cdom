// Example: { p: { "=coalesce": [null, undefined, "Fallback"] } }
export default function (...args) {
    for (const arg of args) {
        if (arg !== null && arg !== undefined) return arg;
    }
    return undefined;
}
