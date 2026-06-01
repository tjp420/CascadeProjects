const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    sanitizeComplianceBundleExport,
    sanitizeComplianceChecklistArtifactExport
} = require('../src/lib/compliance-export-sanitize');

const GATE_REPORT = {
    type: 'simplebeacon-report',
    projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
    ruleScopedFilesAnalyzed: 246,
    credentialScanned: 183,
    productionLeakScanned: 175,
    jestBaselineChecked: false,
    gate: { pass: true, blockingCount: 0 }
};

const CHECKLIST = {
    projectRoot: GATE_REPORT.projectRoot,
    title: 'Simplebeacon Corporate Safety Checklist',
    summary: {
        passed: 8,
        failed: 0,
        skipped: 0,
        total: 8,
        score: 100,
        readyForAutomation: true,
        handoffEligible: true,
        headline: '8/8 applicable rules pass — safe to enable automated AI deploy gates'
    },
    rules: [
        { id: 'SUPPLY-001', status: 'pass', evidence: 'npm audit: 0 critical, 0 high (scan)' },
        { id: 'SUPPLY-002', status: 'pass', evidence: '0 moderate (limit 0)' }
    ]
};

const NPM_AUDIT = {
    source: 'npm-audit',
    success: true,
    summary: {
        critical: 0,
        high: 0,
        moderate: 0,
        dependencies: 776,
        prodDependencies: 235,
        devDependencies: 541
    }
};

test('sanitizeComplianceBundleExport fixes SUPPLY evidence and embeds npmAudit', () => {
    const out = sanitizeComplianceBundleExport({
        projectPath: GATE_REPORT.projectRoot,
        gateReport: GATE_REPORT,
        checklist: CHECKLIST,
        npmAudit: NPM_AUDIT
    });

    const supply1 = out.checklist.rules.find((r) => r.id === 'SUPPLY-001');
    assert.match(supply1.evidence, /npm-audit/);
    assert.equal(out.handoffEligible, true);
    assert.equal(out.complianceStatus, 'pass');
    assert.equal(out.exportNormalized, true);
    assert.ok(out.npmAudit);
    assert.equal(out.npmAudit.supplyChainStatus, 'pass');
    assert.ok(out.exportNotes.some((n) => /Jest was not executed/i.test(n)));
});

test('sanitizeComplianceBundleExport refreshes stale GATE/LEAK fails when gate report passes', () => {
    const projectPath = 'C:/Users/Trevor/CascadeProjects/ai-platform/github-cache/tjp420-simplebeacon';
    const gateReport = {
        projectRoot: projectPath,
        ruleScopedFilesAnalyzed: 102,
        credentialScanned: 102,
        productionLeakScanned: 102,
        productionLeakFindings: 0,
        gate: { pass: true, blockingCount: 0 }
    };
    const staleChecklist = {
        projectRoot: projectPath,
        rules: [
            { id: 'GATE-001', status: 'fail', evidence: 'Gate fail — 39 blocking issue(s)' },
            { id: 'LEAK-001', status: 'fail', evidence: '39 production leak(s) — mock/sample paths in prod code' },
            { id: 'CRED-001', status: 'pass', evidence: 'Scanned 102 path(s) — no credential patterns' }
        ],
        summary: { passed: 4, failed: 2, skipped: 2, total: 8, score: 67, readyForAutomation: false }
    };
    const out = sanitizeComplianceBundleExport({
        projectPath,
        gateReport,
        checklist: staleChecklist,
        npmAudit: { success: true, summary: { critical: 0, high: 0, moderate: 0, dependencies: 12 } }
    });
    const gate = out.checklist.rules.find((r) => r.id === 'GATE-001');
    const leak = out.checklist.rules.find((r) => r.id === 'LEAK-001');
    assert.equal(gate.status, 'pass');
    assert.equal(leak.status, 'pass');
    assert.equal(out.checklist.summary.failed, 0);
    assert.equal(out.handoffEligible, false);
    assert.match(out.checklist.summary.headline, /Benchmark clone/i);
});

test('sanitizeComplianceChecklistArtifactExport adds operator export metadata', () => {
    const out = sanitizeComplianceChecklistArtifactExport(CHECKLIST, {
        projectPath: GATE_REPORT.projectRoot,
        gateReport: GATE_REPORT,
        npmAudit: NPM_AUDIT
    });
    assert.equal(out.exportNormalized, true);
    assert.equal(out.exportSanitized, true);
    assert.equal(out.handoffEligible, false);
    assert.equal(out.securityHandoffEligible, false);
    assert.equal(out.summary.securityHandoffEligible, false);
    assert.equal(out.summary.handoffEligible, false);
    assert.equal(out.summary.readyForAutomation, true);
    assert.match(out.title, /SimpleBeacon Corporate Safety Checklist/);
    assert.equal(out.complianceStatus, 'pass');
    assert.ok(out.exportNotes.some((n) => /Jest was not executed/i.test(n)));
    assert.ok(out.exportNotes.some((n) => /securityHandoffEligible remains false/i.test(n)));
    assert.ok(out.exportNotes.some((n) => /readyForAutomation reflects CI/i.test(String(n))));
    assert.equal(out.rules.length, CHECKLIST.rules.length);
    assert.equal(out.projectRoot, 'ai-platform');
    assert.doesNotMatch(out.projectRoot, /CascadeProjects/i);
    assert.ok(out.exportNotes.some((n) => /redacted to project label/i.test(String(n))));
});

