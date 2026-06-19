const fs = require('fs');
const path = require('path');

const PATTERNS = [
  { name: 'raw 1000', regex: /\b1000\b/ },
  { name: 'raw 3000', regex: /\b3000\b/ },
  { name: 'raw 5000', regex: /\b5000\b/ },
  { name: 'raw 60*1000', regex: /60\s*\*\s*1000/ },
  { name: 'raw 1024', regex: /\b1024\b/ },
  { name: 'raw 65536', regex: /\b65536\b/ },
];

function walk(dir, callback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue;
      walk(full, callback);
    } else if (/\.(js|cjs|mjs)$/.test(entry.name)) {
      callback(full);
    }
  }
}

const dirs = [
  'C:/Users/Trevor/CascadeProjects/packages/simplebeacon-cli/src',
  'C:/Users/Trevor/CascadeProjects/ai-platform/web/simplebeacon-dashboard/js',
];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const counts = {};
  for (const p of PATTERNS) counts[p.name] = 0;

  walk(dir, (file) => {
    const content = fs.readFileSync(file, 'utf8');
    for (const p of PATTERNS) {
      const matches = content.match(p.regex);
      if (matches) counts[p.name] += matches.length;
    }
  });

  console.log(`\n${path.relative('C:/Users/Trevor/CascadeProjects', dir)}:`);
  for (const [name, count] of Object.entries(counts)) {
    if (count > 0) console.log(`  ${name}: ${count}`);
  }
}
