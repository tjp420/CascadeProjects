'use strict';

/**
 * Master KEK rotation unit tests.
 */
const crypto = require('crypto');
const { SoftwareHsmAdapter } = require('../software-adapter.cjs');

describe('Master KEK Rotation Suite', () => {
  let adapter;

  beforeEach(async () => {
    adapter = new SoftwareHsmAdapter({ kekBits: 256 });
    await adapter.initialize();
  });

  const initialKeyring = {
    algorithm: 'X25519+ML-KEM-768',
    keyringId: 'rt-rotation-1',
    createdAt: new Date().toISOString(),
    keyCount: 1,
    keys: [
      { id: 'k1', alg: 'X25519', material: 'secret' },
    ],
  };

  describe('happy path transitions', () => {
    [
      [256, 128],
      [256, 192],
      [256, 256],
      [128, 256],
      [192, 128],
    ].forEach(([oldBits, newBits]) => {
      test(`${oldBits}-bit -> ${newBits}-bit rotation round-trips`, async () => {
        const oldKek = crypto.randomBytes(oldBits / 8);
        const newKek = crypto.randomBytes(newBits / 8);

        const originalEnvelope = await adapter.exportKeyring(initialKeyring, oldKek);
        const rotatedEnvelope = await adapter.rotateKeyring(originalEnvelope, oldKek, newKek);

        expect(Buffer.isBuffer(rotatedEnvelope)).toBe(true);
        expect(rotatedEnvelope.subarray(0, 4).toString('ascii')).toBe('T10K');

        const reconstituted = await adapter.importKeyring(rotatedEnvelope, newKek);
        expect(reconstituted).toEqual(initialKeyring);
      });
    });
  });

  test('rejects an invalid origin KEK with ENVELOPE_INTEGRITY', async () => {
    const oldKek = crypto.randomBytes(32);
    const newKek = crypto.randomBytes(16);
    const originalEnvelope = await adapter.exportKeyring(initialKeyring, oldKek);
    const wrongOldKek = crypto.randomBytes(32);

    await expect(adapter.rotateKeyring(originalEnvelope, wrongOldKek, newKek))
      .rejects
      .toMatchObject({
        name: 'HsmAdapterError',
        code: 'ENVELOPE_INTEGRITY',
        message: expect.stringMatching(/HSM Key rotation failure/),
      });
  });

  test('rejects an invalid or malformed new KEK length before committing', async () => {
    const oldKek = crypto.randomBytes(32);
    const malformedNewKek = crypto.randomBytes(17); // 136 bits
    const originalEnvelope = await adapter.exportKeyring(initialKeyring, oldKek);

    await expect(adapter.rotateKeyring(originalEnvelope, oldKek, malformedNewKek))
      .rejects
      .toMatchObject({
        name: 'HsmAdapterError',
        code: 'INVALID_KEK_LENGTH',
        message: expect.stringMatching(/HSM Key rotation failure/),
      });
  });
});
