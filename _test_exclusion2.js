// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const path = require('path');

// Replicate the isExcludedPath function from dead-code-scanner.js
function isExcludedPath(filePath, rootDir) {
  const rel = filePath.replace(rootDir, '').replace(/^[/\\]+/, '');
  const dirs = rel.split(/[/\\]/);
  console.log('rel:', rel);
  console.log('dirs:', dirs);
  const r1 = /ai-platform[/\\]web[/\\]simplebeacon-dashboard[/\\]js\b/.test(rel);
  const r2 = /simplebeacon-vscode-merged[/\\]dashboard-web[/\\]js\b/.test(rel);
  console.log('regex1 match:', r1);
  console.log('regex2 match:', r2);
  return r1 || r2;
}

const testPath = 'c:/Users/Trevor/CascadeProjects/ai-platform/web/simplebeacon-dashboard/js-es2018/utils-dom.js';
const rootDir = 'c:/Users/Trevor/CascadeProjects';
console.log('Testing:', testPath);
console.log('Excluded:', isExcludedPath(testPath, rootDir));
