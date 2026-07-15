// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require('fs');
const script = fs.readFileSync('c:/Users/Trevor/CascadeProjects/_tmp_codemap_script2.js', 'utf8');

// Check for unclosed string literals, properly handling regex literals
let inString = false;
let stringChar = null;
let escape = false;
let inRegex = false;
let regexEscape = false;

for (let i = 0; i < script.length; i++) {
  const ch = script[i];
  const prev = i > 0 ? script[i - 1] : '';

  if (inRegex) {
    if (regexEscape) {
      regexEscape = false;
      continue;
    }
    if (ch === '\\') {
      regexEscape = true;
      continue;
    }
    if (ch === '/') {
      inRegex = false;
      continue;
    }
    if (ch === '\n') {
      const lineNum = script.substring(0, i).split('\n').length;
      console.log('UNCLOSED regex at line', lineNum);
      console.log('Context:', script.substring(Math.max(0, i - 50), i + 30).replace(/\n/g, '\\n'));
      process.exit(1);
    }
    continue;
  }

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
    } else if (ch === '/' && !inRegex) {
      // Check if this starts a regex literal
      // Regex literals typically appear after: =, (, [, {, ,, ;, :, !, &, |, +, -, *, /, %, <, >, ~, ^, ?, return, throw, delete, typeof, void, in, instanceof, of, do, else, case, yield, await
      const regexContexts = ['=', '(', '[', '{', ',', ';', ':', '!', '&', '|', '+', '-', '*', '/', '%', '<', '>', '~', '^', '?', ' ', '\n', '\t'];
      if (regexContexts.includes(prev)) {
        inRegex = true;
      }
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

console.log('String/regex check complete');
