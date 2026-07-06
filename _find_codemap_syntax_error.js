const fs = require('fs');
const f = 'c:/Users/Trevor/CascadeProjects/.simplebeacon/codemap.html';
const s = fs.readFileSync(f, 'utf8');

const scripts = [];
let m;
const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
while ((m = re.exec(s)) !== null) {
  scripts.push(m[1]);
}

scripts.forEach((js, i) => {
  try {
    new Function(js);
    console.log('Script', i + 1, 'OK');
  } catch (e) {
    console.log('Script', i + 1, 'ERROR:', e.message);
    // Try to find the line
    const match = e.stack?.match(/:(\d+):\d+/);
    const lineNum = match ? parseInt(match[1]) : 0;
    const lines = js.split('\n');
    if (lineNum > 0) {
      const start = Math.max(0, lineNum - 5);
      for (let j = start; j < Math.min(lines.length, lineNum + 3); j++) {
        const marker = j === lineNum - 1 ? '>>> ' : '    ';
        console.log(marker + (j + 1) + ': ' + lines[j].substring(0, 200));
      }
    } else {
      // No line number - show first 20 lines
      for (let j = 0; j < Math.min(20, lines.length); j++) {
        console.log('    ' + (j + 1) + ': ' + lines[j].substring(0, 200));
      }
    }
  }
});
