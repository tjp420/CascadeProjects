const crypto = require('crypto');
const { PrimeField } = require('./field.cjs');

class SchnorrThresholdAggregator {
  constructor(modulus) {
    this.field = new PrimeField(modulus);
  }

  /**
   * Validate that a value is a BigInt or BigInt-coercible and in field range.
   * @private
   */
  _validateBigInt(value, name, allowZero = true) {
    if (value === undefined || value === null) {
      throw new Error(`SchnorrThresholdAggregator: ${name} is required`);
    }
    let bg;
    try {
      bg = BigInt(value);
    } catch (e) {
      throw new Error(`SchnorrThresholdAggregator: ${name} must be a BigInt or BigInt-coercible, got ${typeof value}`);
    }
    if (!allowZero && bg === 0n) {
      throw new Error(`SchnorrThresholdAggregator: ${name} must not be zero`);
    }
    if (bg < 0n || bg >= this.field.q) {
      throw new Error(`SchnorrThresholdAggregator: ${name} must be in field range [0, q-1]`);
    }
    return bg;
  }

  /**
   * Hash arbitrary BigInts/strings to a field element using SHA-256.
   * @private
   */
  _hashToField(...parts) {
    const hasher = crypto.createHash('sha256');
    for (const p of parts) {
      const str = typeof p === 'bigint' ? p.toString(16) : String(p);
      hasher.update(str);
    }
    return BigInt('0x' + hasher.digest('hex')) % this.field.q;
  }

  // Compute Lagrange coefficient for interpolation at 0 for participant i
  // quorum is array of numeric identifiers (small integers)
  computeLagrangeWeight(i, quorum) {
    if (i === undefined || i === null) {
      throw new Error('SchnorrThresholdAggregator.computeLagrangeWeight: i is required');
    }
    if (!Array.isArray(quorum)) {
      throw new Error('SchnorrThresholdAggregator.computeLagrangeWeight: quorum must be an array');
    }
    if (quorum.length < 2) {
      throw new Error('SchnorrThresholdAggregator.computeLagrangeWeight: quorum must have at least 2 elements');
    }
    // Check for duplicates
    const seen = new Set();
    for (const q of quorum) {
      const qs = String(q);
      if (seen.has(qs)) {
        throw new Error('SchnorrThresholdAggregator.computeLagrangeWeight: quorum contains duplicate participant IDs');
      }
      seen.add(qs);
    }
    // Check that i is in quorum
    const idxStr = String(i);
    if (!seen.has(idxStr)) {
      throw new Error(`SchnorrThresholdAggregator.computeLagrangeWeight: participant ${i} is not in quorum`);
    }

    const idx = BigInt(i);
    let num = 1n;
    let den = 1n;
    for (const j of quorum) {
      const jdx = BigInt(j);
      if (jdx === idx) continue;
      // numerator multiply by (-j)
      num = this.field.mul(num, this.field.neg(jdx));
      // denominator multiply by (i - j)
      den = this.field.mul(den, this.field.sub(idx, jdx));
    }
    return this.field.mul(num, this.field.inv(den));
  }

  /**
   * Compute the Schnorr challenge: c = H(R || P || m) mod q
   * @param {bigint} aggPublicKey - Aggregated public key (field element)
   * @param {bigint} aggNonce - Aggregated public nonce R (field element)
   * @param {string|bigint} messageHash - Message hash (hex string or BigInt)
   * @returns {bigint} Challenge value in field range [0, q-1]
   */
  computeChallenge(aggPublicKey, aggNonce, messageHash) {
    if (aggPublicKey === undefined || aggPublicKey === null) {
      throw new Error('SchnorrThresholdAggregator.computeChallenge: aggPublicKey is required');
    }
    if (aggNonce === undefined || aggNonce === null) {
      throw new Error('SchnorrThresholdAggregator.computeChallenge: aggNonce is required');
    }
    if (messageHash === undefined || messageHash === null) {
      throw new Error('SchnorrThresholdAggregator.computeChallenge: messageHash is required');
    }
    const P = this._validateBigInt(aggPublicKey, 'aggPublicKey');
    const R = this._validateBigInt(aggNonce, 'aggNonce');
    return this._hashToField(R, P, messageHash);
  }

