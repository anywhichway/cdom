const fs = require('fs');
const path = require('path');

/**
 * Simple build script for cDOM
 * - Cleans the dist folder
 * - Copies index.js as both index.js and cdom.js
 * - Copies helpers and examples directories
 * - Copies core documentation files
 */

const dist = path.join(__dirname, 'dist');

console.log('Starting build...');

// 1. Clean and create dist directory
// 1. Clean and create dist directory
if (!fs.existsSync(dist)) {
    fs.mkdirSync(dist);
} else {
    console.log('Cleaning existing dist folder...');
    try {
        // Try to clear contents instead of removing directory itself to avoid EBUSY on folder lock
        const files = fs.readdirSync(dist);
        for (const file of files) {
            try {
                fs.rmSync(path.join(dist, file), { recursive: true, force: true });
            } catch (e) {
                console.warn(`Warning: Could not delete ${file}: ${e.message}`);
            }
        }
    } catch (e) {
        console.warn(`Warning: Could not clean dist folder: ${e.message}. Attempting to overwrite...`);
    }
}

// 2. Helper function to copy directories recursively
function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// 3. Copy Assets
console.log('Copying helpers...');
copyDir(path.join(__dirname, 'helpers'), path.join(dist, 'helpers'));

console.log('Copying examples...');
copyDir(path.join(__dirname, 'examples'), path.join(dist, 'examples'));

// 4. Copy and Rename Core Library
console.log('Processing core library...');
const indexContent = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

// Write both as index.js (for example compatibility) and cdom.js (for distribution)
fs.writeFileSync(path.join(dist, 'index.js'), indexContent);
fs.writeFileSync(path.join(dist, 'cdom.js'), indexContent);

// 5. Copy Base Files
const baseFiles = ['README.md', 'LICENSE', 'package.json', 'wrangler.toml'];
baseFiles.forEach(file => {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) {
        console.log(`Copying ${file}...`);
        fs.copyFileSync(src, path.join(dist, file));
    }
});

console.log('\nBuild completed successfully!');
console.log('Distribution files are ready in the ./dist directory.');
