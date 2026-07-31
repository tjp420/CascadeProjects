const {
  isSandboxToken,
  recordSandboxRequest,
  getSandboxLimitHeaders,
  SANDBOX_DAILY_LIMIT,
} = require('../../lib/auth/sandbox-service.cjs');

describe('sandbox-service', () => {
  describe('isSandboxToken', () => {
    test('detects sandbox tier', () => {
      expect(isSandboxToken({ tier: 'sandbox' })).toBe(true);
      expect(isSandboxToken({ plan: 'community' })).toBe(true);
      expect(isSandboxToken({ tier: 'free' })).toBe(true);
      expect(isSandboxToken({ tier: 'developer' })).toBe(true);
    });
    test('returns false for paid tiers', () => {
      expect(isSandboxToken({ tier: 'pro' })).toBe(false);
      expect(isSandboxToken({ tier: 'enterprise' })).toBe(false);
    });
    test('returns false for null/undefined', () => {
      expect(isSandboxToken(null)).toBe(false);
      expect(isSandboxToken(undefined)).toBe(false);
    });
  });

  describe('recordSandboxRequest', () => {
    test('allows first request', () => {
      const result = recordSandboxRequest('jti-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(SANDBOX_DAILY_LIMIT - 1);
    });

    test('blocks after limit exceeded', () => {
      const jti = 'jti-limit';
      for (let i = 0; i < SANDBOX_DAILY_LIMIT; i++) {
        recordSandboxRequest(jti);
      }
      const result = recordSandboxRequest(jti);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test('rejects null jti', () => {
      const result = recordSandboxRequest(null);
      expect(result.allowed).toBe(false);
    });
  });

  describe('getSandboxLimitHeaders', () => {
    test('returns full limit for unknown jti', () => {
      const headers = getSandboxLimitHeaders('unknown');
      expect(headers['X-Sandbox-Limit']).toBe(String(SANDBOX_DAILY_LIMIT));
      expect(headers['X-Sandbox-Remaining']).toBe(String(SANDBOX_DAILY_LIMIT));
    });

    test('returns decremented remaining after requests', () => {
      const jti = 'jti-headers';
      recordSandboxRequest(jti);
      const headers = getSandboxLimitHeaders(jti);
      expect(headers['X-Sandbox-Remaining']).toBe(String(SANDBOX_DAILY_LIMIT - 1));
    });
  });
});
