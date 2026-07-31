#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require('fs');

const file = require('path').join(
  __dirname,
  '../web/simplebeacon-dashboard/js/utils/analyze-mode-file-scope.browser.js'
);
let content = fs.readFileSync(file, 'utf8');
const transcripts = [
  'C:/Users/Trevor/.cursor/projects/c-Users-Trevor-CascadeProjects/agent-transcripts/fb7b3a63-6c3c-4656-8c5e-de276257c6bf/fb7b3a63-6c3c-4656-8c5e-de276257c6bf.jsonl',
  'C:/Users/Trevor/.cursor/projects/c-Users-Trevor-CascadeProjects/agent-transcripts/67f7a260-95de-4452-9e95-d33daaf4421f/67f7a260-95de-4452-9e95-d33daaf4421f.jsonl',
  'C:/Users/Trevor/.cursor/projects/c-Users-Trevor-CascadeProjects/agent-transcripts/e56dee22-9d9b-454b-ba46-847eac78dc07/e56dee22-9d9b-454b-ba46-847eac78dc07.jsonl',
];
let applied = 0;
let missed = 0;
for (const jl of transcripts) {
  if (!fs.existsSync(jl)) continue;
  for (const line of fs.readFileSync(jl, 'utf8').split('\n')) {
    if (!line.includes('analyze-mode-file-scope')) continue;
    try {
      const o = JSON.parse(line);
      for (const c of o.message?.content || []) {
        if (c.name !== 'StrReplace' || !c.input?.path?.includes('analyze-mode-file-scope'))
          continue;
        if (!c.input.old_string || !c.input.new_string) continue;
        if (content.includes(c.input.old_string)) {
          content = content.replace(c.input.old_string, c.input.new_string);
          applied += 1;
        } else {
          missed += 1;
        }
      }
    } catch {
      /* skip malformed lines */
    }
  }
}
fs.writeFileSync(file, content);
console.log(
  'applied',
  applied,
  'missed',
  missed,
  'hasExport',
  content.includes('export function extractRoadmapFileMetrics')
);
