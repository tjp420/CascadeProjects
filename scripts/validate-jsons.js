const fs = require('fs');
const path = require('path');

const root = process.cwd();
const errors = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    try {
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        if (['node_modules', '.git', '.simplebeacon', 'vscode-extension/out'].includes(name)) continue;
        walk(p);
      } else if (st.isFile() && p.endsWith('.json')) {
        try {
          const s = fs.readFileSync(p, 'utf8');
          JSON.parse(s);
        } catch (e) {
          errors.push({file: p, message: e.message});
        }
      }
    } catch (err) {
      // ignore
    }
  }
}

walk(root);
if (errors.length === 0) {
  console.log('No invalid JSON files found');
  process.exit(0);
}
console.log('Invalid JSON files:');
for (const e of errors) console.log(e.file + ': ' + e.message);
process.exit(1);
