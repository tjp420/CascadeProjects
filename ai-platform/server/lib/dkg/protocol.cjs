// protocol.cjs - DKG proactive refresh protocol skeleton

const { EventEmitter } = require('events');
const crypto = require('crypto');
const transport = require('./transport.cjs');

let defaultTimeoutMs = 15000; // configurable
let defaultEvictionThreshold = 2;
let defaultComplaintRounds = 2;
let defaultComplaintTimeoutMs = 5000;

function configure(opts = {}) {
  if (typeof opts.defaultTimeoutMs === 'number') defaultTimeoutMs = opts.defaultTimeoutMs;
  if (typeof opts.evictionThreshold === 'number') defaultEvictionThreshold = opts.evictionThreshold;
  if (typeof opts.complaintRounds === 'number') defaultComplaintRounds = opts.complaintRounds;
  if (typeof opts.complaintTimeoutMs === 'number') defaultComplaintTimeoutMs = opts.complaintTimeoutMs;
  // optional pluggable verifiers
  if (typeof opts.verifySignatureFn === 'function') verifySignatureFn = opts.verifySignatureFn;
  if (typeof opts.verifyOpeningFn === 'function') verifyOpeningFn = opts.verifyOpeningFn;
}

// default signature verifier: expects ed25519 PEM publicKey
let verifySignatureFn = function (publicKeyPem, message, signatureBase64) {
  try {
    const sig = Buffer.from(signatureBase64, 'base64');
    const ok = crypto.verify(null, Buffer.from(message), publicKeyPem, sig);
    return Boolean(ok);
  } catch (e) {
    return false;
  }
};

// default opening verifier: simple SHA256(opening) == commitment
let verifyOpeningFn = function (commitmentHex, opening) {
  try {
    const h = crypto.createHash('sha256').update(String(opening)).digest('hex');
    return h === String(commitmentHex);
  } catch (e) {
    return false;
  }
};

// Helper to enforce timeout bounds for promise-returning phase functions
function withTimeout(promise, ms, label = 'phase') {
  if (!Number.isFinite(ms) || ms <= 0) return promise;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout]);
}

class Protocol extends EventEmitter {
  constructor() {
    super();
    this.state = 'idle';
    // epochId -> epochState
    this.epochs = new Map();
  }

  async startRefreshEpoch(epochId, opts = {}) {
    // opts: { peers, timeoutMs }
    const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : defaultTimeoutMs;
    this.state = 'refreshing';
    const transcript = { epoch: epochId, startedAt: Date.now(), events: [] };
    // initialize epoch state
    const epochState = {
      peers: (opts.peers || []).slice(),
      receivedShares: new Map(),
      accusations: new Map(), // accused -> Set of accusers
      evicted: new Set(),
      config: {
        evictionThreshold: typeof opts.evictionThreshold === 'number' ? opts.evictionThreshold : defaultEvictionThreshold,
        complaintRounds: typeof opts.complaintRounds === 'number' ? opts.complaintRounds : defaultComplaintRounds,
        complaintTimeoutMs: typeof opts.complaintTimeoutMs === 'number' ? opts.complaintTimeoutMs : defaultComplaintTimeoutMs,
      },
    };
    this.epochs.set(epochId, epochState);

    try {
      // Phase 1: announce
      transcript.events.push({ phase: 'announce', ts: Date.now() });
      await withTimeout(this._announce(epochId, opts), timeoutMs, 'announce');

      // Phase 2: send shares
      transcript.events.push({ phase: 'share_send', ts: Date.now() });
      await withTimeout(this._sendShares(epochId, opts), timeoutMs, 'sendShares');

      // Phase 3: collect & verify
      transcript.events.push({ phase: 'collect_verify', ts: Date.now() });
      const verified = await withTimeout(this._collectAndVerify(epochId, opts), timeoutMs, 'collectAndVerify');

      // Process accusations and evictions if any
      const evicted = await this._processAccusations(epochId);
      if (evicted && evicted.length) transcript.events.push({ phase: 'evictions', ts: Date.now(), evicted });

      // Phase 4: commit
      transcript.events.push({ phase: 'commit', ts: Date.now(), result: verified });
      await withTimeout(this._commit(epochId, opts, verified), timeoutMs, 'commit');

      this.state = 'idle';
      transcript.endedAt = Date.now();
      transcript.status = 'success';
      return { ok: true, transcript };
    } catch (err) {
      this.state = 'error';
      transcript.endedAt = Date.now();
      transcript.status = 'failed';
      transcript.error = String(err);
      this.emit('error', err);
      return { ok: false, transcript };
    }
  }

