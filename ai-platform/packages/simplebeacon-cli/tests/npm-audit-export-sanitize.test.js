const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    sanitizeNpmAuditExport,
    resolveSupplyChainStatus
} = require('../src/lib/npm-audit-export-sanitize');

test('resolveSupplyChainStatus pass for zero critical/high with dependencies', () => {
    assert.equal(resolveSupplyChainStatus({
        summary: { critical: 0, high: 0, dependencies: 776 }
    }), 'pass');
});

test('sanitizeNpmAuditExport enriches product-root clean audit like Downloads export', () => {
    const raw = {
        type: 'simplebeacon-npm-audit',
        generatedAt: '2026-05-31T07:54:19.760Z',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        success: true,
        dataSource: 'npm-audit',
        summary: {
            critical: 0,
            high: 0,
            moderate: 0,
            low: 0,
            total: 0,
            vulnerabilityTotal: 0,
            dependencies: 776,
            prodDependencies: 235,
            devDependencies: 541
        },
        dependencies: { total: 776, prod: 235, dev: 541 },
        vulnerabilities: [],
        packageJsonPath: 'C:/Users/Trevor/CascadeProjects/ai-platform/package.json'
    };

    const out = sanitizeNpmAuditExport(raw, raw.projectPath);
    assert.equal(out.exportSanitized, true);
    assert.equal(out.supplyChainStatus, 'pass');
    assert.equal(out.handoffEligible, true);
    assert.equal(out.securityHandoffEligible, false);
    assert.equal(out.scanTargetProfile, 'product');
    assert.equal(out.exportNormalized, true);
    assert.equal(out.source, 'npm-audit');
    assert.equal(out.projectPath, 'ai-platform');
    assert.equal(out.auditRoot, 'ai-platform');
    assert.equal(out.packageJsonPath, 'ai-platform/package.json');
    assert.ok(Array.isArray(out.exportNotes));
    assert.match(out.exportNotes.join(' '), /0 critical, 0 high across 776/);
    assert.ok(out.exportNotes.some((n) => /Absolute scan paths are redacted/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /SUPPLY-001 automation pass/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /nested package\.json/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /does not run Jest/i.test(String(n))));
    assert.equal(out.hygieneSummary?.dependencyTotal, 776);
    assert.equal(out.hygieneSummary?.supplyChainStatus, 'pass');
    assert.equal(out.hygieneSummary?.auditPackageJson, 'ai-platform/package.json');
    assert.equal(out.scanScope?.resultsViewScope, 'product-root-npm-audit');
    assert.equal(out.scanScope?.supplyChainNote, 'npm audit at product root — SUPPLY-001 hygiene only, not vendor handoff clearance.');
});

test('sanitizeNpmAuditExport rebuilds exportNotes idempotently', () => {
    const once = sanitizeNpmAuditExport({
        type: 'simplebeacon-npm-audit',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        success: true,
        summary: { critical: 0, high: 0, dependencies: 776, prodDependencies: 235, devDependencies: 541 },
        dependencies: { total: 776, prod: 235, dev: 541 },
        packageJsonPath: 'C:/Users/Trevor/CascadeProjects/ai-platform/package.json'
    }, 'C:/Users/Trevor/CascadeProjects/ai-platform');
    const twice = sanitizeNpmAuditExport(once, once.projectPath);
    assert.deepEqual(twice.exportNotes, once.exportNotes);
    assert.equal(twice.exportNotes.length, once.exportNotes.length);
});

