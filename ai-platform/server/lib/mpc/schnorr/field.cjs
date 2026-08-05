// Prime field arithmetic using native BigInt
class PrimeField {
  constructor(modulus) {
    this.q = BigInt(modulus);
  }

  toBig(a) {
    return BigInt(a);
  }

  add(a, b) {
    return (this.toBig(a) + this.toBig(b)) % this.q;
  }

  sub(a, b) {
    return (this.toBig(a) - this.toBig(b) + this.q) % this.q;
  }

  mul(a, b) {
    return (this.toBig(a) * this.toBig(b)) % this.q;
  }

  neg(a) {
    return (this.q - (this.toBig(a) % this.q)) % this.q;
  }

  inv(a) {
    let t = 0n, newT = 1n;
    let r = this.q, newR = this.toBig(a) % this.q;
    while (newR !== 0n) {
      const quotient = r / newR;
      const tmpT = newT;
      newT = t - quotient * newT;
      t = tmpT;
      const tmpR = newR;
      newR = r - quotient * newR;
      r = tmpR;
    }
    if (r > 1n) throw new Error('NOT_INVERTIBLE');
    if (t < 0n) t += this.q;
    return t;
  }

  div(a, b) {
    return this.mul(a, this.inv(b));
  }

  exp(base, e) {
    let result = 1n;
    let b = this.toBig(base) % this.q;
    let exp = this.toBig(e);
    if (exp < 0n) {
      b = this.inv(b);
      exp = -exp;
    }
    while (exp > 0n) {
      if (exp % 2n === 1n) result = this.mul(result, b);
      b = this.mul(b, b);
      exp = exp / 2n;
    }
    return result;
  }
}

module.exports = { PrimeField };
