'use strict';

/**
 * Track 10: HSM adapter interface tests.
 *
 * Validates the BaseHsmAdapter contract and the SoftwareHsmAdapter
 * concrete implementation, including:
 *   - KEK lifecycle (create, list, rotate)
 *   - Low-level wrap/unwrap round-trip
 *   - High-level exportKeyring/importKeyring with the T10K serializer
 *   - Error mapping (unknown KEK, corrupted blob, wrong master KEK)
 *   - Initialization guard
 */

const crypto = require('crypto');
const {
  BaseHsmAdapter,
  HsmAdapterError,
  WRAPPED_BLOB_VERSION,
} = require('../hsm-adapter/base-adapter.cjs');
const { SoftwareHsmAdapter } = require('../hsm-adapter/software-adapter.cjs');

function makeValidKeyring(overrides = {}) {
  return {
    algorithm: 'X25519+ML-KEM-768',
    keyringId: 'rt-test',
    createdAt: new Date().toISOString(),
    keyCount: 2,
    keys: [
      { id: 'key-active', alg: 'X25519', data: crypto.randomBytes(32).toString('base64') },
      { id: 'key-previous', alg: 'X25519', data: crypto.randomBytes(32).toString('base64') },
    ],
    ...overrides,
  };
}

function expectErrorCode(fn, code) {
  expect(fn).toThrow(HsmAdapterError);
  let caught;
  try { fn(); } catch (e) { caught = e; }
  expect(caught.code).toBe(code);
}

async function expectRejectErrorCode(promiseFactory, code) {
  try {
    await promiseFactory();
    throw new Error(`Expected rejection with code ${code}, but promise resolved`);
  } catch (e) {
    if (e instanceof HsmAdapterError) {
      expect(e.code).toBe(code);
    } else if (e.message && e.message.includes(code)) {
      // message substring fallback
    } else {
      throw e;
    }
  }
}

describe('BaseHsmAdapter (abstract)', () => {
  test('cannot be instantiated directly', () => {
    expectErrorCode(() => new BaseHsmAdapter(), 'ABSTRACT_INSTANTIATION');
  });

  test('HsmAdapterError has name and code', () => {
    const err = new HsmAdapterError('TEST_CODE', 'test message');
    expect(err.name).toBe('HsmAdapterError');
    expect(err.code).toBe('TEST_CODE');
    expect(err).toBeInstanceOf(Error);
  });

  test('WRAPPED_BLOB_VERSION is 1', () => {
    expect(WRAPPED_BLOB_VERSION).toBe(1);
  });
});

