export default function (expression, ...args) {
    for (let i = 0; i < args.length - 1; i += 2) {
        if (expression === args[i]) return args[i + 1];
    }
    return args.length % 2 === 1 ? args[args.length - 1] : undefined;
}
