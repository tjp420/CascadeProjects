const SoftHsmAdapter = require('../hsm-adapter/softHsmAdapter.cjs');
const crypto = require('crypto');

// Skip these integration tests when pkcs11js is not available (e.g., no SoftHSM).
// They require a real PKCS#11 token to be provisioned — see the SoftHSM CI job.
const PKCS11_AVAILABLE = (() => {
  try { require('pkcs11js'); return true; } catch { return false; }
})();

const describeOrSkip = PKCS11_AVAILABLE ? describe : describe.skip;

describeOrSkip('SoftHSM Adapter Integration Tests', () => {
  let adapter;

  beforeAll(() => {
    adapter = new SoftHsmAdapter({
      libraryPath: process.env.SOFTHSM2_LIB || '/usr/lib/softhsm/libsofthsm2.so',
      slotLabel: 'Track10-Token',
      pin: '1234'
    });
    adapter.initialize();
  });

  afterAll(() => {
    if (adapter) {
      try { adapter.finalize(); } catch (e) {}
    }
  });

  test('Should successfully generate an AES-256 KEK on the token', () => {
    const kekLabel = `test-kek-${Date.now()}`;
    const createdLabel = adapter.createKEK({ label: kekLabel });
    expect(createdLabel).toBeDefined();

    const keks = adapter.listKEKs();
    const labels = keks.map((r) => r.label).filter(Boolean);
    expect(labels).toContain(kekLabel);
  });

  test('Should execute an AES-KW wrap and in-token unwrap (non-extractable) round-trip', () => {
    const kekLabel = `test-wrap-kek-${Date.now()}`;
    adapter.createKEK({ label: kekLabel });

    // Generate a 32-byte dummy CEK to wrap
    const originalCEK = crypto.randomBytes(32);

    // Perform AES-KW wrap operation
    const wrappedCEK = adapter.wrap(kekLabel, originalCEK);
    // Wrapped length for RFC-3394: (n+1)*8 where n = CEK length / 8 => (4+1)*8 = 40
    expect(wrappedCEK.length).toBe(40);

    // Perform AES-KW unwrap operation and receive an in-token key handle
    const unwrappedCEKHandle = adapter.unwrap(kekLabel, wrappedCEK);
    expect(unwrappedCEKHandle).toBeDefined();
    expect(unwrappedCEKHandle).not.toBeNull();
  });
});
