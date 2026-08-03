const { PrimeField } = require('./field.cjs');

class SchnorrThresholdAggregator {
  constructor(modulus) {
    this.field = new PrimeField(modulus);
  }

  // Compute Lagrange coefficient for interpolation at 0 for participant i
  // quorum is array of numeric identifiers (small integers)
  computeLagrangeWeight(i, quorum) {
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
}

module.exports = { SchnorrThresholdAggregator };
