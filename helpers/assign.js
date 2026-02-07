// Example: { onclick: { "=assign": ["/user", { "name": "Bob", "age": 30 }] } }
import set from './set.js';
const assign = function (target, obj) {
    const current = (target && typeof target === 'object' && 'value' in target) ? target.value : {};
    const next = { ...current, ...obj };
    return set(target, next);
}
assign.mutates = true;
export default assign;
