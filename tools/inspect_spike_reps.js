const fs = require('fs');
const argv = require('minimist')(process.argv.slice(2));
const csvPath = argv.input || '.simplebeacon/filtered-audit-compliance-attestation-2026-08-15_to_2026-08-22-fixed-entries.csv';
const date = argv.date; // YYYY-MM-DD
if(!fs.existsSync(csvPath)){ console.error(JSON.stringify({status:'error',message:'csv not found',csvPath})); process.exit(1); }
const lines = fs.readFileSync(csvPath,'utf8').trim().split('\n');
const header = lines.shift();

// Simple CSV parser that respects quoted fields
function parseCsvLine(line){
  const res = [];
  let cur = '';
  let inQuotes = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(ch === '"'){
      if(inQuotes && line[i+1] === '"'){ cur += '"'; i++; continue; }
      inQuotes = !inQuotes;
      continue;
    }
    if(ch === ',' && !inQuotes){ res.push(cur); cur = ''; continue; }
    cur += ch;
  }
  res.push(cur);
  return res;
}

const headerParts = parseCsvLine(header);
const idIdx = headerParts.indexOf('id');
const tsIdx = headerParts.indexOf('timestamp');
const entityIdIdx = headerParts.indexOf('entityId');
const actionIdx = headerParts.indexOf('action');
const rows = lines.map(l=>{
  const parts = parseCsvLine(l);
  return {id: parts[idIdx], timestamp: parts[tsIdx], action: parts[actionIdx], entityId: parts[entityIdIdx], raw: l};
});
const filtered = date ? rows.filter(r=> r.timestamp && r.timestamp.startsWith(date)) : rows;
const counts = {};
for(const r of filtered){
  if(r.action !== 'compliance_report_generated') continue;
  counts[r.entityId] = (counts[r.entityId]||0)+1;
}
const arr = Object.entries(counts).sort((a,b)=> b[1]-a[1]);
console.log(JSON.stringify({date: date||'all', totalFiltered: filtered.length, uniqueRepIds: arr.length, top: arr.slice(0,20)}));
