/**
 * Agent-tier capability matrix — free 2/10 vs paid 11/10 for AI coding agents.
 * Consumed by MCP, CLI agent tools, extension, and browser audit.
 */

const { detectTier } = require('./tier-detector');
const { isPaidTier, resolveTier } = require('./tier-constants');

const UPGRADE_URL = 'https://simplebeacon.ai/pricing';
const FREE_SNIPPET_FINDING_CAP = 3;
const FREE_SUGGEST_FIX_CAP = 1;
const FREE_SNIPPET_SCANS_PER_DAY = 20;

/** Tools fully blocked on free tier (structured upsell response). */
const PAID_ONLY_TOOLS = new Set([
    'scan_file',
    'explain_finding',
    'propose_fix',
    'verify_fix',
    'scan_staged',
    'agent_status',
    'get_action_plan'
]);

/** Tools that require Developer tier or higher (not available on Agent tier). */
const DEVELOPER_PLUS_TOOLS = new Set([
    'scan_staged',
    'get_action_plan'
]);

/** Agent tier tools — the fix loop unlocked at $25/mo. */
const AGENT_TIER_TOOLS = new Set([
    'scan_file',
    'explain_finding',
    'propose_fix',
    'verify_fix',
    'agent_status'
]);

/** In-process daily snippet scan counter for free MCP (resets at UTC midnight). */
const snippetScanCounts = new Map();

function utcDayKey() {
    return new Date().toISOString().slice(0, 10);
}

function resolveAgentTier(options = {}) {
    if (options.tier) {
        const tier = resolveTier(options.tier);
        return { tier, paid: isPaidTier(tier), source: 'options' };
    }
    const detected = detectTier();
    return {
        tier: detected.tier,
        paid: detected.paid,
        source: detected.tokenPresent ? 'license' : 'default',
        error: detected.error || null
    };
}

function getAgentCapabilities(tierOrCtx) {
    const ctx = typeof tierOrCtx === 'object' && tierOrCtx !== null
        ? tierOrCtx
        : { tier: resolveTier(tierOrCtx), paid: isPaidTier(tierOrCtx) };
    const tier = resolveTier(ctx.tier);
    const paid = Boolean(ctx.paid);
    const isGameDev = tier === 'game_dev';
    const isAgent = tier === 'agent';
    const isDevPlus = paid && !isAgent && !isGameDev;
    return {
        tier,
        agentExperience: isGameDev ? '7/10' : isAgent ? '8/10' : paid ? '11/10' : '2/10',
        scanSnippet: true,
        scanSnippetFullFindings: paid,
        scanSnippetMaxFindings: paid ? Infinity : FREE_SNIPPET_FINDING_CAP,
        scanFile: paid,
        proposeFix: paid,
        verifyFix: paid,
        scanStaged: isDevPlus,
        agentStatus: paid,
        explainFinding: paid,
        suggestFixesMax: paid ? 5 : FREE_SUGGEST_FIX_CAP,
        getActionPlan: isDevPlus,
        cursorPreApplyHook: isDevPlus,
        fullAgentBrief: isDevPlus,
        fullAiContextPack: isDevPlus,
        snippetScansPerDay: paid ? Infinity : FREE_SNIPPET_SCANS_PER_DAY,
        patternIdsInFindings: paid,
        recommendedActionInFindings: paid
    };
}

function formatUpsell(toolName, tierCtx) {
    const tier = tierCtx && tierCtx.tier ? resolveTier(tierCtx.tier) : 'developer';
    const isGameDev = tier === 'game_dev';
    const isAgent = tier === 'agent';
    const needsDevPlus = DEVELOPER_PLUS_TOOLS.has(toolName);
    const minTier = needsDevPlus
        ? 'Developer ($49/mo)'
        : isGameDev ? 'Agent ($25/mo)' : 'Agent ($25/mo)';
    const expLabel = isGameDev ? '7/10' : isAgent ? '8/10' : '2/10';
    return {
        blocked: true,
        tool: toolName,
        tier: tier,
        agentExperience: expLabel,
        reason: `${toolName} requires ${minTier} or higher.`,
        upgradeUrl: UPGRADE_URL,
        upsell: `Upgrade to ${minTier} to unlock ${toolName} — https://simplebeacon.ai/pricing`
    };
}

