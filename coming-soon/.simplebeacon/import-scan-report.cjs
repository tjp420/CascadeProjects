const fs = require('fs');
const path = require('path');
const http = require('http');

const scanPath = process.argv[2] || path.join(__dirname, 'complete-scan-ai-platform.json');
if (!fs.existsSync(scanPath)) {
  console.error('Scan report not found:', scanPath);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(scanPath, 'utf8'));

// Normalize complete-scan format to SimpleBeacon sidebar format
const normalized = {
  title: raw.projectPath ? `Scan: ${path.basename(raw.projectPath)}` : 'Scan Report',
  qualityScore: raw.hygieneSummary?.gatePass ? 90 : 50,
  totalFiles: raw.scanScope?.gateRepositoryFilesTotal || raw.hygieneSummary?.gateRepositoryFilesTotal || 0,
  filesAnalyzed: raw.hygieneSummary?.contentFilesScanned || 0,
  gate: {
    pass: raw.hygieneSummary?.gatePass || false,
    blockingCount: raw.hygieneSummary?.blockingCount || 0
  }
};

// Flatten findings from all steps
const allIssues = [];
const sevMap = { critical: 0, high: 0, medium: 0, low: 0 };

for (const step of (raw.steps || [])) {
  if (!step.findings || !step.findings.length) continue;
  for (const f of step.findings) {
    const sev = (f.severity || 'low').toLowerCase();
    if (sevMap[sev] !== undefined) sevMap[sev]++;
    allIssues.push({
      type: f.type || f.category || step.id || 'Issue',
      severity: sev,
      description: f.description || f.match || '',
      file: f.filePath || f.path || '',
      line: f.line || 0,
      count: 1,
      category: f.category || step.id || 'general',
      recommendedAction: f.recommendedAction || ''
    });
  }
}

normalized.rawIssues = allIssues;
normalized.detectedIssues = allIssues;
normalized.issues = allIssues;
normalized.criticalCount = sevMap.critical;
normalized.highCount = sevMap.high;
normalized.mediumCount = sevMap.medium;
normalized.lowCount = sevMap.low;

// Also add file list if available
if (raw.hygieneSummary?.gateRepositoryFilesTotal) {
  normalized.totalFiles = raw.hygieneSummary.gateRepositoryFilesTotal;
}

console.log(`Normalized scan report:`);
console.log(`  Files: ${normalized.totalFiles}`);
console.log(`  Issues: ${allIssues.length} (Critical:${sevMap.critical} High:${sevMap.high} Med:${sevMap.medium} Low:${sevMap.low})`);
console.log(`  Gate: ${normalized.gate.pass ? 'PASS' : 'FAIL'}`);

// Save normalized version
const outPath = path.join(__dirname, 'report-normalized.json');
fs.writeFileSync(outPath, JSON.stringify(normalized, null, 2));
console.log(`\nSaved normalized report to: ${outPath}`);

// Try to POST to relay server
const relayPort = 3001;
const payload = JSON.stringify(normalized);
const req = http.request({
  hostname: '127.0.0.1',
  port: relayPort,
  path: '/api/data',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
}, (res) => {
  console.log(`Relay server response: ${res.statusCode}`);
  process.exit(0);
});
req.on('error', (e) => {
  console.error(`Could not reach relay server on port ${relayPort}: ${e.message}`);
  console.log('The normalized report was saved to disk. Import it manually or start the relay server first.');
  process.exit(0);
});
req.write(payload);
req.end();
