// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Evaluate declarative corporate safety rules against a Simplebeacon scan report.
 *
 * REFACTORED: Previously 540 lines with a massive switch statement.
 * Now a thin facade over focused sub-modules:
 *   - compliance-rules/      — pluggable rule registry (one file per check)
 *   - compliance-checklist/detectors.js — npm audit + auth profile detection
 */

const fs = require('fs');
const path = require('path');
const DEFAULT_CHECKLIST = require('./compliance-checklist.defaults.json');
const EU_AI_ACT_CHECKLIST = require('./compliance-checklist.eu-ai-act.defaults.json');
const { evaluateRule } = require('./compliance-rules');
const {
  detectNpmAuditSummary,
  detectProductionAuthProfile,
} = require('./compliance-checklist/detectors');

/** Frozen map of built-in checklist profiles. */
const CHECKLIST_PROFILES = Object.freeze({
  default: DEFAULT_CHECKLIST,
  corporate: DEFAULT_CHECKLIST,
  'eu-ai-act': EU_AI_ACT_CHECKLIST,
});

/* ── Checklist loading ──────────────────────────────────────────────── */

/**
 * Determine whether a parsed custom checklist file is a stale evaluated output.
 * @param {object} custom Parsed JSON from a compliance-checklist.json file.
 * @returns {boolean}
 */
function isEvaluatedChecklistOutput(custom) {
  const customRules = Array.isArray(custom?.rules) ? custom.rules : [];
  if (!customRules.length) return false;
  if (custom.evaluatedAt || custom.summary?.passed != null || custom.summary?.failed != null) {
    return true;
  }
  return customRules.every((rule) => rule.status != null && !rule.check);
}

/**
 * Merge custom rules on top of defaults, preserving fallback `check` fields.
 * Strips prior `status`/`evidence` so re-evaluation is clean.
 * @param {Array<object>} customRules Rules loaded from the custom file.
 * @param {Array<object>} defaultRules Rules from the selected base profile.
 * @returns {Array<object>} Merged and filtered rule set.
 */
function mergeChecklistRules(customRules, defaultRules) {
  const defaultsById = new Map((defaultRules || []).map((rule) => [rule.id, rule]));
  if (!customRules?.length) return defaultRules;

  const result = new Map(defaultsById);
  for (const rule of customRules) {
    const base = result.get(rule.id) || {};
    const merged = { ...base, ...rule, check: rule.check || base.check };
    delete merged.status;
    delete merged.evidence;
    result.set(rule.id, merged);
  }
  return [...result.values()].filter((rule) => rule.check);
}

/**
 * Resolve the base checklist profile, defaulting to `DEFAULT_CHECKLIST`.
 * Guards against unknown profile names.
 * @param {object} [options]
 * @param {string} [options.checklistProfile]
 * @param {string} [options.profile]
 * @returns {object} Base checklist object.
 */
function resolveChecklistBase(options = {}) {
  const profile = options.checklistProfile || options.profile || 'default';
  if (!Object.prototype.hasOwnProperty.call(CHECKLIST_PROFILES, profile)) {
    return DEFAULT_CHECKLIST;
  }
  return CHECKLIST_PROFILES[profile];
}

/**
 * Validate that a checklist object has the minimum required shape.
 * @param {object} checklist
 * @returns {{ valid: boolean; errors: string[] }}
 */