test('sanitizeComplianceChecklistArtifactExport redacts benchmark clone projectRoot', () => {
    const clonePath = 'C:/Users/Trevor/CascadeProjects/ai-platform/github-cache/tjp420-simplebeacon';
    const out = sanitizeComplianceChecklistArtifactExport({
        ...CHECKLIST,
        projectRoot: clonePath,
        summary: {
            ...CHECKLIST.summary,
            handoffEligible: false,
            readyForAutomation: false,
            scanTargetProfile: 'benchmark-cache'
        }
    }, {
        projectPath: clonePath,
        gateReport: {
            projectRoot: clonePath,
            ruleScopedFilesAnalyzed: 0,
            gate: { pass: true }
        },
        npmAudit: { skipped: true, summary: { dependencies: null } }
    });
    assert.match(out.projectRoot, /^ai-platform\/github-cache\/tjp420-simplebeacon$/);
    assert.doesNotMatch(out.projectRoot, /CascadeProjects/i);
});

test('sanitizeComplianceBundleExport does not default handoffEligible true on benchmark clone', () => {
    const out = sanitizeComplianceBundleExport({
        projectPath: 'C:/repo/ai-platform/github-cache/google-earthenterprise',
        gateReport: {
            projectRoot: 'C:/repo/ai-platform/github-cache/google-earthenterprise',
            ruleScopedFilesAnalyzed: 0,
            gate: { pass: true }
        },
        checklist: {
            ...CHECKLIST,
            summary: { ...CHECKLIST.summary, handoffEligible: true, readyForAutomation: true }
        },
        npmAudit: { skipped: true, summary: { dependencies: null } }
    });
    assert.equal(out.handoffEligible, false);
    assert.equal(out.scanTargetProfile, 'benchmark-cache');
});

test('sanitizeComplianceChecklistArtifactExport enriches operator full-tree checklist like Desktop export', () => {
    const gateReport = {
        projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        repositoryFilesTotal: 1685,
        ruleScopedFilesAnalyzed: 1685,
        credentialScanned: 1639,
        productionLeakScanned: 1639,
        fictionJsonFilesScanned: 184,
        fictionSampleFilesScanned: 6,
        jestBaselineChecked: false,
        scanScope: { profile: 'eu-ai-act' },
        euAiActSummary: { operatorDocumentationCount: 12 },
        gate: { pass: true, blockingCount: 0 }
    };
    const checklist = {
        type: 'simplebeacon-compliance-checklist',
        projectRoot: gateReport.projectRoot,
        summary: {
            passed: 8,
            failed: 0,
            skipped: 0,
            total: 8,
            score: 100,
            readyForAutomation: true,
            operatorDocumentationCount: 12,
            checklistProfile: 'default',
            headline: '8/8 applicable rules pass — safe to enable automated AI deploy gates'
        },
        rules: [
            { id: 'GATE-001', status: 'pass', evidence: 'Gate pass' },
            { id: 'CRED-001', status: 'pass', evidence: 'Scanned 1639 gate-scoped path(s)' },
            { id: 'SUPPLY-001', status: 'pass', evidence: 'npm audit: 0 critical, 0 high (npm-audit)' }
        ]
    };

    const out = sanitizeComplianceChecklistArtifactExport(checklist, {
        projectPath: gateReport.projectRoot,
        gateReport,
        npmAudit: NPM_AUDIT,
        repositoryFilesTotal: 1685
    });

    assert.equal(out.complianceStatus, 'pass');
    assert.equal(out.hygieneSummary.gateRepositoryFilesTotal, 1685);
    assert.equal(out.hygieneSummary.metadataOnlyInventoryFiles, 46);
    assert.equal(out.hygieneSummary.fictionJsonFilesScanned, 184);
    assert.equal(out.hygieneSummary.jestBaselineChecked, false);
    assert.equal(out.scanScope.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.hygieneSummary.fullDirectoryScan, true);
    assert.equal(out.scanScope.fullDirectoryScan, true);
    assert.ok(out.exportNotes.some((n) => /securityHandoffEligible is false/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /46 binary\/metadata-only/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /DATA-002 evaluated 184/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /eu-ai-act-sprint\.json/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /Corporate safety checklist \(8 rules\)/i.test(String(n))));
    assert.match(out.summary.headline, /Jest before vendor handoff/i);
});

