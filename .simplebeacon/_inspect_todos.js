const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '..');
const dirs = [
  path.join(base, 'ai-platform/web/simplebeacon-dashboard/js/views'),
  path.join(base, 'ai-platform/web/simplebeacon-dashboard/js-es2018/views'),
];
const todos = {};
for (const d of dirs) {
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    if (!f.endsWith('.js')) continue;
    const lines = fs.readFileSync(path.join(d, f), 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (/TODO|FIXME|HACK|XXX|BUG/i.test(lines[i])) {
        const key = path.relative(base, path.join(d, f)).replace(/\\/g, '/');
        todos[key] = todos[key] || [];
        todos[key].push({ line: i + 1, text: lines[i].trim() });
      }
    }
  }
}
console.log(JSON.stringify(todos, null, 2));
