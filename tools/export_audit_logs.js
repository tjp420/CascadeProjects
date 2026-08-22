const fs = require('fs');
const path = require('path');
const auditPath = path.join(process.cwd(), 'ai-platform', '.simplebeacon', 'audit-log.json');
const exportPath = path.join(process.cwd(), '.simplebeacon', `exported-audit-log-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
try{
  if(!fs.existsSync(auditPath)){
    console.error(JSON.stringify({status:'error', message:'audit log not found', path:auditPath}));
    process.exit(1);
  }
  const raw = fs.readFileSync(auditPath,'utf8');
  fs.mkdirSync(path.dirname(exportPath), { recursive: true });
  fs.writeFileSync(exportPath, raw, 'utf8');
  // Generate simple stats
  const obj = JSON.parse(raw);
  const entries = Object.values(obj.entries || {});
  const byOrg = {};
  for(const e of entries){
    const org = e.orgId || 'default';
    byOrg[org] = byOrg[org] || { total:0, actions: {} };
    byOrg[org].total++;
    byOrg[org].actions[e.action] = (byOrg[org].actions[e.action]||0)+1;
  }
  const summaryPath = exportPath.replace('.json','-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({exportPath, totalEntries: entries.length, byOrg}, null, 2), 'utf8');
  console.log(JSON.stringify({status:'exported', exportPath, summaryPath}));
}catch(err){
  console.error(JSON.stringify({status:'error', message:err.message}));
  process.exit(2);
}
