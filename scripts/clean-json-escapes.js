const fs = require('fs');
const path = require('path');

const root = process.cwd();
let fixed = 0;
let scanned = 0;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', '.simplebeacon', 'vscode-extension/out'].includes(e.name)) continue;
      walk(p);
    } else if (e.isFile() && p.endsWith('.json')) {
      scanned++;
      let s = fs.readFileSync(p, 'utf8');
      if (s.indexOf('\u001b') !== -1 || /\x1b\[.*?m/.test(s)) {
        const cleaned = s.replace(/\x1b\[[0-9;]*m/g, '');
        fs.writeFileSync(p, cleaned, 'utf8');
        console.log('Fixed', p);
        fixed++;
      }
    }
  }
}

try {
  walk(root);
  console.log(`Scanned ${scanned} JSON files, fixed ${fixed} files.`);
  process.exit(0);
} catch (err) {
  console.error('Error:', err);
  process.exit(2);
}
