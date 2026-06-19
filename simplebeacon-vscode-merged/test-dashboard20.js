const fs = require('fs');
const path = require('path');

const reportPath = process.argv[2] || 'C:\\Users\\Trevor\\CascadeProjects\\coming-soon\\.simplebeacon\\report.json';
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// Simulate Dashboard20 data extraction
function extractAllFindings(r) {
  const all = [];
  if (r.rawIssues?.length) {
    r.rawIssues.forEach((it) => all.push({
      cat: it.type || 'Finding',
      sev: it.severity || 'medium',
      desc: it.description || it.type || 'Finding',
      file: it.filePath || it.file || '',
      line: it.line || ''
    }));
    return all;
  }
  return all;
}

function buildFailingFiles(r) {
  const fileMap = new Map();
  const issues = r.detectedIssues || r.rawIssues || [];
  for (const issue of issues) {
    const fp = issue.file || issue.filePath || 'Unknown';
    if (!fileMap.has(fp)) fileMap.set(fp, []);
    fileMap.get(fp).push({ severity: issue.severity || 'medium' });
  }
  const sorted = Array.from(fileMap.entries())
    .map(([file, iss]) => ({ file, issues: iss }))
    .sort((a, b) => b.issues.length - a.issues.length)
    .slice(0, 20);
  if (!sorted.length) return '<tr><td colspan="4" style="text-align:center;padding:2rem">No issues found</td></tr>';
  return sorted.map((f) => {
    const counts = f.issues.reduce((acc, i) => { acc[i.severity] = (acc[i.severity] || 0) + 1; return acc; }, {});
    const badges = Object.entries(counts).map(([sev, c]) => {
      const color = sev === 'high' || sev === 'critical' ? '#ef4444' : sev === 'medium' ? '#f59e0b' : '#3b82f6';
      return `<span style="background:${color}12;color:${color};padding:2px 6px;border-radius:4px;font-size:11px;margin-right:4px">${sev}: ${c}</span>`;
    }).join('');
    const name = f.file.split(/[/\\]/).pop() || f.file;
    return `<tr><td><span class="file-link failing-file-link" data-file="${f.file}">${name}</span></td><td>${f.issues.length}</td><td>${badges}</td><td><button class="btn" data-cmd="openFile" data-file="${f.file}" style="padding:4px 8px;font-size:12px">Open</button></td></tr>`;
  }).join('');
}

const findings = extractAllFindings(report);
const catColorMap = {
  'missing-env-key': '#f59e0b',
  'unused-file': '#f59e0b',
  'build-artifact': '#3b82f6',
  'orphaned-export': '#3b82f6',
  'unused-dependency': '#3b82f6'
};

const score = report.qualityScore ?? 0;
const passClass = report.gate?.pass ? 'pass' : 'fail';
const passText = report.gate?.pass ? 'PASS' : 'FAIL';
const scoreColor = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

const filesAnalyzed = report.ruleScopedFilesAnalyzed || report.filesAnalyzed || report.totalFiles || 0;
const totalRepoFiles = report.repositoryFilesTotal || filesAnalyzed;
const files = totalRepoFiles > 0 ? `${filesAnalyzed}/${totalRepoFiles}` : `${filesAnalyzed}`;
const folders = report.repositoryFoldersTotal || report.repositoryInventory?.totalFolders || 0;

const categories = {};
findings.forEach((f) => { categories[f.cat] = (categories[f.cat] || 0) + 1; });
const catOptions = Object.entries(categories).map(([k]) => `<option value="${k}">${k}</option>`).join('');

const templatePath = path.join(__dirname, 'media', 'dashboard2_0.html');
let html = fs.readFileSync(templatePath, 'utf8');

html = html
  .replace(/\{\{CSP\}\}/g, "'self'")
  .replace(/\{\{NONCE\}\}/g, 'test123')
  .replace(/\{\{D3_URI\}\}/g, 'https://cdn.jsdelivr.net/npm/d3@7')
  .replace(/\{\{VERSION\}\}/g, '2.0.0')
  .replace(/\{\{PASS_TEXT\}\}/g, passText)
  .replace(/\{\{PASS_CLASS\}\}/g, passClass)
  .replace(/\{\{SCORE\}\}/g, String(score))
  .replace(/\{\{SCORE_COLOR\}\}/g, scoreColor)
  .replace(/\{\{FILES\}\}/g, files)
  .replace(/\{\{FOLDERS\}\}/g, String(folders))
  .replace(/\{\{TOTAL_FINDINGS\}\}/g, String(findings.length))
  .replace(/\{\{CAT_COUNT\}\}/g, String(Object.keys(categories).length))
  .replace(/\{\{BG\}\}/g, '#f9fafb')
  .replace(/\{\{FG\}\}/g, '#111827')
  .replace(/\{\{PANEL\}\}/g, '#ffffff')
  .replace(/\{\{BORDER\}\}/g, '#e5e7eb')
  .replace(/\{\{INPUT\}\}/g, '#f3f4f6')
  .replace(/\{\{FINDINGS_JSON\}\}/g, JSON.stringify(findings))
  .replace(/\{\{CAT_COLOR_MAP\}\}/g, JSON.stringify(catColorMap))
  .replace(/\{\{CATEGORY_OPTIONS\}\}/g, catOptions)
  .replace(/\{\{FAILING_FILES\}\}/g, buildFailingFiles(report));

const outPath = path.join(__dirname, 'test-dashboard20-output.html');
fs.writeFileSync(outPath, html);
console.log('Dashboard 2.0 test HTML written to:', outPath);
console.log('Findings:', findings.length);
console.log('Categories:', Object.keys(categories).join(', ') || 'none');
console.log('Failing files:', (report.detectedIssues || report.rawIssues || []).length);
