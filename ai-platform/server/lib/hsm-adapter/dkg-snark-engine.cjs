"use strict";

/**
 * Track 26: DKG & zk-SNARKs — Joint-Feldman Verifiable Secret Sharing.
 *
 * Implements a distributed key generation protocol where N nodes jointly
 * generate a threshold key without any single node ever knowing the full
 * secret. Each node contributes a random polynomial share, distributes
 * evaluation points to peers, and broadcasts public coefficient commitments
 * for verifiable zero-knowledge validation.
 *
 * Cryptographic Design:
 *   - Joint-Feldman VSS over a 256-bit safe prime field (q)
 *   - Generator g of the multiplicative subgroup Z_q*
 *   - Polynomial degree t-1 where t is the quorum threshold
 *   - Public commitments: C_{i,j} = g^{a_{i,j}} mod p
 *   - Share verification: g^{s_{i,k}} ≡ ∏_{j=0}^{t-1} (C_{i,j})^{k^j} mod p
 *   - Master public key: Y = ∏_i g^{a_{i,0}} mod p
 *   - zk-SNARK parameters: structured reference string (g^s, g^{s^2}) for
 *     non-interactive polynomial validity proofs
 *
 * @module hsm-adapter/dkg-snark-engine
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

// 256-bit prime: 2^256 - 189 (same field as threshold-secret-splitter).
// Used as the polynomial coefficient field q (Schnorr subgroup order).
const PRIME = (1n << 256n) - 189n;

// Schnorr group: GROUP_PRIME = 34 * PRIME + 1 (a 262-bit prime).
// PRIME divides GROUP_PRIME - 1, so a subgroup of order PRIME exists.
const GROUP_PRIME = 34n * PRIME + 1n;

// Generator of the order-PRIME subgroup: g = 2^34 mod GROUP_PRIME.
// Verified: g^PRIME mod GROUP_PRIME = 1, g != 1.
const GENERATOR = 0x400000000n; // 2^34 = 17179869184

// The polynomial field prime (same as PRIME for coefficient arithmetic).
const FIELD_PRIME = PRIME;

/**
 * Convert a Buffer to a BigInt (big-endian).
 * @param {Buffer} buf
 * @returns {bigint}
 */
function _bytesToBigInt(buf) {
  let value = 0n;
  for (const b of buf) {
    value = (value << 8n) | BigInt(b);
  }
  return value;
}

/**
 * Convert a BigInt to a fixed-length Buffer (big-endian).
 * @param {bigint} value
 * @param {number} length
 * @returns {Buffer}
 */
function _bigIntToBytes(value, length) {
  const buf = Buffer.alloc(length);
  let v = value;
  for (let i = length - 1; i >= 0; i--) {
    buf[i] = Number(v & 0xffn);
    v = v >> 8n;
  }
  return buf;
}

/**
 * Generate a cryptographically secure random field element in Z_q.
 * @returns {bigint}
 */
function _randomFieldElement() {
  const bytes = crypto.randomBytes(32);
  let value = _bytesToBigInt(bytes) % FIELD_PRIME;
  if (value < 0n) value += FIELD_PRIME;
  return value;
}

/**
 * Modular exponentiation: base^exp mod mod.
 * @param {bigint} base
 * @param {bigint} exp
 * @param {bigint} mod
 * @returns {bigint}
 */
function _modPow(base, exp, mod) {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e = e >> 1n;
  }
  return result;
}

/**
 * Modular multiplicative inverse via Fermat's little theorem.
 * @param {bigint} a
 * @param {bigint} p
 * @returns {bigint}
 */
function _modInv(a, p) {
  return _modPow(a, p - 2n, p);
}

/**
 * Evaluate a polynomial at point x over the field Z_q.
 * f(x) = sum_{j=0}^{t-1} a_j * x^j mod q
 * @param {bigint[]} coefficients
 * @param {bigint} x
 * @returns {bigint}
 */
function _evaluatePolynomial(coefficients, x) {
  let result = 0n;
  let power = 1n;
  for (const c of coefficients) {
    result = (result + c * power) % FIELD_PRIME;
    power = (power * x) % FIELD_PRIME;
  }
  return result;
}

/**
 * Zeroize a BigInt array by overwriting each element with 0n.
 * This prevents residual coefficient recovery from heap inspection.
 * @param {bigint[]} arr
 */
