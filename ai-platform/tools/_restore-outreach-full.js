const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(process.env.USERPROFILE, '.cursor/projects/c-Users-Trevor-CascadeProjects/agent-transcripts');

const targets = [
  'web/simplebeacon-dashboard/js/services/outreachService.js',
  'server/lib/outreach-mail.js',
  'server/lib/outreach-routes.js',
  'server/lib/outreach-resend-webhook.js'
];

function matchTarget(fp) {
  const norm = fp.replace(/\\/g, '/');
  return targets.find((t) => norm.endsWith(t));
}

const found = {};
for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const jl = path.join(dir, e.name, `${e.name}.jsonl`);
  if (!fs.existsSync(jl)) continue;
  for (const line of fs.readFileSync(jl, 'utf8').split('\n')) {
    if (!line.includes('"Write"')) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    for (const b of obj.message?.content || []) {
      if (b.name !== 'Write' || !b.input?.contents) continue;
      const suffix = matchTarget(String(b.input.path || ''));
      if (!suffix) continue;
      const len = b.input.contents.length;
      if (!found[suffix] || len > found[suffix].len) {
        found[suffix] = { contents: b.input.contents, len, transcript: path.basename(jl) };
      }
    }
  }
}

for (const suffix of targets) {
  const hit = found[suffix];
  if (!hit) {
    console.error('MISSING', suffix);
    continue;
  }
  const out = path.join(root, suffix);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, hit.contents, 'utf8');
  console.log('WROTE', suffix, hit.len, 'from', hit.transcript);
}

// Find index.html nav snippets
for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const jl = path.join(dir, e.name, `${e.name}.jsonl`);
  if (!fs.existsSync(jl)) continue;
  for (const line of fs.readFileSync(jl, 'utf8').split('\n')) {
    if (!line.includes('outreach') || !line.includes('index.html')) continue;
    if (!line.includes('StrReplace') && !line.includes('Write')) continue;
    if (!line.includes('data-view')) continue;
    console.log('\nNAV in', path.basename(jl));
    const m = line.match(/outreach[^"]{0,200}/);
    if (m) console.log(m[0].slice(0, 200));
  }
}

// Find main.js wiring
for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const jl = path.join(dir, e.name, `${e.name}.jsonl`);
  if (!fs.existsSync(jl)) continue;
  for (const line of fs.readFileSync(jl, 'utf8').split('\n')) {
    if (!line.includes('OutreachView') || !line.includes('main.js')) continue;
    if (!line.includes('StrReplace')) continue;
    console.log('\nMAIN in', path.basename(jl), line.slice(0, 400));
  }
}
