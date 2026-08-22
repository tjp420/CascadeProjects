const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const input = argv.input || argv.i || '.simplebeacon/filtered-org-compliance-attestation-strict-redacted.json';
const outPrefix = argv.output || argv.o || '.simplebeacon/filtered-audit-summary';

if(!fs.existsSync(input)){
  console.error(JSON.stringify({status:'error', message:'input not found', input}));
  process.exit(1);
}

const raw = fs.readFileSync(input,'utf8');
const parsed = JSON.parse(raw);
const entriesArr = Array.isArray(parsed.entries) ? parsed.entries : Object.values(parsed.entries || {});

// CSV of entries: id,timestamp,action,entity,entityId,actorId,actorEmail
const lines = ['id,timestamp,action,entity,entityId,actorId,actorEmail'];
for(const e of entriesArr){
  const id = e.id || '';
  const ts = e.timestamp || '';
  const action = (e.action || '').replace(/"/g,'""');
  const entity = (e.entity || '').replace(/"/g,'""');
  const entityId = (e.entityId || '').replace(/"/g,'""');
  const actorId = (e.actorId || '').replace(/"/g,'""');
  const actorEmail = (e.actorEmail || '').replace(/"/g,'""');
  // wrap fields in quotes if contain comma
  const row = [id, ts, action, entity, entityId, actorId, actorEmail].map(v=>{
    if(v === null || v === undefined) return '';
    const s = String(v);
    if(s.includes(',') || s.includes('"') || s.includes('\n')) return '"'+s.replace(/"/g,'""')+'"';
    return s;
  }).join(',');
  lines.push(row);
}
const entriesCsvPath = outPrefix + '-entries.csv';
fs.writeFileSync(entriesCsvPath, lines.join('\n'), 'utf8');

// Aggregation: daily counts per action
const agg = {}; // {date: {action: count}}
for(const e of entriesArr){
  const ts = e.timestamp || '';
  let date = 'unknown';
  if (ts) {
    const d = new Date(ts);
    if (!isNaN(d)) {
      date = d.toISOString().slice(0,10);
    } else {
      const m = String(ts).match(/(\d{4}-\d{2}-\d{2})/);
      date = m ? m[1] : 'invalid-date';
    }
  }
  const action = e.action || 'unknown';
  agg[date] = agg[date] || {};
  agg[date][action] = (agg[date][action] || 0) + 1;
}

// Build CSV: date,action,count
const aggLines = ['date,action,count'];
const dates = Object.keys(agg).sort();
for(const d of dates){
  const actions = Object.keys(agg[d]).sort();
  for(const a of actions){
    aggLines.push([d, '"'+a.replace(/"/g,'""')+'"', agg[d][a]].join(','));
  }
}
const aggCsvPath = outPrefix + '-daily-action-counts.csv';
fs.writeFileSync(aggCsvPath, aggLines.join('\n'), 'utf8');

console.log(JSON.stringify({status:'ok', entriesCsv: entriesCsvPath, aggCsv: aggCsvPath, total: entriesArr.length}));
