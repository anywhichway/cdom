const fs = require('fs');
const path = 'c:/Users/Owner/AntigravityProjects/cdom/index.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Truncate at the first })();
const endMarker = '})();';
const firstEndIndex = content.indexOf(endMarker);
if (firstEndIndex !== -1) {
    content = content.substring(0, firstEndIndex + endMarker.length);
}

// 2. Fix the broken helpers.set lines (661-667 area)
// The view showed 666: helpers.set('
// It seems it missed the rest of that block.

const targetBroken = /helpers\.set\('_', function\(\.\.\.args\) \{[\s\S]*?helpers\.set\('[\s\S]*?\/\/ Transformation Helpers/m;

const replacementFixed = `helpers.set('_', function(...args) {
        const expr = args[0];
        const ctx = currentSubscriber?.contextNode || args[1] || this;
        return _(expr, ctx);
    });
    helpers.set('$', function(...args) {
        const expr = args[0];
        const ctx = currentSubscriber?.contextNode || args[1] || this;
        return $(expr, ctx);
    });

    // Transformation Helpers`;

if (content.match(targetBroken)) {
    content = content.replace(targetBroken, replacementFixed);
} else {
    // Try a simpler match for the specific broken line
    content = content.replace(/helpers\.set\('\s*\n\s*\n\s*\/\/ Transformation Helpers/, replacementFixed.replace("helpers.set('_', function(...args) {\n        const expr = args[0];\n        const ctx = currentSubscriber?.contextNode || args[1] || this;\n        return _(expr, ctx);\n    });\n    ", ""));
}

// 3. Ensure resolveArg fixes were actually applied correctly
if (!content.includes("if (arg === '$this') return context;")) {
    const resolveArgStart = `const resolveArg = (arg) => {
                if (arg && typeof arg === 'object' && !Array.isArray(arg)) {`;
    const resolveArgNew = `const resolveArg = (arg) => {
                if (arg === '$this') return context;
                if (arg === '$event') return undefined;
                if (arg && typeof arg === 'object' && !Array.isArray(arg)) {`;
    content = content.replace(resolveArgStart, resolveArgNew);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Restored index.js and fixed syntax errors.');
