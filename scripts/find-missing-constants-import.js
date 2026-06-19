const fs = require('fs');
const path = require('path');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      walk(fullPath, files);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.cjs')) {
      files.push(fullPath);
    }
  }
  return files;
}

for (const dir of [
  'C:/Users/Trevor/CascadeProjects/ai-platform/server',
  'C:/Users/Trevor/CascadeProjects/ai-platform/src',
  'C:/Users/Trevor/CascadeProjects/packages/simplebeacon-cli/src'
]) {
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir)) {
    const content = fs.readFileSync(file, 'utf8');
    const hasRequire = /require\(['"][^'"]*constants/.test(content);
    if (hasRequire) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\bconstants\.[A-Z]/.test(line) && !line.trim().startsWith('//') && !line.includes('const constants')) {
        console.log(path.relative('C:/Users/Trevor/CascadeProjects', file) + ':' + (i+1) + ' ' + line.trim().slice(0, 100));
        break;
      }
    }
  }
}
