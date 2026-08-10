'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setVaultSessionCookie, getVaultSessionToken } = require('../dashboard-vault-auth.cjs');

describe('dashboard-vault-auth', () => {
  describe('setVaultSessionCookie', () => {
    let originalNodeEnv;

    beforeEach(() => {
      originalNodeEnv = process.env.NODE_ENV;
      // Ensure DASHBOARD_VAULT_PASSWORD is set for token generation
      process.env.DASHBOARD_VAULT_PASSWORD = 'test-vault-secret';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      delete process.env.DASHBOARD_VAULT_PASSWORD;
    });

    function mockRes() {
      const headers = {};
      return {
        setHeader(name, value) { headers[name] = value; },
        getHeader(name) { return headers[name]; },
        _headers: headers,
      };
    }

    it('sets SameSite=Strict attribute', () => {
      process.env.NODE_ENV = 'development';
      const res = mockRes();
      setVaultSessionCookie(res, 'test-secret');
      const cookie = res.getHeader('Set-Cookie');
      assert.ok(cookie.includes('SameSite=Strict'), `Expected SameSite=Strict in: ${cookie}`);
    });

    it('sets HttpOnly attribute', () => {
      process.env.NODE_ENV = 'development';
      const res = mockRes();
      setVaultSessionCookie(res, 'test-secret');
      const cookie = res.getHeader('Set-Cookie');
      assert.ok(cookie.includes('HttpOnly'), `Expected HttpOnly in: ${cookie}`);
    });

    it('sets Max-Age=86400 (24 hours)', () => {
      process.env.NODE_ENV = 'development';
      const res = mockRes();
      setVaultSessionCookie(res, 'test-secret');
      const cookie = res.getHeader('Set-Cookie');
      assert.ok(cookie.includes('Max-Age=86400'), `Expected Max-Age=86400 in: ${cookie}`);
    });

    it('sets Secure flag in production', () => {
      process.env.NODE_ENV = 'production';
      const res = mockRes();
      setVaultSessionCookie(res, 'test-secret');
      const cookie = res.getHeader('Set-Cookie');
      assert.ok(cookie.includes('Secure'), `Expected Secure in production: ${cookie}`);
    });

    it('does NOT set Secure flag in development', () => {
      process.env.NODE_ENV = 'development';
      const res = mockRes();
      setVaultSessionCookie(res, 'test-secret');
      const cookie = res.getHeader('Set-Cookie');
      assert.ok(!cookie.includes('Secure'), `Expected no Secure in development: ${cookie}`);
    });

    it('sets cookie name to sb_vault', () => {
      process.env.NODE_ENV = 'development';
      const res = mockRes();
      setVaultSessionCookie(res, 'test-secret');
      const cookie = res.getHeader('Set-Cookie');
      assert.ok(cookie.startsWith('sb_vault='), `Expected cookie to start with sb_vault=: ${cookie}`);
    });

    it('does not set cookie when token generation fails', () => {
      process.env.NODE_ENV = 'development';
      const res = mockRes();
      // Pass null/empty secret with no env var fallback
      delete process.env.DASHBOARD_VAULT_PASSWORD;
      setVaultSessionCookie(res, null);
      assert.strictEqual(res.getHeader('Set-Cookie'), undefined);
    });
  });

  describe('getVaultSessionToken', () => {
    it('generates a token from a secret', () => {
      const token = getVaultSessionToken('my-secret');
      assert.ok(typeof token === 'string');
      assert.ok(token.length > 0);
    });

    it('generates deterministic tokens for the same secret', () => {
      const token1 = getVaultSessionToken('same-secret');
      const token2 = getVaultSessionToken('same-secret');
      assert.strictEqual(token1, token2);
    });

    it('generates different tokens for different secrets', () => {
      const token1 = getVaultSessionToken('secret-a');
      const token2 = getVaultSessionToken('secret-b');
      assert.notStrictEqual(token1, token2);
    });
  });
});
