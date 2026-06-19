/**
 * Tests for tier-gated Configuration-as-Code in config.js.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { sanitizeConfigForTier, PROFILE_RULES } = require('../src/config');

describe('sanitizeConfigForTier', () => {
    it('strips scanners and allowlist for developer tier', () => {
        const config = {
            profile: 'standard',
            scanners: { credential_leak: { enabled: true } },
            allowlist: ['internal.local'],
            rules: { credentials: { enabled: false } }
        };
        const sanitized = sanitizeConfigForTier(config, 'developer');
        assert.strictEqual(sanitized.scanners, undefined);
        assert.strictEqual(sanitized.allowlist, undefined);
        assert.deepStrictEqual(sanitized.rules, PROFILE_RULES.standard);
    });

    it('allows scanners but strips allowlist for startup tier', () => {
        const config = {
            profile: 'standard',
            scanners: { credential_leak: { enabled: true } },
            allowlist: ['internal.local'],
            rules: { credentials: { enabled: false } }
        };
        const sanitized = sanitizeConfigForTier(config, 'startup');
        assert.deepStrictEqual(sanitized.scanners, config.scanners);
        assert.strictEqual(sanitized.allowlist, undefined);
    });

    it('allows both scanners and allowlist for growth tier', () => {
        const config = {
            profile: 'standard',
            scanners: { credential_leak: { enabled: true } },
            allowlist: ['internal.local'],
            rules: { credentials: { enabled: false } }
        };
        const sanitized = sanitizeConfigForTier(config, 'growth');
        assert.deepStrictEqual(sanitized.scanners, config.scanners);
        assert.deepStrictEqual(sanitized.allowlist, config.allowlist);
    });

    it('allows everything for enterprise tier', () => {
        const config = {
            profile: 'standard',
            scanners: { credential_leak: { enabled: true } },
            allowlist: ['internal.local'],
            rules: { credentials: { enabled: false } }
        };
        const sanitized = sanitizeConfigForTier(config, 'enterprise');
        assert.deepStrictEqual(sanitized.scanners, config.scanners);
        assert.deepStrictEqual(sanitized.allowlist, config.allowlist);
    });
});
