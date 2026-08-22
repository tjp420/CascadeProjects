const db = require('../ai-platform/server/lib/token-db.cjs');
(async function(){
  try{
    const email = 'stripe@example.com';
    const list = await db.getLicenseTokensByEmail(email);
    if(!list || list.length===0) return console.log(JSON.stringify({status:'not_found'}));
    const last = list[list.length-1];
    console.log(JSON.stringify({status:'found', tokenSummary: {email:last.email, tier:last.tier, registered_at:last.registered_at, revoked_at: last.revoked_at || null}}));
  }catch(err){
    console.error(JSON.stringify({status:'error', message: err && err.message}));
    process.exit(2);
  }
})();
