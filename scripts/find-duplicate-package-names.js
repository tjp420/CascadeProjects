const fs = require('fs');
const path = require('path');

function findPackageJsonFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // skip node_modules and .git
      if (e.name === 'node_modules' || e.name === '.git') continue;
      results.push(...findPackageJsonFiles(full));
    } else if (e.isFile() && e.name === 'package.json') {
      results.push(full);
    }
  }
  return results;
}

function main() {
  const root = process.cwd();
  const files = findPackageJsonFiles(root);
  const map = new Map();
  for (const f of files) {
    try {
      const txt = fs.readFileSync(f, 'utf8');
      const obj = JSON.parse(txt);
      const name = obj.name || '<no-name>';
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(f);
    } catch (err) {
      console.error('ERR', f, err.message);
    }
  }

  const duplicates = [];
  for (const [name, paths] of map.entries()) {
    if (paths.length > 1) duplicates.push({ name, paths });
  }

  if (duplicates.length === 0) {
    console.log('No duplicate package names found.');
    return;
  }

  console.log('Duplicate package.json names found:');
  for (const d of duplicates) {
    console.log('\nName:', d.name);
    for (const p of d.paths) console.log('  -', p);
  }
}

main();
