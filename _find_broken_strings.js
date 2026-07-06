const fs = require('fs');
const h = fs.readFileSync('c:/Users/Trevor/CascadeProjects/.simplebeacon/codemap.html', 'utf8');
const m = h.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
if (!m) { console.log('no script'); process.exit(1); }
const lines = m[1].split('\n');
let inString = false;
let stringChar = null;
let startLine = 0;
let issues = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    const prev = j > 0 ? line[j-1] : null;
    if (!inString && (ch === "'" || ch === '"' || ch === '`')) {
      inString = true;
      stringChar = ch;
      startLine = i + 1;
    } else if (inString && ch === stringChar && prev !== '\\') {
      inString = false;
    }
  }
  if (inString) {
    issues.push(`Line ${startLine}: unterminated ${stringChar} string continues to line ${i + 1}`);
    inString = false;
  }
}

if (issues.length) {
  console.log('Found ' + issues.length + ' broken string(s):');
  issues.forEach(issue => console.log('  ' + issue));
  process.exit(1);
} else {
  console.log('No broken strings found');
}
