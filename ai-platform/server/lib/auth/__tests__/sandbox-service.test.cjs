const { jest: _jest } = require('@jest/globals');

describe('sandbox-service behaviors', () => {
  beforeEach(() => jest.resetModules());

  test('isSandboxToken recognizes sandbox tiers', () => {
    const ss = require('../sandbox-service.cjs');
    expect(ss.isSandboxToken({ tier: 'sandbox' })).toBe(true);
    expect(ss.isSandboxToken({ plan: 'community' })).toBe(true);
    expect(ss.isSandboxToken({})).toBe(false);
  });

  test('recordSandboxRequest initializes and counts', () => {
    const ss = require('../sandbox-service.cjs');
    const jti = 's-xyz';
    const first = ss.recordSandboxRequest(jti);
    expect(first.allowed).toBe(true);
    expect(typeof first.remaining).toBe('number');

    // simulate many calls up to limit
    for (let i = 0; i < 5; i++) ss.recordSandboxRequest(jti);
    const headers = ss.getSandboxLimitHeaders(jti);
    expect(headers['X-Sandbox-Limit']).toBe(String(ss.SANDBOX_DAILY_LIMIT));
    expect(Number(headers['X-Sandbox-Remaining'])).toBeLessThanOrEqual(ss.SANDBOX_DAILY_LIMIT);
  });
});
