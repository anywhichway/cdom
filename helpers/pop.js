import set from './set.js';
export default function (target) {
    const current = (target && typeof target === 'object' && 'value' in target) ? target.value : [];
    if (Array.isArray(current) && current.length > 0) {
        const next = current.slice(0, -1);
        set(target, next);
    }
    return current;
}
