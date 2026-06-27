const fs = require('fs');
const content = fs.readFileSync('c:/Users/Trevor/CascadeProjects/simplebeacon-vscode-merged/out/modernSidebarProvider.js', 'utf8');

const startIdx = content.indexOf('const layoutHtml = `');
if (startIdx === -1) {
  console.log('Start not found');
  process.exit(1);
}

const templateStart = startIdx + 'const layoutHtml = '.length;
let depth = 0;
let i = templateStart;
let inString = false;
let stringChar = null;
let escapeNext = false;

while (i < content.length) {
  const ch = content[i];
  
  if (escapeNext) {
    escapeNext = false;
    i++;
    continue;
  }
  
  if (ch === '\\') {
    escapeNext = true;
    i++;
    continue;
  }
  
  if (!inString && ch === '\`') {
    // Check if this is inside ${} interpolation
    if (depth === 0) {
      break; // Found closing backtick
    }
  }
  
  if (!inString && ch === '$' && content[i+1] === '{') {
    depth++;
    i += 2;
    continue;
  }
  
  if (!inString && ch === '}') {
    depth--;
    i++;
    continue;
  }
  
  if (!inString && (ch === '"' || ch === "'" || ch === '\`')) {
    inString = true;
    stringChar = ch;
    i++;
    continue;
  }
  
  if (inString && ch === stringChar) {
    inString = false;
    stringChar = null;
    i++;
    continue;
  }
  
  i++;
}

const layoutHtml = content.substring(templateStart, i);
fs.writeFileSync('c:/Users/Trevor/CascadeProjects/simplebeacon-vscode-merged/extracted-layout.html', layoutHtml);
console.log('Extracted', layoutHtml.length, 'chars to extracted-layout.html');
console.log('Closing backtick at position', i);
