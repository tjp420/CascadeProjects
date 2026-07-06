const fs = require('fs');
const script = fs.readFileSync('c:/Users/Trevor/CascadeProjects/_tmp_codemap_script2.js', 'utf8');

// Check for unclosed string literals
let inString = false;
let stringChar = null;
let escape = false;
for (let i = 0; i < script.length; i++) {
  const ch = script[i];
  if (escape) {
    escape = false;
    continue;
  }
  if (ch === '\\') {
    escape = true;
    continue;
  }
  if (!inString) {
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
    }
  } else {
    if (ch === stringChar) {
      inString = false;
      stringChar = null;
    } else if (ch === '\n' && stringChar !== '`') {
      const lineNum = script.substring(0, i).split('\n').length;
      console.log('UNCLOSED', stringChar, 'at line', lineNum);
      console.log('Context:', script.substring(Math.max(0, i - 50), i + 30).replace(/\n/g, '\\n'));
      process.exit(1);
    }
  }
}

if (inString) {
  console.log('UNCLOSED', stringChar, 'at end of file');
}

// Check for regex literals with invalid flags
const re = /\/((?:\\[^\r\n]|[^\r\n\/\\])*)\/([gimsuvyd]*)/g;
let m;
while ((m = re.exec(script)) !== null) {
  const flags = m[2];
  const valid = 'gimsuvyd';
  const bad = [...flags].filter(c => !valid.includes(c));
  if (bad.length) {
    const lineNum = script.substring(0, m.index).split('\n').length;
    console.log('Line', lineNum, 'Invalid flags:', bad.join(''), 'in regex:', m[0].substring(0, 60));
  }
}

console.log('String check complete');