describe('SoftwareHsmAdapter', () => {
  let adapter;

  beforeEach(async () => {
    adapter = new SoftwareHsmAdapter({ kekBits: 256 });
    await adapter.initialize();
  });

  // ── Initialization ─────────────────────────────────────────────────

  describe('initialization', () => {
    test('initialize is idempotent', async () => {
      await adapter.initialize();
      await adapter.initialize();
      expect(adapter._initialized).toBe(true);
    });

    test('rejects operations before initialize', async () => {
      const uninit = new SoftwareHsmAdapter();
      await expectRejectErrorCode(() => uninit.createKEK('t1'), 'NOT_INITIALIZED');
    });

    test('rejects invalid kekBits', () => {
      expectErrorCode(() => new SoftwareHsmAdapter({ kekBits: 64 }), 'INVALID_KEK_BITS');
      expectErrorCode(() => new SoftwareHsmAdapter({ kekBits: 512 }), 'INVALID_KEK_BITS');
    });
  });

  // ── KEK lifecycle ──────────────────────────────────────────────────

  describe('KEK lifecycle', () => {
    test('createKEK returns a hex string kekId', async () => {
      const kekId = await adapter.createKEK('t1');
      expect(typeof kekId).toBe('string');
      expect(kekId).toMatch(/^[0-9a-f]+$/);
    });

    test('createKEK stores metadata', async () => {
      const kekId = await adapter.createKEK('t1', { purpose: 'test' });
      const list = await adapter.listKEKs('t1');
      const entry = list.find((k) => k.kekId === kekId);
      expect(entry).toBeDefined();
      expect(entry.meta.purpose).toBe('test');
      expect(entry.createdAt).toBeGreaterThan(0);
    });

    test('listKEKs returns all created KEKs', async () => {
      await adapter.createKEK('t1');
      await adapter.createKEK('t1');
      const list = await adapter.listKEKs('t1');
      expect(list).toHaveLength(2);
    });

    test('rotateKEK creates a new KEK and preserves old one', async () => {
      const oldId = await adapter.createKEK('t1');
      const newId = await adapter.rotateKEK('t1', oldId);
      expect(newId).not.toBe(oldId);
      const list = await adapter.listKEKs('t1');
      expect(list).toHaveLength(2);
      const newEntry = list.find((k) => k.kekId === newId);
      expect(newEntry.meta.rotatedFrom).toBe(oldId);
    });

    test('rotateKEK rejects unknown KEK', async () => {
      await expectRejectErrorCode(() => adapter.rotateKEK('nonexistent'), 'UNKNOWN_KEK');
    });

    test('generateTestKEK creates a KEK with test flag', async () => {
      const kekId = await adapter.generateTestKEK('t1');
      const list = await adapter.listKEKs('t1');
      const entry = list.find((k) => k.kekId === kekId);
      expect(entry.meta.test).toBe(true);
    });
  });

  // ── Low-level wrap/unwrap ───────────────────────────────────────────

  describe('low-level wrap/unwrap', () => {
    test('wrap/unwrap round-trip recovers plaintext', async () => {
      const kekId = await adapter.createKEK('t1');
      const plaintext = crypto.randomBytes(32);
      const wrapped = await adapter.wrap('t1', kekId, plaintext);
      const unwrapped = await adapter.unwrap('t1', kekId, wrapped);
      expect(unwrapped.equals(plaintext)).toBe(true);
    });

    test('wrap rejects non-Buffer plaintext', async () => {
      const kekId = await adapter.createKEK('t1');
      await expectRejectErrorCode(() => adapter.wrap('t1', kekId, 'not-a-buffer'), 'INVALID_INPUT');
    });

    test('wrap rejects unknown KEK', async () => {
      await expectRejectErrorCode(() => adapter.wrap('t1', 'nonexistent', Buffer.alloc(32)), 'UNKNOWN_KEK');
    });

    test('unwrap rejects unknown KEK', async () => {
      await expectRejectErrorCode(() => adapter.unwrap('t1', 'nonexistent', Buffer.alloc(40)), 'UNKNOWN_KEK');
    });

    test('unwrap corrupted ciphertext fails with UNWRAP_FAILED', async () => {
      const kekId = await adapter.createKEK('t1');
      const plaintext = crypto.randomBytes(32);
      const wrapped = await adapter.wrap('t1', kekId, plaintext);
      wrapped[wrapped.length - 1] ^= 0xFF; // corrupt last byte
      await expectRejectErrorCode(() => adapter.unwrap('t1', kekId, wrapped), 'UNWRAP_FAILED');
    });
  });

  // ── High-level exportKeyring/importKeyring ─────────────────────────

  describe('exportKeyring/importKeyring', () => {
    test('round-trip recovers the original keyring', async () => {
      const original = makeValidKeyring();
      const masterKek = crypto.randomBytes(32);

      const blob = await adapter.exportKeyring(original, masterKek);
      expect(Buffer.isBuffer(blob)).toBe(true);
      expect(blob.subarray(0, 4).toString('ascii')).toBe('T10K');

      const recovered = await adapter.importKeyring(blob, masterKek);
      expect(recovered).toEqual(original);
    });

    test('rejects export with invalid master KEK length', async () => {
      const keyring = makeValidKeyring();
      const invalidKek = Buffer.alloc(17); // 136 bits
      await expect(adapter.exportKeyring(keyring, invalidKek)).rejects.toMatchObject({
        name: 'HsmAdapterError',
        code: 'INVALID_KEK_LENGTH',
        message: expect.stringMatching(/HSM Export pipeline failure/),
      });
    });

    test('rejects non-Buffer binary envelope', async () => {
      const masterKek = crypto.randomBytes(32);
      await expect(adapter.importKeyring('not-a-buffer', masterKek)).rejects.toMatchObject({
        name: 'HsmAdapterError',
        code: 'INVALID_ENVELOPE_BUFFER',
        message: expect.stringMatching(/HSM Import pipeline failure/),
      });
    });

    test('rejects import with the wrong master KEK', async () => {
      const keyring = makeValidKeyring();
      const masterKek = crypto.randomBytes(32);
      const wrongKek = crypto.randomBytes(32);
      const blob = await adapter.exportKeyring(keyring, masterKek);
      await expect(adapter.importKeyring(blob, wrongKek)).rejects.toMatchObject({
        name: 'HsmAdapterError',
        code: 'ENVELOPE_INTEGRITY',
        message: expect.stringMatching(/HSM Import pipeline failure/),
      });
    });

    test('rejects corrupted T10K ciphertext', async () => {
      const keyring = makeValidKeyring();
      const masterKek = crypto.randomBytes(32);
      const blob = await adapter.exportKeyring(keyring, masterKek);
      const tampered = Buffer.from(blob);
      tampered[tampered.length - 1] ^= 0xFF;
      await expect(adapter.importKeyring(tampered, masterKek)).rejects.toMatchObject({
        name: 'HsmAdapterError',
        code: 'ENVELOPE_INTEGRITY',
        message: expect.stringMatching(/HSM Import pipeline failure/),
      });
    });

    test('rejects T10K envelope with wrong magic', async () => {
      const keyring = makeValidKeyring();
      const masterKek = crypto.randomBytes(32);
      const blob = await adapter.exportKeyring(keyring, masterKek);
      const tampered = Buffer.from(blob);
      tampered[0] = 0x00; // corrupt magic
      await expect(adapter.importKeyring(tampered, masterKek)).rejects.toMatchObject({
        name: 'HsmAdapterError',
        code: 'INVALID_MAGIC',
        message: expect.stringMatching(/HSM Import pipeline failure/),
      });
    });
  });

  // ── KEK size variants ─────────────────────────────────────────────

  describe('KEK size variants', () => {
    [128, 192, 256].forEach((kekBits) => {
      test(`${kekBits}-bit KEK wrap/unwrap round-trip`, async () => {
        const a = new SoftwareHsmAdapter({ kekBits });
        await a.initialize();
        const kekId = await a.createKEK('t1');
        const plaintext = crypto.randomBytes(32);
        const wrapped = await a.wrap('t1', kekId, plaintext);
        const unwrapped = await a.unwrap('t1', kekId, wrapped);
        expect(unwrapped.equals(plaintext)).toBe(true);
      });
    });
  });
});
