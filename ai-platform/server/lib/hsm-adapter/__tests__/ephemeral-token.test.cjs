'use strict';

/**
 * Track 21: Ephemeral hardware token splitter tests.
 *
 * Covers spec items:
 *   L2-03: Issue and verify within window
 *   L2-04: Expired token rejected (IDENTITY_PROOF_EXPIRED)
 *   L2-05: Wrong tenant rejected (TOKEN_NOT_BOUND)
 *   L3-01: maxProofs rate limit (PROOF_LIMIT_EXCEEDED)
 *   S-02:  Tokens expire and are not reversible to attestation root
 *   S-04:  maxProofs prevents proof-flooding
 */
const crypto = require('crypto');
const { EphemeralHardwareTokenSplitter } = require('../ephemeral-hardware-token-splitter.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('EphemeralHardwareTokenSplitter', () => {
  describe('constructor', () => {
    test('rejects attestationRoot shorter than 16 bytes', () => {
      expect(() => new EphemeralHardwareTokenSplitter(crypto.randomBytes(8))).toThrow(HsmAdapterError);
    });

    test('accepts a 32-byte attestation root', () => {
      const splitter = new EphemeralHardwareTokenSplitter(crypto.randomBytes(32));
      expect(splitter).toBeInstanceOf(EphemeralHardwareTokenSplitter);
    });

    test('copies attestationRoot to avoid external mutation', () => {
      const root = crypto.randomBytes(32);
      const splitter = new EphemeralHardwareTokenSplitter(root);
      root[0] = 0xff;
      const token = splitter.issue('t1');
      // Should still verify because the splitter copied the root
      expect(splitter.verify(token, 't1')).toBe(true);
    });
  });

  describe('L2-03: issue and verify within window', () => {
    test('issues a 16-byte token and verifies it', () => {
      const splitter = new EphemeralHardwareTokenSplitter(crypto.randomBytes(32), { tokenExpiryMs: 10000 });
      const token = splitter.issue('t1');
      expect(Buffer.isBuffer(token.value)).toBe(true);
      expect(token.value.length).toBe(16);
      expect(token.tenantId).toBe('t1');
      expect(token.issuedAt).toBeLessThanOrEqual(Date.now());
      expect(token.expiresAt).toBe(token.issuedAt + 10000);
      expect(splitter.verify(token, 't1')).toBe(true);
    });

    test('multiple tokens for the same tenant all verify correctly', () => {
      const splitter = new EphemeralHardwareTokenSplitter(crypto.randomBytes(32), { tokenExpiryMs: 10000 });
      const t1 = splitter.issue('t1');
      const t2 = splitter.issue('t1');
      const t3 = splitter.issue('t1');
      expect(splitter.verify(t1, 't1')).toBe(true);
      expect(splitter.verify(t2, 't1')).toBe(true);
      expect(splitter.verify(t3, 't1')).toBe(true);
    });

    test('tokens for different tenants are distinct', () => {
      const splitter = new EphemeralHardwareTokenSplitter(crypto.randomBytes(32), { tokenExpiryMs: 10000 });
      const t1 = splitter.issue('tenant-a');
      const t2 = splitter.issue('tenant-b');
      expect(t1.value.equals(t2.value)).toBe(false);
    });
  });

  describe('L2-04: expired token rejected', () => {
    test('throws IDENTITY_PROOF_EXPIRED after expiry', async () => {
      const splitter = new EphemeralHardwareTokenSplitter(crypto.randomBytes(32), {
        tokenExpiryMs: 1,
        clockSkewMs: 0,
      });
      const token = splitter.issue('t1');
      await new Promise((resolve) => setTimeout(resolve, 50));
      try {
        splitter.verify(token, 't1');
        fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe('IDENTITY_PROOF_EXPIRED');
      }
    });

    test('respects clockSkewMs grace period', async () => {
      const splitter = new EphemeralHardwareTokenSplitter(crypto.randomBytes(32), {
        tokenExpiryMs: 1,
        clockSkewMs: 10000,
      });
      const token = splitter.issue('t1');
      await new Promise((resolve) => setTimeout(resolve, 50));
      // Should still verify within the skew window
      expect(splitter.verify(token, 't1')).toBe(true);
    });
  });

  describe('L2-05: wrong tenant rejected', () => {
    test('throws TOKEN_NOT_BOUND when tenantId mismatches', () => {
      const splitter = new EphemeralHardwareTokenSplitter(crypto.randomBytes(32), { tokenExpiryMs: 10000 });
      const token = splitter.issue('t1');
      try {
        splitter.verify(token, 't2');
        fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe('TOKEN_NOT_BOUND');
      }
    });

    test('accepts Buffer tenantId that matches string tenantId', () => {
      const splitter = new EphemeralHardwareTokenSplitter(crypto.randomBytes(32), { tokenExpiryMs: 10000 });
      const token = splitter.issue('t1');
      expect(splitter.verify(token, Buffer.from('t1', 'utf8'))).toBe(true);
    });
  });

  describe('L3-01 / S-04: maxProofs rate limit', () => {
    test('throws PROOF_LIMIT_EXCEEDED when count exceeds maxProofs', () => {
      const splitter = new EphemeralHardwareTokenSplitter(crypto.randomBytes(32));
      splitter.recordProof('t1', 3);
      splitter.recordProof('t1', 3);
      splitter.recordProof('t1', 3);
      try {
        splitter.recordProof('t1', 3);
        fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe('PROOF_LIMIT_EXCEEDED');
      }
    });

    test('rate limit is per-tenant', () => {
      const splitter = new EphemeralHardwareTokenSplitter(crypto.randomBytes(32));
      splitter.recordProof('t1', 1);
      // t1 is now at limit, but t2 should still be fine
      expect(() => splitter.recordProof('t2', 1)).not.toThrow();
      expect(() => splitter.recordProof('t1', 1)).toThrow(HsmAdapterError);
    });
  });

  describe('S-02: tokens are not reversible to attestation root', () => {
    test('token value is an HMAC truncation, not the root', () => {
      const root = crypto.randomBytes(32);
      const splitter = new EphemeralHardwareTokenSplitter(root, { tokenExpiryMs: 10000 });
      const token = splitter.issue('t1');
      // Token must not contain the root
      expect(token.value.equals(root.subarray(0, 16))).toBe(false);
      // Token must not be a substring of the root
      expect(root.includes(token.value)).toBe(false);
    });

    test('different attestation roots produce different tokens for same tenant', () => {
      const root1 = crypto.randomBytes(32);
      const root2 = crypto.randomBytes(32);
      const s1 = new EphemeralHardwareTokenSplitter(root1, { tokenExpiryMs: 10000 });
      const s2 = new EphemeralHardwareTokenSplitter(root2, { tokenExpiryMs: 10000 });
      // Issue at the same time — unlikely but possible; values should differ
      const t1 = s1.issue('t1');
      const t2 = s2.issue('t1');
      expect(t1.value.equals(t2.value)).toBe(false);
    });
  });

  describe('invalid input', () => {
    test('issue rejects non-string non-Buffer tenantId', () => {
      const splitter = new EphemeralHardwareTokenSplitter(crypto.randomBytes(32));
      expect(() => splitter.issue(123)).toThrow(HsmAdapterError);
    });

    test('verify rejects token without value Buffer', () => {
      const splitter = new EphemeralHardwareTokenSplitter(crypto.randomBytes(32));
      expect(() => splitter.verify(null, 't1')).toThrow(HsmAdapterError);
      expect(() => splitter.verify({}, 't1')).toThrow(HsmAdapterError);
    });

    test('verify rejects token with wrong value length', () => {
      const splitter = new EphemeralHardwareTokenSplitter(crypto.randomBytes(32));
      const fakeToken = { value: crypto.randomBytes(8), issuedAt: Date.now(), expiresAt: Date.now() + 10000, tenantId: 't1', counter: 1 };
      expect(() => splitter.verify(fakeToken, 't1')).toThrow(HsmAdapterError);
    });
  });

  describe('audit events', () => {
    test('emits TOKEN_ISSUED and TOKEN_VERIFIED events', () => {
      const logger = { info: jest.fn() };
      const splitter = new EphemeralHardwareTokenSplitter(crypto.randomBytes(32), { tokenExpiryMs: 10000, logger });
      const token = splitter.issue('t1');
      splitter.verify(token, 't1');
      expect(logger.info).toHaveBeenCalledWith(
        'TOKEN_ISSUED',
        expect.objectContaining({ sub: 'hsm-adapter', provider: 'ephemeral-token', tenantId: 't1' })
      );
      expect(logger.info).toHaveBeenCalledWith(
        'TOKEN_VERIFIED',
        expect.objectContaining({ sub: 'hsm-adapter', provider: 'ephemeral-token', ok: true })
      );
    });
  });
});