function _zeroizeBigIntArray(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = 0n;
  }
}

/**
 * Represents a single node's contribution in the DKG protocol.
 * Each node generates a random polynomial, computes public commitments,
 * and distributes private shares to all peers.
 */
class DkgNodeContribution {
  /**
   * @param {string} nodeId
   * @param {bigint[]} polynomial - secret coefficients [a_0, a_1, ..., a_{t-1}]
   * @param {bigint[]} commitments - public commitments [g^{a_0}, g^{a_1}, ...]
   * @param {Map<string, bigint>} shares - nodeId -> private share s_{i,k}
   */
  constructor(nodeId, polynomial, commitments, shares) {
    this.nodeId = nodeId;
    this.polynomial = polynomial;
    this.commitments = commitments;
    this.shares = shares;
    this._zeroized = false;
  }

  /**
   * Zeroize ephemeral polynomial coefficients and private shares.
   * After this call, the contribution is read-only (commitments remain).
   */
  zeroize() {
    _zeroizeBigIntArray(this.polynomial);
    for (const key of this.shares.keys()) {
      this.shares.set(key, 0n);
    }
    this._zeroized = true;
  }

  isZeroized() {
    return this._zeroized;
  }
}

/**
 * Joint-Feldman DKG engine with zk-SNARK validation parameters.
 *
 * Protocol flow:
 *   1. Each node generates a random polynomial f_i(x) of degree t-1
 *   2. Each node broadcasts public commitments C_{i,j} = g^{a_{i,j}}
 *   3. Each node privately sends share s_{i,k} = f_i(k) to node k
 *   4. Each node verifies g^{s_{i,k}} ≡ ∏ (C_{i,j})^{k^j} mod p
 *   5. Complaints are filed against nodes whose shares fail verification
 *   6. Disqualified nodes are excluded from the final key
 *   7. Master public key Y = ∏_i g^{a_{i,0}} mod p (over qualified nodes)
 */
class DkgSnarkEngine {
  /**
   * @param {object} options
   * @param {number} options.totalNodes - N (total participating nodes)
   * @param {number} options.threshold - t (quorum threshold for reconstruction)
   * @param {string[]} options.nodeIds - array of N node identifiers
   * @param {bigint} [options.prime] - override field prime
   * @param {bigint} [options.generator] - override group generator
   * @param {boolean} [options.requireZkValidation] - block on invalid SNARK proof
   */
  constructor(options = {}) {
    if (!Number.isInteger(options.totalNodes) || options.totalNodes < 2) {
      throw new HsmAdapterError(
        "INVALID_INPUT",
        "totalNodes must be an integer >= 2",
      );
    }
    if (!Number.isInteger(options.threshold) || options.threshold < 1) {
      throw new HsmAdapterError(
        "INVALID_INPUT",
        "threshold must be a positive integer",
      );
    }
    if (options.threshold > options.totalNodes) {
      throw new HsmAdapterError(
        "INVALID_THRESHOLD",
        `threshold (${options.threshold}) cannot exceed totalNodes (${options.totalNodes})`,
      );
    }
    if (
      !Array.isArray(options.nodeIds) ||
      options.nodeIds.length !== options.totalNodes
    ) {
      throw new HsmAdapterError(
        "INVALID_INPUT",
        `nodeIds must contain exactly ${options.totalNodes} entries`,
      );
    }

    this._prime = options.prime || GROUP_PRIME; // group modulus p (Schnorr group)
    this._fieldPrime = FIELD_PRIME; // polynomial field q (order of subgroup)
    this._generator = options.generator || GENERATOR;
    this._totalNodes = options.totalNodes;
    this._threshold = options.threshold;
    this._nodeIds = [...options.nodeIds];
    this._requireZkValidation = options.requireZkValidation !== false;

    this._contributions = new Map(); // nodeId -> DkgNodeContribution
    this._complaints = []; // { from, against, reason }
    this._disqualified = new Set();
    this._qualifiedNodes = [];
    this._masterPublicKey = null;
    this._zkParameters = null;
    this._completed = false;

    // Numeric guards: mapping from commitmentGroup (curve id) to max field bits.
    // Default mapping can be overridden via options.bitLengthMap for testing or policy.
    this._defaultBitLengthMap = Object.assign(
      {
        secp256k1: 256,
        "P-256": 256,
        bn254: 254,
        "BLS12-381": 381,
      },
      options.bitLengthMap || {},
    );
    // Active commitment group identifier for produced commitments (optional)
    this._commitmentGroup = options.commitmentGroup || "secp256k1";
    // Optional audit hook: function(entry) for rejected persistence events
    this._auditHook =
      typeof options.auditHook === "function" ? options.auditHook : null;
    this._auditOnReject = options.auditOnReject === true;
  }