  /**
   * Compute the MuSig2 binding factor: b = H(P || R1 || R2 || ...) mod q
   * @param {bigint} aggPublicKey - Aggregated public key
   * @param {Array<{h1: string, h2: string}>} nonceCommitments - Per-participant nonce commitments
   * @returns {bigint} Binding factor in field range [0, q-1]
   */
  computeBindingFactor(aggPublicKey, nonceCommitments) {
    if (aggPublicKey === undefined || aggPublicKey === null) {
      throw new Error('SchnorrThresholdAggregator.computeBindingFactor: aggPublicKey is required');
    }
    if (!Array.isArray(nonceCommitments) || nonceCommitments.length === 0) {
      throw new Error('SchnorrThresholdAggregator.computeBindingFactor: nonceCommitments must be a non-empty array');
    }
    const P = this._validateBigInt(aggPublicKey, 'aggPublicKey');
    const parts = [P];
    for (let i = 0; i < nonceCommitments.length; i++) {
      const nc = nonceCommitments[i];
      if (!nc || (!nc.h1 && !nc.h2)) {
        throw new Error(`SchnorrThresholdAggregator.computeBindingFactor: nonceCommitments[${i}] missing h1/h2`);
      }
      if (nc.h1) parts.push(nc.h1);
      if (nc.h2) parts.push(nc.h2);
    }
    return this._hashToField(...parts);
  }

  /**
   * Aggregate individual public keys using Lagrange-weighted sum.
   * P_agg = sum(P_i * lambda_i) mod q
   * @param {Array<bigint>} publicKeys - Per-participant public keys (field elements)
   * @param {Array<number>} [quorum] - Optional quorum IDs (defaults to [1, 2, ..., n])
   * @returns {bigint} Aggregated public key
   */
  aggregatePublicKeys(publicKeys, quorum) {
    if (!Array.isArray(publicKeys) || publicKeys.length === 0) {
      throw new Error('SchnorrThresholdAggregator.aggregatePublicKeys: publicKeys must be a non-empty array');
    }
    if (publicKeys.length === 1) {
      return this._validateBigInt(publicKeys[0], 'publicKeys[0]');
    }
    const ids = quorum || publicKeys.map((_, i) => i + 1);
    if (ids.length !== publicKeys.length) {
      throw new Error('SchnorrThresholdAggregator.aggregatePublicKeys: quorum length must match publicKeys length');
    }
    let agg = 0n;
    for (let i = 0; i < publicKeys.length; i++) {
      const P = this._validateBigInt(publicKeys[i], `publicKeys[${i}]`);
      const lambda = this.computeLagrangeWeight(ids[i], ids);
      agg = this.field.add(agg, this.field.mul(P, lambda));
    }
    return agg;
  }

  /**
   * Aggregate individual public nonce commitments.
   * R_agg = sum(R_i * b_i) mod q where b_i is the binding factor
   * @param {Array<bigint>} publicNonces - Per-participant public nonces (h1 values as BigInt)
   * @param {bigint} bindingFactor - Computed binding factor
   * @returns {bigint} Aggregated nonce
   */
  aggregateNonces(publicNonces, bindingFactor) {
    if (!Array.isArray(publicNonces) || publicNonces.length === 0) {
      throw new Error('SchnorrThresholdAggregator.aggregateNonces: publicNonces must be a non-empty array');
    }
    if (bindingFactor === undefined || bindingFactor === null) {
      throw new Error('SchnorrThresholdAggregator.aggregateNonces: bindingFactor is required');
    }
    const b = this._validateBigInt(bindingFactor, 'bindingFactor');
    let agg = 0n;
    for (let i = 0; i < publicNonces.length; i++) {
      const R = this._validateBigInt(publicNonces[i], `publicNonces[${i}]`);
      agg = this.field.add(agg, this.field.mul(R, b));
    }
    return agg;
  }

