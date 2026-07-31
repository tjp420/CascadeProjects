// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(
  process.env.USERPROFILE,
  '.cursor/projects/c-Users-Trevor-CascadeProjects/agent-transcripts'
);

const targets = ['server/lib/eu-ai-act-audit-report.js'];

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
    if (!line.includes('eu-ai-act-audit-report')) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
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
    process.stderr.write(['MISSING', suffix].join(' ') + '\n');
    continue;
  }
  const out = path.join(root, suffix);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, hit.contents, 'utf8');
  process.stdout.write(['WROTE', suffix, hit.len, 'from', hit.transcript].join(' ') + '\n');
}

// Extract route snippet
const jl = path.join(
  dir,
  '0c70eceb-6e6d-4916-991c-74e04829fd1b',
  '0c70eceb-6e6d-4916-991c-74e04829fd1b.jsonl'
);
if (fs.existsSync(jl)) {
  for (const line of fs.readFileSync(jl, 'utf8').split('\n')) {
    if (!line.includes("app.post('/api/analyze/eu-ai-act-audit-report'")) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    for (const b of obj.message?.content || []) {
      if (b.name === 'StrReplace' && b.input?.new_string?.includes('eu-ai-act-audit-report')) {
        process.stdout.write(['\n--- ROUTE SNIPPET ---\n'].join(' ') + '\n');
        const m = b.input.new_string.match(
          /app\.post\('\/api\/analyze\/eu-ai-act-audit-report'[\s\S]{0,3500}/
        );
        if (m) process.stdout.write([m[0]].join(' ') + '\n');
      }
    }
  }
}
