const fs = require('fs');
const http = require('http');

const reportPath =
    process.argv[2] ||
    'c:\\Users\\Trevor\\CascadeProjects\\coming-soon\\.simplebeacon\\simplebeacon-analytics-report.json';
if (!fs.existsSync(reportPath)) {
    console.error('Report not found:', reportPath);
    process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// Normalize to SimpleBeacon sidebar format
const normalized = {
    title: 'Analytics Report',
    qualityScore: raw.qualityScore || 0,
    totalFiles: raw.totalFiles || raw.filesAnalyzed || 0,
    filesAnalyzed: raw.filesAnalyzed || 0,
    gate: {
        pass: raw.qualityScore >= 80,
        blockingCount: raw.scan_summary?.total_risks_found || 0
    },
    severityCounts: raw.severityCounts || {},
    criticalCount: raw.severityCounts?.critical || 0,
    highCount: raw.severityCounts?.high || 0,
    mediumCount: raw.severityCounts?.medium || 0,
    lowCount: raw.severityCounts?.low || 0,
    rawIssues: [],
    detectedIssues: [],
    issues: []
};

// Flatten findings
if (raw.detectedIssues && Array.isArray(raw.detectedIssues)) {
    for (const f of raw.detectedIssues) {
        normalized.rawIssues.push({
            type: f.type || 'Issue',
            severity: (f.severity || 'low').toLowerCase(),
            description: f.description || f.recommendation || '',
            file: f.file || (f.filePaths && f.filePaths[0]) || '',
            line: f.line || 0,
            count: f.count || 1,
            category: f.type || 'general',
            recommendedAction: f.recommendedAction || f.recommendation || ''
        });
    }
}

normalized.detectedIssues = normalized.rawIssues;
normalized.issues = normalized.rawIssues;

console.log(`Normalized analytics report:`);
console.log(`  Files: ${normalized.totalFiles}`);
console.log(`  Issues: ${normalized.rawIssues.length}`);
console.log(
    `  Critical: ${normalized.criticalCount}, High: ${normalized.highCount}, Med: ${normalized.mediumCount}, Low: ${normalized.lowCount}`
);
console.log(`  Quality Score: ${normalized.qualityScore}`);

// Save normalized
const outPath = reportPath.replace('.json', '-normalized.json');
fs.writeFileSync(outPath, JSON.stringify(normalized, null, 2));
console.log(`\nSaved normalized report to: ${outPath}`);

// POST to relay server
const relayPort = 3001;
const payload = JSON.stringify(normalized);
const req = http.request(
    {
        hostname: '127.0.0.1',
        port: relayPort,
        path: '/api/data',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    },
    res => {
        console.log(`Relay server response: ${res.statusCode}`);
        process.exit(0);
    }
);
req.on('error', e => {
    console.error(`Could not reach relay server on port ${relayPort}: ${e.message}`);
    console.log('The normalized report was saved to disk. Import it manually or start the relay server first.');
    process.exit(0);
});
req.write(payload);
req.end();
