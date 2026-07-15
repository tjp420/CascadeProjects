/**
 * Unified tier constants — single source of truth for SimpleBeacon tier system.
 * Used by CLI, VS Code extension, dashboard, and server.
 */

const _TIER_DEFINITIONS = {
    developer: {
        paid: false,
        label: 'Solo',
        quota: Infinity,
        maxScansPerPeriod: 9999,
        engines: 'basic',
        websiteScans: false,
        websiteScanQuota: 0,
        maxFilesPerScan: 50,
        maxFindingsShown: 5,
        showQualityScore: false,
        pipelineScans: false,
        customConfig: false,
        allowlist: false
    },
    pro: {
        paid: true,
        label: 'Pro',
        quota: 2500,
        maxScansPerPeriod: 2500,
        engines: 'all',
        websiteScans: true,
        websiteScanQuota: 50,
        maxFilesPerScan: Infinity,
        maxFindingsShown: Infinity,
        showQualityScore: true,
        pipelineScans: true,
        customConfig: true,
        allowlist: false
    },
    team: {
        paid: true,
        label: 'Team',
        quota: 10000,
        maxScansPerPeriod: 10000,
        engines: 'all',
        websiteScans: true,
        websiteScanQuota: 200,
        maxFilesPerScan: Infinity,
        maxFindingsShown: Infinity,
        showQualityScore: true,
        pipelineScans: true,
        customConfig: true,
        allowlist: true
    },
    enterprise: {
        paid: true,
        label: 'Enterprise',
        quota: Infinity,
        maxScansPerPeriod: Infinity,
        engines: 'all',
        websiteScans: true,
        websiteScanQuota: Infinity,
        maxFilesPerScan: Infinity,
        maxFindingsShown: Infinity,
        showQualityScore: true,
        pipelineScans: true,
        customConfig: true,
        allowlist: true
    }
};

const TIER_ALIASES = Object.freeze({
    free: 'developer',
    community: 'developer',
    sandbox: 'developer',
    instant: 'developer',
    locked: 'developer',
    solo: 'developer',
    '': 'developer',
    startup: 'pro',
    growth: 'team',
    executive: 'pro',
    euai: 'pro',
    eusprint: 'team',
    universal: 'enterprise',
    custom: 'enterprise',
    compliance: 'enterprise',
    business: 'pro',
    premium: 'pro',
    license: 'pro',
    auditor: 'pro',
    admin: 'enterprise',
    paid: 'pro'
});

// Fill legacy alias entries with their canonical tier definitions
for (const [alias, canonical] of Object.entries(TIER_ALIASES)) {
    if (alias && !_TIER_DEFINITIONS[alias] && _TIER_DEFINITIONS[canonical]) {
        _TIER_DEFINITIONS[alias] = _TIER_DEFINITIONS[canonical];
    }
}
const TIER_DEFINITIONS = Object.freeze(_TIER_DEFINITIONS);

const PAID_TIERS = Object.freeze(new Set(
    Object.entries(TIER_DEFINITIONS)
        .filter(([, def]) => def.paid)
        .map(([tier]) => tier)
        .concat(Object.entries(TIER_ALIASES)
            .filter(([, canonical]) => TIER_DEFINITIONS[canonical]?.paid)
            .map(([alias]) => alias))
));

const FREE_TIERS = Object.freeze(new Set(
    Object.entries(TIER_DEFINITIONS)
        .filter(([, def]) => !def.paid)
        .map(([tier]) => tier)
        .concat(Object.entries(TIER_ALIASES)
            .filter(([, canonical]) => !TIER_DEFINITIONS[canonical]?.paid)
            .map(([alias]) => alias))
        .filter(tier => tier !== '')
));

function resolveTier(raw) {
    const t = String(raw || '').toLowerCase().trim();
    const canonical = TIER_ALIASES[t] || t;
    return TIER_DEFINITIONS[canonical] ? canonical : 'developer';
}

function isPaidTier(tier) {
    const canonical = resolveTier(tier);
    return TIER_DEFINITIONS[canonical]?.paid ?? false;
}

function getTierLimits(tier) {
    const canonical = resolveTier(tier);
    return TIER_DEFINITIONS[canonical] || TIER_DEFINITIONS.developer;
}

function getTierCapability(tier, capability) {
    const canonical = resolveTier(tier);
    return TIER_DEFINITIONS[canonical]?.[capability] ?? false;
}

module.exports = {
    TIER_DEFINITIONS,
    TIER_ALIASES,
    PAID_TIERS,
    FREE_TIERS,
    resolveTier,
    isPaidTier,
    getTierLimits,
    getTierCapability
};
