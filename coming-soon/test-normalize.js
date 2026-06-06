function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function normalizeReport(reportJson) {
    if (!reportJson || typeof reportJson !== 'object') return {};
    const type = reportJson.type || '';

    // 1. Complete scan nesting
    const sub = reportJson?.results?.simplebeacon;
    if (sub && typeof sub === 'object') {
        const nested = sub.results?.simplebeacon;
        if (nested && typeof nested === 'object') {
            const issues = nested.detectedIssues || sub.detectedIssues || reportJson.detectedIssues || [];
            return { ...reportJson, ...sub, ...nested, detectedIssues: issues, issueCount: nested.issueCount ?? sub.issueCount ?? reportJson.issueCount ?? issues.length };
        }
        const issues = sub.detectedIssues || reportJson.detectedIssues || [];
        return { ...reportJson, ...sub, detectedIssues: issues, issueCount: sub.issueCount ?? reportJson.issueCount ?? issues.length };
    }

    // 2. Public-summary
    if (type === 'simplebeacon-public-summary') {
        const summary = reportJson.summary || {};
        return {
            ...reportJson,
            gate: {
                pass: summary.gatePass ?? null,
                blockingCount: (reportJson.severityCounts?.critical || 0) + (reportJson.severityCounts?.high || 0),
                warningCount: (reportJson.severityCounts?.medium || 0) + (reportJson.severityCounts?.low || 0)
            },
            qualityScore: summary.qualityScore ?? 0,
            totalFiles: summary.filesScanned ?? 0,
            issueCount: summary.totalIssuesFound ?? 0,
            detectedIssues: []
        };
    }

    // 3. Re-attestation-note
    if (type === 'simplebeacon-re-attestation-note') {
        const isReference = reportJson.workflowStatus === 'reference-only' || reportJson.currentGate === null;
        const cg = reportJson.currentGate || {};
        return {
            ...reportJson,
            gate: {
                pass: isReference ? null : (cg.pass ?? false),
                blockingCount: isReference ? null : (cg.blockingCount ?? 0),
                warningCount: 0
            },
            isReferenceTemplate: isReference,
            qualityScore: cg.qualityScore ?? 0,
            totalFiles: cg.repositoryFilesTotal ?? 0,
            issueCount: 0,
            detectedIssues: []
        };
    }

    // 4. npm-audit
    if (type === 'simplebeacon-npm-audit') {
        const h = reportJson.hygieneSummary || {};
        const pkgCount = reportJson.packageJsonCount ?? 0;
        const depCount = reportJson.dependencyCount ?? 0;
        const critical = h.critical || 0;
        const high = h.high || 0;
        const moderate = h.moderate || 0;
        const low = h.low || 0;
        return {
            ...reportJson,
            gate: {
                pass: h.gatePass ?? true,
                blockingCount: critical + high,
                warningCount: moderate + low
            },
            qualityScore: h.gatePass === true ? 100 : Math.max(0, 100 - (critical * 20 + high * 10 + moderate * 5 + low * 2)),
            totalFiles: pkgCount,
            issueCount: critical + high + moderate + low,
            detectedIssues: [],
            npmAudit: {
                packageJsonCount: pkgCount,
                dependencyCount: depCount,
                summary: `${pkgCount} package.json files found with ${depCount} total dependencies.`,
                supplyChainStatus: reportJson.supplyChainStatus || 'not-applicable'
            }
        };
    }

    // 5. Generic without gate
    if (!reportJson.gate) {
        if (reportJson.packageJsonCount !== undefined || reportJson.dependencyCount !== undefined) {
            const pkgCount = reportJson.packageJsonCount ?? 0;
            const depCount = reportJson.dependencyCount ?? 0;
            const h = reportJson.hygieneSummary || {};
            const critical = h.critical || 0;
            const high = h.high || 0;
            const moderate = h.moderate || 0;
            const low = h.low || 0;
            return {
                ...reportJson,
                gate: {
                    pass: h.gatePass ?? true,
                    blockingCount: critical + high,
                    warningCount: moderate + low
                },
                qualityScore: h.gatePass === true ? 100 : Math.max(0, 100 - (critical * 20 + high * 10 + moderate * 5 + low * 2)),
                totalFiles: pkgCount,
                issueCount: critical + high + moderate + low,
                detectedIssues: [],
                npmAudit: {
                    packageJsonCount: pkgCount,
                    dependencyCount: depCount,
                    summary: `${pkgCount} package.json files found with ${depCount} total dependencies.`,
                    supplyChainStatus: reportJson.supplyChainStatus || 'not-applicable'
                }
            };
        }

        const debugCount = reportJson.debugArtifactCount || 0;
        const mockCount = reportJson.mockSampleFiles || 0;
        const credHits = reportJson.credentialFindings || 0;
        const totalIssues = debugCount + mockCount + credHits + (reportJson.issueCount || 0);
        return {
            ...reportJson,
            gate: {
                pass: credHits === 0,
                blockingCount: credHits,
                warningCount: totalIssues - credHits
            },
            qualityScore: reportJson.qualityScore ?? (totalIssues === 0 ? 100 : Math.max(0, 100 - totalIssues * 2)),
            totalFiles: reportJson.totalFiles ?? reportJson.filesAnalyzed ?? 0,
            issueCount: totalIssues,
            detectedIssues: reportJson.detectedIssues || []
        };
    }

    return reportJson;
}

