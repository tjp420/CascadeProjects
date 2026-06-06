// Test that generateSovereignCertificate extracts correct data from various report types
const reports = [
    {
        name: 'Browser complete scan',
        data: {
            type: 'simplebeacon-report',
            generatedBy: 'SimpleBeacon Browser Sandbox',
            scanProfileLabel: 'Complete Scan',
            projectRoot: 'my-project',
            qualityScore: 85,
            totalFiles: 150,
            issueCount: 3,
            gate: { pass: true, blockingCount: 0 }
        },
        expect: { profileLabel: 'Complete Scan', gateLabel: 'PASSED', gateColor: '#34D399', scope: 'Browser Sandbox', qs: 85, grade: 'B', files: 150, issues: 3 }
    },
    {
        name: 'CLI public-summary (gate false)',
        data: {
            type: 'simplebeacon-public-summary',
            generatedBy: 'simplebeacon-cli',
            summary: { gatePass: false, qualityScore: 55, filesScanned: 200, totalIssuesFound: 12 },
            severityCounts: { critical: 1, high: 2, medium: 3, low: 6 },
            // After renderPreview normalization
            gate: { pass: false, blockingCount: 3, warningCount: 9 },
            qualityScore: 55,
            totalFiles: 200,
            issueCount: 12
        },
        expect: { profileLabel: 'Public Summary', gateLabel: 'BLOCKED', gateColor: '#EF4444', scope: 'Local CLI', qs: 55, grade: 'D', files: 200, issues: 12 }
    },
    {
        name: 'Re-attestation reference-only',
        data: {
            type: 'simplebeacon-re-attestation-note',
            workflowStatus: 'reference-only',
            currentGate: null
        },
        expect: { profileLabel: 'Re Attestation Note', gateLabel: 'REVIEW', gateColor: '#60A5FA', scope: 'Local CLI', qs: 0, grade: 'F', files: 0, issues: 0 }
    },
    {
        name: 'npm-audit pass',
        data: {
            type: 'simplebeacon-npm-audit',
            packageJsonCount: 5,
            dependencyCount: 120,
            hygieneSummary: { gatePass: true, critical: 0, high: 0, moderate: 1, low: 2 },
            // After renderPreview normalization
            gate: { pass: true, blockingCount: 0, warningCount: 3 },
            qualityScore: 100,
            totalFiles: 5
        },
        expect: { profileLabel: 'Npm Audit', gateLabel: 'PASSED', gateColor: '#34D399', scope: 'Local CLI', qs: 100, grade: 'A', files: 5, issues: 0 }
    }
];

function extractCertData(report) {
    const qs = report.qualityScore || 0;
    let grade = 'F';
    if (qs >= 95) grade = 'A';
    else if (qs >= 85) grade = 'B';
    else if (qs >= 70) grade = 'C';
    else if (qs >= 50) grade = 'D';

    const rawGate = report.gate?.pass ?? report.gateReport?.pass ?? null;
    const gatePassed = rawGate === true;
    const gateLabel = rawGate === null ? 'REVIEW' : (gatePassed ? 'PASSED' : 'BLOCKED');
    const gateColor = rawGate === null ? '#60A5FA' : (gatePassed ? '#34D399' : '#EF4444');

    const profileLabel = report.scanProfileLabel || report.type?.replace('simplebeacon-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Scan';
    const scope = report.generatedBy?.includes('Browser') ? 'Browser Sandbox' : 'Local CLI';
    const fileCount = report.totalFiles || report.filesAnalyzed || 0;
    const issueCount = report.issueCount || report.simplebeaconIssues || 0;

    return { profileLabel, gateLabel, gateColor, scope, qs, grade, files: fileCount, issues: issueCount };
}

let passed = 0, failed = 0;
for (const t of reports) {
    const actual = extractCertData(t.data);
    const ok = Object.keys(t.expect).every(k => actual[k] === t.expect[k]);
    if (ok) { console.log(`PASS: ${t.name}`); passed++; }
    else {
        console.log(`FAIL: ${t.name}`);
        console.log('  expect:', JSON.stringify(t.expect));
        console.log('  actual:', JSON.stringify(actual));
        failed++;
    }
}
console.log(`\nTotal: ${passed} passed, ${failed} failed`);
