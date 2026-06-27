const fs = require('fs');
const vm = require('vm');
const content = fs.readFileSync('out/modernSidebarProvider.js', 'utf8');

// Find the layoutHtml string - it's a template literal starting with `<!DOCTYPE html>
const startIdx = content.indexOf('const layoutHtml = `<!DOCTYPE html>');
if (startIdx === -1) {
  console.log('layoutHtml not found');
  process.exit(1);
}

// Find the end of the template literal
let depth = 0;
let endIdx = -1;
for (let i = startIdx + 'const layoutHtml = '.length; i < content.length; i++) {
  if (content[i] === '`') {
    if (depth === 0) {
      endIdx = i;
      break;
    } else {
      depth--;
    }
  } else if (content[i] === '$' && content[i+1] === '{') {
    // We need to skip nested template literals - but in the compiled JS, the layoutHtml
    // is a simple template literal without nested backticks (they are escaped)
  }
}

if (endIdx === -1) {
  console.log('Could not find end of layoutHtml');
  process.exit(1);
}

let html = content.slice(startIdx + 'const layoutHtml = '.length, endIdx + 1);
// Remove the backticks
html = html.slice(1, -1);

// Replace escaped backticks and newlines
html = html.replace(/\\`/g, '`').replace(/\\n/g, '\n');

// Find all script tags
const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
let match;
let scriptNum = 0;
let hasError = false;

while ((match = scriptRegex.exec(html)) !== null) {
  scriptNum++;
  const js = match[1];
  try {
    new vm.Script(js);
    console.log(`Script ${scriptNum}: OK (${js.length} chars)`);
  } catch (e) {
    hasError = true;
    console.log(`Script ${scriptNum}: ERROR - ${e.message}`);
    console.log('--- First 300 chars ---');
    console.log(js.slice(0, 300));
    console.log('-----------------------');
  }
}

if (!hasError) {
  console.log('All scripts parsed successfully');
}
