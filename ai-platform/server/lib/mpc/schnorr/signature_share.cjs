const { PrimeField } = require('./field.cjs');

class SchnorrShareEvaluator {
  constructor(modulus, subgroupOrder = modulus) {
    this.field = new PrimeField(modulus);
    this.subgroupOrder = subgroupOrder === undefined || subgroupOrder === null ? this.field.q : BigInt(subgroupOrder);
  }

  /**
   * Validates that a value is a BigInt (or can be coerced to one) and is within range.
   * @param {*} value - The value to validate.
   * @param {string} name - The parameter name for error messages.
   * @param {boolean} [allowZero=true] - Whether zero is a valid value.
   * @returns {bigint} The validated BigInt value.
   */
  _validateBigInt(value, name, allowZero = true) {
    if (value === undefined || value === null) {
      throw new Error(`SchnorrShareEvaluator: ${name} is required`);
    }
    let bg;
    try {
      bg = BigInt(value);
    } catch (e) {
      throw new Error(`SchnorrShareEvaluator: ${name} must be a BigInt or BigInt-coercible, got ${typeof value}`);
    }
    if (!allowZero && bg === 0n) {
      throw new Error(`SchnorrShareEvaluator: ${name} must not be zero`);
    }
    if (bg < 0n || bg >= this.subgroupOrder) {
      throw new Error(`SchnorrShareEvaluator: ${name} must be in subgroup range [0, q-1]`);
    }
    return bg;
  }

  /**
   * Evaluates a localized partial signature share scalar: s_i = (c * x_i * lambda_i) + k_i1 + (b * k_i2) mod q
   * All secret scalars live in the prime-order subgroup of order q, so the result is
   * reduced modulo q. The public verification equation is:
   *   g^{s_i} == (X_i)^{c * lambda_i} * R_i1 * (R_i2)^b  (mod p)
   */
  evaluatePartialShare({ challenge, secretKeyShare, lagrangeWeight, secretNonces, bindingFactor }) {
    if (challenge === undefined || challenge === null) {
      throw new Error('SchnorrShareEvaluator.evaluatePartialShare: challenge is required');
    }
    if (secretKeyShare === undefined || secretKeyShare === null) {
      throw new Error('SchnorrShareEvaluator.evaluatePartialShare: secretKeyShare is required');
    }
    if (lagrangeWeight === undefined || lagrangeWeight === null) {
      throw new Error('SchnorrShareEvaluator.evaluatePartialShare: lagrangeWeight is required');
    }
    if (!secretNonces || typeof secretNonces !== 'object') {
      throw new Error('SchnorrShareEvaluator.evaluatePartialShare: secretNonces object is required');
    }
    if (secretNonces.k1 === undefined || secretNonces.k1 === null) {
      throw new Error('SchnorrShareEvaluator.evaluatePartialShare: secretNonces.k1 is required');
    }
    if (secretNonces.k2 === undefined || secretNonces.k2 === null) {
      throw new Error('SchnorrShareEvaluator.evaluatePartialShare: secretNonces.k2 is required');
    }
    if (bindingFactor === undefined || bindingFactor === null) {
      throw new Error('SchnorrShareEvaluator.evaluatePartialShare: bindingFactor is required');
    }

    const c = this._validateBigInt(challenge, 'challenge');
    const x = this._validateBigInt(secretKeyShare, 'secretKeyShare');
    const lambda = this._validateBigInt(lagrangeWeight, 'lagrangeWeight');
    const k1 = this._validateBigInt(secretNonces.k1, 'secretNonces.k1');
    const k2 = this._validateBigInt(secretNonces.k2, 'secretNonces.k2');
    const b = this._validateBigInt(bindingFactor, 'bindingFactor');

    const q = this.subgroupOrder;

    const secretPart = (((c * x) % q) * lambda) % q;
    const noncePart = (k1 + ((b * k2) % q)) % q;

    return (secretPart + noncePart) % q;
  }

  // Zeroize secret nonces (in-place) to reduce memory lifetime of secrets.
  zeroizeSecretNonces(secretNonces) {
    if (!secretNonces) return;
    if (typeof secretNonces.k1 !== 'undefined') secretNonces.k1 = 0n;
    if (typeof secretNonces.k2 !== 'undefined') secretNonces.k2 = 0n;
  }
}

module.exports = { SchnorrShareEvaluator };