test('sanitizeNpmAuditExport enriches Desktop operator npm audit with gate context', () => {
    const raw = {
        type: 'simplebeacon-npm-audit',
        generatedAt: '2026-06-01T05:03:30.851Z',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        success: true,
        dataSource: 'npm-audit',
        summary: {
            critical: 0,
            high: 0,
            moderate: 0,
            low: 0,
            total: 0,
            vulnerabilityTotal: 0,
            dependencies: 776,
            prodDependencies: 235,
            devDependencies: 541
        },
        dependencies: { total: 776, prod: 235, dev: 541, optional: 1 },
        vulnerabilities: [],
        packageJsonPath: 'C:/Users/Trevor/CascadeProjects/ai-platform/package.json'
    };
    const gateReport = {
        repositoryFilesTotal: 1685,
        credentialScanned: 1639,
        fictionJsonFilesScanned: 184,
        fictionSampleFilesScanned: 6,
        jestBaselineChecked: false,
        gate: { pass: false, blockingCount: 1 },
        scanScope: { profile: 'eu-ai-act' }
    };

    const out = sanitizeNpmAuditExport(raw, raw.projectPath, {
        repositoryFilesTotal: 1685,
        gateReport
    });

    assert.equal(out.hygieneSummary.gateRepositoryFilesTotal, 1685);
    assert.equal(out.hygieneSummary.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.hygieneSummary.contentFilesScanned, 1639);
    assert.equal(out.hygieneSummary.gateMetadataOnlyFiles, 46);
    assert.equal(out.hygieneSummary.fictionJsonFilesScanned, 184);
    assert.equal(out.hygieneSummary.fictionSampleFilesScanned, 6);
    assert.equal(out.hygieneSummary.gatePass, false);
    assert.equal(out.hygieneSummary.blockingCount, 1);
    assert.equal(out.hygieneSummary.optionalDependencies, 1);
    assert.equal(out.hygieneSummary.jestBaselineChecked, false);
    assert.equal(out.scanScope.gateRepositoryFilesTotal, 1685);
    assert.ok(out.exportNotes.some((n) => /1,685 repository paths/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /776 lockfile package/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /1,639 production-path/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /184 repository JSON path/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /Gate rule bundle profile: eu-ai-act/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /Gate FAIL — 1 blocking/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /1 optional dependency package/i.test(String(n))));
});

test('sanitizeNpmAuditExport idempotently re-sanitizes enriched npm audit from embedded gate context', () => {
    const enriched = {
        type: 'simplebeacon-npm-audit',
        projectPath: 'ai-platform',
        success: true,
        summary: { critical: 0, high: 0, dependencies: 776, prodDependencies: 235, devDependencies: 541 },
        dependencies: { total: 776, prod: 235, dev: 541, optional: 1 },
        packageJsonPath: 'ai-platform/package.json',
        exportSanitized: true,
        supplyChainStatus: 'pass',
        scanScope: {
            gateRepositoryFilesTotal: 1685,
            gateRuleBundleProfile: 'eu-ai-act',
            securityHandoffEligible: false
        },
        hygieneSummary: {
            gateRepositoryFilesTotal: 1685,
            gateMetadataOnlyFiles: 46,
            contentFilesScanned: 1639,
            gateRuleBundleProfile: 'eu-ai-act',
            fictionJsonFilesScanned: 184,
            fictionSampleFilesScanned: 6,
            gatePass: false,
            blockingCount: 1,
            jestBaselineChecked: false
        }
    };
    const out = sanitizeNpmAuditExport(enriched, 'ai-platform');
    const out2 = sanitizeNpmAuditExport(out, 'ai-platform');
    assert.equal(out.hygieneSummary.contentFilesScanned, 1639);
    assert.equal(out.hygieneSummary.gatePass, false);
    assert.deepEqual(out2.hygieneSummary, out.hygieneSummary);
    assert.deepEqual(out2.exportNotes, out.exportNotes);
});

test('sanitizeNpmAuditExport clears dependency counts when skipped on benchmark clone', () => {
    const out = sanitizeNpmAuditExport({
        projectPath: 'C:/repo/ai-platform/github-cache/google-earthenterprise',
        skipped: true,
        summary: { total: 0, dependencies: 776, critical: 0, high: 0 }
    });
    assert.equal(out.scanTargetProfile, 'benchmark-cache');
    assert.equal(out.summary.dependencies, null);
    assert.equal(out.handoffEligible, false);
    assert.equal(out.supplyChainStatus, 'skipped');
});
