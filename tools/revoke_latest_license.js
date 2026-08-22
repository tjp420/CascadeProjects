const fs = require('fs');
const path = require('path');
const db = require('../ai-platform/server/lib/token-db.cjs');
(async function(){
  try{
    const p = path.join(process.cwd(), 'latest_license.jwt');
    if(!fs.existsSync(p)){
      console.log(JSON.stringify({status:'no_file'}));
      process.exit(0);
    }
    const token = fs.readFileSync(p,'utf8').trim();
    const res = await db.updateLicenseToken(token, { revoked_at: new Date().toISOString(), revoked_reason: 'manual_revoke' });
    fs.unlinkSync(p);
    console.log(JSON.stringify({status:'revoked', dbUpdated: !!res, removedFile: p}));
  }catch(err){
    console.error(JSON.stringify({status:'error', message: err && err.message}));
    process.exit(2);
  }
})();
