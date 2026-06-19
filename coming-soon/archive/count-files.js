/**
 * count-files.js
 * Recursively counts all files in a directory tree.
 * Excludes node_modules, .git, and other common noise directories.
 */

const fs = require('fs');
const path = require('path');

const TARGET_DIR = process.argv[2] || path.join(__dirname, '..');

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git'
]);

function walk(dir) {
  let files = 0;
  let dirs = 0;
  let byExt = {};
  let largest = { path: '', size: 0 };
  let totalSize = 0;

  function recurse(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDE_DIRS.has(entry.name)) continue;
        dirs++;
        recurse(full);
      } else {
        files++;
        const ext = path.extname(entry.name).toLowerCase() || '(no ext)';
        byExt[ext] = (byExt[ext] || 0) + 1;
        const size = fs.statSync(full).size;
        totalSize += size;
        if (size > largest.size) {
          largest = { path: path.relative(TARGET_DIR, full).replace(/\\/g, '/'), size };
        }
      }
    }
  }

  recurse(dir);
  return { files, dirs, byExt, largest, totalSize };
}

console.log(`Scanning: ${TARGET_DIR}`);
console.log('');

const result = walk(TARGET_DIR);

console.log(`Total files:   ${result.files.toLocaleString()}`);
console.log(`Total folders: ${result.dirs.toLocaleString()}`);
console.log(`Total size:    ${(result.totalSize / 1024 / 1024).toFixed(2)} MB`);
console.log('');
console.log('Largest file:');
console.log(`  ${result.largest.path}`);
console.log(`  ${(result.largest.size / 1024).toFixed(1)} KB`);
console.log('');
console.log('Files by extension (top 20):');
Object.entries(result.byExt)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .forEach(([ext, count]) => {
    console.log(`  ${ext.padEnd(12)} ${count.toLocaleString().padStart(6)}`);
  });
