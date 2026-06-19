/**
 * Tests for secret-config.cjs
 */

const {
  isConfiguredSecret,
  isProductionLike,
  resolveSecret,
  assertAuthConfiguration,
  assertProductionAuthSafety,
  applyLocalV1InternalDevProfile,
  PLACEHOLDER_PATTERN
} = require('../server/lib/secret-config.cjs');

// Mock logger to prevent app-logger console.warn failures in test environment
const logger = require('../server/lib/app-logger.cjs');
const originalWarn = logger.warn;
const originalInfo = logger.info;

describe('secret-config', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    // Prevent .env.v1-internal REQUIRE_AUTH from interfering with tests
    delete process.env.REQUIRE_AUTH;
    // Clear module caches that depend on env
    delete resolveSecret._warned;
    delete resolveSecret._cache;
    // Mock logger methods to prevent console method failures in Jest sandbox
    logger.warn = jest.fn();
    logger.info = jest.fn();
  });

  afterEach(() => {
    logger.warn = originalWarn;
    logger.info = originalInfo;
    process.env = { ...ORIGINAL_ENV };
  });

  describe('isConfiguredSecret', () => {
    test('rejects falsy values', () => {
      expect(isConfiguredSecret(null)).toBe(false);
      expect(isConfiguredSecret(undefined)).toBe(false);
      expect(isConfiguredSecret('')).toBe(false);
    });

    test('rejects short secrets', () => {
      expect(isConfiguredSecret('short')).toBe(false);
      expect(isConfiguredSecret('a'.repeat(31))).toBe(false);
    });

    test('accepts long non-placeholder secrets', () => {
      expect(isConfiguredSecret('a'.repeat(32))).toBe(true);
      expect(isConfiguredSecret('valid-production-secret-key-here')).toBe(true);
    });

    test('rejects placeholder patterns', () => {
      expect(isConfiguredSecret('replace-me-with-real-secret-123')).toBe(false);
      expect(isConfiguredSecret('changeme-12345678901234567890')).toBe(false);
      expect(isConfiguredSecret('demo-secret-key-for-development')).toBe(false);
      expect(isConfiguredSecret('example-key-do-not-use-in-prod')).toBe(false);
      expect(isConfiguredSecret('your_secret_here_12345678901234')).toBe(false);
      expect(isConfiguredSecret('placeholder-secret-development')).toBe(false);
      expect(isConfiguredSecret('dummy-key-not-for-production')).toBe(false);
      expect(isConfiguredSecret('sk_test_your_key_here_12345678')).toBe(false);
      expect(isConfiguredSecret('REPLACE_ME_WITH_REAL_VALUE_NOW')).toBe(false);
    });

    test('rejects secrets with placeholder substrings even inside larger words', () => {
      expect(isConfiguredSecret('my-demo-app-secret-key-1234567')).toBe(false); // contains 'demo'
    });

    test('rejects secrets with placeholder substrings inside words', () => {
      expect(isConfiguredSecret('demonstration-key-123456789012')).toBe(false); // contains 'demo'
    });

    test('respects custom minLength', () => {
      expect(isConfiguredSecret('short', 5)).toBe(true); // 5 chars meets minLength=5, no placeholder pattern
      expect(isConfiguredSecret('tiny', 5)).toBe(false); // 4 chars below minLength=5
      expect(isConfiguredSecret('enough', 5)).toBe(true);
    });
  });

  describe('isProductionLike', () => {
    test('returns true when NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      expect(isProductionLike()).toBe(true);
    });

    test('returns true when REQUIRE_AUTH=true', () => {
      process.env.NODE_ENV = 'development';
      process.env.REQUIRE_AUTH = 'true';
      expect(isProductionLike()).toBe(true);
    });

    test('returns false otherwise', () => {
      process.env.NODE_ENV = 'development';
      process.env.REQUIRE_AUTH = 'false';
      expect(isProductionLike()).toBe(false);
    });
  });

  describe('resolveSecret', () => {
    test('returns configured env secret', () => {
      process.env.MY_SECRET = 'a'.repeat(32);
      expect(resolveSecret('MY_SECRET')).toBe('a'.repeat(32));
    });

    test('throws in production when secret missing', () => {
      process.env.NODE_ENV = 'production';
      process.env.REQUIRE_AUTH = 'true';
      delete process.env.MY_SECRET;
      expect(() => resolveSecret('MY_SECRET')).toThrow(/must be set to a strong secret/);
    });

    test('generates ephemeral secret when ALLOW_DEV_EPHEMERAL_SECRETS=true', () => {
      process.env.ALLOW_DEV_EPHEMERAL_SECRETS = 'true';
      delete process.env.MY_SECRET;
      const val = resolveSecret('MY_SECRET');
      expect(typeof val).toBe('string');
      expect(val.length).toBe(128); // 64 bytes hex
    });

    test('caches ephemeral secret per name', () => {
      process.env.ALLOW_DEV_EPHEMERAL_SECRETS = 'true';
      delete process.env.MY_SECRET;
      const v1 = resolveSecret('MY_SECRET');
      const v2 = resolveSecret('MY_SECRET');
      expect(v1).toBe(v2);
    });

    test('returns test-only secret in test env', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.MY_SECRET;
      const val = resolveSecret('MY_SECRET');
      expect(val).toMatch(/^test-only-MY_SECRET-/);
    });

    test('throws with helpful message when secret missing in dev', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.MY_SECRET;
      expect(() => resolveSecret('MY_SECRET')).toThrow(/is not configured/);
    });
  });

  describe('assertAuthConfiguration', () => {
    test('does nothing when REQUIRE_AUTH is not true', () => {
      process.env.REQUIRE_AUTH = 'false';
      expect(() => assertAuthConfiguration()).not.toThrow();
    });

    test('does nothing when secrets are configured', () => {
      process.env.REQUIRE_AUTH = 'true';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      expect(() => assertAuthConfiguration()).not.toThrow();
    });

    test('warns with ephemeral when ALLOW_DEV_EPHEMERAL_SECRETS=true', () => {
      process.env.REQUIRE_AUTH = 'true';
      process.env.ALLOW_DEV_EPHEMERAL_SECRETS = 'true';
      delete process.env.JWT_SECRET;
      delete process.env.JWT_REFRESH_SECRET;
      expect(() => assertAuthConfiguration()).not.toThrow();
    });

    test('throws in production when secrets missing and ephemeral disabled', () => {
      process.env.REQUIRE_AUTH = 'true';
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      delete process.env.JWT_REFRESH_SECRET;
      expect(() => assertAuthConfiguration()).toThrow(/REQUIRE_AUTH=true requires configured/);
    });
  });

  describe('assertProductionAuthSafety', () => {
    test('does nothing when not in production', () => {
      process.env.NODE_ENV = 'development';
      expect(() => assertProductionAuthSafety()).not.toThrow();
    });

    test('does nothing when all safety rules met', () => {
      process.env.NODE_ENV = 'production';
      process.env.REQUIRE_AUTH = 'true';
      process.env.SEED_DEMO_USERS = 'false';
      process.env.ALLOW_LEGACY_LOGIN = 'false';
      expect(() => assertProductionAuthSafety()).not.toThrow();
    });

    test('throws when REQUIRE_AUTH is not true in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.REQUIRE_AUTH = 'false';
      expect(() => assertProductionAuthSafety()).toThrow(/REQUIRE_AUTH=true/);
    });

    test('throws when SEED_DEMO_USERS is not false in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.REQUIRE_AUTH = 'true';
      process.env.SEED_DEMO_USERS = 'true';
      expect(() => assertProductionAuthSafety()).toThrow(/SEED_DEMO_USERS=false/);
    });

    test('throws when ALLOW_LEGACY_LOGIN is true in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.REQUIRE_AUTH = 'true';
      process.env.SEED_DEMO_USERS = 'false';
      process.env.ALLOW_LEGACY_LOGIN = 'true';
      expect(() => assertProductionAuthSafety()).toThrow(/ALLOW_LEGACY_LOGIN/);
    });
  });

  describe('applyLocalV1InternalDevProfile', () => {
    test('does nothing when REQUIRE_AUTH is not true', () => {
      process.env.REQUIRE_AUTH = 'false';
      expect(applyLocalV1InternalDevProfile()).toBe(false);
    });

    test('sets SIMPLEBEACON_INTERNAL_DASHBOARD', () => {
      process.env.REQUIRE_AUTH = 'true';
      process.env.JWT_SECRET = 'a'.repeat(32);
      applyLocalV1InternalDevProfile();
      expect(process.env.SIMPLEBEACON_INTERNAL_DASHBOARD).toBe('true');
    });

    test('forces NODE_ENV to development when production with internal dashboard', () => {
      process.env.REQUIRE_AUTH = 'true';
      process.env.NODE_ENV = 'production';
      process.env.SIMPLEBEACON_INTERNAL_DASHBOARD = 'true';
      process.env.JWT_SECRET = 'a'.repeat(32);
      applyLocalV1InternalDevProfile();
      expect(process.env.NODE_ENV).toBe('development');
    });

    test('enables ephemeral when JWT secrets are placeholders', () => {
      process.env.REQUIRE_AUTH = 'true';
      process.env.JWT_SECRET = 'placeholder-secret';
      process.env.JWT_REFRESH_SECRET = 'placeholder-secret';
      expect(applyLocalV1InternalDevProfile()).toBe(true);
      expect(process.env.ALLOW_DEV_EPHEMERAL_SECRETS).toBe('true');
    });
  });

  describe('PLACEHOLDER_PATTERN', () => {
    test('matches known placeholder substrings', () => {
      expect(PLACEHOLDER_PATTERN.test('replace')).toBe(true);
      expect(PLACEHOLDER_PATTERN.test('changeme')).toBe(true);
      expect(PLACEHOLDER_PATTERN.test('demo')).toBe(true);
      expect(PLACEHOLDER_PATTERN.test('placeholder')).toBe(true);
      expect(PLACEHOLDER_PATTERN.test('dummy')).toBe(true);
      expect(PLACEHOLDER_PATTERN.test('your_value_here')).toBe(true);
      expect(PLACEHOLDER_PATTERN.test('REPLACE_ME')).toBe(true);
    });
  });
});
