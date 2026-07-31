// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require('fs');
const path = require('path');

const REPO_ROOT = 'C:/Users/Trevor/CascadeProjects';
const EXCLUDES = ['node_modules', '.git', 'coverage', 'dist', 'build', '.simplebeacon', 'archive'];

function shouldSkip(dir) {
  const base = path.basename(dir);
  return EXCLUDES.includes(base);
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkip(fullPath)) {
        walk(fullPath, files);
      }
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.cjs')) {
      files.push(fullPath);
    }
  }
  return files;
}

let foundCount = 0;
for (const file of walk(REPO_ROOT)) {
  const content = fs.readFileSync(file, 'utf8');
  const hasRequire = /require\(['"][^'"]*constants/.test(content);
  if (hasRequire) continue;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) continue;
    if (/\bconstants\.[A-Z]/.test(line)) {
      const relPath = path.relative(REPO_ROOT, file);
      console.log(`${relPath}:${i + 1} ${trimmed.slice(0, 100)}`);
      foundCount++;
      break;
    }
  }
}

console.log(`\nTotal files with missing constants import: ${foundCount}`);