  // The following are protocol phase placeholders; implement VSS & verification logic here.
  async _announce(epochId, opts) {
    // Broadcast REFRESH_OFFER to peers
    return Promise.resolve();
  }

  async _sendShares(epochId, opts) {
    // Compute polynomials, create commitments, and send encrypted shares to peers
    return Promise.resolve();
  }

  async _collectAndVerify(epochId, opts) {
    // In this skeleton, support a test-injection path: opts.simulateBadPeers = [ids]
    const state = this.epochs.get(epochId);
    const peers = state ? state.peers : (opts.peers || []);
    const bad = Array.isArray(opts.simulateBadPeers) ? new Set(opts.simulateBadPeers) : new Set();

    let verifiedCount = 0;
    for (const p of peers) {
      // simulate receiving a share and verifying
      const ok = !bad.has(p);
      state && state.receivedShares.set(p, { ok });
      if (!ok) {
        // record an automatic local accusation from self (simulated)
        this._recordAccusation(epochId, 'self', p, { reason: 'invalid_share' });
      } else {
        verifiedCount++;
      }
    }
    return { verifiedCount };
  }

  async _commit(epochId, opts, verified) {
    // Publish REFRESH_COMMIT and finalize epoch
    // mark commitments; in a real impl we'd aggregate and publish commitments here
    return Promise.resolve();
  }

  // Record an accusation: accuser claims accused produced invalid data with supplied evidence
  async _recordAccusation(epochId, accuser, accused, evidence) {
    const state = this.epochs.get(epochId);
    if (!state) return 0;
    if (state.evicted.has(accused)) return 0;

    // Expect evidence to contain: { evidenceHash, shareCommitmentOpening, signature, publicKey, accusedCommitment }
    let verifiedProof = false;
    try {
      const { evidenceHash, shareCommitmentOpening, signature, publicKey, accusedCommitment } = evidence || {};
      const message = `${epochId}|${accused}|${evidenceHash || ''}`;
      if (signature && publicKey) {
        verifiedProof = verifySignatureFn(publicKey, message, signature);
      }
      // If a commitment opening is present, verify opening against provided or known commitment
      if (shareCommitmentOpening) {
        const commitmentHex = accusedCommitment || (state.commitments && state.commitments.get(accused));
        if (!commitmentHex) verifiedProof = false;
        else verifiedProof = verifiedProof && verifyOpeningFn(commitmentHex, shareCommitmentOpening);
      }
    } catch (e) {
      verifiedProof = false;
    }

    // Only accept accusation payloads that include a valid signature + opening (conservative)
    if (!verifiedProof) {
      // emit an event but do not count it toward eviction unless operator flags later
      this.emit('accusation_unverified', { epochId, accuser, accused, evidence });
      // still broadcast it so operators/auditors can see the claim
      try { transport.broadcast(state.peers, { type: 'ACCUSATION', epoch: epochId, accuser, accused, evidence }); } catch (e) {}
      // return 0 to indicate not counted
      return 0;
    }

    let accSet = state.accusations.get(accused);
    if (!accSet) {
      accSet = new Set();
      state.accusations.set(accused, accSet);
    }
    accSet.add(accuser + ':' + JSON.stringify(evidence || {}));
    this.emit('accusation', { epochId, accuser, accused, evidence });

    // broadcast the verified accusation to peers for visibility
    try { transport.broadcast(state.peers, { type: 'ACCUSATION_VERIFIED', epoch: epochId, accuser, accused, evidence }); } catch (e) {}

    return accSet.size;
  }

  // Evaluate accusations and evict nodes that surpass the threshold
  async _processAccusations(epochId) {
    const state = this.epochs.get(epochId);
    if (!state) return [];
    const evicted = [];
    const threshold = state.config.evictionThreshold;
    for (const [accused, accSet] of state.accusations.entries()) {
      if (accSet.size >= threshold) {
        // evict
        state.evicted.add(accused);
        this.emit('evict', { epochId, accused, by: accSet.size });
        evicted.push(accused);
      }
    }
    // remove evicted from peers
    if (evicted.length) {
      state.peers = state.peers.filter((p) => !state.evicted.has(p));
    }
    return evicted;
  }

  // helper for tests and inspection
  _getEpochState(epochId) {
    return this.epochs.get(epochId);
  }
}

const instance = new Protocol();
module.exports = instance;
module.exports.configure = configure;
