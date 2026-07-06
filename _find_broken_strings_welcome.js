const fs = require('fs');
const f = 'c:/Users/Trevor/CascadeProjects/simplebeacon-vscode-merged/src/welcomeDashboardHtml.ts';
const s = fs.readFileSync(f, 'utf8');

// Find all <script> sections
const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
let match;
let foundAny = false;

while ((match = scriptRegex.exec(s)) !== null) {
  const js = match[1];
  const lines = js.split('\n');
  let inString = false;
  let stringChar = null;
  let startLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      const prev = j > 0 ? line[j-1] : null;

      if (!inString) {
        if (ch === "'" || ch === '"' || ch === '`') {
          inString = true;
          stringChar = ch;
          startLine = i;
        }
      } else {
        if (ch === stringChar && prev !== '\\') {
          inString = false;
          stringChar = null;
        }
      }
    }

    if (inString) {
      console.log(`Broken string at line ${match.index + lines.slice(0, i+1).join('\n').length - line.length + 1}: starts around script line ${startLine+1}`);
      console.log('  Start context:', lines[startLine].trim());
      console.log('  Current line:', line.trim());
      foundAny = true;
      inString = false;
      stringChar = null;
    }
  }
}

if (!foundAny) {
  console.log('No broken strings found in script tags');
}
