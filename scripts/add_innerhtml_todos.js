const fs = require('fs');
const path = require('path');

const roots = [
  'ai-platform/web/simplebeacon-dashboard/js-es2018/views',
  'ai-platform/web/simplebeacon-dashboard/js/views',
  'coming-soon/public/dashboard/js-es2018/views',
  'coming-soon/public/dashboard/js/views',
  'simplebeacon-vscode-merged/dashboard-web/js-es2018/views',
  'simplebeacon-vscode-merged/dashboard-web/js/views'
];

const todo = '// TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.';

function walk(dir) {
  let files = [];
  try {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) files = files.concat(walk(p));
      else files.push(p);
    }
  } catch (e) {
    return files;
  }
  return files;
}

let modified = 0;
let touchedFiles = [];
const workspaceRoot = process.argv[2] || process.cwd();
for (const root of roots) {
  const fullRoot = path.join(workspaceRoot, root.replace(/\//g, path.sep));
  const all = walk(fullRoot).filter(f => f.endsWith('.js'));
  for (const file of all) {
    let s = fs.readFileSync(file, 'utf8');
    const lines = s.split(/\r?\n/);
    let changed = false;
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('innerHTML')) {
        const prev = out.length ? out[out.length - 1] : '';
        if (!prev.includes('TODO(security): review innerHTML')) {
          out.push(todo);
          changed = true;
        }
      }
      out.push(line);
    }
    if (changed) {
      fs.writeFileSync(file, out.join('\n'));
      modified++;
      touchedFiles.push(file.replace(process.cwd() + path.sep, ''));
    }
  }
}
console.log('Touched files:', modified);
if (touchedFiles.length) console.log(touchedFiles.join('\n'));
process.exit(0);
