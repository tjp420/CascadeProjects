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
const { detectNpmAuditSummary, detectProductionAuthProfile } = require('./compliance-checklist/detectors');

const CHECKLIST_PROFILES = {
    default: DEFAULT_CHECKLIST,
    corporate: DEFAULT_CHECKLIST,
    'eu-ai-act': EU_AI_ACT_CHECKLIST
};

/* ── Checklist loading ──────────────────────────────────────────────── */

function isEvaluatedChecklistOutput(custom) {
    const customRules = Array.isArray(custom?.rules) ? custom.rules : [];
    if (!customRules.length) return false;
    if (custom.evaluatedAt || custom.summary?.passed != null || custom.summary?.failed != null) {
        return true;
    }
    return customRules.every((rule) => rule.status != null && !rule.check);
}

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

function resolveChecklistBase(options = {}) {
    const profile = options.checklistProfile || options.profile || 'default';
    return CHECKLIST_PROFILES[profile] || DEFAULT_CHECKLIST;
}

function loadComplianceChecklist(projectRoot, options = {}) {
    const baseChecklist = resolveChecklistBase(options);
    if (!projectRoot) return baseChecklist;
    const customPath = path.join(path.resolve(projectRoot), '.simplebeacon', 'compliance-checklist.json');
    if (!fs.existsSync(customPath)) return baseChecklist;
    try {
        const custom = JSON.parse(fs.readFileSync(customPath, 'utf8'));
        const defaultRules = baseChecklist.rules || [];
        const customRules = Array.isArray(custom.rules) ? custom.rules : [];
        const rules = isEvaluatedChecklistOutput(custom)
            ? defaultRules
            : mergeChecklistRules(customRules, defaultRules);
        return { ...baseChecklist, ...custom, rules: rules.length ? rules : defaultRules };
    } catch {
        return baseChecklist;
    }
}

/* ── Evaluation context ──────────────────────────────────────────── */

function buildEvaluationContext(report, options = {}) {
    const projectRoot = options.projectRoot || report.projectRoot || '';
    return {
        report,
        npmAudit: options.npmAudit || detectNpmAuditSummary(projectRoot),
        productionProfile: options.productionProfile || detectProductionAuthProfile(projectRoot),
        dataCleanup: options.dataCleanup || null
    };
}

/* ── Formatting ────────────────────────────────────────────────────── */

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/* ── Main evaluator ────────────────────────────────────────────────── */

function evaluateComplianceChecklist(report, options = {}) {
    const projectRoot = options.projectRoot || report.projectRoot || '';
    const checklist = options.checklist || loadComplianceChecklist(projectRoot, {
        checklistProfile: options.checklistProfile
    });
    const context = buildEvaluationContext(report, options);
    const rules = (checklist.rules || []).map((rule) => evaluateRule(rule, context));

    const passed = rules.filter((r) => r.status === 'pass').length;
    const failed = rules.filter((r) => r.status === 'fail').length;
    const skipped = rules.filter((r) => r.status === 'skip').length;
    const scored = passed + failed;
    const score = scored ? Math.round((passed / scored) * 100) : null;

    const isEuAiAct = checklist.extends === 'corporate-safety' || options.checklistProfile === 'eu-ai-act';

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
            headline: failed === 0 && passed > 0
                ? (isEuAiAct
                    ? `${passed}/${scored} EU AI Act readiness rules pass — review legal classification before August 2026`
                    : `${passed}/${scored} applicable rules pass — safe to enable automated AI deploy gates`)
                : failed > 0
                    ? (isEuAiAct
                        ? `${failed} EU AI Act rule(s) fail — address before August 2026 deadline`
                        : `${failed} rule(s) fail — fix before handing operations to AI-generated code`)
                    : skipped === rules.length
                        ? 'Checklist not evaluated — stale compliance output was ignored; re-run assess or compliance'
                        : 'No scored rules — review scan report manually'
        },
        rules
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
    CHECKLIST_PROFILES
};
