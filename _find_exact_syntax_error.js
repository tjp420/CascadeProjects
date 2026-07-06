const vm = require('vm');
const fs = require('fs');
const script = fs.readFileSync('c:/Users/Trevor/CascadeProjects/_tmp_codemap_script2.js', 'utf8');

try {
  new vm.Script(script);
  console.log('Syntax OK');
} catch (e) {
  console.log('Error:', e.message);
  // Extract line and column from stack trace
  const match = e.stack.match(/:(\d+):(\d+)\)/);
  if (match) {
    const lineNum = parseInt(match[1]);
    const colNum = parseInt(match[2]);
    console.log('Line:', lineNum, 'Column:', colNum);
    const lines = script.split('\n');
    for (let i = Math.max(0, lineNum - 5); i < Math.min(lines.length, lineNum + 3); i++) {
      const marker = i === lineNum - 1 ? '>>> ' : '    ';
      console.log(marker + (i + 1) + ': ' + lines[i]);
    }
    // Show the exact character
    const line = lines[lineNum - 1];
    console.log('    ' + ' '.repeat(String(lineNum).length + 2 + colNum - 1) + '^');
  } else {
    console.log('No line/col info in stack');
    console.log(e.stack.substring(0, 500));
  }
}
