require('dotenv').config({ path: 'ai-platform/.env' });
const fs = require('fs');
const path = require('path');
const db = require('../ai-platform/server/lib/token-db.cjs');
const proxy = require('../ai-platform/server/lib/simplebeacon-proxy.cjs');

function base64UrlDecode(input) {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) input += '=';
  return Buffer.from(input, 'base64').toString('utf8');
}

(async function(){
  try{
    const email = 'stripe@example.com';
    const list = await db.getLicenseTokensByEmail(email);
    if(!list || list.length===0){
      console.log(JSON.stringify({status:'not_found'}));
      process.exit(0);
    }
    const last = list[list.length-1];
    const token = last.token;
    const jwtPath = path.join(process.cwd(),'latest_license.jwt');
    const outPath = path.join(process.cwd(),'latest_license.json');
    fs.writeFileSync(jwtPath, token, 'utf8');

    const parts = token.split('.');
    if(parts.length!==3) throw new Error('invalid_jwt_format');
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    const verifyFn = proxy.verifyLicenseToken;
    let valid = null, verifyErr = null;
    try{
      valid = verifyFn(token, process.env.SIMPLEBEACON_LICENSE_SECRET);
    }catch(err){ verifyErr = err && err.message; }

    const out = { status: 'saved', jwtFile: jwtPath, claims: payload, verified: !!valid, verifyError: verifyErr };
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
    console.log(JSON.stringify(out));
  }catch(err){
    console.error(JSON.stringify({status:'error', message: err && err.message}));
    process.exit(2);
  }
})();
