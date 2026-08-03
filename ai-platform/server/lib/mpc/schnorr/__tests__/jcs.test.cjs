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
});
