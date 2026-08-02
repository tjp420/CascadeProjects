// Simple in-memory proof store for development/testing
class ProofStore {
  constructor(){
    this._byId = new Map();
    this._byPolicy = new Map();
    this._counter = 1;
  }

  _nextId(){
    return `proof-${(this._counter++).toString().padStart(6,'0')}`;
  }

  saveProof({ policyId, proof_bundle, meta = {} }){
    const id = this._nextId();
    const record = { id, policyId, proof_bundle, meta, created_at: new Date().toISOString() };
    this._byId.set(id, record);
    if(!this._byPolicy.has(policyId)) this._byPolicy.set(policyId, []);
    this._byPolicy.get(policyId).push(record);
    return record;
  }

  getProof(id){
    return this._byId.get(id) || null;
  }

  listByPolicy(policyId){
    return this._byPolicy.get(policyId) || [];
  }

  clear(){
    this._byId.clear();
    this._byPolicy.clear();
    this._counter = 1;
  }
}

module.exports = ProofStore;
