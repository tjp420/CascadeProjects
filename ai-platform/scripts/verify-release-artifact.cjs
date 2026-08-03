#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { sha256HexFromObject, canonicalize } = require('../server/lib/nizk/utils.cjs');

function walkDir(dir){
  const res = [];
  const items = fs.readdirSync(dir);
  for(const it of items){
    const p = path.join(dir, it);
    const st = fs.statSync(p);
    if(st.isDirectory()) res.push(...walkDir(p));
    else res.push(p);
  }
  return res;
}

function loadJson(file){
  try{ return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch(e){ return null; }
}

function verifyObject(obj){
  if(!obj || typeof obj !== 'object') return { ok: false, reason: 'not-object' };
  if(!obj.proof_bundle || !obj.meta) return { ok: false, reason: 'missing-fields' };

  // Reconstruct meta without provenanceHash (it was computed over meta before provenanceHash added)
  const metaWithoutProv = Object.assign({}, obj.meta);
  delete metaWithoutProv.provenanceHash;

  const policyId = (obj.publicInputs && obj.publicInputs.policyId) || obj.policyId || null;

  const expected = sha256HexFromObject({ policyId, proof_bundle: obj.proof_bundle, meta: metaWithoutProv });
  const actual = obj.meta.provenanceHash;
  const ok = expected === actual;
  return { ok, expected, actual };
}

function main(){
  const args = process.argv.slice(2);
  if(args.length < 1){
    console.error('Usage: verify-release-artifact.cjs <extracted-artifact-dir>');
    process.exit(2);
  }
  const dir = args[0];
  if(!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()){
    console.error('Directory not found:', dir);
    process.exit(2);
  }

  const files = walkDir(dir).filter(f => f.endsWith('.json'));
  if(files.length === 0){
    console.error('No JSON files found under', dir);
    process.exit(1);
  }

  let failures = 0;
  for(const f of files){
    const data = loadJson(f);
    if(!data) continue;
    const objs = Array.isArray(data) ? data : [data];
    for(const obj of objs){
      if(!obj || !obj.proof_bundle || !obj.meta || !obj.meta.provenanceHash) continue;
      const out = verifyObject(obj);
      if(!out.ok){
        failures++;
        console.error(`FAIL: ${f} expected=${out.expected} actual=${out.actual}`);
      } else {
        console.log(`OK: ${f}`);
      }
    }
  }

  if(failures > 0){
    console.error(`Verification failed: ${failures} mismatches`);
    process.exit(3);
  }

  console.log('All proofs verified successfully');
}

if(require.main === module) main();
