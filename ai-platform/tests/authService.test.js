/**
 * AuthService Tests
 * Tests for token-based auth session validation and JWT decode logic.
 */

const { strict: assert } = require('node:assert');
global.fail = (msg) => assert.fail(msg);

// Minimal mock for localStorage
const mockStorage = new Map();
global.localStorage = {
  getItem: (k) => mockStorage.get(k) ?? null,
  setItem: (k, v) => mockStorage.set(k, v),
  removeItem: (k) => mockStorage.delete(k),
};

// Mock atob for Node environment
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');

// Build a minimal testable auth service module
const TOKEN_KEY = 'sb_auth_token';
const USER_KEY = 'sb_auth_user';

function createTestAuthService() {
  let token = null;
  let user = null;
  let authRequired = true;

  return {
    getToken() { return token; },
    getUser() { return user; },
    getAuthHeaders() {
      const t = token;
      return t ? { Authorization: `Bearer ${t}` } : {};
    },
    setSession(t, _ctx) {
      token = t;
      localStorage.setItem(TOKEN_KEY, t);
    },
    clearSession() {
      token = null;
      user = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
    _decodeJwtPayload(token) {
      try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const headerB64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
        const header = JSON.parse(atob(headerB64));
        if (header.alg === 'none') {
          console.warn('[AuthService] Rejected JWT with alg:none');
          return null;
        }
        const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(payloadB64));
      } catch {
        return null;
      }
    },
    _setTokenSession(payload) {
      user = {
        email: payload.sub || 'token-user',
        plan: payload.plan || payload.tier || 'free',
        tokenSession: true
      };
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    async validateSession() {
      if (!token) return false;
      // Simulate server rejection (no fetch in Node test env)
      const payload = this._decodeJwtPayload(token);
      if (!payload) {
        this.clearSession();
        return false;
      }
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        this.clearSession();
        return false;
      }
      this._setTokenSession(payload);
      return true;
    }
  };
}

// Valid HS256 JWT: {"tier":"universal","exp":2000000000,"sub":"all-access","plan":"Sovereign"}
const VALID_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0aWVyIjoidW5pdmVyc2FsIiwiZXhwIjoyMDAwMDAwMDAwLCJzdWIiOiJhbGwtYWNjZXNzIiwicGxhbiI6IlNvdmVyZWlnbiJ9.dummy-signature-1';

// Expired HS256 JWT: {"exp":1000000000,"sub":"expired"}
const EXPIRED_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjEwMDAwMDAwMDAsInN1YiI6ImV4cGlyZWQifQ.dummy-signature-2';

// Unsigned JWT (should be rejected): {"alg":"none"}
const UNSIGNED_JWT = 'eyJhbGciOiJub25lIiwidHlwIjoiS1dUIn0.eyJ0aWVyIjoidW5pdmVyc2FsIiwiZXhwIjoyMDAwMDAwMDAwLCJzdWIiOiJhbGwtYWNjZXNzIiwicGxhbiI6IlNvdmVyZWlnbiJ9.';

describe('AuthService', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  describe('setSession / clearSession', () => {
    test('should store token in localStorage', () => {
      const auth = createTestAuthService();
      auth.setSession(VALID_JWT);
      expect(auth.getToken()).toBe(VALID_JWT);
      expect(localStorage.getItem(TOKEN_KEY)).toBe(VALID_JWT);
    });

    test('should clear token and user', () => {
      const auth = createTestAuthService();
      auth.setSession(VALID_JWT);
      auth.clearSession();
      expect(auth.getToken()).toBeNull();
      expect(auth.getUser()).toBeNull();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });
  });

  describe('_decodeJwtPayload', () => {
    test('should decode valid HS256 JWT', () => {
      const auth = createTestAuthService();
      const payload = auth._decodeJwtPayload(VALID_JWT);
      expect(payload).toEqual({
        tier: 'universal',
        exp: 2000000000,
        sub: 'all-access',
        plan: 'Sovereign'
      });
    });

    test('should reject JWT with alg:none', () => {
      const auth = createTestAuthService();
      const payload = auth._decodeJwtPayload(UNSIGNED_JWT);
      expect(payload).toBeNull();
    });

    test('should return null for malformed token', () => {
      const auth = createTestAuthService();
      expect(auth._decodeJwtPayload('not-a-jwt')).toBeNull();
      expect(auth._decodeJwtPayload('')).toBeNull();
    });

    test('should return null for invalid base64', () => {
      const auth = createTestAuthService();
      expect(auth._decodeJwtPayload('header.!!!')).toBeNull();
    });
  });

  describe('_setTokenSession', () => {
    test('should set user from payload', () => {
      const auth = createTestAuthService();
      auth._setTokenSession({ sub: 'test-user', plan: 'pro', tier: 'team' });
      expect(auth.getUser()).toEqual({
        email: 'test-user',
        plan: 'pro',
        tokenSession: true
      });
    });

    test('should fallback to defaults when fields missing', () => {
      const auth = createTestAuthService();
      auth._setTokenSession({});
      expect(auth.getUser()).toEqual({
        email: 'token-user',
        plan: 'free',
        tokenSession: true
      });
    });
  });

  describe('validateSession', () => {
    test('should return false when no token', async () => {
      const auth = createTestAuthService();
      const result = await auth.validateSession();
      expect(result).toBe(false);
    });

    test('should validate HS256 token successfully', async () => {
      const auth = createTestAuthService();
      auth.setSession(VALID_JWT);
      const result = await auth.validateSession();
      expect(result).toBe(true);
      expect(auth.getUser()).toEqual({
        email: 'all-access',
        plan: 'Sovereign',
        tokenSession: true
      });
    });

    test('should reject unsigned token (alg:none)', async () => {
      const auth = createTestAuthService();
      auth.setSession(UNSIGNED_JWT);
      const result = await auth.validateSession();
      expect(result).toBe(false);
      expect(auth.getToken()).toBeNull();
    });

    test('should reject expired token', async () => {
      const auth = createTestAuthService();
      auth.setSession(EXPIRED_JWT);
      const result = await auth.validateSession();
      expect(result).toBe(false);
      expect(auth.getToken()).toBeNull();
    });

    test('should reject malformed token and clear session', async () => {
      const auth = createTestAuthService();
      auth.setSession('bad-token');
      const result = await auth.validateSession();
      expect(result).toBe(false);
      expect(auth.getToken()).toBeNull();
    });
  });
});