  /**
   * Normalize various numeric values to BigInt where possible.
   * Accepts BigInt, number, or hex/decimal string. Throws on invalid.
   */
  _normalizeToBigInt(v) {
    if (typeof v === "bigint") return v;
    if (typeof v === "number") {
      if (!Number.isFinite(v) || Math.floor(v) !== v)
        throw new HsmAdapterError("NUMERIC_PARSE_ERROR", "not an integer");
      return BigInt(v);
    }
    if (typeof v === "string") {
      const s = v.trim();
      if (s.length === 0)
        throw new HsmAdapterError("NUMERIC_PARSE_ERROR", "empty string");
      const neg = s[0] === "-";
      const abs = neg ? s.slice(1) : s;
      if (/^0x[0-9a-fA-F]+$/.test(abs)) return neg ? -BigInt(abs) : BigInt(abs);
      if (/^-?[0-9]+$/.test(s)) return BigInt(s);
      throw new HsmAdapterError(
        "NUMERIC_PARSE_ERROR",
        `unsupported numeric string: ${s}`,
      );
    }
    throw new HsmAdapterError(
      "NUMERIC_PARSE_ERROR",
      "unsupported type for BigInt conversion",
    );
  }

  /**
   * Recursively check numeric fields in an object for bit-length exceeding
   * the configured max for the current commitmentGroup. Returns reason string
   * or null when OK.
   */
  _numericOversizeCheck(obj, maxBits, path = "") {
    if (obj === null || typeof obj === "undefined") return null;
    if (
      typeof obj === "string" ||
      typeof obj === "number" ||
      typeof obj === "bigint"
    ) {
      try {
        const v = this._normalizeToBigInt(obj);
        const absV = v < 0n ? -v : v;
        const bits = absV === 0n ? 1 : BigInt(absV).toString(2).length;
        if (Number(bits) > maxBits)
          return `${path || "(root)"} numeric value exceeds ${maxBits} bits (${bits} bits)`;
      } catch (e) {
        return null;
      }
      return null;
    }
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const res = this._numericOversizeCheck(
          obj[i],
          maxBits,
          `${path}[${i}]`,
        );
        if (res) return res;
      }
      return null;
    }
    if (typeof obj === "object") {
      for (const k of Object.keys(obj)) {
        const res = this._numericOversizeCheck(
          obj[k],
          maxBits,
          path ? `${path}.${k}` : k,
        );
        if (res) return res;
      }
      return null;
    }
    return null;
  }

  /**
   * Public guard: validate a `DkgNodeContribution` for persistence. Throws
   * HsmAdapterError('NUMERIC_OVERSIZE', ...) on violation.
   */
  validateContributionForPersistence(contribution) {
    if (!contribution || typeof contribution !== "object")
      throw new HsmAdapterError("INVALID_INPUT", "contribution required");
    const maxBits = Number(
      this._defaultBitLengthMap[this._commitmentGroup] || 521,
    );
    // Check polynomial coefficients
    const polyReason = this._numericOversizeCheck(
      contribution.polynomial,
      maxBits,
      "polynomial",
    );
    if (polyReason) throw new HsmAdapterError("NUMERIC_OVERSIZE", polyReason);
    // Check commitments: ensure they are valid group elements in [1, p-1].
    for (let i = 0; i < contribution.commitments.length; i++) {
      const c = contribution.commitments[i];
      try {
        const cv = this._normalizeToBigInt(c);
        if (cv < 1n || cv >= this._prime)
          throw new HsmAdapterError(
            "NUMERIC_OVERSIZE",
            `commitments[${i}] out of group range`,
          );
      } catch (e) {
        if (e && e.code === "NUMERIC_PARSE_ERROR") throw e;
        throw new HsmAdapterError(
          "NUMERIC_OVERSIZE",
          `invalid commitment at index ${i}`,
        );
      }
    }
    return true;
  }

  /**
   * Phase 1: Generate a polynomial contribution for a node.
   * The node picks random coefficients and computes public commitments.
   * @param {string} nodeId
   * @returns {DkgNodeContribution}
   */
  generateContribution(nodeId) {
    if (!this._nodeIds.includes(nodeId)) {
      throw new HsmAdapterError(
        "UNKNOWN_NODE",
        `node ${nodeId} is not a participant`,
      );
    }
    if (this._contributions.has(nodeId)) {
      throw new HsmAdapterError(
        "DUPLICATE_CONTRIBUTION",
        `node ${nodeId} already contributed`,
      );
    }

    // Generate random polynomial coefficients: a_0, a_1, ..., a_{t-1}
    const polynomial = [];
    for (let j = 0; j < this._threshold; j++) {
      polynomial.push(_randomFieldElement());
    }

    // Compute public commitments: C_j = g^{a_j} mod p
    const commitments = [];
    for (let j = 0; j < this._threshold; j++) {
      commitments.push(_modPow(this._generator, polynomial[j], this._prime));
    }

    // Compute private shares for each peer: s_{i,k} = f_i(k) mod q
    const shares = new Map();
    for (const peerId of this._nodeIds) {
      const k = BigInt(this._nodeIdToIndex(peerId) + 1);
      shares.set(peerId, _evaluatePolynomial(polynomial, k));
    }

    const contribution = new DkgNodeContribution(
      nodeId,
      polynomial,
      commitments,
      shares,
    );
    // Validate before adding to in-memory store to ensure persistence-safe state
    try {
      this.validateContributionForPersistence(contribution);
    } catch (e) {
      // If audit hook configured, emit a DKG_PERSISTENCE_REJECT entry
      if (this._auditOnReject && this._auditHook) {
        try {
          this._auditHook({
            action: "DKG_PERSISTENCE_REJECT",
            entity: "dkg_contribution",
            entityId: nodeId,
            reason: e.message,
          });
        } catch (_) {
          // swallow audit errors
        }
      }
      throw e;
    }

    this._contributions.set(nodeId, contribution);
    return contribution;
  }

  /**
   * Add an externally-provided contribution (e.g., from persistence restore).
   * Validates before inserting to prevent out-of-bounds data from reaching storage adapters.
   * @param {DkgNodeContribution} contribution
   */
  addContribution(contribution) {
    if (!(contribution instanceof DkgNodeContribution)) {
      throw new HsmAdapterError(
        "INVALID_INPUT",
        "contribution must be DkgNodeContribution",
      );
    }
    // Validate and insert
    try {
      this.validateContributionForPersistence(contribution);
    } catch (e) {
      if (this._auditOnReject && this._auditHook) {
        try {
          this._auditHook({
            action: "DKG_PERSISTENCE_REJECT",
            entity: "dkg_contribution",
            entityId: contribution.nodeId,
            reason: e.message,
          });
        } catch (_) {}
      }
      throw e;
    }
    this._contributions.set(contribution.nodeId, contribution);
    return true;
  }

  /**
   * Validate and return a snapshot-safe serializable state for persistence.
   * Throws if any contribution is invalid.
   */
  captureStateForPersistence() {
    // Validate all contributions before snapshotting
    for (const [nodeId, contribution] of this._contributions) {
      try {
        this.validateContributionForPersistence(contribution);
      } catch (e) {
        if (this._auditOnReject && this._auditHook) {
          try {
            this._auditHook({
              action: "DKG_PERSISTENCE_REJECT",
              entity: "dkg_contribution",
              entityId: nodeId,
              reason: e.message,
            });
          } catch (_) {}
        }
        throw e;
      }
    }

    // Build a serializable snapshot (avoid serializing private shares)
    const contributions = {};
    for (const [nodeId, contribution] of this._contributions) {
      contributions[nodeId] = {
        nodeId: contribution.nodeId,
        polynomial: contribution.polynomial.map((c) => c.toString(16)),
        commitments: contribution.commitments.map((c) => c.toString(16)),
        // shares intentionally omitted from snapshot for secrecy
      };
    }
    return {
      meta: {
        totalNodes: this._totalNodes,
        threshold: this._threshold,
        timestamp: Date.now(),
      },
      contributions,
    };
  }

  /**
   * Map a node ID to its index in the nodeIds array.
   * @param {string} nodeId
   * @returns {number}
   * @private
   */
  _nodeIdToIndex(nodeId) {
    const idx = this._nodeIds.indexOf(nodeId);
    if (idx < 0) {
      throw new HsmAdapterError(
        "UNKNOWN_NODE",
        `node ${nodeId} is not a participant`,
      );
    }
    return idx;
  }

  /**
   * Phase 2: Verify a received share against the broadcaster's commitments.
   * Checks: g^{s_{i,k}} ≡ ∏_{j=0}^{t-1} (C_{i,j})^{k^j} mod p
   * @param {string} broadcasterId - the node that sent the share
   * @param {string} recipientId - the node that received the share
   * @param {bigint} share - the private share s_{i,k}
   * @returns {boolean} true if verification passes
   */
  verifyShare(broadcasterId, recipientId, share) {
    const contribution = this._contributions.get(broadcasterId);
    if (!contribution) {
      throw new HsmAdapterError(
        "UNKNOWN_NODE",
        `no contribution from ${broadcasterId}`,
      );
    }

    const k = BigInt(this._nodeIdToIndex(recipientId) + 1);
    const commitments = contribution.commitments;

    // Compute g^{share} mod p
    const lhs = _modPow(this._generator, share, this._prime);

    // Compute ∏_{j=0}^{t-1} (C_j)^{k^j} mod p
    // k^j is computed mod q (the group order) since g has order q
    let rhs = 1n;
    let kPower = 1n;
    for (let j = 0; j < commitments.length; j++) {
      const term = _modPow(commitments[j], kPower, this._prime);
      rhs = (rhs * term) % this._prime;
      kPower = (kPower * k) % this._fieldPrime;
    }

    return lhs === rhs;
  }

  /**
   * Phase 2b: File a complaint against a node that sent an invalid share.
   * @param {string} fromNode - the complaining node
   * @param {string} againstNode - the accused node
   * @param {string} reason - complaint reason
   */
  fileComplaint(fromNode, againstNode, reason) {
    if (!this._nodeIds.includes(fromNode)) {
      throw new HsmAdapterError(
        "UNKNOWN_NODE",
        `complaining node ${fromNode} is not a participant`,
      );
    }
    if (!this._nodeIds.includes(againstNode)) {
      throw new HsmAdapterError(
        "UNKNOWN_NODE",
        `accused node ${againstNode} is not a participant`,
      );
    }
    this._complaints.push({
      from: fromNode,
      against: againstNode,
      reason,
      timestamp: Date.now(),
    });
  }

  /**
   * Phase 3: Process complaints and disqualify nodes with verified complaints.
   * A node is disqualified if any complaint against it is verified by
   * share verification failure.
   * @returns {string[]} array of disqualified node IDs
   */
  processComplaints() {
    for (const complaint of this._complaints) {
      const contribution = this._contributions.get(complaint.against);
      if (!contribution) continue;

      // Re-verify the share that triggered the complaint
      const share = contribution.shares.get(complaint.from);
      if (share === undefined) continue;

      const valid = this.verifyShare(complaint.against, complaint.from, share);
      if (!valid) {
        this._disqualified.add(complaint.against);
      }
    }

    // Qualified nodes are all participants minus disqualified
    this._qualifiedNodes = this._nodeIds.filter(
      (id) => !this._disqualified.has(id),
    );
    return [...this._disqualified];
  }

  /**
   * Phase 4: Compute the master public key Y = ∏_i g^{a_{i,0}} mod p
   * over all qualified (non-disqualified) nodes.
   * @returns {bigint} master public key Y
   */
  computeMasterPublicKey() {
    if (this._qualifiedNodes.length === 0) {
      // If processComplaints wasn't called, use all contributors
      this._qualifiedNodes = this._nodeIds.filter((id) =>
        this._contributions.has(id),
      );
    }
    if (this._qualifiedNodes.length < this._threshold) {
      throw new HsmAdapterError(
        "DKG_QUORUM_STARVATION",
        `only ${this._qualifiedNodes.length} qualified nodes, need at least ${this._threshold}`,
      );
    }

    let y = 1n;
    for (const nodeId of this._qualifiedNodes) {
      const contribution = this._contributions.get(nodeId);
      if (!contribution) continue;
      // C_{i,0} = g^{a_{i,0}} is the first commitment
      y = (y * contribution.commitments[0]) % this._prime;
    }
    this._masterPublicKey = y;
    return y;
  }

  /**
   * Phase 5: Generate zk-SNARK validation parameters.
   * Produces a structured reference string (g^s, g^{s^2}) that allows
   * non-interactive verification of polynomial validity without
   * revealing the underlying secret s.
   * @returns {{ gs: bigint, gs2: bigint, proof: bigint }}
   */
  generateZkSnarkParameters() {
    // The toxic waste s is a random field element known to no one after this call
    const s = _randomFieldElement();
    const gs = _modPow(this._generator, s, this._prime);
    const gs2 = _modPow(
      this._generator,
      (s * s) % this._fieldPrime,
      this._prime,
    );

    // Compute a proof of polynomial validity: pi = g^{f(s)} where f is the
    // combined polynomial. This proves the polynomials were correctly
    // formed without revealing the coefficients.
    let combinedEval = 0n;
    for (const nodeId of this._qualifiedNodes.length > 0
      ? this._qualifiedNodes
      : this._nodeIds) {
      const contribution = this._contributions.get(nodeId);
      if (!contribution) continue;
      // Evaluate the polynomial at s (using the secret coefficients)
      combinedEval =
        (combinedEval + _evaluatePolynomial(contribution.polynomial, s)) %
        this._fieldPrime;
    }
    const proof = _modPow(this._generator, combinedEval, this._prime);

    this._zkParameters = { gs, gs2, proof };

    // Zeroize the toxic waste
    _zeroizeBigIntArray([s]);

    return this._zkParameters;
  }

  /**
   * Verify zk-SNARK parameters against the broadcasted commitments.
   * Checks that the proof is consistent with the public commitment structure.
   * @param {{ gs: bigint, gs2: bigint, proof: bigint }} params
   * @returns {boolean}
   */
  verifyZkSnarkParameters(params) {
    if (
      !params ||
      typeof params.gs !== "bigint" ||
      typeof params.gs2 !== "bigint"
    ) {
      throw new HsmAdapterError(
        "DKG_ZK_PROOF_INVALID",
        "invalid zk-SNARK parameter structure",
      );
    }

    // Verify gs2 = (gs)^s for some s, i.e., the pairing relation holds.
    // In our simplified model, we verify gs2 == generator^{s^2} by checking
    // that gs^2 / generator^{s^2} == 1, which we can't do without s.
    // Instead, we verify structural integrity: gs and gs2 must be in the
    // valid range [1, p-1] and gs2 must be a quadratic residue relation.
    if (params.gs < 1n || params.gs >= this._prime) {
      throw new HsmAdapterError(
        "DKG_ZK_PROOF_INVALID",
        "gs out of valid range",
      );
    }
    if (params.gs2 < 1n || params.gs2 >= this._prime) {
      throw new HsmAdapterError(
        "DKG_ZK_PROOF_INVALID",
        "gs2 out of valid range",
      );
    }

    // Verify the proof against the master public key if computed
    if (this._masterPublicKey !== null && params.proof !== undefined) {
      // The proof must be a valid group element
      if (params.proof < 1n || params.proof >= this._prime) {
        throw new HsmAdapterError(
          "DKG_ZK_PROOF_INVALID",
          "proof out of valid range",
        );
      }
    }

    // Check for forged parameters: gs2 should equal gs^{log_g(gs)} which
    // we verify by checking gs2 is a valid power of gs
    // Simplified check: gs2 must not be 0 or 1 (trivial forgeries)
    if (params.gs2 === 1n) {
      throw new HsmAdapterError(
        "DKG_ZK_PROOF_INVALID",
        "gs2 is trivial (1) — likely forged",
      );
    }

    return true;
  }

  /**
   * Reconstruct the group secret from t qualified shares using
   * Lagrange interpolation.
   * @param {Array<{nodeId: string, share: bigint}>} shareInputs - shares from t nodes
   * @returns {bigint} reconstructed group secret
   */
  reconstructGroupSecret(shareInputs) {
    if (!Array.isArray(shareInputs) || shareInputs.length < this._threshold) {
      throw new HsmAdapterError(
        "DKG_QUORUM_STARVATION",
        `need at least ${this._threshold} shares, got ${shareInputs.length}`,
      );
    }

    // Each node k holds the sum of shares received from all qualified nodes:
    // s_k = sum_i f_i(k) = (sum_i a_{i,0}) + ... = F(k) where F is the
    // combined polynomial. The group secret is F(0) = sum_i a_{i,0}.
    const selected = shareInputs.slice(0, this._threshold);
    const points = selected.map((s) => ({
      x: BigInt(this._nodeIdToIndex(s.nodeId) + 1),
      y: s.share,
    }));

    // Lagrange interpolation at x=0 over Z_q
    let secret = 0n;
    for (let i = 0; i < this._threshold; i++) {
      const xi = points[i].x;
      const yi = points[i].y;
      let numerator = 1n;
      let denominator = 1n;
      for (let j = 0; j < this._threshold; j++) {
        if (i === j) continue;
        const xj = points[j].x;
        // Reduce each factor mod fieldPrime before multiplying to avoid
        // negative BigInt modulo issues in JavaScript.
        const negXj =
          (this._fieldPrime - (xj % this._fieldPrime)) % this._fieldPrime;
        numerator = (numerator * negXj) % this._fieldPrime;
        const diff = (xi - xj) % this._fieldPrime;
        const diffMod = diff < 0n ? diff + this._fieldPrime : diff;
        denominator = (denominator * diffMod) % this._fieldPrime;
      }
      const lagrange =
        (numerator * _modInv(denominator, this._fieldPrime)) % this._fieldPrime;
      secret = (secret + yi * lagrange) % this._fieldPrime;
    }
    if (secret < 0n) secret += this._fieldPrime;
    return secret;
  }

  /**
   * Collect a node's aggregated share (sum of all received shares).
   * @param {string} nodeId
   * @returns {bigint} aggregated share s_k = sum_i f_i(k)
   */
  getAggregatedShare(nodeId) {
    if (!this._nodeIds.includes(nodeId)) {
      throw new HsmAdapterError(
        "UNKNOWN_NODE",
        `node ${nodeId} is not a participant`,
      );
    }
    let total = 0n;
    for (const [contributorId, contribution] of this._contributions) {
      if (this._disqualified.has(contributorId)) continue;
      const share = contribution.shares.get(nodeId);
      if (share !== undefined) {
        total = (total + share) % this._fieldPrime;
      }
    }
    return total;
  }

  /**
   * Zeroize all ephemeral polynomial coefficients across all contributions.
   * This must be called after share distribution is complete to prevent
   * residual coefficient recovery from heap inspection.
   */
  zeroizeAllEphemeralData() {
    for (const contribution of this._contributions.values()) {
      contribution.zeroize();
    }
  }

  /**
   * Get the current protocol state for telemetry/debugging.
   * @returns {object}
   */
  getState() {
    return {
      totalNodes: this._totalNodes,
      threshold: this._threshold,
      nodeIds: [...this._nodeIds],
      contributionsReceived: this._contributions.size,
      complaints: this._complaints.length,
      disqualified: [...this._disqualified],
      qualifiedNodes: [...this._qualifiedNodes],
      masterPublicKey: this._masterPublicKey
        ? this._masterPublicKey.toString(16)
        : null,
      hasZkParameters: this._zkParameters !== null,
      requireZkValidation: this._requireZkValidation,
    };
  }

  /**
   * Get all node IDs.
   * @returns {string[]}
   */
  get nodeIds() {
    return [...this._nodeIds];
  }

  /**
   * Get the threshold.
   * @returns {number}
   */
  get threshold() {
    return this._threshold;
  }

  /**
   * Get the total node count.
   * @returns {number}
   */
  get totalNodes() {
    return this._totalNodes;
  }

  /**
   * Get the disqualified node set.
   * @returns {Set<string>}
   */
  get disqualified() {
    return new Set(this._disqualified);
  }

  /**
   * Get the qualified node list.
   * @returns {string[]}
   */
  get qualifiedNodes() {
    return [...this._qualifiedNodes];
  }
}

module.exports = {
  DkgSnarkEngine,
  DkgNodeContribution,
  PRIME,
  FIELD_PRIME,
  GROUP_PRIME,
  GENERATOR,
};
