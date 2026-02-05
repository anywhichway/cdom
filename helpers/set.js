const set = function (target, val) {
    if (target && typeof target === 'object' && 'value' in target) {
        target.value = val;
    } else if (target && typeof target === 'function' && 'value' in target) {
        target.value = val;
    } else if (target && typeof target === 'object' && val && typeof val === 'object') {
        Object.assign(target, val);
    }
    return val;
}
set.mutates = true;
export default set;
