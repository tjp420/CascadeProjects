const { PrimeField, normalizeToBigInt } = require('./field.cjs');

class SchnorrShareEvaluator {
  constructor(modulus) {
    this.field = new PrimeField(modulus);
  }

  /**
   * Evaluates a localized partial signature share: s_i = (c * x_i * lambda_i) + k_i1 + (b_i * k_i2) mod q
   */
  evaluatePartialShare({ challenge, secretKeyShare, lagrangeWeight, secretNonces, bindingFactor }) {
    const c = normalizeToBigInt(challenge);
    const x = normalizeToBigInt(secretKeyShare);
    const lambda = normalizeToBigInt(lagrangeWeight);

    // effective secret component: (c * x * lambda) mod q
    const keyProduct = this.field.mul(c, x);
    const effectiveSecret = this.field.mul(keyProduct, lambda);

    // blended nonce: k1 + b * k2
    const k1 = normalizeToBigInt(secretNonces.k1);
    const k2 = normalizeToBigInt(secretNonces.k2);
    const b = normalizeToBigInt(bindingFactor);
    const blended = this.field.add(k1, this.field.mul(b, k2));

    return this.field.add(effectiveSecret, blended);
  }

  // Zeroize secret nonces (in-place) to reduce memory lifetime of secrets.
  zeroizeSecretNonces(secretNonces) {
    if (!secretNonces) return;
    if (typeof secretNonces.k1 !== 'undefined') secretNonces.k1 = 0n;
    if (typeof secretNonces.k2 !== 'undefined') secretNonces.k2 = 0n;
  }
}

module.exports = { SchnorrShareEvaluator };
