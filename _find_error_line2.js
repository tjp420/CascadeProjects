const fs = require('fs');
const script = fs.readFileSync('c:/Users/Trevor/CascadeProjects/_tmp_codemap_script2.js', 'utf8');
const lines = script.split('\n');

// Find exact line with syntax error
let low = 0, high = lines.length;
while (high - low > 1) {
  const mid = Math.floor((low + high) / 2);
  const test = lines.slice(0, mid).join('\n');
  try {
    new Function(test);
    low = mid;
  } catch (e) {
    high = mid;
  }
}

console.log('Syntax error between lines', low + 1, 'and', high);
for (let i = Math.max(0, low - 3); i < Math.min(lines.length, high + 3); i++) {
  const marker = i === low ? '>>> ' : '    ';
  console.log(marker + (i + 1) + ': ' + lines[i].substring(0, 120));
}
