import set from './set.js';
export default function (target, obj) {
    const current = (target && typeof target === 'object' && 'value' in target) ? target.value : {};
    const next = { ...current, ...obj };
    return set(target, next);
}
