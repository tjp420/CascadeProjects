const fs = require('fs');
const argv = require('minimist')(process.argv.slice(2));
const input = argv.input || '.simplebeacon/filtered-audit-org-compliance-attestation-compliance_report_generated-2026-08-15T00-00-00.000Z_to_2026-08-22T15-14-05.974Z.json';
const date = argv.date;
if(!fs.existsSync(input)){ console.error('input not found', input); process.exit(1); }
const obj = JSON.parse(fs.readFileSync(input,'utf8'));
const entries = obj.entries || [];
const rows = [];
for(const e of entries){
  if(e.action !== 'compliance_report_generated') continue;
  if(date && !(e.timestamp && e.timestamp.startsWith(date))) continue;
  rows.push({ entityId: e.entityId, timestamp: e.timestamp, frameworks: (e.metadata && e.metadata.frameworks || []).join('|'), organizationsEvaluated: (e.metadata && e.metadata.organizationsEvaluated) || '' });
}
// sort by timestamp
rows.sort((a,b)=> new Date(a.timestamp) - new Date(b.timestamp));
const outCsv = 'entityId,timestamp,frameworks,organizationsEvaluated\n' + rows.map(r => `${r.entityId},${r.timestamp},"${r.frameworks}",${r.organizationsEvaluated}`).join('\n');
const outPath = argv.output || `.simplebeacon/rep_meta_summary${date?('-'+date):''}.csv`;
fs.writeFileSync(outPath, outCsv,'utf8');
console.log('wrote', outPath, 'rows', rows.length);
