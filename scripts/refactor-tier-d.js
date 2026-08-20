// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require("fs");

const tierFile =
  "C:/Users/Trevor/CascadeProjects/ai-platform/server/lib/audit-export-tier.cjs";
let tier = fs.readFileSync(tierFile, "utf8");

// 1. Extract buildTierResult helper to reduce duplication in assessAuditExportTier
const buildTierResultFunc = `
function buildTierResult(tier, label, overrides = {}) {
    return {
        tier,
        label,
        missingForHandoff: overrides.missingForHandoff ?? [],
        readinessDisplay: overrides.readinessDisplay ?? null,
        showSignOffBlock: overrides.showSignOffBlock ?? false,
        showReadinessScore: overrides.showReadinessScore ?? false,
        handoffHint: overrides.handoffHint ?? '',
        exportBlocked: overrides.exportBlocked ?? false,
        blockReason: overrides.blockReason ?? null,
        ...overrides.extra
    };
}
`;

// Insert buildTierResult before assessAuditExportTier
tier = tier.replace(
  "function assessAuditExportTier(completeScan) {",
  buildTierResultFunc + "function assessAuditExportTier(completeScan) {",
);

// 2. Replace duplicated return blocks with buildTierResult calls
// insufficient - no scan data
tier = tier.replace(
  /const normalized = normalizeExportScan\(completeScan\);\n    if \(!normalized\) \{\n        return \{\n            tier: 'insufficient',\n            label: 'Insufficient scan data',\n            missingForHandoff: missingForHandoff\(false, false\),\n            readinessDisplay: null,\n            showSignOffBlock: false,\n            showReadinessScore: false,\n            handoffHint: 'Run a scan before exporting an audit PDF\.',\n            exportBlocked: true,\n            blockReason: 'No scan data available for audit PDF export\.'\n        \};\n    \}/,
  `const normalized = normalizeExportScan(completeScan);
    if (!normalized) {
        return buildTierResult('insufficient', 'Insufficient scan data', {
            missingForHandoff: missingForHandoff(false, false),
            handoffHint: 'Run a scan before exporting an audit PDF.',
            exportBlocked: true,
            blockReason: 'No scan data available for audit PDF export.'
        });
    }`,
);

// insufficient - no results
tier = tier.replace(
  /const hasAnyResult = Object\.values\(results\)\.some\(Boolean\);\n    if \(!hasAnyResult\) \{\n        return \{\n            tier: 'insufficient',\n            label: 'Insufficient scan data',\n            missingForHandoff: missingForHandoff\(false, false\),\n            readinessDisplay: null,\n            showSignOffBlock: false,\n            showReadinessScore: false,\n            handoffHint: 'Run a scan before exporting an audit PDF\.',\n            exportBlocked: true,\n            blockReason: 'Export payload has no scan steps — run Complete scan or an individual analysis first\.'\n        \};\n    \}/,
  `const hasAnyResult = Object.values(results).some(Boolean);
    if (!hasAnyResult) {
        return buildTierResult('insufficient', 'Insufficient scan data', {
            missingForHandoff: missingForHandoff(false, false),
            handoffHint: 'Run a scan before exporting an audit PDF.',
            exportBlocked: true,
            blockReason: 'Export payload has no scan steps — run Complete scan or an individual analysis first.'
        });
    }`,
);

// handoff
tier = tier.replace(
  /if \(hasGate && hasCodebase\) \{\n        return \{\n            tier: 'handoff',\n            label: 'Pre-launch security audit',\n            missingForHandoff: \[\],\n            readinessDisplay: null,\n            showSignOffBlock: true,\n            showReadinessScore: true,\n            handoffHint: '',\n            exportBlocked: false,\n            blockReason: null\n        \};\n    \}/,
  `if (hasGate && hasCodebase) {
        return buildTierResult('handoff', 'Pre-launch security audit', {
            showSignOffBlock: true,
            showReadinessScore: true
        });
    }`,
);

// gate-only
tier = tier.replace(
  /if \(hasGate && !hasCodebase\) \{\n        return \{\n            tier: 'gate-only',\n            label: 'Gate attestation',\n            missingForHandoff: missing,\n            readinessDisplay: 'Gate attestation only — run Complete scan for full readiness score',\n            showSignOffBlock: false,\n            showReadinessScore: false,\n            handoffHint,\n            exportBlocked: false,\n            blockReason: null\n        \};\n    \}/,
  `if (hasGate && !hasCodebase) {
        return buildTierResult('gate-only', 'Gate attestation', {
            missingForHandoff: missing,
            readinessDisplay: 'Gate attestation only — run Complete scan for full readiness score',
            handoffHint
        });
    }`,
);

// codebase-only
tier = tier.replace(
  /if \(hasCodebase && !hasGate\) \{\n        return \{\n            tier: 'codebase-only',\n            label: 'Codebase hygiene',\n            missingForHandoff: missing,\n            readinessDisplay: 'Codebase analysis only — attach gate PASS evidence for sign-off',\n            showSignOffBlock: false,\n            showReadinessScore: false,\n            handoffHint,\n            exportBlocked: false,\n            blockReason: null\n        \};\n    \}/,
  `if (hasCodebase && !hasGate) {
        return buildTierResult('codebase-only', 'Codebase hygiene', {
            missingForHandoff: missing,
            readinessDisplay: 'Codebase analysis only — attach gate PASS evidence for sign-off',
            handoffHint
        });
    }`,
);

// supplementary
tier = tier.replace(
  /const step = detectSupplementaryStep\(normalized\);\n    return \{\n        tier: 'supplementary',\n        label: step\.label,\n        stepKey: step\.key,\n        missingForHandoff: missing,\n        readinessDisplay: `Supplementary — \$\{step\.label\}`,\n        showSignOffBlock: false,\n        showReadinessScore: false,\n        handoffHint,\n        exportBlocked: false,\n        blockReason: null\n    \};/,
  `const step = detectSupplementaryStep(normalized);
    return buildTierResult('supplementary', step.label, {
        missingForHandoff: missing,
        readinessDisplay: \`Supplementary — \${step.label}\`,
        handoffHint,
        extra: { stepKey: step.key }
    });`,
);

fs.writeFileSync(tierFile, tier, "utf8");
console.log("✓ audit-export-tier.cjs");

console.log("\nDone.");
