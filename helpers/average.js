import sum from './sum.js';
export default function (...args) {
    const flat = args.flat(Infinity);
    return flat.length === 0 ? 0 : sum(...flat) / flat.length;
}
