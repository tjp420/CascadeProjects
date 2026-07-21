const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'remediation-roadmap-2026-07-21.json'), 'utf8'));
const debugFiles = [];
const todoFiles = [];
for (const issue of data.issues) {
  const rel = issue.filePath.replace(/^CascadeProjects\//, '');
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) continue;
  if (issue.type === 'debugArtifacts') debugFiles.push(abs);
  if (issue.type === 'todoMarkers') todoFiles.push(abs);
}
// Exclude already-handled files
const skip = new Set([
  path.join(root, 'ai-platform/tools/apply-roadmap-export.js'),
  path.join(root, 'ai-platform/tools/apply-roadmap-export.cjs'),
  path.join(root, 'api-server/server.cjs')
]);
const uniqueDebug = [...new Set(debugFiles)].filter(f => !skip.has(f));
const uniqueTodo = [...new Set(todoFiles)].filter(f => !skip.has(f));

fs.writeFileSync(path.join(__dirname, '_debug_files.txt'), uniqueDebug.join('\n'));
fs.writeFileSync(path.join(__dirname, '_todo_files.txt'), uniqueTodo.join('\n'));
console.log(`debug=${uniqueDebug.length} todo=${uniqueTodo.length}`);
