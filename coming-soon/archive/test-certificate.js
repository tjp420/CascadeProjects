const http = require('http');

const DEFAULT_PORT = 3001;
const token = 'eyJ0aWVyIjoiZXhlY3V0aXZlIiwiZXhwIjoxNzg4NTI4MzkxMzg5LCJwcm9qZWN0TmFtZSI6InRlc3QifQ.UCKlsMCFGnKnjxS7P-n7t2wU7VKsYEjwskO2eH0ySVI';

const reports = [
    { name: 'Complete scan', reportJson: { type: 'simplebeacon-report', gate: { pass: true }, qualityScore: 85, totalFiles: 100, detectedIssues: [] } },
    { name: 'Public summary', reportJson: { type: 'simplebeacon-public-summary', summary: { gatePass: false, qualityScore: 60, filesScanned: 50 } } },
    { name: 'npm-audit', reportJson: { type: 'simplebeacon-npm-audit', packageJsonCount: 245, dependencyCount: 1981, hygieneSummary: { gatePass: true } } },
    { name: 'Generic cleanup', reportJson: { debugArtifactCount: 3, credentialFindings: 1 } },
];

function testEndpoint(name, reportJson) {
    return new Promise((resolve) => {
        const postData = JSON.stringify({ reportJson, licenseToken: token });
        const req = http.request({
            hostname: 'localhost',
            port: DEFAULT_PORT,
            path: '/api/certificate/download',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const body = Buffer.concat(chunks);
                if (res.statusCode === 200 && res.headers['content-type'] === 'application/zip') {
                    console.log(`PASS: ${name} — ZIP ${body.length} bytes`);
                    resolve({ name, ok: true, size: body.length });
                } else {
                    const text = body.toString().slice(0, 200);
                    console.log(`FAIL: ${name} — HTTP ${res.statusCode}: ${text}`);
                    resolve({ name, ok: false, status: res.statusCode, text });
                }
            });
        });
        req.on('error', (err) => {
            console.log(`FAIL: ${name} — ${err.message}`);
            resolve({ name, ok: false, error: err.message });
        });
        req.write(postData);
        req.end();
    });
}

(async () => {
    console.log('Testing certificate endpoint...\n');
    for (const t of reports) {
        await testEndpoint(t.name, t.reportJson);
    }
    console.log('\nDone.');
})();
