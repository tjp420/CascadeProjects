const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));

const inputPath = argv.input || path.join(process.cwd(), 'ai-platform', '.simplebeacon', 'audit-log.json');
const orgFilter = argv.org || argv.o || 'default';
const actionFilter = argv.action || argv.a || '';
const end = argv.end ? new Date(argv.end) : new Date();
const start = argv.start ? new Date(argv.start) : new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000);

function iso(d){ return d.toISOString(); }

if(!fs.existsSync(inputPath)){
  console.error(JSON.stringify({status:'error',message:'input file not found', inputPath}));
  process.exit(1);
}

const raw = fs.readFileSync(inputPath,'utf8');
const obj = JSON.parse(raw);
const entries = Object.values(obj.entries || {});

const filtered = entries.filter(e=>{
  if(orgFilter && orgFilter !== 'All' && orgFilter !== 'all' && orgFilter !== 'ANY' && orgFilter !== 'any'){
    if((e.orgId||'default') !== orgFilter) return false;
  }
  if(actionFilter){ if(e.action !== actionFilter) return false; }
  const t = new Date(e.timestamp);
  if(t < start || t > end) return false;
  return true;
});

const exportDir = path.join(process.cwd(), '.simplebeacon');
fs.mkdirSync(exportDir, { recursive: true });
const fileName = `filtered-audit-${orgFilter || 'any'}${actionFilter?'-'+actionFilter:''}-${iso(start)}_to_${iso(end)}.json`.replace(/[:]/g,'-');
const exportPath = path.join(exportDir, fileName);
fs.writeFileSync(exportPath, JSON.stringify({meta:{orgFilter,actionFilter,start:iso(start),end:iso(end),totalFiltered:filtered.length}, entries: filtered}, null, 2), 'utf8');

// write a short summary
const byAction = {};
for(const e of filtered){ byAction[e.action] = (byAction[e.action]||0)+1; }
const summaryPath = exportPath.replace('.json','-summary.json');
fs.writeFileSync(summaryPath, JSON.stringify({exportPath, totalFiltered: filtered.length, byAction}, null, 2), 'utf8');

console.log(JSON.stringify({status:'ok', exportPath, summaryPath}));
