'use strict';

const {
  parseOriginList,
  normalizeOrigin,
  isAllowedCorsOrigin,
  resolveCorsOptions,
} = require('../cors-config.cjs');

describe('cors-config', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalCorsOrigins = process.env.CORS_ORIGINS;
  const originalCorsOrigin = process.env.CORS_ORIGIN;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.CORS_ORIGINS = originalCorsOrigins;
    process.env.CORS_ORIGIN = originalCorsOrigin;
  });

  test('parseOriginList trims comma-separated origins', () => {
    expect(parseOriginList(' https://a.test,https://b.test , ,')).toEqual([
      'https://a.test',
      'https://b.test',
    ]);
  });

  test('normalizeOrigin strips trailing slash', () => {
    expect(normalizeOrigin('https://example.com/')).toBe('https://example.com');
  });

  test('isAllowedCorsOrigin allows any origin in non-production', () => {
    expect(isAllowedCorsOrigin('https://unknown.example', { isProduction: false, origins: [] })).toBe(true);
  });

  test('isAllowedCorsOrigin rejects wildcard allowlist in production', () => {
    expect(isAllowedCorsOrigin('https://example.com', { isProduction: true, origins: ['*'] })).toBe(false);
  });

  test('isAllowedCorsOrigin allows explicit origin in production', () => {
    expect(isAllowedCorsOrigin('https://simplebeacon.ai', { isProduction: true, origins: ['https://simplebeacon.ai'] })).toBe(true);
  });

  test('isAllowedCorsOrigin supports wildcard subdomain entries in production', () => {
    expect(isAllowedCorsOrigin('https://preview.simplebeacon.pages.dev', {
      isProduction: true,
      origins: ['https://*.simplebeacon.pages.dev'],
    })).toBe(true);
  });

  test('isAllowedCorsOrigin allows built-in Pages preview host in production', () => {
    expect(isAllowedCorsOrigin('https://e4cff06f.simplebeacon.pages.dev', {
      isProduction: true,
      origins: [],
    })).toBe(true);
  });

  test('resolveCorsOptions origin callback enforces production allowlist', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://simplebeacon.ai';

    const options = resolveCorsOptions();

    options.origin('https://simplebeacon.ai', (_err, allowed) => {
      expect(allowed).toBe(true);
    });

    options.origin('https://not-allowed.example', (_err, allowed) => {
      expect(allowed).toBe(false);
    });
  });
});
