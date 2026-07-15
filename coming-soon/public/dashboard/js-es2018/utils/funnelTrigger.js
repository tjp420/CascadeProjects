/**
 * SimpleBeacon Automated Funnel Trigger Engine
 * Evaluates free tier scan metrics to trigger contextual enterprise upsells.
 */
export function evaluateFunnelMetrics(reportData) {
    var _a;
    const triggers = {
        shouldPromptUpgrade: false,
        reason: null,
        targetTier: 'team'
    };
    if (!reportData)
        return triggers;
    // 1. Enterprise Scale Check: Large file volume footprint
    if (reportData.files_scanned > 5000 || reportData.total_files > 15000) {
        triggers.shouldPromptUpgrade = true;
        triggers.reason = 'monorepo_scale';
        triggers.targetTier = 'enterprise';
        return triggers;
    }
    // 2. Multi-Team Check: Stale TODO items or varying metadata flags
    if (reportData.quality_score < 80 && ((_a = reportData.findings) === null || _a === void 0 ? void 0 : _a.some(f => f.rule_id === 'SB-FICTION-003'))) {
        triggers.shouldPromptUpgrade = true;
        triggers.reason = 'hallucinated_dependency_risk';
        triggers.targetTier = 'team';
        return triggers;
    }
    return triggers;
}
/**
 * Returns tailored conversion copy blocks based on the trigger context
 */
export function shouldShowEnterpriseFunnel(options = {}) {
    if (options.isAdmin)
        return false;
    if (options.isFreeTier === false)
        return false;
    const tier = String(options.tier || '').toLowerCase();
    const paidTiers = ['team', 'enterprise', 'operator', 'handoff', 'pro', 'business', 'gold', 'platinum'];
    if (paidTiers.includes(tier))
        return false;
    const trust = String(options.trustLevel || '').toLowerCase();
    if (trust === 'gold' || trust === 'platinum')
        return false;
    return true;
}

/**
 * Returns tailored conversion copy blocks based on the trigger context
 */
export function getFunnelCopy(reason) {
    const copyMap = {
        monorepo_scale: {
            title: 'Scaling SimpleBeacon for Large Monorepos',
            body: 'Your repository size exceeds the standard developer free tier limits. Unlock premium multi-threaded scan processing, custom rule profiles, and centralized compliance reporting.',
            cta: 'Contact Enterprise Sales'
        },
        hallucinated_dependency_risk: {
            title: 'Protect Your Supply Chain',
            body: 'We detected suspicious or unverified dependency footprints in this workspace. Upgrade to the Team plan to activate automated real-time npm registry 404 validation gates.',
            cta: 'Upgrade to Team ($149/mo)'
        }
    };
    return copyMap[reason] || {
        title: 'Unlock Advanced Analytics',
        body: 'Get deep KPI tracking, code history metrics, and cryptographically signed release certificates.',
        cta: 'View Premium Tiers'
    };
}
