const fs = require('fs');
const path = require('path');
(async function(){
  try{
    const dbPath = path.join(process.cwd(),'ai-platform','server','db','token-registry.json');
    const raw = fs.readFileSync(dbPath,'utf8');
    const obj = JSON.parse(raw);
    const list = obj.license_tokens || [];
    for(let i=list.length-1;i>=0;i--){
      if(list[i].email === 'stripe@example.com' && !list[i].revoked_at){
        list[i].revoked_at = new Date().toISOString();
        list[i].revoked_reason = 'manual_revoke_forced';
        list[i].updated_at = new Date().toISOString();
        fs.writeFileSync(dbPath, JSON.stringify(obj, null, 2), 'utf8');
        console.log(JSON.stringify({status:'revoked', index:i, token_jti: (list[i].token || '').slice(0,20)}));
        return;
      }
    }
    console.log(JSON.stringify({status:'not_found'}));
  }catch(err){
    console.error(JSON.stringify({status:'error', message: err && err.message}));
    process.exit(2);
  }
})();
