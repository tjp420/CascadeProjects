// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(process.env.USERPROFILE, '.cursor/projects/c-Users-Trevor-CascadeProjects/agent-transcripts');
const files = [
  { suffix: 'web/simplebeacon-dashboard/js/views/OutreachView.js', match: (fp) => fp.endsWith('OutreachView.js') },
  { suffix: 'web/simplebeacon-dashboard/js/views/DeliverablesView.js', match: (fp) => fp.endsWith('DeliverablesView.js') },
  { suffix: 'web/simplebeacon-dashboard/js/data/outreach-prospects.js', match: (fp) => fp.endsWith('outreach-prospects.js') }
];

const found = {};
for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const jl = path.join(dir, e.name, `${e.name}.jsonl`);
  if (!fs.existsSync(jl)) continue;
  for (const line of fs.readFileSync(jl, 'utf8').split('\n')) {
    if (!line.includes('Write')) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    for (const b of obj.message?.content || []) {
      if (b.name !== 'Write' || !b.input?.contents) continue;
      const fp = String(b.input.path || '');
      for (const spec of files) {
        if (!spec.match(fp)) continue;
        const len = b.input.contents.length;
        if (!found[spec.suffix] || len > found[spec.suffix].len) {
          found[spec.suffix] = { contents: b.input.contents, len, transcript: path.basename(jl) };
        }
      }
    }
  }
}

for (const spec of files) {
  const hit = found[spec.suffix];
  if (!hit) {
    console.error('MISSING', spec.suffix);
    continue;
  }
  const out = path.join(root, spec.suffix);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, hit.contents, 'utf8');
  console.log('WROTE', spec.suffix, hit.len, 'from', hit.transcript);
}
