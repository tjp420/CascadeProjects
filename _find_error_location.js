const fs = require('fs');
const script = fs.readFileSync('c:/Users/Trevor/CascadeProjects/_tmp_codemap_script.js', 'utf8');
const lines = script.split('\n');

// Binary search for the syntax error line
let good = 0;
let bad = lines.length;

while (bad - good > 1) {
  const mid = Math.floor((good + bad) / 2);
  const testCode = lines.slice(0, mid).join('\n');
  try {
    new Function(testCode);
    good = mid;
  } catch (e) {
    bad = mid;
  }
}

console.log('Error around line:', bad);
for (let i = Math.max(0, bad - 5); i < Math.min(lines.length, bad + 3); i++) {
  const marker = i === bad - 1 ? '>>> ' : '    ';
  console.log(marker + (i + 1) + ': ' + lines[i].substring(0, 120));
}
