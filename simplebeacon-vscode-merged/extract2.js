const fs = require('fs');
const content = fs.readFileSync('c:/Users/Trevor/CascadeProjects/simplebeacon-vscode-merged/out/modernSidebarProvider.js', 'utf8');

const startMarker = 'const layoutHtml = `';
const startIdx = content.indexOf(startMarker);
if (startIdx === -1) {
  console.log('Start not found');
  process.exit(1);
}

const templateStart = startIdx + startMarker.length;
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
  
  if (!inString && ch === '`' && depth === 0) {
    break;
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
  
  if (!inString && (ch === '"' || ch === "'" || ch === '`')) {
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
const lines = layoutHtml.split('\n');

// Check each line inside <script> blocks for multi-line strings
let inScript = false;
let prevLineOddQuotes = false;
for (let j = 0; j < lines.length; j++) {
  const line = lines[j];
  if (line.includes('<script>') || line.includes('<script ')) {
    inScript = true;
    continue;
  }
  if (line.includes('</script>')) {
    inScript = false;
    continue;
  }
  if (!inScript) continue;

  let quoteCount = 0;
  for (let k = 0; k < line.length; k++) {
    if (line[k] === "'" && (k === 0 || line[k-1] !== '\\')) {
      quoteCount++;
    }
  }

  if (prevLineOddQuotes) {
    console.log('MULTI-LINE at HTML line', j + 1, ':');
    console.log('  PREV:', lines[j-1].substring(0, 200));
    console.log('  THIS:', line.substring(0, 200));
  }
  prevLineOddQuotes = (quoteCount % 2 !== 0);
}

console.log('Total lines:', lines.length);
fs.writeFileSync('c:/Users/Trevor/CascadeProjects/simplebeacon-vscode-merged/extracted.html', layoutHtml);
console.log('Saved to extracted.html');
