const fs = require('fs');
const script = fs.readFileSync('c:/Users/Trevor/CascadeProjects/_tmp_codemap_script2.js', 'utf8');
const lines = script.split('\n');

for (let n = 1; n <= 20; n++) {
  const test = lines.slice(0, n).join('\n');
  
  // Check for unclosed string literals
  let inString = false;
  let stringChar = null;
  let escape = false;
  for (let i = 0; i < test.length; i++) {
    const ch = test[i];
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
      }
    }
  }
  
  if (inString) {
    const lineNum = test.substring(0, test.lastIndexOf(stringChar === '`' ? '`' : stringChar) + 1).split('\n').length;
    console.log('Line count', n, ': UNCLOSED', stringChar, 'around line', lineNum);
    continue;
  }
  
  // Check for unclosed regex
  let inRegex = false;
  for (let i = 0; i < test.length; i++) {
    const ch = test[i];
    if (ch === '/' && !inRegex) {
      // Check if this looks like a regex start
      const prev = i > 0 ? test[i-1] : '';
      if (prev === '' || prev === '(' || prev === '=' || prev === ':' || prev === '[' || prev === '!' || prev === '&' || prev === '|') {
        inRegex = true;
      }
    } else if (ch === '\\' && inRegex) {
      i++; // skip escaped char
    } else if (ch === '/' && inRegex) {
      inRegex = false;
    } else if (ch === '\n' && inRegex) {
      const lineNum = test.substring(0, i).split('\n').length;
      console.log('Line count', n, ': UNCLOSED regex around line', lineNum);
      break;
    }
  }
  
  if (inRegex) {
    continue;
  }
  
  try {
    new Function(test);
    console.log('Line count', n, ': OK');
  } catch (e) {
    console.log('Line count', n, ': FAIL -', e.message);
  }
}
