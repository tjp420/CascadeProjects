describe('server/lib token-service blacklist', () => {
  test('blacklistAccessToken + isAccessTokenBlacklisted (memory)', async () => {
    const svc = require('../token-service.cjs');
    // create a signed access token using the module helper
    const token = svc.generateAccessToken({ sub: 'user-1' });
    // ensure not blacklisted initially
    expect(await svc.isAccessTokenBlacklisted(token)).toBe(false);
    // blacklist and verify
    await svc.blacklistAccessToken(token, 'test-logout');
    expect(await svc.isAccessTokenBlacklisted(token)).toBe(true);
  });

  test('blacklistAccessToken tolerates invalid token input', async () => {
    const svc = require('../token-service.cjs');
    // Should not throw on malformed token
    await expect(svc.blacklistAccessToken('not-a-jwt')).resolves.toBeUndefined();
    expect(await svc.isAccessTokenBlacklisted('not-a-jwt')).toBe(false);
  });
});
