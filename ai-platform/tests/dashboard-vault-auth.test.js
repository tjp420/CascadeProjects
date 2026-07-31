/**
 * Tests for dashboard-vault-auth.cjs
 */

const {
  parseRequestCookies,
  getVaultSessionToken,
  isVaultAuthenticated,
  isProtectedDashboardPath,
  isPublicDashboardAssetPath,
  setVaultSessionCookie,
} = require('../server/lib/dashboard-vault-auth.cjs');

describe('dashboard-vault-auth', () => {
  const TEST_SECRET = require('crypto').randomBytes(16).toString('hex');
  const ORIGINAL_ENV = process.env.DASHBOARD_VAULT_PASSWORD;

  beforeEach(() => {
    delete process.env.DASHBOARD_VAULT_PASSWORD;
  });

  afterEach(() => {
    if (ORIGINAL_ENV !== undefined) {
      process.env.DASHBOARD_VAULT_PASSWORD = ORIGINAL_ENV;
    } else {
      delete process.env.DASHBOARD_VAULT_PASSWORD;
    }
  });

  describe('parseRequestCookies', () => {
    test('returns empty object when no cookie header', () => {
      expect(parseRequestCookies({})).toEqual({});
      expect(parseRequestCookies({ headers: {} })).toEqual({});
      expect(parseRequestCookies({ headers: { cookie: '' } })).toEqual({});
    });

    test('parses single cookie', () => {
      expect(parseRequestCookies({ headers: { cookie: 'foo=bar' } })).toEqual({ foo: 'bar' });
    });

    test('parses multiple cookies', () => {
      const req = { headers: { cookie: 'a=1; b=2; c=3' } };
      expect(parseRequestCookies(req)).toEqual({ a: '1', b: '2', c: '3' });
    });

    test('handles URL-encoded values', () => {
      const req = { headers: { cookie: 'key=%20value%20' } };
      expect(parseRequestCookies(req)).toEqual({ key: ' value ' });
    });

    test('skips malformed parts without equals', () => {
      const req = { headers: { cookie: 'good=yes; bad; also=ok' } };
      expect(parseRequestCookies(req)).toEqual({ good: 'yes', also: 'ok' });
    });

    test('trims whitespace around keys and values', () => {
      const req = { headers: { cookie: '  key  =  value  ' } };
      expect(parseRequestCookies(req)).toEqual({ key: 'value' });
    });
  });

  describe('getVaultSessionToken', () => {
    test('returns null for empty secret', () => {
      expect(getVaultSessionToken(null)).toBeNull();
      expect(getVaultSessionToken('')).toBeNull();
      expect(getVaultSessionToken(undefined)).toBeNull();
    });

    test('returns consistent hex HMAC for same secret', () => {
      const t1 = getVaultSessionToken('my-secret');
      const t2 = getVaultSessionToken('my-secret');
      expect(t1).toBe(t2);
      expect(typeof t1).toBe('string');
      expect(t1.length).toBe(64); // sha256 hex
    });

    test('returns different tokens for different secrets', () => {
      const t1 = getVaultSessionToken('secret-a');
      const t2 = getVaultSessionToken('secret-b');
      expect(t1).not.toBe(t2);
    });
  });

  describe('isVaultAuthenticated', () => {
    const validToken = getVaultSessionToken(TEST_SECRET);

    test('returns true when internalDashboard is false', () => {
      expect(isVaultAuthenticated({}, { internalDashboard: false })).toBe(true);
      expect(isVaultAuthenticated({}, {})).toBe(true);
    });

    test('returns false when secret is missing', () => {
      expect(isVaultAuthenticated({}, { internalDashboard: true })).toBe(false);
    });

    test('returns false with wrong cookie', () => {
      const req = { headers: { cookie: 'sb_vault=wrong-token' } };
      expect(
        isVaultAuthenticated(req, { internalDashboard: true, vaultPassword: TEST_SECRET })
      ).toBe(false);
    });

    test('returns true with valid cookie', () => {
      const req = { headers: { cookie: `sb_vault=${validToken}` } };
      expect(
        isVaultAuthenticated(req, { internalDashboard: true, vaultPassword: TEST_SECRET })
      ).toBe(true);
    });

    test('falls back to env.DASHBOARD_VAULT_PASSWORD', () => {
      const original = process.env.DASHBOARD_VAULT_PASSWORD;
      process.env.DASHBOARD_VAULT_PASSWORD = TEST_SECRET;
      const req = { headers: { cookie: `sb_vault=${validToken}` } };
      expect(isVaultAuthenticated(req, { internalDashboard: true })).toBe(true);
      process.env.DASHBOARD_VAULT_PASSWORD = original;
    });
  });

  describe('isProtectedDashboardPath', () => {
    test('protects dashboard paths', () => {
      expect(isProtectedDashboardPath('/app')).toBe(true);
      expect(isProtectedDashboardPath('/app/')).toBe(true);
      expect(isProtectedDashboardPath('/app/dashboard')).toBe(true);
      expect(isProtectedDashboardPath('/demo')).toBe(true);
      expect(isProtectedDashboardPath('/signin')).toBe(true);
      expect(isProtectedDashboardPath('/simplebeacon-dashboard')).toBe(true);
      expect(isProtectedDashboardPath('/services')).toBe(true);
    });

    test('excludes favicon', () => {
      expect(isProtectedDashboardPath('/favicon.svg')).toBe(false);
      expect(isProtectedDashboardPath('/favicon.ico')).toBe(false);
    });

    test('excludes static assets', () => {
      expect(isProtectedDashboardPath('/app.css')).toBe(false);
      expect(isProtectedDashboardPath('/app.js')).toBe(false);
      expect(isProtectedDashboardPath('/bundle.mjs')).toBe(false);
      expect(isProtectedDashboardPath('/logo.png')).toBe(false);
      expect(isProtectedDashboardPath('/font.woff2')).toBe(false);
      expect(isProtectedDashboardPath('/bundle.js.map')).toBe(false);
    });

    test('allows unprotected root paths', () => {
      expect(isProtectedDashboardPath('/')).toBe(false);
      expect(isProtectedDashboardPath('/api/health')).toBe(false);
      expect(isProtectedDashboardPath('/landing')).toBe(false);
    });
  });

  describe('isPublicDashboardAssetPath', () => {
    test('returns true for favicon paths', () => {
      expect(isPublicDashboardAssetPath('/favicon.svg')).toBe(true);
      expect(isPublicDashboardAssetPath('/favicon.ico')).toBe(true);
    });

    test('returns false for other paths', () => {
      expect(isPublicDashboardAssetPath('/app')).toBe(false);
      expect(isPublicDashboardAssetPath('/')).toBe(false);
    });
  });

  describe('setVaultSessionCookie', () => {
    test('sets cookie header on response', () => {
      const res = { setHeader: jest.fn() };
      setVaultSessionCookie(res, TEST_SECRET);
      expect(res.setHeader).toHaveBeenCalledTimes(1);
      const cookie = res.setHeader.mock.calls[0][1];
      expect(cookie).toContain('sb_vault=');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Max-Age=86400');
    });

    test('does nothing when secret is missing', () => {
      const res = { setHeader: jest.fn() };
      setVaultSessionCookie(res, null);
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    test('falls back to env.DASHBOARD_VAULT_PASSWORD', () => {
      const original = process.env.DASHBOARD_VAULT_PASSWORD;
      process.env.DASHBOARD_VAULT_PASSWORD = TEST_SECRET;
      const res = { setHeader: jest.fn() };
      setVaultSessionCookie(res);
      expect(res.setHeader).toHaveBeenCalledTimes(1);
      process.env.DASHBOARD_VAULT_PASSWORD = original;
    });
  });
});
