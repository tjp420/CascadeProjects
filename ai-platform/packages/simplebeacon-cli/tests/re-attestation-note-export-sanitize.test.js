const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    sanitizeReAttestationNoteArtifactExport,
    buildReAttestationNoteArtifact
} = require('../src/lib/re-attestation-note-export-sanitize');

test('sanitizeReAttestationNoteArtifactExport redacts project path and adds export metadata', () => {
    const raw = {
        type: 'simplebeacon-re-attestation-note',
        generatedAt: '2026-06-01T03:02:07.847Z',
        tier: 'operator',
        message: 'Post-handoff warranty re-scan deliverable. Compare gate verdict to original clearance PDF.',
        originalProject: 'C:/Users/Trevor/CascadeProjects/ai-platform'
    };

    const out = sanitizeReAttestationNoteArtifactExport(raw, {
        tierId: 'operator',
        projectPath: raw.originalProject,
        gateReport: {
            gate: { pass: true, blockingCount: 0 },
            ruleScopedFilesAnalyzed: 196,
            repositoryFilesTotal: 860,
            qualityScore: 100,
            jestBaselineChecked: false,
            generatedAt: '2026-06-01T03:01:00.000Z'
        }
    });

    assert.equal(out.projectPath, 'ai-platform');
    assert.equal(out.originalProject, undefined);
    assert.equal(out.exportNormalized, true);
    assert.equal(out.exportSanitized, true);
    assert.equal(out.securityHandoffEligible, false);
    assert.equal(out.handoffEligible, false);
    assert.equal(out.scanTargetProfile, 'product');
    assert.equal(out.workflowStatus, 'reference-only');
    assert.equal(out.currentGate.pass, true);
    assert.equal(out.currentGate.blockingCount, 0);
    assert.equal(out.currentGate.ruleScopedFilesAnalyzed, 196);
    assert.equal(out.currentGate.repositoryFilesTotal, 860);
    assert.equal(out.currentGate.qualityScore, 100);
    assert.equal(out.currentGate.jestBaselineChecked, false);
    assert.equal(out.scanScope?.resultsViewScope, 're-attestation-workflow-metadata');
    assert.equal(out.hygieneSummary?.gatePass, true);
    assert.equal(out.hygieneSummary?.jestBaselineChecked, false);
    assert.ok(out.exportNotes.some((n) => /Operator vault export includes this template/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /securityHandoffEligible is false/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /did not run Jest/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /simplebeacon-gate\.json bundled/i.test(String(n))));
    assert.match(out.message, /not a completed re-attestation/i);
});

test('buildReAttestationNoteArtifact sets warranty tier workflow status', () => {
    const out = buildReAttestationNoteArtifact({
        tierId: 'warranty199',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        gateReport: { gate: { pass: false, blockingCount: 2 } },
        generatedAt: '2026-06-01T03:02:07.847Z'
    });

    assert.equal(out.tier, 'warranty199');
    assert.equal(out.productSku, 'warranty199');
    assert.equal(out.workflowStatus, 'awaiting-operator-comparison');
    assert.equal(out.projectPath, 'ai-platform');
    assert.equal(out.currentGate.pass, false);
    assert.equal(out.currentGate.blockingCount, 2);
    assert.ok(out.exportNotes.some((n) => /clearance499 PDF/i.test(String(n))));
});

