const {
    isConfiguredSecret,
    resolveSecret,
    assertAuthConfiguration,
    assertProductionAuthSafety
} = require('../../server/lib/secret-config');

describe('secret-config', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        delete process.env.ALLOW_DEV_EPHEMERAL_SECRETS;
        delete process.env.JWT_SECRET;
        delete process.env.REQUIRE_AUTH;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('isConfiguredSecret rejects placeholders and short values', () => {
        expect(isConfiguredSecret('replace-with-long-secret-value-here-1234567890')).toBe(false);
        expect(isConfiguredSecret('YOUR_JWT_SECRET_HERE')).toBe(false);
        expect(isConfiguredSecret('short')).toBe(false);
        expect(isConfiguredSecret('a'.repeat(40))).toBe(true);
    });

    test('resolveSecret returns configured env value', () => {
        process.env.JWT_SECRET = 'a'.repeat(40);
        expect(resolveSecret('JWT_SECRET')).toBe('a'.repeat(40));
    });

    test('resolveSecret fails in production when unset', () => {
        process.env.NODE_ENV = 'production';
        expect(() => resolveSecret('JWT_SECRET')).toThrow(/JWT_SECRET must be set/);
    });

    test('resolveSecret uses deterministic test fallback', () => {
        process.env.NODE_ENV = 'test';
        const value = resolveSecret('JWT_SECRET');
        expect(value.startsWith('test-only-JWT_SECRET-')).toBe(true);
        expect(value.length).toBeGreaterThanOrEqual(32);
    });

    test('assertAuthConfiguration requires secrets when REQUIRE_AUTH=true', () => {
        process.env.REQUIRE_AUTH = 'true';
        expect(() => assertAuthConfiguration()).toThrow(/JWT_SECRET/);
    });

    test('assertAuthConfiguration allows placeholders when ALLOW_DEV_EPHEMERAL_SECRETS=true', () => {
        process.env.REQUIRE_AUTH = 'true';
        process.env.ALLOW_DEV_EPHEMERAL_SECRETS = 'true';
        expect(() => assertAuthConfiguration()).not.toThrow();
    });

    test('resolveSecret uses ephemeral secret when ALLOW_DEV_EPHEMERAL_SECRETS=true', () => {
        process.env.REQUIRE_AUTH = 'true';
        process.env.ALLOW_DEV_EPHEMERAL_SECRETS = 'true';
        const value = resolveSecret('JWT_SECRET');
        expect(value.length).toBeGreaterThanOrEqual(32);
    });

    test('assertProductionAuthSafety enforces production auth flags', () => {
        process.env.NODE_ENV = 'production';
        process.env.REQUIRE_AUTH = 'false';
        expect(() => assertProductionAuthSafety()).toThrow(/REQUIRE_AUTH=true/);
    });
});
