'use strict';

/**
 * @module compliance-rules
 * Pluggable compliance rule registry.
 *
 * Each rule exports a function: `(rule, context) => result`.
 * Rules are evaluated against a scan report to verify quality gates,
 * security posture, schema compliance, and EU AI Act requirements.
 *
 * Evaluate a built-in rule:
 * ```js
 * const { evaluateRule } = require('./compliance-rules');
 * const result = evaluateRule({ id: 'r1', check: 'gate-pass', title: 'Gate', category: 'quality', severity: 'high' }, { report });
 * ```
 *
 * Register a custom rule at runtime:
 * ```js
 * const { registerRule } = require('./compliance-rules');
 * registerRule('my-check', (rule, context) => ({ ...result }));
 * ```
 *
 * Access the frozen registry directly:
 * ```js
 * const { registry } = require('./compliance-rules');
 * Object.isFrozen(registry); // true
 * ```
 *
 * @file packages/simplebeacon-cli/src/compliance-rules/index.js
 */

const registry = {
    'gate-pass': require('./gate-pass'),
    'zero-credential-findings': require('./zero-credential-findings'),
    'zero-production-leaks': require('./zero-production-leaks'),
    'schema-compliance': require('./schema-compliance'),
    'consistency-pass': require('./consistency-pass'),
    'npm-no-critical-high': require('./npm-no-critical-high'),
    'npm-moderate-limit': require('./npm-moderate-limit'),
    'production-auth-profile': require('./production-auth-profile'),
    'eu-ai-act-high-risk-reviewed': require('./eu-ai-act-high-risk-reviewed'),
    'eu-ai-act-transparency': require('./eu-ai-act-transparency'),
    'eu-ai-act-documentation': require('./eu-ai-act-documentation'),
    'eu-ai-act-human-oversight': require('./eu-ai-act-human-oversight'),
    'eu-ai-act-logging': require('./eu-ai-act-logging'),
    'cleanup-bloat-reviewed': require('./cleanup-bloat-reviewed'),
    'cleanup-empty-dirs': require('./cleanup-empty-dirs'),
    'file-reduction-reviewed': require('./file-reduction-reviewed')
};

/**
 * Evaluate a single compliance rule against the provided scan context.
 *
 * @param {Object} rule - Rule definition with `check`, `id`, `title`, etc.
 * @param {Object} context - Scan context, typically `{ report }`.
 * @returns {Object} Result object with `status` ('pass'|'fail'|'skip'),
 *   `evidence`, and rule metadata.
 *
 * @example
 * const { evaluateRule } = require('./compliance-rules');
 * const result = evaluateRule(
 *   { id: 'r1', check: 'gate-pass', title: 'Gate', category: 'quality', severity: 'high' },
 *   { report: { gate: { pass: true } } }
 * );
 * // { status: 'pass', evidence: 'Gate pass — no blocking issues at configured severities', ... }
 */
function evaluateRule(rule, context) {
    const evaluator = registry[rule.check];
    if (!evaluator) {
        return {
            id: rule.id,
            title: rule.title,
            category: rule.category,
            severity: rule.severity,
            remediation: rule.remediation || null,
            status: 'skip',
            evidence: `Unknown check: ${rule.check}`
        };
    }
    return evaluator(rule, context);
}

/**
 * Register a custom evaluator for a given check name.
 *
 * @param {string} checkName - Unique check identifier.
 * @param {Function} evaluatorFn - `(rule, context) => result`.
 * @returns {void}
 *
 * @example
 * const { registerRule } = require('./compliance-rules');
 * registerRule('custom-check', (rule, context) => ({
 *   status: 'pass',
 *   evidence: 'All clear'
 * }));
 */
function registerRule(checkName, evaluatorFn) {
    registry[checkName] = evaluatorFn;
}

module.exports = Object.freeze({
  evaluateRule,
  registerRule,
  registry: Object.freeze({ ...registry })
});