test('sanitizeComplianceChecklistArtifactExport syncs stale rows from gate without breaking AUTH on evaluation root', () => {
    const evalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-compliance-auth-'));
    fs.writeFileSync(path.join(evalRoot, 'package.json'), JSON.stringify({ name: 'auth-eval-root' }));
    fs.writeFileSync(path.join(evalRoot, '.env.production'), [
        'REQUIRE_AUTH=true',
        'JWT_SECRET=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        'JWT_REFRESH_SECRET=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
    ].join('\n'));

    const gateReport = {
        projectRoot: 'ai-platform',
        scanTargetRoot: evalRoot,
        repositoryFilesTotal: 1693,
        ruleScopedFilesAnalyzed: 1693,
        credentialScanned: 1647,
        productionLeakScanned: 1647,
        fictionJsonFilesScanned: 185,
        fictionSampleFilesScanned: 6,
        jestBaselineChecked: false,
        fullDirectoryScan: true,
        scanScope: { profile: 'eu-ai-act', fullDirectoryScan: true },
        gate: { pass: true, blockingCount: 0 }
    };
    const checklist = {
        type: 'simplebeacon-compliance-checklist',
        projectRoot: 'ai-platform',
        summary: {
            passed: 8,
            failed: 0,
            skipped: 0,
            total: 8,
            score: 100,
            readyForAutomation: true,
            checklistProfile: 'default',
            headline: '8/8 applicable rules pass — safe to enable automated AI deploy gates'
        },
        rules: [
            { id: 'AUTH-001', status: 'pass', evidence: 'REQUIRE_AUTH=true with non-placeholder JWT' },
            { id: 'GATE-001', status: 'pass', evidence: 'Gate pass — no blocking issues at configured severities' },
            { id: 'CRED-001', status: 'pass', evidence: 'Scanned 0 gate-scoped path(s) — no credential patterns' },
            { id: 'LEAK-001', status: 'pass', evidence: 'Scanned 0 gate-scoped production file(s) — no sample-path leaks' },
            { id: 'SUPPLY-001', status: 'pass', evidence: 'npm audit: 0 critical, 0 high (scan)' }
        ]
    };
    try {
        const out = sanitizeComplianceChecklistArtifactExport(checklist, {
            projectPath: 'ai-platform',
            gateReport,
            npmAudit: NPM_AUDIT,
            evaluationProjectRoot: evalRoot
        });
        const auth = out.rules.find((r) => r.id === 'AUTH-001');
        const cred = out.rules.find((r) => r.id === 'CRED-001');
        assert.equal(auth?.status, 'pass');
        assert.match(String(cred?.evidence || ''), /1,?647/);
        assert.match(out.summary.headline, /Jest before vendor handoff/i);
        assert.equal(out.scanScope.checklistProfile, 'default');
    } finally {
        fs.rmSync(evalRoot, { recursive: true, force: true });
    }
});

test('sanitizeComplianceChecklistArtifactExport preserves AUTH on redacted export without stale rows', () => {
    const gateReport = {
        projectRoot: 'ai-platform',
        ruleScopedFilesAnalyzed: 1693,
        credentialScanned: 1647,
        jestBaselineChecked: false,
        scanScope: { profile: 'eu-ai-act' },
        gate: { pass: true, blockingCount: 0 }
    };
    const checklist = {
        type: 'simplebeacon-compliance-checklist',
        projectRoot: 'ai-platform',
        summary: {
            passed: 8,
            failed: 0,
            skipped: 0,
            total: 8,
            score: 100,
            readyForAutomation: true,
            checklistProfile: 'default',
            headline: '8/8 applicable rules pass — safe to enable automated AI deploy gates'
        },
        rules: [
            { id: 'AUTH-001', status: 'pass', evidence: 'REQUIRE_AUTH=true with non-placeholder JWT' },
            { id: 'GATE-001', status: 'pass', evidence: 'Gate pass — no blocking issues at configured severities' },
            { id: 'CRED-001', status: 'pass', evidence: 'Scanned 1647 gate-scoped path(s) — no credential patterns' }
        ]
    };
    const out = sanitizeComplianceChecklistArtifactExport(checklist, {
        projectPath: 'ai-platform',
        gateReport,
        npmAudit: NPM_AUDIT
    });
    assert.equal(out.rules.find((r) => r.id === 'AUTH-001')?.status, 'pass');
    assert.match(out.summary.headline, /Jest before vendor handoff/i);
});

