// Simple in-memory proof store for development/testing
class ProofStore {
  constructor(){
    this._byId = new Map();
    this._byPolicy = new Map();
    this._counter = 1;
    // Monotonic sequence for proofs (in-memory)
    this._lastSequence = 0;
  }

  _nextId(){
    return `proof-${(this._counter++).toString().padStart(6,'0')}`;
  }

  // Atomically save a proof. If `meta.sequence` is absent it will be assigned.
  // If `meta.sequence` is provided and `force` is false, it must be greater
  // than the current last sequence to avoid breaking monotonic ordering.
  saveProof({ policyId, proof_bundle, meta = {} , force = false }){
    // validate sequence if present
    if(typeof meta.sequence === 'number'){
      // allow equality so sequences assigned by nextSequence() are not rejected
      if(!force && meta.sequence < this._lastSequence){
        throw new Error('sequence-too-small');
      }
      // advance lastSequence to include the provided value
      this._lastSequence = Math.max(this._lastSequence, meta.sequence);
    } else {
      // assign next monotonic sequence
      meta.sequence = this.nextSequence();
    }

    const id = this._nextId();
    const record = { id, policyId, proof_bundle, meta, created_at: new Date().toISOString() };
    this._byId.set(id, record);
    if(!this._byPolicy.has(policyId)) this._byPolicy.set(policyId, []);
    this._byPolicy.get(policyId).push(record);
    return record;
  }

  // Return the next monotonic sequence (atomic within this process)
  nextSequence(){
    this._lastSequence = (this._lastSequence || 0) + 1;
    return this._lastSequence;
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
    this._lastSequence = 0;
  }
}

module.exports = ProofStore;
