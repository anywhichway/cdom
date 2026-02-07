// Example: { p: { "=stddev": [[1, 2, 3, 4, 5]] } }
import variance from './variance.js';
export default function (...args) {
    return Math.sqrt(variance(...args));
}
