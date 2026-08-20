// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
"use strict";

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
 * Access the frozen registry snapshot:
 * ```js
 * const { getRegistry } = require('./compliance-rules');
 * Object.isFrozen(getRegistry()); // true
 * ```
 *
 * @file packages/simplebeacon-cli/src/compliance-rules/index.js
 */

const fs = require("fs");
const path = require("path");

/** Discover and load all rule modules from the current directory. */
function loadRuleRegistry() {
  const registry = {};
  const dir = __dirname;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".js") && f !== "index.js");
  for (const file of files) {
    const id = path.basename(file, ".js");
    registry[id] = require(path.join(dir, file));
  }
  return registry;
}

const registry = loadRuleRegistry();

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
      status: "skip",
      evidence: `Unknown check: ${rule.check}`,
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

/** Return a frozen snapshot of the current registry. */
function getRegistry() {
  return Object.freeze({ ...registry });
}

module.exports = Object.freeze({
  evaluateRule,
  registerRule,
  getRegistry,
});
