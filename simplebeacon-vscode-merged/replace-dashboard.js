'use strict';
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'enhancedDashboard.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the buildEnhancedHtml method
const startMarker = '  private buildEnhancedHtml(): string {';
const endMarker = '  private extractCategories(';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find markers');
  process.exit(1);
}

const newMethod = `  private buildEnhancedHtml(): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    const csp = this.panel.webview.cspSource;
    const r = this.report as any;
    const g = r.gate || {};
    const score = r.qualityScore ?? 0;
    const pass = g.pass ? 'PASS' : 'FAIL';
    const passColor = g.pass ? '#10B981' : '#EF4444';
    const scoreColor = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
    const passBg = g.pass ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)';
    const passBorder = g.pass ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.25)';
    const filesAnalyzed = r.ruleScopedFilesAnalyzed || r.filesAnalyzed || r.totalFiles || 0;
    const totalRepositoryFiles = r.repositoryFilesTotal || 0;
    const files = totalRepositoryFiles > 0 ? \`\${filesAnalyzed}/\${totalRepositoryFiles}\` : \`\${filesAnalyzed}\`;
    const folders = r.repositoryFoldersTotal || r.repositoryInventory?.totalFolders || 0;
    const categories = this.extractCategories(r);
    const totalFindings = categories.reduce((sum, c) => sum + c.count, 0);
    const allFindings = this.extractAllFindings(r);
    const findingsJson = JSON.stringify(allFindings.map((f) => ({ ...f, desc: this.escapeHtml(f.desc), file: this.escapeHtml(f.file) })));
    const sevCounts = r.severityCounts || {};
    const crit = sevCounts.critical || 0;
    const high = sevCounts.high || 0;
    const med = sevCounts.medium || 0;
    const low = sevCounts.low || 0;
    const gaugeDash = Math.round(2 * Math.PI * 45);
    const gaugeOffset = Math.round(gaugeDash - (score / 100) * gaugeDash);
    const maxCat = Math.max(...categories.map((c) => c.count), 1);
    const categoryItems = categories.map((c) => {
      const color = c.severity === 'fail' ? '#EF4444' : c.severity === 'warn' ? '#F59E0B' : '#3B82F6';
      const pct = Math.round((c.count / maxCat) * 100);
      return \`<div class="cat-row"><span class="cat-color" style="background:\${color}"></span><span class="cat-name">\${c.label}</span><div class="cat-bar"><div class="cat-fill" style="width:\${pct}%;background:\${color}"></div></div><span class="cat-count">\${c.count}</span></div>\`;
    }).join('');
    const categoryOptions = categories.map((c) => \`<option value="\${c.label}">\${c.label}</option>\`).join('');
    const failingFiles = this.extractFailingFiles(this.report);
    const failingFilesHtml = failingFiles.map((file) => {
      const sevMap = {};
      file.issues.forEach((i) => { sevMap[i.severity] = (sevMap[i.severity] || 0) + 1; });
      const sevBadges = Object.entries(sevMap).map(([s, c]) => {
        const color = s === 'critical' || s === 'high' ? '#EF4444' : s === 'medium' ? '#F59E0B' : '#10B981';
        return \`<span class="flist-pill" style="background:\${color}15;color:\${color}">\${s} \${c}</span>\`;
      }).join('');
      const fileName = file.file.split(/[\\\\/]/).pop() || file.file;
      return \`<div class="flist-row"><div style="flex:1;min-width:0"><div class="flist-name">\${fileName}</div><div class="flist-path">\${file.file}</div></div><div class="flist-count">\${sevBadges}</div><div class="flist-actions"><button class="btn" style="padding:4px 10px;font-size:.7rem" onclick="vscode.postMessage({command:'openFile',file:'\${file.file.replace(/\\\\/g, '\\\\\\\\')}',line:1})">Open</button></div></div>\`;
    }).join('');

    const templatePath = path.join(this.extUri.fsPath, 'media', 'dashboardTemplate.html');
    let html = fs.existsSync(templatePath) ? fs.readFileSync(templatePath, 'utf8') : this.fallbackDashboardHtml();
    return html
      .replace(/NONCE/g, nonce)
      .replace(/CSP_SRC/g, csp)
      .replace(/SCORE_COLOR/g, scoreColor)
      .replace(/GAUGE_DASH/g, String(gaugeDash))
      .replace(/GAUGE_OFFSET/g, String(gaugeOffset))
      .replace(/PASS_TEXT/g, pass)
      .replace(/PASS_COLOR/g, passColor)
      .replace(/PASS_BG/g, passBg)
      .replace(/PASS_BORDER/g, passBorder)
      .replace(/SCORE/g, String(score))
      .replace(/VERSION/g, this.version)
      .replace(/FILES/g, files)
      .replace(/FOLDERS/g, String(folders))
      .replace(/FINDINGS/g, String(totalFindings))
      .replace(/CATS/g, String(categories.length))
      .replace(/CRIT/g, String(crit))
      .replace(/HIGH/g, String(high))
      .replace(/MED/g, String(med))
      .replace(/LOW/g, String(low))
      .replace('CATEGORY_ITEMS', categoryItems)
      .replace('CATEGORY_OPTIONS', categoryOptions)
      .replace('FAILING_FILES', failingFilesHtml)
      .replace('FINDINGS_JSON', findingsJson)
      .replace('METRIC_GRAD', scoreColor);
  }

  private fallbackDashboardHtml(): string {
    return \`<!DOCTYPE html><html><body style="background:var(--vscode-editor-background);color:var(--vscode-foreground);font-family:var(--vscode-font-family);padding:20px;text-align:center;"><h2>SimpleBeacon Dashboard</h2><p>Template not found. Please reinstall the extension.</p></body></html>\`;
  }

`;

const before = content.substring(0, startIdx);
const after = content.substring(endIdx);

fs.writeFileSync(filePath, before + newMethod + after);
console.log('Dashboard method replaced successfully');
