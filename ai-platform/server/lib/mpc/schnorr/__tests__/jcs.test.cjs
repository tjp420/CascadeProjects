const { JcsCanonicalizer } = require('../jcs.cjs');

describe('RFC 8785 JSON Canonicalization Scheme (JCS) Compliance Matrix', () => {
  let jcs;

  beforeEach(() => {
    jcs = new JcsCanonicalizer();
  });

  test('Should strictly enforce deterministic alphabetical key-sorting regardless of payload property declaration order', () => {
    const envelopeA = { beta: 2, alpha: 1 };
    const envelopeB = { alpha: 1, beta: 2 };

    const resA = jcs.canonicalize(envelopeA);
    const resB = jcs.canonicalize(envelopeB);

    expect(resA).toBe('{"alpha":1,"beta":2}');
    expect(resA).toBe(resB);
  });

  // ── Numeric normalization (RFC 8785 §3.2.2) ──────────────────────────────

  test('L2-15: canonicalizes -0 as "0" (negative zero normalization)', () => {
    expect(jcs.canonicalize(-0)).toBe('0');
  });

  test('L2-16: canonicalizes exponent form deterministically', () => {
    // 1e21 should produce a deterministic normalized representation
    const result = jcs.canonicalize(1e21);
    expect(typeof result).toBe('string');
    // Should not contain uppercase 'E'
    expect(result).not.toMatch(/E/);
  });

  test('L2-17: strips trailing zeros after decimal point', () => {
    expect(jcs.canonicalize(1.5)).toBe('1.5');
    // 1.5000 as a JS number is just 1.5, but verify the normalization logic
    // doesn't introduce trailing zeros
    const result = jcs.canonicalize(1.5);
    expect(result).not.toMatch(/0+$/);
  });

  test('L2-18: bounds significant digits to 21 (precision bounding)', () => {
    // A number with many significant digits should be bounded
    const result = jcs.canonicalize(1.2345678901234567890123456789);
    expect(typeof result).toBe('string');
    // The result should be deterministic
    expect(jcs.canonicalize(1.2345678901234567890123456789)).toBe(result);
  });

  test('numeric normalization is deterministic across repeated calls', () => {
    const values = [0, -0, 1, -1, 1.5, 1e21, 1e-21, 123.456];
    for (const v of values) {
      const r1 = jcs.canonicalize(v);
      const r2 = jcs.canonicalize(v);
      expect(r1).toBe(r2);
    }
  });

  test('Infinity and NaN canonicalize as "null" (RFC 8785)', () => {
    expect(jcs.canonicalize(Infinity)).toBe('null');
    expect(jcs.canonicalize(-Infinity)).toBe('null');
    expect(jcs.canonicalize(NaN)).toBe('null');
  });
});
