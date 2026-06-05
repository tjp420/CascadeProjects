const fs = require('fs');
const path = require('path');

function parseEnv(content) {
  const map = new Map();
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    map.set(key, { value, line: i + 1 });
  }
  return map;
}

const envFiles = [];
function walk(dir, rel) {
  rel = rel || '';
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (['node_modules','.git','coverage','dist','build','.simplebeacon','tests','test','__tests__','fixtures','examples','coming-soon','reports','security-reports','templates','data-central','deployments','public','functions','cloudflare-deploy','temp','tests-legacy','.github-sync','.cursor','.vscode','downloads','findings','simplebeacon-frameworkless','simplebeacon-rule-tests'].includes(entry)) continue;
      walk(full, rel ? rel + '/' + entry : entry);
    } else if (/^\.env/i.test(entry)) {
      envFiles.push({ path: full, rel: rel ? rel + '/' + entry : entry });
    }
  }
}
walk('.');

const envKeys = new Map();
for (const f of envFiles) {
  const content = fs.readFileSync(f.path, 'utf8');
  const parsed = parseEnv(content);
  for (const [key, meta] of parsed) {
    const bucket = envKeys.get(key) || [];
    bucket.push({ file: f.rel, value: meta.value });
    envKeys.set(key, bucket);
  }
}

const referencedKeys = new Map();
const patterns = [
  /process\.env\.([A-Z0-9_]+)/g,
  /\bget\s*\(\s*['\"]([A-Z0-9_]+)['\"]\s*\)/g,
  /resolveCredential\([^,]+,\s*[^,]+,\s*['\"]([A-Z0-9_]+)['\"]\s*\)/g
];
function walkSource(dir, rel) {
  rel = rel || '';
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (['node_modules','.git','coverage','dist','build','.simplebeacon','tests','test','__tests__','fixtures','examples','coming-soon','reports','security-reports','templates','data-central','deployments','public','functions','cloudflare-deploy','temp','tests-legacy','.github-sync','.cursor','.vscode','downloads','findings','simplebeacon-frameworkless','simplebeacon-rule-tests'].includes(entry)) continue;
      walkSource(full, rel ? rel + '/' + entry : entry);
    } else if (['.js','.mjs','.cjs','.ts','.tsx','.jsx'].includes(path.extname(entry).toLowerCase())) {
      try {
        const content = fs.readFileSync(full, 'utf8');
        for (const p of patterns) {
          p.lastIndex = 0;
          let m;
          while ((m = p.exec(content)) !== null) {
            const key = m[1];
            const refs = referencedKeys.get(key) || new Set();
            refs.add(rel ? rel + '/' + entry : entry);
            referencedKeys.set(key, refs);
          }
        }
      } catch {}
    }
  }
}
walkSource('.');

const missing = [];
for (const [key, refs] of referencedKeys) {
  if (/^(NODE_ENV|PORT|HOST|CI|DEBUG)$/i.test(key)) continue;
  if (envKeys.has(key)) continue;
  const prodRefs = [...refs].filter(r => !r.includes('test') && !r.includes('spec'));
  if (prodRefs.length > 0) {
    missing.push({ key, refs: prodRefs.slice(0, 3) });
  }
}

const inconsistencies = [];
for (const [key, entries] of envKeys) {
  const uniqueValues = [...new Set(entries.map(e => e.value))];
  if (uniqueValues.length > 1) {
    inconsistencies.push({ key, entries });
  }
}

console.log('=== MISSING KEYS (' + missing.length + ') ===');
missing.slice(0, 20).forEach(m => console.log(m.key + ' in ' + m.refs.join(', ')));

console.log('\n=== INCONSISTENCIES (' + inconsistencies.length + ') ===');
inconsistencies.slice(0, 20).forEach(i => {
  console.log(i.key + ':');
  i.entries.forEach(e => console.log('  ' + e.file + ' = ' + JSON.stringify(e.value)));
});