function assertCapability(toolName, tierCtx) {
    const ctx = tierCtx && typeof tierCtx.paid === 'boolean' ? tierCtx : resolveAgentTier(tierCtx);
    if (ctx.paid) {
        const tier = resolveTier(ctx.tier);
        if ((tier === 'agent' || tier === 'game_dev') && DEVELOPER_PLUS_TOOLS.has(toolName)) {
            return { allowed: false, tier: ctx.tier, paid: true, upsell: formatUpsell(toolName, ctx) };
        }
        return { allowed: true, tier: ctx.tier, paid: true };
    }
    if (PAID_ONLY_TOOLS.has(toolName)) {
        return { allowed: false, tier: ctx.tier, paid: false, upsell: formatUpsell(toolName, ctx) };
    }
    return { allowed: true, tier: ctx.tier, paid: false };
}

function redactFindingsForFree(findings, cap) {
    const max = cap || FREE_SNIPPET_FINDING_CAP;
    return (findings || []).slice(0, max).map((f) => ({
        severity: f.severity || 'medium',
        type: f.type || 'Finding',
        description: f.description
            ? String(f.description).slice(0, 120)
            : 'Issue detected — upgrade to see pattern id and remediation steps.',
        filePath: f.filePath || null,
        line: f.line ?? null
    }));
}

function applyFreeSnippetLimits(result) {
    const findings = redactFindingsForFree(result.findings, FREE_SNIPPET_FINDING_CAP);
    const blockingCount = findings.filter(
        (f) => f.severity === 'high' || f.severity === 'critical'
    ).length;
    return {
        ...result,
        findings,
        findingCount: findings.length,
        blockingCount,
        redacted: true,
        agentExperience: '2/10',
        upgradeUrl: UPGRADE_URL,
        upsell: 'Upgrade to Agent ($25/mo) for the fix loop (scan_file, propose_fix, verify_fix) or Developer ($49/mo) for CI gate tools (scan_staged, get_action_plan) — https://simplebeacon.ai/pricing'
    };
}

function checkFreeSnippetRateLimit(key) {
    const day = utcDayKey();
    const id = String(key || 'default');
    const entry = snippetScanCounts.get(id);
    if (!entry || entry.day !== day) {
        snippetScanCounts.set(id, { day, count: 1 });
        return { allowed: true, remaining: FREE_SNIPPET_SCANS_PER_DAY - 1 };
    }
    if (entry.count >= FREE_SNIPPET_SCANS_PER_DAY) {
        return {
            allowed: false,
            remaining: 0,
            upsell: formatUpsell('scan_snippet'),
            reason: `Free tier allows ${FREE_SNIPPET_SCANS_PER_DAY} snippet scans per day. Upgrade for unlimited agent scans.`
        };
    }
    entry.count += 1;
    return { allowed: true, remaining: FREE_SNIPPET_SCANS_PER_DAY - entry.count };
}

function resetSnippetRateLimitsForTests() {
    snippetScanCounts.clear();
}

module.exports = {
    UPGRADE_URL,
    FREE_SNIPPET_FINDING_CAP,
    FREE_SUGGEST_FIX_CAP,
    FREE_SNIPPET_SCANS_PER_DAY,
    PAID_ONLY_TOOLS,
    DEVELOPER_PLUS_TOOLS,
    AGENT_TIER_TOOLS,
    resolveAgentTier,
    getAgentCapabilities,
    formatUpsell,
    assertCapability,
    redactFindingsForFree,
    applyFreeSnippetLimits,
    checkFreeSnippetRateLimit,
    resetSnippetRateLimitsForTests
};
