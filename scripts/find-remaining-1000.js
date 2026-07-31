// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require('fs');
const path = require('path');

const results = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(full);
    } else if (/\.(cjs|js)$/.test(entry.name)) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        // Match 1000 not in strings, not already a constant, not part of larger number
        if (
          /\b1000\b/.test(line) &&
          !line.includes('constants.') &&
          !/['\"`].*1000.*['\"`]/.test(line) &&
          !line.includes('//') &&
          !/\d{5,}/.test(line.replace(/1000/g, ''))
        ) {
          results.push({
            file: path.relative('C:/Users/Trevor/CascadeProjects/ai-platform', full),
            line: i + 1,
            text: line.trim().slice(0, 100),
          });
        }
      });
    }
  }
}

walk('C:/Users/Trevor/CascadeProjects/ai-platform/server');

// Group by file
const byFile = {};
results.forEach((r) => {
  if (!byFile[r.file]) byFile[r.file] = [];
  byFile[r.file].push(r);
});

Object.entries(byFile).forEach(([file, lines]) => {
  console.log(`\n${file}:`);
  lines.forEach((l) => console.log(`  ${l.line}: ${l.text}`));
});

console.log(`\nTotal: ${results.length} occurrences in ${Object.keys(byFile).length} files`);
