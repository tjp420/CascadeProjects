/**
 * Tests for tier-gated Configuration-as-Code in config.js.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { sanitizeConfigForTier, PROFILE_RULES } = require('../src/config');

describe('sanitizeConfigForTier', () => {
    it('strips scanners and allowlist for developer tier and disables non-free engines', () => {
        const config = {
            profile: 'standard',
            scanners: { credential_leak: { enabled: true } },
            allowlist: ['internal.local'],
            rules: { credentials: { enabled: false } }
        };
        const sanitized = sanitizeConfigForTier(config, 'developer');
        assert.strictEqual(sanitized.scanners, undefined);
        assert.strictEqual(sanitized.allowlist, undefined);
        // Free tier: only credentials, production-leak, llm-slop-patterns, security-patterns enabled
        // (dead-code is not in PROFILE_RULES.standard so it is absent, not explicitly disabled)
        assert.strictEqual(sanitized.rules.credentials.enabled, false);
        assert.strictEqual(sanitized.rules['production-leak'].enabled, true);
        assert.strictEqual(sanitized.rules['llm-slop-patterns'].enabled, true);
        assert.strictEqual(sanitized.rules['security-patterns'].enabled, true);
        assert.strictEqual(sanitized.rules.roadmap.enabled, false);
        assert.strictEqual(sanitized.rules['fiction-kpi-patterns'].enabled, false);
        assert.strictEqual(sanitized.rules['agency-handoff-patterns'].enabled, false);
    });

    it('allows scanners but strips allowlist for pro tier', () => {
        const config = {
            profile: 'standard',
            scanners: { credential_leak: { enabled: true } },
            allowlist: ['internal.local'],
            rules: { credentials: { enabled: false } }
        };
        const sanitized = sanitizeConfigForTier(config, 'pro');
        assert.deepStrictEqual(sanitized.scanners, config.scanners);
        assert.strictEqual(sanitized.allowlist, undefined);
    });

    it('allows both scanners and allowlist for team tier', () => {
        const config = {
            profile: 'standard',
            scanners: { credential_leak: { enabled: true } },
            allowlist: ['internal.local'],
            rules: { credentials: { enabled: false } }
        };
        const sanitized = sanitizeConfigForTier(config, 'team');
        assert.deepStrictEqual(sanitized.scanners, config.scanners);
        assert.deepStrictEqual(sanitized.allowlist, config.allowlist);
    });

    it('maps legacy startup to pro behavior', () => {
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

    it('maps legacy growth to team behavior', () => {
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
