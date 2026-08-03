"use strict";

class PoRepVerifier {
  constructor() {
    this.metrics = { verifications: 0, failures: 0 };
  }

  async verify(proof, options = {}) {
    this.metrics.verifications += 1;
    await new Promise((r) => setTimeout(r, 15));
    if (proof && proof.valid) return { valid: true };
    this.metrics.failures += 1;
    return { valid: false, reason: 'invalid' };
  }
}

module.exports = PoRepVerifier;
