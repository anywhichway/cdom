// Example: { p: { "=object": ["{\"key\": \"value\"}"] } }
import parseLiteral from './parseLiteral.js';

export default function object(jsonString) {
    if (typeof jsonString === 'object') return jsonString;
    if (typeof jsonString !== 'string') return {};

    // 1. Try strict JSON parse first (fastest)
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        // 2. Fallback to safe literal parser
        try {
            return parseLiteral(jsonString);
        } catch (e2) {
            console.error('[cDOM] object() helper failed to parse:', jsonString, e2);
            return {};
        }
    }
}