test('sanitizeReAttestationNoteArtifactExport preserves embedded currentGate when gateReport omitted', () => {
    const out = sanitizeReAttestationNoteArtifactExport({
        type: 'simplebeacon-re-attestation-note',
        tier: 'operator',
        projectPath: 'ai-platform',
        currentGate: {
            pass: true,
            blockingCount: 0,
            ruleScopedFilesAnalyzed: 1685,
            generatedAt: '2026-06-01T03:31:14.968Z'
        }
    }, { tierId: 'operator', projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform' });

    assert.equal(out.exportSanitized, true);
    assert.equal(out.currentGate.pass, true);
    assert.equal(out.currentGate.ruleScopedFilesAnalyzed, 1685);
    assert.ok(out.exportNotes.some((n) => /currentGate reflects the bundled scan/i.test(String(n))));
    assert.ok(!out.exportNotes.some((n) => /No gate report was bundled/i.test(String(n))));
});

test('sanitizeReAttestationNoteArtifactExport enriches operator note like Desktop export', () => {
    const gateReport = {
        gate: { pass: true, blockingCount: 0 },
        ruleScopedFilesAnalyzed: 1685,
        repositoryFilesTotal: 1685,
        credentialScanned: 1639,
        fictionJsonFilesScanned: 184,
        fictionSampleFilesScanned: 6,
        qualityScore: 100,
        jestBaselineChecked: false,
        generatedAt: '2026-06-01T04:31:03.571Z',
        scanScope: { profile: 'eu-ai-act' }
    };
    const out = sanitizeReAttestationNoteArtifactExport({
        type: 'simplebeacon-re-attestation-note',
        generatedAt: '2026-06-01T04:31:26.279Z',
        tier: 'operator',
        projectPath: 'ai-platform',
        currentGate: {
            pass: true,
            blockingCount: 0,
            ruleScopedFilesAnalyzed: 1685,
            generatedAt: '2026-06-01T04:31:03.571Z'
        }
    }, {
        tierId: 'operator',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        gateReport,
        repositoryFilesTotal: 1685
    });

    assert.equal(out.hygieneSummary?.repositoryFilesTotal, 1685);
    assert.equal(out.hygieneSummary?.gateRepositoryFilesTotal, 1685);
    assert.equal(out.hygieneSummary?.credentialScanned, 1639);
    assert.equal(out.hygieneSummary?.contentFilesScanned, 1639);
    assert.equal(out.hygieneSummary?.gateMetadataOnlyFiles, 46);
    assert.equal(out.hygieneSummary?.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.scanScope?.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.scanScope?.gateRepositoryFilesTotal, 1685);
    assert.equal(out.currentGate.qualityScore, 100);
    assert.ok(out.exportNotes.some((n) => /Full-tree gate inventory/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /CRED\/LEAK rules scanned/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /DATA-002 evaluated/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /eu-ai-act/i.test(String(n))));
});

test('sanitizeReAttestationNoteArtifactExport enriches gate FAIL operator note like Desktop export', () => {
    const gateReport = {
        gate: { pass: false, blockingCount: 1 },
        ruleScopedFilesAnalyzed: 1685,
        repositoryFilesTotal: 1685,
        credentialScanned: 1639,
        fictionJsonFilesScanned: 184,
        fictionSampleFilesScanned: 6,
        qualityScore: 94,
        jestBaselineChecked: false,
        generatedAt: '2026-06-01T05:31:38.203Z',
        scanScope: { profile: 'eu-ai-act' }
    };
    const out = sanitizeReAttestationNoteArtifactExport({
        type: 'simplebeacon-re-attestation-note',
        tier: 'operator',
        projectPath: 'ai-platform',
        currentGate: {
            pass: false,
            blockingCount: 1,
            ruleScopedFilesAnalyzed: 1685,
            repositoryFilesTotal: 1685,
            qualityScore: 94,
            jestBaselineChecked: false,
            generatedAt: '2026-06-01T05:31:38.203Z'
        }
    }, {
        tierId: 'operator',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        gateReport,
        repositoryFilesTotal: 1685
    });

    assert.equal(out.hygieneSummary.contentFilesScanned, 1639);
    assert.equal(out.hygieneSummary.blockingCount, 1);
    assert.equal(out.hygieneSummary.gatePass, false);
    assert.ok(out.exportNotes.some((n) => /Gate FAIL — 1 blocking/i.test(String(n))));
});

test('sanitizeReAttestationNoteArtifactExport idempotently re-sanitizes enriched note from embedded gate context', () => {
    const enriched = {
        type: 'simplebeacon-re-attestation-note',
        tier: 'operator',
        projectPath: 'ai-platform',
        currentGate: {
            pass: false,
            blockingCount: 1,
            ruleScopedFilesAnalyzed: 1685,
            repositoryFilesTotal: 1685,
            qualityScore: 94,
            jestBaselineChecked: false,
            generatedAt: '2026-06-01T05:31:38.203Z'
        },
        scanScope: {
            gateRepositoryFilesTotal: 1685,
            gateRuleBundleProfile: 'eu-ai-act',
            securityHandoffEligible: false
        },
        hygieneSummary: {
            gatePass: false,
            blockingCount: 1,
            gateRepositoryFilesTotal: 1685,
            contentFilesScanned: 1639,
            credentialScanned: 1639,
            gateMetadataOnlyFiles: 46,
            fictionJsonFilesScanned: 184,
            fictionSampleFilesScanned: 6,
            gateRuleBundleProfile: 'eu-ai-act',
            jestBaselineChecked: false
        },
        exportSanitized: true
    };
    const out = sanitizeReAttestationNoteArtifactExport(enriched, {
        tierId: 'operator',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform'
    });
    const out2 = sanitizeReAttestationNoteArtifactExport(out, {
        tierId: 'operator',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform'
    });
    assert.equal(out.hygieneSummary.contentFilesScanned, 1639);
    assert.equal(out.hygieneSummary.fictionJsonFilesScanned, 184);
    assert.deepEqual(out2.hygieneSummary, out.hygieneSummary);
    assert.deepEqual(out2.exportNotes, out.exportNotes);
});
