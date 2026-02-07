// Example: { onclick: { "=toggle": ["/user/isActive"] } }
import set from './set.js';
const toggle = function (target) {
    const hasValue = target && (typeof target === 'object' || typeof target === 'function') && 'value' in target;
    const current = hasValue ? target.value : false;
    return set(target, !current);
}
toggle.mutates = true;
export default toggle;
