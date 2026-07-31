'use strict';

const {
  generateToken,
  verifyToken,
  recordTokenFirstUse,
  isTokenExpiredByFirstUse,
  invalidateToken,
  TOKEN_LIFETIME_MS,
} = require('../auth/token-service.cjs');

describe('token-service', () => {
  test('exports expected functions and constants', () => {
    expect(typeof generateToken).toBe('function');
    expect(typeof verifyToken).toBe('function');
    expect(typeof recordTokenFirstUse).toBe('function');
    expect(typeof isTokenExpiredByFirstUse).toBe('function');
    expect(typeof invalidateToken).toBe('function');
    expect(typeof TOKEN_LIFETIME_MS).toBe('number');
    expect(TOKEN_LIFETIME_MS).toBeGreaterThan(0);
  });

  test('generateToken throws on missing user', () => {
    expect(() => generateToken(null)).toThrow(TypeError);
    expect(() => generateToken(undefined)).toThrow(TypeError);
    expect(() => generateToken('not-an-object')).toThrow(TypeError);
  });

  test('generateToken produces a valid JWT string', () => {
    const token = generateToken({ id: 'user-1', email: 'test@example.com', name: 'Test' });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  test('generateToken includes user fields in payload', () => {
    const token = generateToken({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test',
      trustLevel: 'gold',
      role: 'admin',
      features: ['all_modules'],
    });
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    expect(decoded.sub).toBe('user-1');
    expect(decoded.email).toBe('test@example.com');
    expect(decoded.name).toBe('Test');
    expect(decoded.trustLevel).toBe('gold');
    expect(decoded.role).toBe('admin');
    expect(decoded.features).toEqual(['all_modules']);
    expect(decoded.jti).toBeDefined();
  });

  test('verifyToken accepts a freshly generated token', async () => {
    const token = generateToken({ id: 'user-1', email: 'test@example.com', name: 'Test' });
    const decoded = await verifyToken(token);
    expect(decoded.sub).toBe('user-1');
    expect(decoded.email).toBe('test@example.com');
  });

  test('verifyToken rejects an invalid token', async () => {
    await expect(verifyToken('invalid-token')).rejects.toMatchObject({ status: 401 });
  });

  test('verifyToken rejects a token without iss/aud claims', async () => {
    const jwt = require('jsonwebtoken');
    const { jwtConfig } = require('../jwt-config.cjs');
    const tokenWithoutClaims = jwt.sign(
      { sub: 'user-1', email: 'test@example.com', name: 'Test' },
      jwtConfig.secret,
      { algorithm: 'HS256', expiresIn: '15m' }
    );
    await expect(verifyToken(tokenWithoutClaims)).rejects.toMatchObject({ status: 401 });
  });

  test('verifyToken rejects a token with wrong issuer', async () => {
    const jwt = require('jsonwebtoken');
    const { jwtConfig } = require('../jwt-config.cjs');
    const wrongIssuerToken = jwt.sign(
      { sub: 'user-1', email: 'test@example.com', name: 'Test' },
      jwtConfig.secret,
      { algorithm: 'HS256', issuer: 'wrong-issuer', audience: jwtConfig.audience, expiresIn: '15m' }
    );
    await expect(verifyToken(wrongIssuerToken)).rejects.toMatchObject({ status: 401 });
  });

  test('verifyToken rejects a token with wrong audience', async () => {
    const jwt = require('jsonwebtoken');
    const { jwtConfig } = require('../jwt-config.cjs');
    const wrongAudienceToken = jwt.sign(
      { sub: 'user-1', email: 'test@example.com', name: 'Test' },
      jwtConfig.secret,
      { algorithm: 'HS256', issuer: jwtConfig.issuer, audience: 'wrong-audience', expiresIn: '15m' }
    );
    await expect(verifyToken(wrongAudienceToken)).rejects.toMatchObject({ status: 401 });
  });

  test('recordTokenFirstUse returns a timestamp', () => {
    const ts = recordTokenFirstUse('test-jti-1');
    expect(typeof ts).toBe('number');
    expect(ts).toBeLessThanOrEqual(Date.now());
  });

  test('isTokenExpiredByFirstUse returns false for unknown jti', () => {
    expect(isTokenExpiredByFirstUse('unknown-jti')).toBe(false);
  });

  test('isTokenExpiredByFirstUse returns false for null jti', () => {
    expect(isTokenExpiredByFirstUse(null)).toBe(false);
  });

  test('invalidateToken removes a tracked jti', () => {
    recordTokenFirstUse('test-jti-2');
    invalidateToken('test-jti-2');
    expect(isTokenExpiredByFirstUse('test-jti-2')).toBe(false);
  });
});
