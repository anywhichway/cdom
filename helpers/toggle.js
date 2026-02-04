import set from './set.js';
export default function (target) {
    const hasValue = target && (typeof target === 'object' || typeof target === 'function') && 'value' in target;
    const current = hasValue ? target.value : false;
    return set(target, !current);
}
