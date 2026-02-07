// Example: { onclick: { "=increment": ["/counter/count", 1] } }
import set from './set.js';
const increment = function (target, by = 1) {
    const hasValue = target && (typeof target === 'object' || typeof target === 'function') && 'value' in target;
    const current = hasValue ? target.value : 0;
    const next = Number(current) + Number(by);
    return set(target, next);
}
increment.mutates = true;
export default increment;
