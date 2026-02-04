import set from './set.js';
export default function (target, item) {
    const current = (target && typeof target === 'object' && 'value' in target) ? target.value : [];
    if (Array.isArray(current)) {
        const next = [...current, item];
        return set(target, next);
    }
    return current;
}