test('sanitizeComplianceChecklistArtifactExport enriches failed operator checklist aligned with blocking gate', () => {
    const gateReport = {
        repositoryFilesTotal: 1685,
        credentialScanned: 1639,
        productionLeakFindings: 1,
        fictionJsonFilesScanned: 184,
        fictionSampleFilesScanned: 6,
        jestBaselineChecked: false,
        scanScope: { profile: 'eu-ai-act', fullDirectoryStats: { contentScanned: 1639 } },
        euAiActSummary: { operatorDocumentationCount: 12 },
        gate: { pass: false, blockingCount: 1 }
    };
    const checklist = {
        type: 'simplebeacon-compliance-checklist',
        projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        summary: {
            passed: 6,
            failed: 2,
            skipped: 0,
            total: 8,
            score: 75,
            readyForAutomation: false,
            operatorDocumentationCount: 12,
            headline: '2 rule(s) fail — fix before handing operations to AI-generated code'
        },
        rules: [
            { id: 'GATE-001', status: 'fail', evidence: 'Gate fail — 1 blocking issue(s)' },
            { id: 'LEAK-001', status: 'fail', evidence: '1 production leak(s)' },
            { id: 'SUPPLY-001', status: 'pass', evidence: 'npm audit: 0 critical, 0 high (npm-audit)' }
        ]
    };

    const out = sanitizeComplianceChecklistArtifactExport(checklist, {
        projectPath: checklist.projectRoot,
        gateReport,
        npmAudit: NPM_AUDIT,
        repositoryFilesTotal: 1685
    });

    assert.equal(out.complianceStatus, 'failed');
    assert.equal(out.hygieneSummary.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.scanScope.securityHandoffEligible, false);
    assert.ok(out.exportNotes.some((n) => /GATE-001, LEAK-001/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /Gate rule bundle profile: eu-ai-act/i.test(String(n))));
});

test('sanitizeComplianceChecklistArtifactExport idempotently re-sanitizes from embedded hygiene and gateReport', () => {
    const gateReport = {
        repositoryFilesTotal: 1686,
        ruleScopedFilesAnalyzed: 1686,
        credentialScanned: 1640,
        fictionJsonFilesScanned: 185,
        fictionSampleFilesScanned: 6,
        jestBaselineChecked: false,
        scanScope: { profile: 'eu-ai-act', fullDirectoryStats: { contentScanned: 1640 } },
        euAiActSummary: { operatorDocumentationCount: 12 },
        gate: { pass: true, blockingCount: 0 }
    };
    const enriched = {
        type: 'simplebeacon-compliance-checklist',
        projectRoot: 'ai-platform',
        summary: {
            passed: 8,
            failed: 0,
            score: 100,
            readyForAutomation: true,
            operatorDocumentationCount: 12,
            checklistProfile: 'default'
        },
        rules: [{ id: 'SUPPLY-001', status: 'pass', evidence: 'npm audit: 0 critical, 0 high (npm-audit)' }],
        exportSanitized: true,
        hygieneSummary: {
            gateRepositoryFilesTotal: 1686,
            ruleScopedFilesAnalyzed: 1686,
            metadataOnlyInventoryFiles: 46,
            credentialScanned: 1640,
            contentFilesScanned: 1640,
            fictionJsonFilesScanned: 185,
            fictionSampleFilesScanned: 6,
            gateRuleBundleProfile: 'eu-ai-act',
            gatePass: true,
            gateBlockingCount: 0,
            npmAuditCritical: 0,
            npmAuditHigh: 0,
            jestBaselineChecked: false
        },
        scanScope: { gateRuleBundleProfile: 'eu-ai-act', sourceArtifacts: { gateReport: true, npmAudit: true } }
    };
    const out = sanitizeComplianceChecklistArtifactExport(enriched, {
        projectPath: 'ai-platform',
        gateReport,
        npmAudit: NPM_AUDIT
    });
    assert.equal(out.hygieneSummary.gatePass, true);
    assert.ok(out.exportNotes.some((n) => /Paired gate scan PASS/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /Supply chain: npm audit reported 0 critical/i.test(String(n))));
    const out2 = sanitizeComplianceChecklistArtifactExport(out, { projectPath: 'ai-platform', gateReport });
    assert.deepEqual(out2.exportNotes, out.exportNotes);
    const out3 = sanitizeComplianceChecklistArtifactExport(out, { projectPath: 'ai-platform' });
    assert.ok(out3.exportNotes.some((n) => /CRED\/LEAK rules scanned/i.test(String(n))));
    assert.ok(out3.exportNotes.some((n) => /Supply chain: npm audit reported 0 critical/i.test(String(n))));
    assert.ok(out3.exportNotes.some((n) => /Paired gate scan PASS/i.test(String(n))));
    assert.equal(out3.hygieneSummary.fullDirectoryScan, true);
    assert.deepEqual(out3.hygieneSummary, out.hygieneSummary);
});
