const fs = require('fs');
const path = require('path');

const reportPath = process.argv[2] || 'j:\\Downloads\\report(164).json';
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const issues = report.detectedIssues || report.rawIssues || report.findings || [];

// Summary by type and severity
const summary = {};
let totalFindings = 0;
for (const issue of issues) {
    const type = issue.type || 'Unknown';
    const sev = issue.severity || 'low';
    if (!summary[type]) summary[type] = { count: 0, severity: {} };
    summary[type].count += issue.count || 1;
    summary[type].severity[sev] = (summary[type].severity[sev] || 0) + (issue.count || 1);
    totalFindings += issue.count || 1;
}

// Credential patterns
const credentialIssues = issues.filter(i => /credential/i.test(i.type || ''));
let credentialFiles = new Set();
let credentialMatches = [];
for (const issue of credentialIssues) {
    if (issue.filePath) issue.filePath.forEach(f => credentialFiles.add(f));
    if (issue.findings) {
        for (const f of issue.findings) {
            if (f.file) credentialFiles.add(f.file);
            if (f.matches) {
                for (const m of f.matches) {
                    credentialMatches.push({
                        file: f.file || '',
                        line: m.line || 1,
                        snippet: m.snippet || '',
                        type: m.type || issue.type || ''
                    });
                }
            }
        }
    }
}

// Export CSV
const csvRows = [
    ['Severity', 'Type', 'Count', 'Files'].join(','),
    ...issues.map(i => {
        const files = Array.isArray(i.filePath) ? i.filePath.join('; ') : i.filePath || '';
        return [i.severity || 'low', i.type || 'Unknown', i.count || 1, `"${files.replace(/"/g, '""')}"`].join(',');
    })
];
const csvPath = path.join(path.dirname(reportPath), 'report-summary.csv');
fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');

// Export HTML
const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
for (const issue of issues) {
    const sev = (issue.severity || 'low').toLowerCase();
    const count = issue.count || 1;
    if (sevCounts[sev] !== undefined) sevCounts[sev] += count;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SimpleBeacon Report Summary</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1117;color:#e2e8f0;padding:24px;margin:0}
h1{font-size:20px;margin-bottom:4px}
.meta{color:#94a3b8;font-size:12px;margin-bottom:20px}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}
.metric{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:14px;text-align:center}
.metric-value{font-size:24px;font-weight:700}
.metric-label{font-size:11px;color:#94a3b8;margin-top:4px}
.sev-critical{color:#ef4444}
.sev-high{color:#f59e0b}
.sev-medium{color:#d18616}
.sev-low{color:#75beff}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:20px}
th{text-align:left;padding:10px 8px;color:#94a3b8;font-size:11px;text-transform:uppercase;border-bottom:1px solid #334155}
td{padding:10px 8px;border-bottom:1px solid #1e293b;vertical-align:top}
tr:hover{background:#1e293b}
.badge{display:inline-block;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase}
.badge-critical{background:#ef444422;color:#ef4444;border:1px solid #ef444444}
.badge-high{background:#f59e0b22;color:#f59e0b;border:1px solid #f59e0b44}
.badge-medium{background:#d1861622;color:#d18616;border:1px solid #d1861644}
.badge-low{background:#75beff22;color:#75beff;border:1px solid #75beff44}
</style>
</head>
<body>
<h1>SimpleBeacon Report Summary</h1>
<div class="meta">
  Project: ${report.projectRoot || 'unknown'} | Files: ${report.totalFiles || 0} | Generated: ${report.generatedAt || 'unknown'}
</div>
<div class="metrics">
  <div class="metric"><div class="metric-value">${report.qualityScore ?? '--'}</div><div class="metric-label">Quality Score</div></div>
  <div class="metric"><div class="metric-value sev-critical">${sevCounts.critical}</div><div class="metric-label">Critical</div></div>
  <div class="metric"><div class="metric-value sev-high">${sevCounts.high}</div><div class="metric-label">High</div></div>
  <div class="metric"><div class="metric-value sev-medium">${sevCounts.medium}</div><div class="metric-label">Medium</div></div>
</div>
<table>
<tr><th>Severity</th><th>Type</th><th>Count</th><th>Files</th></tr>
${issues
    .map(i => {
        const sev = (i.severity || 'low').toLowerCase();
        const files = Array.isArray(i.filePath) ? i.filePath.join(', ') : i.filePath || '';
        return `<tr><td><span class="badge badge-${sev}">${sev}</span></td><td>${i.type || 'Unknown'}</td><td>${i.count || 1}</td><td>${files}</td></tr>`;
    })
    .join('')}
</table>
</body>
</html>`;
const htmlPath = path.join(path.dirname(reportPath), 'report-summary.html');
fs.writeFileSync(htmlPath, html, 'utf8');

// Credential patterns CSV
const credCsvRows = [
    ['File', 'Line', 'Type', 'Snippet'].join(','),
    ...credentialMatches
        .slice(0, 200)
        .map(m =>
            [
                `"${m.file.replace(/"/g, '""')}"`,
                m.line,
                `"${m.type.replace(/"/g, '""')}"`,
                `"${(m.snippet || '').replace(/"/g, '""').replace(/\n/g, ' ').slice(0, 200)}"`
            ].join(',')
        )
];
const credCsvPath = path.join(path.dirname(reportPath), 'credential-findings.csv');
fs.writeFileSync(credCsvPath, credCsvRows.join('\n'), 'utf8');
