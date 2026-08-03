const { JcsCanonicalizer } = require('../jcs.cjs');

describe('JCS Unicode NFC normalization and codepoint key ordering', () => {
  let jcs;
  beforeEach(() => { jcs = new JcsCanonicalizer(); });

  test('string values are normalized to NFC', () => {
    const decomposed = 'A\u030A'; // A + ring
    const res = jcs.canonicalize({ s: decomposed });
    // Normalized to single codepoint \u00C5 (Å)
    expect(res).toBe('{"s":"Å"}');
  });
});
