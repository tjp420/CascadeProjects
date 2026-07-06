/**
 * Unified tier constants — single source of truth for SimpleBeacon tier system.
 * Inlined here so the VSIX extension doesn't depend on external filesystem paths.
 */

export const TIER_DEFINITIONS: Record<string, {
    paid: boolean;
    label: string;
    quota: number;
    engines: string;
    websiteScans: boolean;
    websiteScanQuota: number;
    maxFilesPerScan: number;
    maxFindingsShown: number;
    showQualityScore: boolean;
    pipelineScans: boolean;
    customConfig: boolean;
    allowlist: boolean;
}> = {
    developer: {
        paid: false,
        label: 'Solo',
        quota: Infinity,
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

export const TIER_ALIASES: Record<string, string> = {
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
};

export const PAID_TIERS: ReadonlySet<string> = new Set(
    Object.entries(TIER_DEFINITIONS)
        .filter(([, def]) => def.paid)
        .map(([tier]) => tier)
);

export const FREE_TIERS: ReadonlySet<string> = new Set(
    Object.entries(TIER_DEFINITIONS)
        .filter(([, def]) => !def.paid)
        .map(([tier]) => tier)
);

export function resolveTier(raw: string | undefined): string {
    const t = String(raw || '').toLowerCase().trim();
    const canonical = TIER_ALIASES[t] || t;
    return TIER_DEFINITIONS[canonical] ? canonical : 'developer';
}

export function isPaidTier(tier: string | undefined): boolean {
    const canonical = resolveTier(tier);
    return TIER_DEFINITIONS[canonical]?.paid ?? false;
}

export function getTierLimits(tier: string | undefined): typeof TIER_DEFINITIONS[string] {
    const canonical = resolveTier(tier);
    return TIER_DEFINITIONS[canonical] || TIER_DEFINITIONS.developer;
}

export function getTierCapability(tier: string | undefined, capability: string): boolean {
    const canonical = resolveTier(tier);
    const def = TIER_DEFINITIONS[canonical] || TIER_DEFINITIONS.developer;
    return (def as any)[capability] ?? false;
}
