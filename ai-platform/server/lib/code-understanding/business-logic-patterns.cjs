/**
 * Domain business-logic heuristics — deterministic pattern library by language/domain.
 */

const DOMAIN_PATTERNS = {
    'web-api': {
        label: 'Web API / HTTP handler',
        patterns: [
            { id: 'rest-route', pattern: /\b(app|router)\.(get|post|put|patch|delete)\s*\(/gi, label: 'HTTP route handler' },
            { id: 'auth-middleware', pattern: /\b(authenticate|requireAuth|requirePaid|jwt|session)\b/gi, label: 'Authentication middleware' },
            { id: 'validation', pattern: /\b(validate|schema|zod|joi|yup)\b/gi, label: 'Input validation' }
        ]
    },
    auth: {
        label: 'Authentication & authorization',
        patterns: [
            { id: 'login-flow', pattern: /\b(login|signIn|sign-in|password|bcrypt|argon2)\b/gi, label: 'Login / credential flow' },
            { id: 'token-issue', pattern: /\b(jwt|refreshToken|accessToken|Bearer)\b/gi, label: 'Token issuance' },
            { id: 'rbac', pattern: /\b(role|permission|authorize|forbidden|403)\b/gi, label: 'Role-based access' }
        ]
    },
    billing: {
        label: 'Billing & subscriptions',
        patterns: [
            { id: 'stripe', pattern: /\b(stripe|checkout\.session|paymentIntent|subscription)\b/gi, label: 'Payment / Stripe integration' },
            { id: 'quota', pattern: /\b(quota|usageLimit|tier|planId)\b/gi, label: 'Usage quota or plan tier' }
        ]
    },
    'data-pipeline': {
        label: 'Data processing pipeline',
        patterns: [
            { id: 'etl', pattern: /\b(transform|aggregate|pipeline|batch|stream)\b/gi, label: 'Data transform pipeline' },
            { id: 'schema-check', pattern: /\b(schema|validate|parse|serialize)\b/gi, label: 'Schema validation' }
        ]
    },
    'game-modding': {
        label: 'Game modding (GZDoom / ACS)',
        languages: ['zscript', 'acs', 'decorate'],
        patterns: [
            { id: 'actor-lifecycle', pattern: /\bclass\s+\w+\s*:\s*\w+/gi, label: 'Actor / class hierarchy' },
            { id: 'state-machine', pattern: /\bStates\s*\{/gi, label: 'State machine block' },
            { id: 'weapon-logic', pattern: /\b(Weapon|Ammo|Fire|Reload|AltFire)\b/g, label: 'Weapon combat logic' },
            { id: 'damage-rule', pattern: /\b(Damage|PainChance|RadiusDamage|A_Damage)\b/g, label: 'Damage / combat rules' },
            { id: 'inventory-give', pattern: /\b(GiveInventory|TakeInventory|CheckInventory)\b/g, label: 'Inventory rules' }
        ]
    },
    testing: {
        label: 'Test & quality gates',
        patterns: [
            { id: 'unit-test', pattern: /\b(describe|it|test|expect|assert)\s*\(/g, label: 'Unit test structure' },
            { id: 'mock-fixture', pattern: /\b(mock|fixture|stub|spyOn)\b/gi, label: 'Test doubles' }
        ]
    }
};

/**
 * Infer domain hints.
 * @param {string} filePath
 * @param {any} language
 * @returns {any}
 */
function inferDomainHints(filePath, language) {
    const rel = String(filePath || '').replace(/\\/g, '/').toLowerCase();
    const hints = [];
    if (/server\/|api\/|routes\//.test(rel)) hints.push('web-api');
    if (/auth|login|session|jwt/.test(rel)) hints.push('auth');
    if (/billing|stripe|subscription|payment/.test(rel)) hints.push('billing');
    if (/zscript|actors|weapons|decorate|\.zs$|\.acs$/.test(rel)) hints.push('game-modding');
    if (/test|spec|__tests__/.test(rel)) hints.push('testing');
    if (/pipeline|etl|transform|data\//.test(rel)) hints.push('data-pipeline');
    if (['zscript', 'acs', 'decorate'].includes(language)) hints.push('game-modding');
    return [...new Set(hints)];
}

/**
 * Detect business logic patterns.
 * @param {any} content
 * @param {Object} options
 * @returns {any}
 */
function detectBusinessLogicPatterns(content, options = {}) {
    const language = String(options.language || 'generic').toLowerCase();
    const domainHints = options.domainHints || inferDomainHints(options.filePath, language);
    const hits = [];

    for (const [domainId, domain] of Object.entries(DOMAIN_PATTERNS)) {
        if (domain.languages && !domain.languages.includes(language) && !domainHints.includes(domainId)) {
            continue;
        }
        if (domainHints.length && !domainHints.includes(domainId) && domain.languages) {
            continue;
        }

        for (const item of domain.patterns) {
            const pattern = new RegExp(item.pattern.source, item.pattern.flags);
            const matches = String(content || '').match(pattern);
            if (!matches?.length) continue;
            hits.push({
                domain: domainId,
                domainLabel: domain.label,
                patternId: item.id,
                label: item.label,
                matchCount: Math.min(matches.length, 20),
                confidence: domainHints.includes(domainId) ? 0.85 : 0.65
            });
        }
    }

    return {
        domains: [...new Set(hits.map((h) => h.domain))],
        patterns: hits.slice(0, 24),
        primaryDomain: hits[0]?.domain || domainHints[0] || null
    };
}

module.exports = {
    DOMAIN_PATTERNS,
    detectBusinessLogicPatterns,
    inferDomainHints
};
