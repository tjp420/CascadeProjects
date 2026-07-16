// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
const fs = require('fs');
const path = require('path');

// Load the compiled module and generate HTML
const compiledPath = path.join(__dirname, 'out', 'welcomeDashboardHtml.js');
const moduleCode = fs.readFileSync(compiledPath, 'utf8');
const moduleExports = {};
const moduleFunc = new Function('exports', moduleCode);
moduleFunc(moduleExports);

const buildDashboardHtml = moduleExports.buildDashboardHtml;
const html = buildDashboardHtml({
  cspSource: "default-src 'self'",
  nonce: 'testnonce123456',
  version: 'test',
  showWelcome: true
});

const lines = html.split('\n');

// Find the script content
let inScript = false;
let scriptStartLine = -1;
let scriptLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('<script') && !inScript) {
    inScript = true;
    scriptStartLine = i;
    continue;
  }
  if (line.includes('</script>') && inScript) {
    inScript = false;
    break;
  }
  if (inScript) {
    scriptLines.push(line);
  }
}

console.log('Script starts at line:', scriptStartLine + 1);
console.log('Script lines:', scriptLines.length);

// Check for potential issues
const issues = [];

// 1. Check for unclosed strings in if conditions
for (let i = 0; i < scriptLines.length; i++) {
  const line = scriptLines[i];
  if (line.includes('if (')) {
    // Find the if condition and check for balanced parens
    let balance = 0;
    let inString = false;
    let stringChar = null;
    let escapeNext = false;
    let foundIf = false;
    
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (escapeNext) { escapeNext = false; continue; }
      if (ch === '\\') { escapeNext = true; continue; }
      if (inString) {
        if (ch === stringChar) inString = false;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
        continue;
      }
      if (ch === '(') {
        if (!foundIf && line.substring(Math.max(0, j-3), j+1).includes('if (')) {
          foundIf = true;
        }
        if (foundIf) balance++;
      }
      if (ch === ')' && foundIf) {
        balance--;
        if (balance === 0) break;
      }
    }
    
    if (foundIf && balance !== 0) {
      issues.push({ type: 'unclosed-if', line: i + 1, text: line.substring(0, 100) });
    }
    
    // Check for strings that might contain ) and not be closed
    const ifPart = line.substring(line.indexOf('if ('));
    const stringMatches = ifPart.match(/["']/g);
    if (stringMatches) {
      let stringCount = 0;
      let lastStringChar = null;
      let inStr = false;
      for (let j = 0; j < ifPart.length; j++) {
        const ch = ifPart[j];
        if (ch === '"' || ch === "'") {
          if (!inStr) {
            inStr = true;
            lastStringChar = ch;
            stringCount++;
          } else if (lastStringChar === ch) {
            inStr = false;
            stringCount++;
          }
        }
      }
      if (stringCount % 2 !== 0) {
        issues.push({ type: 'unclosed-string-in-if', line: i + 1, text: line.substring(0, 100) });
      }
    }
  }
}

// 2. Check for regex issues
for (let i = 0; i < scriptLines.length; i++) {
  const line = scriptLines[i];
  const regexMatches = line.match(/\/[^/]+\//g);
  if (regexMatches) {
    for (const regex of regexMatches) {
      try {
        new RegExp(regex.slice(1, -1));
      } catch (e) {
        issues.push({ type: 'invalid-regex', line: i + 1, text: regex, error: e.message });
      }
    }
  }
}

// 3. Check for unclosed template literals
for (let i = 0; i < scriptLines.length; i++) {
  const line = scriptLines[i];
  let backtickCount = 0;
  let inString = false;
  let stringChar = null;
  let escapeNext = false;
  
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (escapeNext) { escapeNext = false; continue; }
    if (ch === '\\') { escapeNext = true; continue; }
    if (inString) {
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === '`') {
      backtickCount++;
    }
  }
  
  if (backtickCount % 2 !== 0) {
    // Could be multi-line template literal, check next few lines
    let totalBackticks = backtickCount;
    for (let k = i + 1; k < Math.min(scriptLines.length, i + 10); k++) {
      for (let j = 0; j < scriptLines[k].length; j++) {
        const ch = scriptLines[k][j];
        if (ch === '`' && scriptLines[k][j-1] !== '\\') {
          totalBackticks++;
        }
      }
      if (totalBackticks % 2 === 0) break;
    }
    if (totalBackticks % 2 !== 0) {
      issues.push({ type: 'unclosed-template', line: i + 1, text: line.substring(0, 100) });
    }
  }
}

// 4. Check for </script> inside strings
for (let i = 0; i < scriptLines.length; i++) {
  const line = scriptLines[i];
  if (line.includes('</script>')) {
    issues.push({ type: 'script-end-in-string', line: i + 1, text: line.substring(0, 100) });
  }
}

if (issues.length === 0) {
  console.log('No obvious syntax issues found in script.');
} else {
  console.log('Found', issues.length, 'potential issues:');
  for (const issue of issues) {
    console.log('  Line', issue.line, '-', issue.type, ':', issue.text);
    if (issue.error) console.log('    Error:', issue.error);
  }
}

// Also try parsing with a more strict approach
try {
  const fullScript = scriptLines.join('\n');
  new Function(fullScript);
  console.log('Script passes new Function() check.');
} catch (e) {
  console.log('Script FAILS new Function() check:', e.message);
}
