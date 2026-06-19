const fs = require('fs');
const path = require('path');

const REPO_ROOT = 'C:/Users/Trevor/CascadeProjects';
const EXCLUDES = ['node_modules', '.git', 'coverage', 'dist', 'build'];

function shouldSkip(dir) {
  return EXCLUDES.includes(path.basename(dir));
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkip(fullPath)) walk(fullPath, files);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.cjs')) {
      files.push(fullPath);
    }
  }
  return files;
}

const constantsFile = path.join(REPO_ROOT, 'ai-platform/server/config/constants.cjs');

for (const file of walk(REPO_ROOT)) {
  const content = fs.readFileSync(file, 'utf8');
  const matches = [...content.matchAll(/require\(['"]([^'"]*constants\.cjs)['"]\)/g)];
  if (!matches.length) continue;

  const fileDir = path.dirname(file);
  for (const m of matches) {
    const reqPath = m[1];
    let resolved;
    if (reqPath.startsWith('.')) {
      resolved = path.resolve(fileDir, reqPath);
    } else {
      resolved = path.join(REPO_ROOT, reqPath);
    }

    const exists = fs.existsSync(resolved);
    const relFile = path.relative(REPO_ROOT, file);
    if (!exists) {
      console.log(`BROKEN: ${relFile}`);
      console.log(`  requires: ${reqPath}`);
      console.log(`  resolves to: ${path.relative(REPO_ROOT, resolved)} (NOT FOUND)`);
      console.log('');
    }
  }
}
