const fs = require('fs');
const path = require('path');

const needles = ['OutreachView.js', 'outreach-prospects.js', 'DeliverablesView.js', 'data-view="outreach"'];
const dir = path.join(process.env.USERPROFILE, '.cursor/projects/c-Users-Trevor-CascadeProjects/agent-transcripts');

for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const jl = path.join(dir, e.name, `${e.name}.jsonl`);
  if (!fs.existsSync(jl)) continue;
  for (const line of fs.readFileSync(jl, 'utf8').split('\n')) {
    if (!needles.some((n) => line.includes(n))) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    for (const b of obj.message?.content || []) {
      if (b.name !== 'Write') continue;
      const fp = b.input?.path || '';
      if (needles.some((n) => fp.includes(n.replace('data-view="outreach"', 'outreach')) || fp.includes('Outreach') || fp.includes('outreach-prospects') || fp.includes('DeliverablesView'))) {
        console.log(path.basename(jl), fp, (b.input.contents || '').length);
      }
    }
  }
}
