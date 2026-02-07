// Example: { p: { "=if": [true, "Yes", "No"] } }
export default function (condition, thenVal, elseVal) {
    return condition ? thenVal : elseVal;
}