const tests = [
    { name: 'Complete scan (nested)', input: { type: 'simplebeacon-report', results: { simplebeacon: { gate: { pass: true }, qualityScore: 85, totalFiles: 100, detectedIssues: [{severity:'high'}] } } }, expect: { gatePass: true, qualityScore: 85, files: 100, issues: 1 } },
    { name: 'Public summary', input: { type: 'simplebeacon-public-summary', summary: { gatePass: false, qualityScore: 60, filesScanned: 50, totalIssuesFound: 5 }, severityCounts: { critical: 1, high: 2, medium: 1, low: 1 } }, expect: { gatePass: false, qualityScore: 60, files: 50, blocking: 3, warning: 2 } },
    { name: 'Re-attestation reference', input: { type: 'simplebeacon-re-attestation-note', workflowStatus: 'reference-only', currentGate: null }, expect: { gatePass: null, isReference: true } },
    { name: 'Re-attestation with gate', input: { type: 'simplebeacon-re-attestation-note', currentGate: { pass: true, qualityScore: 90, repositoryFilesTotal: 200 } }, expect: { gatePass: true, qualityScore: 90, files: 200 } },
    { name: 'npm-audit explicit (gatePass=true => 100)', input: { type: 'simplebeacon-npm-audit', packageJsonCount: 245, dependencyCount: 1981, hygieneSummary: { gatePass: true, critical: 0, high: 0, moderate: 1, low: 2 } }, expect: { gatePass: true, qualityScore: 100, files: 245, pkgCount: 245, depCount: 1981 } },
    { name: 'npm-audit explicit (gatePass=false)', input: { type: 'simplebeacon-npm-audit', packageJsonCount: 245, dependencyCount: 1981, hygieneSummary: { gatePass: false, critical: 1, high: 2, moderate: 1, low: 2 } }, expect: { gatePass: false, qualityScore: 51, files: 245, pkgCount: 245, depCount: 1981 } },
    { name: 'Generic npm-audit', input: { packageJsonCount: 10, dependencyCount: 100 }, expect: { gatePass: true, files: 10, pkgCount: 10 } },
    { name: 'Generic cleanup', input: { debugArtifactCount: 5, credentialFindings: 2 }, expect: { gatePass: false, blocking: 2, warning: 5, qualityScore: 86 } },
    { name: 'Already has gate', input: { type: 'simplebeacon-report', gate: { pass: true, blockingCount: 0, warningCount: 1 }, qualityScore: 95, totalFiles: 300 }, expect: { gatePass: true, qualityScore: 95, files: 300 } },
];

let passed = 0, failed = 0;
tests.forEach(t => {
    const r = normalizeReport(t.input);
    const errors = [];
    if (t.expect.gatePass !== undefined && r.gate?.pass !== t.expect.gatePass) errors.push(`gate.pass: got ${r.gate?.pass}, expected ${t.expect.gatePass}`);
    if (t.expect.qualityScore !== undefined && r.qualityScore !== t.expect.qualityScore) errors.push(`qualityScore: got ${r.qualityScore}, expected ${t.expect.qualityScore}`);
    if (t.expect.files !== undefined && r.totalFiles !== t.expect.files) errors.push(`totalFiles: got ${r.totalFiles}, expected ${t.expect.files}`);
    if (t.expect.blocking !== undefined && r.gate?.blockingCount !== t.expect.blocking) errors.push(`blockingCount: got ${r.gate?.blockingCount}, expected ${t.expect.blocking}`);
    if (t.expect.warning !== undefined && r.gate?.warningCount !== t.expect.warning) errors.push(`warningCount: got ${r.gate?.warningCount}, expected ${t.expect.warning}`);
    if (t.expect.isReference !== undefined && r.isReferenceTemplate !== t.expect.isReference) errors.push(`isReference: got ${r.isReferenceTemplate}, expected ${t.expect.isReference}`);
    if (t.expect.pkgCount !== undefined && r.npmAudit?.packageJsonCount !== t.expect.pkgCount) errors.push(`npmAudit.pkgCount: got ${r.npmAudit?.packageJsonCount}, expected ${t.expect.pkgCount}`);
    if (t.expect.depCount !== undefined && r.npmAudit?.dependencyCount !== t.expect.depCount) errors.push(`npmAudit.depCount: got ${r.npmAudit?.dependencyCount}, expected ${t.expect.depCount}`);
    if (t.expect.issues !== undefined && r.issueCount !== t.expect.issues) errors.push(`issueCount: got ${r.issueCount}, expected ${t.expect.issues}`);

    if (errors.length) { console.log('FAIL:', t.name, '|', errors.join('; ')); failed++; }
    else { console.log('PASS:', t.name); passed++; }
});
console.log(`\nTotal: ${passed} passed, ${failed} failed`);
