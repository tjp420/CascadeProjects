/**
 * Validate .simplebeacon/config.json and return warnings/errors.
 */

const VALID_RULES = new Set([
    'credentials',
    'json-schema',
    'sample-consistency',
    'roadmap',
    'production-leak',
    'fiction-kpi-patterns',
    'llm-slop-patterns',
    'agency-handoff-patterns',
    'eu-ai-act-patterns',
    'jest-baseline',
    'credential_leak',
    'hallucinated_urls',
    'fictional_kpis',
    'mock_data_paths',
    'debug_artifacts',
    'eu_ai_act',
    'token-bleed-patterns',
    'architecture-drift-patterns',
    'hardcoded-url',
    'weak-crypto',
    'secret-in-comments',
    'sync-io-async-path',
    'env-in-git',
    'redos-risk',
    'pii-logging',
    'dead-code',
    'memory-leak',
    'type-safety',
    'hallucinated-import',
    'dependency-graph',
    'ast-structural',
    'owasp-llm-patterns',
    'regional-ai-safety-patterns',
    'enterprise-guardrail-patterns',
    'comprehensive',
    'security-patterns',
    'cve-dependency',
    'sbom-generator',
    'git-history-secret',
    'gzdoom-integrity-patterns'
]);

const VALID_SCANNER_ACTIONS = new Set(['BLOCK', 'WARN', 'SKIP']);
const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);
const VALID_PROFILES = new Set(['minimal', 'standard', 'cascade', 'eu-ai-act', 'gamedev']);

function validateConfig(config) {
    const errors = [];
    const warnings = [];

    if (!config || typeof config !== 'object') {
        errors.push('Config must be a JSON object');
        return { valid: false, errors, warnings };
    }

    if (config.profile && !VALID_PROFILES.has(config.profile)) {
        warnings.push(`Unknown profile "${config.profile}" — use minimal, standard, or cascade`);
    }

    if (config.scanPaths != null && !Array.isArray(config.scanPaths)) {
        errors.push('scanPaths must be an array of relative paths');
    } else if (Array.isArray(config.scanPaths) && config.scanPaths.length === 0) {
        warnings.push('scanPaths is empty — scan will find no mock data files');
    } else if (Array.isArray(config.scanPaths)) {
        for (const scanPath of config.scanPaths) {
            if (typeof scanPath !== 'string' || !scanPath.trim()) {
                errors.push('scanPaths entries must be non-empty strings');
                continue;
            }
            if (/^(?:[A-Za-z]:[\\/]|\/)/.test(scanPath) || scanPath.includes('..')) {
                errors.push(`scanPaths entry must be repository-relative and non-traversing: "${scanPath}"`);
            }
        }
    }

    if (config.productionPaths != null && !Array.isArray(config.productionPaths)) {
        errors.push('productionPaths must be an array of relative paths');
    } else if (Array.isArray(config.productionPaths)) {
        for (const productionPath of config.productionPaths) {
            if (typeof productionPath !== 'string' || !productionPath.trim()) {
                errors.push('productionPaths entries must be non-empty strings');
                continue;
            }
            if (/^(?:[A-Za-z]:[\\/]|\/)/.test(productionPath) || productionPath.includes('..')) {
                errors.push(`productionPaths entry must be repository-relative and non-traversing: "${productionPath}"`);
            }
        }
    }

    if (config.rules && typeof config.rules === 'object') {
        for (const [name, rule] of Object.entries(config.rules)) {
            if (!VALID_RULES.has(name)) {
                warnings.push(`Unknown rule "${name}" — ignored`);
                continue;
            }
            if (rule && typeof rule === 'object' && rule.severity && !VALID_SEVERITIES.has(rule.severity)) {
                warnings.push(`Rule "${name}" has invalid severity "${rule.severity}"`);
            }
        }
    }

    if (config.gate?.failOn) {
        for (const sev of config.gate.failOn) {
            if (!VALID_SEVERITIES.has(sev)) {
                warnings.push(`gate.failOn contains invalid severity "${sev}"`);
            }
        }
    }

    if (config.scanners && typeof config.scanners === 'object') {
        for (const [name, scanner] of Object.entries(config.scanners)) {
            if (scanner && typeof scanner === 'object') {
                if (scanner.action && !VALID_SCANNER_ACTIONS.has(scanner.action)) {
                    warnings.push(`Scanner "${name}" has invalid action "${scanner.action}" — use BLOCK, WARN, or SKIP`);
                }
                if (scanner.severity && !VALID_SEVERITIES.has(scanner.severity)) {
                    warnings.push(`Scanner "${name}" has invalid severity "${scanner.severity}"`);
                }
            }
        }
    }

    if (config.allowlist != null) {
        if (!Array.isArray(config.allowlist)) {
            errors.push('allowlist must be an array of strings');
        } else {
            for (const item of config.allowlist) {
                if (typeof item !== 'string' || !item.trim()) {
                    errors.push('allowlist entries must be non-empty strings');
                }
            }
        }
    }

    return { valid: errors.length === 0, errors, warnings };
}

module.exports = {
    VALID_RULES,
    VALID_PROFILES,
    VALID_SCANNER_ACTIONS,
    VALID_SEVERITIES,
    validateConfig
};
