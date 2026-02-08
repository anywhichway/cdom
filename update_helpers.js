const fs = require('fs');
const path = require('path');

const helpersDir = path.join(__dirname, 'helpers');
const files = fs.readdirSync(helpersDir);

const mathHelpers = ['abs', 'add', 'average', 'avg', 'ceil', 'ceiling', 'floor', 'int', 'max', 'median', 'min', 'mod', 'multiply', 'percent', 'pow', 'power', 'rand', 'random', 'round', 'sign', 'sqrt', 'stddev', 'stdev', 'subtract', 'sum', 'trunc', 'var', 'variance'];
const stringHelpers = ['concat', 'join', 'split', 'trim', 'upper', 'lower', 'proper', 'titlecase', 'tocamelcase', 'toslugcase', 'left', 'right', 'mid', 'len', 'length', 'slice', 'substring', 'replace', 'substitute', 'padend', 'padstart', 'startswith', 'endswith', 'includes', 'charat', 'text', 'textjoin', 'fixed'];
const logicHelpers = ['and', 'or', 'not', 'if', 'ifs', 'switch', 'choose', 'coalesce', 'iferror'];
const typeHelpers = ['isnumber', 'isstring', 'istext', 'isblank', 'isempty', 'isarray'];
const mutationHelpers = ['set', 'assign', 'increment', 'decrement', 'clear', 'toggle'];

files.forEach(file => {
    if (!file.endsWith('.js')) return;
    const filePath = path.join(helpersDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    const lines = content.split('\n');
    let firstLine = lines[0];

    // Remove old example if it exists
    if (firstLine.startsWith('// Example:')) {
        lines.shift();
        content = lines.join('\n');
    }

    const name = path.basename(file, '.js');
    const mutates = content.includes('.mutates = true');

    let example;
    if (mutationHelpers.includes(name) || mutates) {
        if (name === 'toggle') {
            example = '// Example: { onclick: { "=toggle": ["/user/isActive"] } }';
        } else if (name === 'set' || name === 'assign') {
            example = `// Example: { onclick: { "=${name}": ["/user/name", "Bob"] } }`;
        } else {
            example = `// Example: { onclick: { "=${name}": ["/counter/count", 1] } }`;
        }
    } else if (mathHelpers.includes(name)) {
        example = `// Example: { p: { "=${name}": [10, 20] } }`;
    } else if (stringHelpers.includes(name)) {
        if (name === 'upper' || name === 'lower') {
            example = `// Example: { span: { "=${name}": ["hello"] } }`;
        } else {
            example = `// Example: { span: { "=${name}": ["hello", "world"] } }`;
        }
    } else if (logicHelpers.includes(name)) {
        example = `// Example: { div: { "=${name}": [true, false] } }`;
    } else if (typeHelpers.includes(name)) {
        example = `// Example: { div: { "=${name}": [123] } }`;
    } else {
        example = `// Example: { p: { "=${name}": ["/state/path"] } }`;
    }

    const newContent = `${example}\n${content}`;
    fs.writeFileSync(filePath, newContent);
    console.log(`Updated ${file}`);
});
