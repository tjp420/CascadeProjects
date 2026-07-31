#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Replay StrReplace patches onto analyzeService.js from known-good transcripts.
 * Does NOT apply Write operations (those can overwrite with stale stubs).
 */
const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '../web/simplebeacon-dashboard/js/services/analyzeService.js');
const base = path.join(
  process.env.USERPROFILE || '',
  '.cursor/projects/c-Users-Trevor-CascadeProjects/agent-transcripts'
);

const transcriptIds = [
  '0c70eceb-6e6d-4916-991c-74e04829fd1b',
  '0ef44f78-57e6-4f8f-a618-314f16c39ffc',
  '76d266c0-5a33-4895-8981-4c1495f28fd9',
  '599cb1eb-1631-458b-ab1b-2c0535c26b29',
];

let content = fs.readFileSync(out, 'utf8');
let applied = 0;
let skipped = 0;

for (const id of transcriptIds) {
  const transcript = path.join(base, id, `${id}.jsonl`);
  if (!fs.existsSync(transcript)) continue;
  for (const line of fs.readFileSync(transcript, 'utf8').split('\n')) {
    if (!line.includes('analyzeService.js')) continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    for (const block of parsed.message?.content || []) {
      if (block.name !== 'StrReplace' || !block.input?.path?.includes('analyzeService.js'))
        continue;
      const { old_string: oldString, new_string: newString } = block.input;
      if (oldString && content.includes(oldString)) {
        content = content.replace(oldString, newString);
        applied += 1;
      } else {
        skipped += 1;
      }
    }
  }
}

fs.writeFileSync(out, content);
process.stdout.write(
  [`applied ${applied}, skipped ${skipped}, lines ${content.split('\n').length}`].join(' ') + '\n'
);

const required = [
  'refreshLiveReport',
  'shouldPreferLiveReport',
  'liveInventoryForPath',
  'fetchAnalyzeTestSources',
  'prepareGithubRepo',
  'preparePlatformResultsReport',
];
for (const name of required) {
  const ok = new RegExp(`export (async )?function ${name}`).test(content);
  process.stdout.write([`${name}: ${ok ? 'OK' : 'MISSING'}`].join(' ') + '\n');
}
