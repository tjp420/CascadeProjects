// Lightweight NIZK proof stub for development and testing
// Exports deterministic `generateProof` and `verifyProof` stubs.

const ProofStore = require('./store.cjs');
const store = new ProofStore();

function generateProof({publicInputs = {}, secretInputs = {}, scheme = 'mock-scheme'} = {}){
  // deterministic mock proof bundle
  const proof = Buffer.from(`mock-proof:${scheme}:${JSON.stringify(publicInputs)}`).toString('base64');
  return {
    proof_bundle: proof,
    proof_size: proof.length,
    meta: {
      scheme,
      generated_at: new Date().toISOString()
    }
  };
}

function verifyProof({publicInputs = {}, proof_bundle}){
  // In this stub we accept any proof starting with 'mock-proof:' when base64-decoded
  try{
    const decoded = Buffer.from(proof_bundle || '', 'base64').toString('utf8');
    const ok = decoded.startsWith('mock-proof:');
    return {
      is_valid: ok,
      error_context: ok ? null : 'invalid-mock-proof'
    };
  }catch(e){
    return { is_valid: false, error_context: 'decode-error' };
  }
}

function generateAndStore({ policyId, publicInputs = {}, secretInputs = {}, scheme = 'mock-scheme' } = {}){
  const res = generateProof({ publicInputs, secretInputs, scheme });
  const rec = store.saveProof({ policyId: policyId || 'unknown', proof_bundle: res.proof_bundle, meta: res.meta });
  return { record: rec, proof: res };
}

function getStoredProof(id){
  return store.getProof(id);
}

function listProofsByPolicy(policyId){
  return store.listByPolicy(policyId);
}

function clearStore(){
  store.clear();
}

module.exports = {
  generateProof,
  verifyProof,
  generateAndStore,
  getStoredProof,
  listProofsByPolicy,
  clearStore
};
