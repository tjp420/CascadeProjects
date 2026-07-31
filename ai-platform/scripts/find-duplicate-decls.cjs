const fs = require('fs');
const path = require('path');

function walk(dir) {
  const res = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) res.push(...walk(p));
    else if (st.isFile() && p.endsWith('.cjs')) res.push(p);
  }
  return res;
}

function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const re = /\b(?:const|let)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  const ids = {};
  let m;
  const lines = src.split(/\r?\n/);
  while ((m = re.exec(src)) !== null) {
    const id = m[1];
    const idx = m.index;
    const before = src.slice(0, idx);
    const lineNo = (before.match(/\n/g) || []).length + 1;
    ids[id] = ids[id] || [];
    ids[id].push(lineNo);
  }
  const dup = Object.entries(ids).filter(([, v]) => v.length > 1);
  if (dup.length) {
    return { file, duplicates: dup };
  }
  return null;
}

const root = path.join(__dirname, '..', 'server', 'routes');
if (!fs.existsSync(root)) {
  console.error('No routes dir at', root);
  process.exit(2);
}
const files = walk(root);
const results = [];
for (const f of files) {
  const r = scanFile(f);
  if (r) results.push(r);
}
if (results.length === 0) {
  console.log('No duplicate block-scoped declarations found in server/routes');
  process.exit(0);
}
for (const r of results) {
  console.log('\nFile:', r.file);
  for (const [id, lines] of r.duplicates) {
    console.log(`  Identifier '${id}' declared ${lines.length} times at lines: ${lines.join(', ')}`);
  }
}
process.exit(results.length ? 0 : 0);
