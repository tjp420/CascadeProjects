// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require('fs');
const path = require('path');

const js = fs.readFileSync(path.join(__dirname, 'out', 'welcomeDashboard.js'), 'utf8');

// Find the return statement in buildHtml - it returns a template literal
const buildHtmlMatch = js.match(/buildHtml\(\)\s*\{[\s\S]*?return `([\s\S]*?)`;\s*\}\s*\n/);
if (!buildHtmlMatch) {
  console.error('Could not find buildHtml return statement');
  process.exit(1);
}

let html = buildHtmlMatch[1];

// Replace escaped backticks with actual backticks
html = html.replace(/\\`/g, '`');

// Replace template expressions with dummy values
html = html.replace(/\$\{nonce\}/g, 'testnonce123');
html = html.replace(/\$\{csp\}/g, 'vscode-webview://test');
// Replace any remaining ${...} expressions with empty string
html = html.replace(/\$\{[^}]+\}/g, '');

// Fix acquireVsCodeApi for browser testing
html = html.replace(
  'const vscode = acquireVsCodeApi();',
  `const vscode = {
    postMessage: (msg) => { void msg; },
    setState: () => {},
    getState: () => ({})
  };`
);

const outPath = path.join(__dirname, '__test_dashboard.html');
fs.writeFileSync(outPath, html);
process.stdout.write('Wrote ' + outPath + ' size: ' + html.length + '\n');
