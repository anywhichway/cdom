// Example: { onclick: { "=clear": ["/form/data"] } }
import set from './set.js';
const clear = function (target) {
    const current = (target && typeof target === 'object' && 'value' in target) ? target.value : null;
    if (Array.isArray(current)) return set(target, []);
    if (typeof current === 'object' && current !== null) return set(target, {});
    return set(target, null);
}
clear.mutates = true;
export default clear;
