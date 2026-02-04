import set from './set.js';
export default function (target) {
    const current = (target && typeof target === 'object' && 'value' in target) ? target.value : null;
    if (Array.isArray(current)) return set(target, []);
    if (typeof current === 'object' && current !== null) return set(target, {});
    return set(target, null);
}