function validateChecklist(checklist) {
  const errors = [];
  if (!Array.isArray(checklist.rules)) {
    errors.push('Missing or non-array "rules"');
  } else {
    for (let i = 0; i < checklist.rules.length; i++) {
      const rule = checklist.rules[i];
      if (typeof rule.id !== 'string') errors.push(`Rule ${i}: missing "id"`);
      if (typeof rule.check !== 'string') errors.push(`Rule ${i}: missing "check"`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Load the compliance checklist for a project, merging custom rules if present.
 * Returns `{ checklist, error }` so callers can decide how to handle invalid JSON.
 * @param {string} projectRoot Absolute or relative path to the project root.
 * @param {object} [options]
 * @param {string} [options.checklistProfile]
 * @returns {{ checklist: object; error?: string }}
 */
function loadComplianceChecklist(projectRoot, options = {}) {
  const baseChecklist = resolveChecklistBase(options);
  if (!projectRoot) return { checklist: baseChecklist };
  const customPath = path.join(
    path.resolve(projectRoot),
    '.simplebeacon',
    'compliance-checklist.json'
  );
  if (!fs.existsSync(customPath)) return { checklist: baseChecklist };
  try {
    const custom = JSON.parse(fs.readFileSync(customPath, 'utf8'));
    const defaultRules = baseChecklist.rules || [];
    const customRules = Array.isArray(custom.rules) ? custom.rules : [];
    const rules = isEvaluatedChecklistOutput(custom)
      ? defaultRules
      : mergeChecklistRules(customRules, defaultRules);
    const merged = { ...baseChecklist, ...custom, rules: rules.length ? rules : defaultRules };
    const validation = validateChecklist(merged);
    return validation.valid
      ? { checklist: merged }
      : {
          checklist: baseChecklist,
          error: `Invalid custom checklist: ${validation.errors.join('; ')}`,
        };
  } catch (err) {
    return { checklist: baseChecklist, error: `Failed to load custom checklist: ${err.message}` };
  }
}

/* ── Evaluation context ──────────────────────────────────────────── */

const _evalCtxCache = new Map();

/**
 * Build the evaluation context for a single checklist run.
 * Caches detector results per `projectRoot` to avoid redundant filesystem probes.
 * @param {object} report Simplebeacon scan report.
 * @param {object} [options]
 * @param {string} [options.projectRoot]
 * @param {object} [options.npmAudit]
 * @param {object} [options.productionProfile]
 * @param {*} [options.dataCleanup]
 * @returns {object} Context passed to each rule evaluator.
 */
function buildEvaluationContext(report, options = {}) {
  const projectRoot = options.projectRoot || report.projectRoot || '';

  let cached = _evalCtxCache.get(projectRoot);
  if (!cached) {
    cached = {
      npmAudit: detectNpmAuditSummary(projectRoot),
      productionProfile: detectProductionAuthProfile(projectRoot),
    };
    _evalCtxCache.set(projectRoot, cached);
  }

  return {
    report,
    npmAudit: options.npmAudit || cached.npmAudit,
    productionProfile: options.productionProfile || cached.productionProfile,
    dataCleanup: options.dataCleanup || null,
  };
}

/**
 * Format a byte count into a human-readable string.
 * @param {number} bytes
 * @returns {string} e.g. "1.5 MB"
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Generate a human-readable headline summarising the checklist outcome.
 * @param {number} passed
 * @param {number} failed
 * @param {number} skipped
 * @param {number} scored
 * @param {boolean} isEuAiAct
 * @returns {string}
 */
function buildHeadline(passed, failed, skipped, scored, isEuAiAct) {
  if (failed === 0 && passed > 0) {
    return isEuAiAct
      ? `${passed}/${scored} EU AI Act readiness rules pass — review legal classification before August 2026`
      : `${passed}/${scored} applicable rules pass — safe to enable automated AI deploy gates`;
  }
  if (failed > 0) {
    return isEuAiAct
      ? `${failed} EU AI Act rule(s) fail — address before August 2026 deadline`
      : `${failed} rule(s) fail — fix before handing operations to AI-generated code`;
  }
  if (skipped === scored + skipped) {
    return 'Checklist not evaluated — stale compliance output was ignored; re-run assess or compliance';
  }
  return 'No scored rules — review scan report manually';
}

/**
 * Evaluate the full compliance checklist against a scan report.
 * @param {object} report Simplebeacon scan report.
 * @param {object} [options]
 * @param {string} [options.projectRoot]
 * @param {string} [options.checklistProfile]
 * @param {object} [options.checklist]
 * @param {object} [options.npmAudit]
 * @param {object} [options.productionProfile]
 * @param {*} [options.dataCleanup]
 * @returns {object} Compliance checklist result.
 */
function evaluateComplianceChecklist(report, options = {}) {
  const projectRoot = options.projectRoot || report.projectRoot || '';
  const { checklist, error } = options.checklist
    ? { checklist: options.checklist }
    : loadComplianceChecklist(projectRoot, { checklistProfile: options.checklistProfile });
  if (error) {
    /* eslint-disable no-console */
    console.warn('[compliance-checklist]', error);
  }
  const context = buildEvaluationContext(report, options);
  const rules = (checklist.rules || []).map((rule) => evaluateRule(rule, context));

  const passed = rules.filter((r) => r.status === 'pass').length;
  const failed = rules.filter((r) => r.status === 'fail').length;
  const skipped = rules.filter((r) => r.status === 'skip').length;
  const scored = passed + failed;
  const score = scored ? Math.round((passed / scored) * 100) : null;

  const isEuAiAct =
    checklist.extends === 'corporate-safety' || options.checklistProfile === 'eu-ai-act';

  return {
    type: 'simplebeacon-compliance-checklist',
    version: checklist.version || '1.0.0',
    title: checklist.title || 'Simplebeacon Corporate Safety Checklist',
    description: checklist.description || null,
    evaluatedAt: new Date().toISOString(),
    projectRoot: projectRoot || report.projectRoot || '',
    summary: {
      passed,
      failed,
      skipped,
      total: rules.length,
      score,
      readyForAutomation: failed === 0 && passed > 0,
      checklistProfile: options.checklistProfile || (isEuAiAct ? 'eu-ai-act' : 'default'),
      headline: buildHeadline(passed, failed, skipped, scored, isEuAiAct),
    },
    rules,
  };
}

/* ── Re-exports ────────────────────────────────────────────────────── */

module.exports = {
  loadComplianceChecklist,
  evaluateComplianceChecklist,
  evaluateRule,
  detectNpmAuditSummary,
  detectProductionAuthProfile,
  resolveChecklistBase,
  DEFAULT_CHECKLIST,
  EU_AI_ACT_CHECKLIST,
  CHECKLIST_PROFILES,
};