  /**
   * Assemble the final signature from aggregated nonce and partial shares.
   * s = sum(s_i) mod q
   * @param {bigint} aggNonce - Aggregated public nonce R
   * @param {Array<bigint>} partialShares - Per-participant partial signature shares
   * @returns {{R: bigint, s: bigint}} Final signature (R, s)
   */
  assembleSignature(aggNonce, partialShares) {
    if (aggNonce === undefined || aggNonce === null) {
      throw new Error('SchnorrThresholdAggregator.assembleSignature: aggNonce is required');
    }
    if (!Array.isArray(partialShares) || partialShares.length === 0) {
      throw new Error('SchnorrThresholdAggregator.assembleSignature: partialShares must be a non-empty array');
    }
    const R = this._validateBigInt(aggNonce, 'aggNonce');
    let s = 0n;
    for (let i = 0; i < partialShares.length; i++) {
      const si = this._validateBigInt(partialShares[i], `partialShares[${i}]`);
      s = this.field.add(s, si);
    }
    return { R, s };
  }

  /**
   * Verify a Schnorr signature against an aggregate public key.
   * For BigInt-based field arithmetic (no elliptic curve point arithmetic),
   * we verify the algebraic relation: s ≡ c * x_agg + r_agg (mod q)
   * where x_agg is the aggregate private key (for testing) or via
   * the discrete log relation s*G ≡ R + c*P (for EC-based verification).
   *
   * Since this implementation uses field arithmetic only (no EC points),
   * we verify the linear relation: s ≡ k_agg + c * x_agg (mod q)
   * where k_agg = sum(k_i1 + b_i * k_i2) and x_agg = sum(x_i * lambda_i).
   *
   * For external verification (without private keys), the caller should
   * use EC point arithmetic: verify s*G == R + c*P_agg.
   *
   * @param {bigint} aggPublicKey - Aggregated public key (x_agg for field-based verification)
   * @param {bigint} aggNonce - Aggregated nonce R
   * @param {{R: bigint, s: bigint}} signature - Final signature
   * @param {string|bigint} messageHash - Message hash
   * @param {object} [options] - Verification options
   * @param {bigint} [options.aggPrivateKey] - Aggregate private key for field-based verification
   * @param {bigint} [options.aggSecretNonce] - Aggregate secret nonce for field-based verification
   * @returns {boolean} True if signature verifies
   */
  verifySignature(aggPublicKey, aggNonce, signature, messageHash, options = {}) {
    if (!signature || typeof signature !== 'object') {
      throw new Error('SchnorrThresholdAggregator.verifySignature: signature object is required');
    }
    if (signature.R === undefined || signature.s === undefined) {
      throw new Error('SchnorrThresholdAggregator.verifySignature: signature must have R and s components');
    }
    const P = this._validateBigInt(aggPublicKey, 'aggPublicKey');
    const R = this._validateBigInt(aggNonce, 'aggNonce');
    const s = this._validateBigInt(signature.s, 'signature.s');
    const sigR = this._validateBigInt(signature.R, 'signature.R');

    // R must match
    if (sigR !== R) {
      return false;
    }

    // Compute challenge
    const c = this.computeChallenge(P, R, messageHash);

    // Field-based verification (for testing without EC points):
    // s ≡ k_agg + c * x_agg (mod q)
    if (options.aggPrivateKey !== undefined && options.aggSecretNonce !== undefined) {
      const x_agg = this._validateBigInt(options.aggPrivateKey, 'aggPrivateKey');
      const k_agg = this._validateBigInt(options.aggSecretNonce, 'aggSecretNonce');
      const expected = this.field.add(k_agg, this.field.mul(c, x_agg));
      return s === expected;
    }

    // EC-based verification would go here:
    // verify s*G == R + c*P_agg
    // This requires EC point arithmetic which is not available in this
    // field-only implementation. For now, return false if no private
    // key material is provided (fail-closed).
    throw new Error('SchnorrThresholdAggregator.verifySignature: EC-based verification requires aggPrivateKey and aggSecretNonce for field-based verification (no EC point arithmetic available)');
  }
}

module.exports = { SchnorrThresholdAggregator };
