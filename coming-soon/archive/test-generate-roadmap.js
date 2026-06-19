const fs = require('fs');
const report = JSON.parse(fs.readFileSync('C:/Users/Trevor/CascadeProjects/ai-platform/.simplebeacon/report.json', 'utf8'));

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function collectFindings(pathArr, snippetKey = 'snippet') {
  const out = [];
  if (!Array.isArray(pathArr)) return out;
  for (const item of pathArr) {
    if (typeof item === 'string') out.push({ file: item });
    else if (item && typeof item === 'object') {
      const file = item.file || item.path || item.filename || '';
      const line = item.line || item.lineNumber || '';
      const text = item[snippetKey] || item.text || item.message || item.reason || '';
      if (file) out.push({ file, line, text });
    }
  }
  return out;
}

function isBuildArtifactPath(p) {
  return /(^|\/)(node_modules|\.git|dist|build|\.next|out|coverage|frontend-build)\//i.test(p) || /(^|\/)vscode-extension\/out\//i.test(p) || /\.map$/i.test(p);
}

function generateRoadmap(report) {
  // Sanitize old reports
  if (report.aiContext && Array.isArray(report.aiContext.suggestedFixes)) {
    report.aiContext.suggestedFixes = report.aiContext.suggestedFixes.filter(f => !isBuildArtifactPath(f.file));
  }
  if (Array.isArray(report.detectedIssues)) {
    report.detectedIssues = report.detectedIssues.map(issue => {
      const files = Array.isArray(issue.filePath) ? issue.filePath : (issue.filePath ? [issue.filePath] : []);
      const cleanFiles = files.filter(f => !isBuildArtifactPath(f));
      return { ...issue, filePath: cleanFiles };
    }).filter(issue => Array.isArray(issue.filePath) && issue.filePath.length > 0);
  }

  // Prefer server-computed remediationPhases when available
  if (Array.isArray(report.remediationPhases) && report.remediationPhases.length > 0) {
    console.log('Using remediationPhases');
    const phases = report.remediationPhases.map(p => {
      const tasks = p.tasks || [];
      const doneCount = tasks.filter(t => typeof t === 'object' && t && t.done).length;
      const total = tasks.length;
      const taskPercent = total ? Math.round((doneCount / total) * 100) : 100;
      const taskStatus = taskPercent >= 95 ? 'completed' : (taskPercent > 0 ? 'in-progress' : 'pending');
      return {
        id: p.id,
        title: p.title,
        severity: p.severity || 'medium',
        effort: p.effort || 'TBD',
        description: p.description || '',
        tasks,
        progress: taskPercent,
        status: taskStatus,
        extraHtml: ''
      };
    });
    phases.forEach(p => {
      if (!p.dependsOn || p.progress >= 100) return;
      const dep = phases.find(x => x.id === p.dependsOn);
      if (dep && dep.progress < 95) { p.status = 'blocked'; p.progress = Math.min(p.progress, dep.progress); }
    });
    return { phases, generatedAt: new Date().toISOString(), sourceReport: report.generatedAt };
  }

  console.log('Building phases manually');
  const src = report.sourceReport || report;
  const phases = [];

  const qs = src.qualityScore != null ? Number(src.qualityScore) : null;
  const issues = src.issueCount != null ? Number(src.issueCount) : null;
  const invalidJson = src.invalidJson != null ? Number(src.invalidJson) : null;
  const emptyFiles = src.emptyFiles != null ? Number(src.emptyFiles) : (src.dataQuality?.emptyJsonCount != null ? Number(src.dataQuality.emptyJsonCount) : null);
  const schemaComp = src.schemaCompliance != null ? Number(src.schemaCompliance) : null;
  const schemaChecked = src.schemaChecked != null ? Number(src.schemaChecked) : null;
  const schemaPassed = src.schemaPassed != null ? Number(src.schemaPassed) : null;
  const dupes = src.duplicateGroups != null ? Number(src.duplicateGroups) : (src.consolidation?.duplicateGroups != null ? Number(src.consolidation.duplicateGroups) : null);
  const consistency = src.consistencyScore != null ? Number(src.consistencyScore) : (src.consolidation?.duplicateGroups != null ? (src.consolidation.duplicateGroups === 0 ? 100 : 50) : null);
  const consistencyChecked = src.consistencyChecked != null ? Number(src.consistencyChecked) : null;
  const consistencyPassed = src.consistencyPassed != null ? Number(src.consistencyPassed) : null;
  const credFindings = src.credentialFindings != null ? Number(src.credentialFindings) : (src.gate?.blockingCount != null ? Number(src.gate.blockingCount) : null);
  const leakFindings = src.productionLeakFindings != null ? Number(src.productionLeakFindings) : null;
  const euAiAct = src.euAiActFindings != null ? Number(src.euAiActFindings) : (src.euAiActSummary?.aiSystemIndicators != null ? Number(src.euAiActSummary.aiSystemIndicators) : null);
  const todoMarkers = src.todoMarkerCount != null ? Number(src.todoMarkerCount) : (src.roadmap?.todoCount != null ? Number(src.roadmap.todoCount) : null);
  const issueCount = src.issueCount != null ? Number(src.issueCount) : 0;
  const scanIsClean = qs === 100 && (src.gate?.pass === true || src.gate?.blockingCount === 0) && issueCount === 0;

  console.log('qs:', qs, 'issues:', issues, 'invalidJson:', invalidJson, 'emptyFiles:', emptyFiles, 'schemaComp:', schemaComp);
  console.log('dupes:', dupes, 'consistency:', consistency, 'credFindings:', credFindings, 'leakFindings:', leakFindings);
  console.log('scanIsClean:', scanIsClean);

  function isRestricted(str) { return typeof str === 'string' && str.includes('***REDACTED***'); }
  function anyRestricted(arr) { return Array.isArray(arr) && arr.some(f => isRestricted(f.snippet) || isRestricted(f.text) || isRestricted(f.message)); }

  const gateFindings = collectFindings(report.gate?.blockingFindings || []);
  const credDetail = gateFindings.filter(f => /credential|secret|token|password|api_key|auth/i.test(f.text || ''));
  const leakDetail = gateFindings.filter(f => /production|prod|staging|deploy|\.env/i.test(f.text || ''));
  const hasRestrictedCred = anyRestricted(src.gate?.blockingFindings);
  const emptyFileDetail = collectFindings(src.dataQuality?.emptyJsonFiles);
  const invalidJsonDetail = collectFindings(src.dataQuality?.invalidJsonFiles);
  const dupeDetail = collectFindings(src.consolidation?.duplicateGroups);
  const todoDetail = (src.roadmap?.todoFiles || []).map(p => typeof p === 'string' ? { file: p } : p);
  const debugDetail = collectFindings(src.cleanup?.debugFindings);
  const junkDetail = collectFindings(src.junkFiles?.findings || src.junkFiles?.files);
  const buildDetail = collectFindings(src.buildReadiness?.findings || src.buildReadiness?.issues);
  const vulnDetail = collectFindings(src.dependencyAudit?.vulnerabilities || src.dependencyAudit?.findings);

  console.log('gateFindings:', gateFindings.length, 'credDetail:', credDetail.length, 'leakDetail:', leakDetail.length);
  console.log('emptyFileDetail:', emptyFileDetail.length, 'invalidJsonDetail:', invalidJsonDetail.length);
  console.log('dupeDetail:', dupeDetail.length, 'todoDetail:', todoDetail.length, 'debugDetail:', debugDetail.length);

  // Phase 1: Security
  {
    const t = [];
    const blockingFindings = src.gate?.blockingFindings || [];
    if (blockingFindings.length > 0 && !hasRestrictedCred) {
      blockingFindings.forEach(bf => {
        (bf.findings || []).forEach(m => {
          t.push({ type: 'review', location: bf.filePath, codeSnippet: m.snippet || '', isStructured: true });
        });
      });
    } else if ((credFindings || 0) > 0) { t.push({ description: `Rotate ${credFindings} exposed credential(s)`, type: 'fix', isStructured: true }); }
    if ((leakFindings || 0) > 0) { t.push({ description: `Review ${leakFindings} production leak(s)`, type: 'review', isStructured: true }); }
    if (t.length === 0) t.push({ description: 'No security issues detected — credentials && secrets verified.', type: 'verify', isStructured: true });
    t.push(
      { description: 'Add .env to .gitignore', type: 'fix', codeSnippet: 'echo ".env" >> .gitignore', isStructured: true },
      { description: 'Re-run gate scan', type: 'verify', codeSnippet: 'npx simplebeacon scan --gate', isStructured: true }
    );
    const totalIssues = (credFindings || 0) + (leakFindings || 0);
    const progress = totalIssues === 0 ? 100 : Math.max(5, Math.round((1 - totalIssues / (totalIssues + 3)) * 100));
    const status = progress >= 95 ? 'completed' : (progress > 0 ? 'in-progress' : 'pending');
    const credIssue = src.detectedIssues?.find(i => i.type === 'Credential Pattern');
    const impactHtml = credIssue?.impact ? `<div class="phase-impact">Impact: ${escapeHtml(credIssue.impact)}</div>` : '';
    const fixHtml = credIssue?.fix ? `<div class="phase-fix">Fix: ${escapeHtml(credIssue.fix)}</div>` : '';
    phases.push({ id: 'security', title: 'Security Hardening', severity: totalIssues === 0 ? 'low' : 'critical', effort: '1–2 days', description: totalIssues === 0 ? 'No security issues detected — credentials && secrets verified.' : `Address ${credFindings || 0} credential and ${leakFindings || 0} production leak finding(s).`, tasks: t, progress, status, extraHtml: impactHtml + fixHtml });
  }

  console.log('After security phase, phases:', phases.length);

  // Phase 2: Data Integrity
  {
    const allClean = (invalidJson === 0 || invalidJson == null) && (emptyFiles === 0 || emptyFiles == null) && (schemaComp === 100 || schemaComp == null) && invalidJsonDetail.length === 0 && emptyFileDetail.length === 0;
    const t = [];
    if (invalidJsonDetail.length > 0) {
      invalidJsonDetail.forEach(f => { t.push({ description: `Fix invalid JSON: ${f.file}`, type: 'fix', location: f.file, isStructured: true }); });
    } else if (invalidJson > 0) { t.push({ description: `Fix ${invalidJson} invalid JSON file(s)`, type: 'fix', isStructured: true }); }
    if (emptyFileDetail.length > 0) {
      emptyFileDetail.forEach(f => { t.push({ description: `Remove empty file: ${f.file}`, type: 'fix', location: f.file, isStructured: true }); });
    } else if (emptyFiles > 0) { t.push({ description: `Remove ${emptyFiles} empty file(s)`, type: 'fix', isStructured: true }); }
    if (schemaComp != null && schemaComp < 100 && schemaChecked != null) { const failed = schemaChecked - (schemaPassed || 0); if (failed > 0) t.push({ description: `Fix ${failed} schema violation(s)`, type: 'fix', isStructured: true }); }
    if (schemaComp != null && schemaComp < 100 && schemaChecked == null) t.push({ description: 'Review schema compliance failures', type: 'review', isStructured: true });
    t.push(
      { description: 'Validate all JSON', type: 'verify', codeSnippet: 'npx simplebeacon scan --json', isStructured: true },
      { description: 'Re-run scan', type: 'verify', codeSnippet: 'npx simplebeacon scan', isStructured: true }
    );
    const sameEmptyCount = invalidJson === emptyFiles && invalidJson != null;
    const dirtyDesc = sameEmptyCount
      ? `Resolve structural issues: ${invalidJson} empty/invalid JSON file(s).`
      : `Resolve structural issues${invalidJson > 0 ? ': ' + invalidJson + ' invalid JSON' : ''}${emptyFiles > 0 ? ': ' + emptyFiles + ' empty files' : ''}${schemaComp != null && schemaComp < 100 ? ': ' + schemaComp + '% schema compliance' : ''}.`;
    phases.push({ id: 'integrity', title: 'Data Integrity', severity: (invalidJson > 0 || emptyFiles > 0 || invalidJsonDetail.length > 0 || emptyFileDetail.length > 0) ? 'high' : 'low', effort: '2–4 days', description: allClean ? 'Data integrity verified — no structural issues detected.' : dirtyDesc, tasks: t, progress: allClean ? 100 : (schemaComp != null ? Math.round(schemaComp) : 0), status: allClean ? 'completed' : 'pending' });
  }

  console.log('After integrity phase, phases:', phases.length);

  // Phase 3: Consistency
  {
    const dupFiles = src.consolidation?.duplicateFiles || [];
    const isMirrorOnly = dupFiles.length > 0 && dupFiles.every(g => Array.isArray(g) && g.every(f => /^(coming-soon\/|Domain\/|packages\/|[^\/]+$)/.test(f)));
    const allClean = (dupes === 0 || dupes == null) && (consistency === 100 || consistency == null) && dupeDetail.length === 0;
    const autoComplete = allClean || isMirrorOnly;
    const t = [];
    if (dupeDetail.length > 0) {
      dupeDetail.forEach(f => { t.push({ description: `Consolidate duplicate: ${f.file}`, type: 'fix', location: f.file, isStructured: true }); });
    } else if (dupes > 0 && !autoComplete) { t.push({ description: `Consolidate ${dupes} duplicate group(s)`, type: 'fix', isStructured: true }); }
    if (consistency != null && consistency < 100 && consistencyChecked != null) { const failed = consistencyChecked - (consistencyPassed || 0); if (failed > 0) t.push({ description: `Resolve ${failed} consistency failure(s)`, type: 'fix', isStructured: true }); }
    if (consistency != null && consistency < 100 && consistencyChecked == null) t.push({ description: 'Review consistency check failures', type: 'review', isStructured: true });
    if (!autoComplete) t.push(
      { description: 'Standardize naming conventions', type: 'doc', isStructured: true },
      { description: 'Document canonical file locations', type: 'doc', isStructured: true }
    );
    if (autoComplete) t.push({ description: 'Verified — duplicates are structural/intentional', type: 'verify', isStructured: true });
    phases.push({ id: 'consistency', title: 'Consistency & Deduplication', severity: (dupes > 5 || dupeDetail.length > 5) && !autoComplete ? 'high' : 'low', effort: autoComplete ? 'None' : '3–5 days', description: autoComplete ? 'Consistency verified — structural duplicates only.' : `Eliminate redundancy${dupes > 0 ? ': ' + dupes + ' duplicate group(s)' : ''}${dupeDetail.length > 0 ? ': ' + dupeDetail.length + ' duplicate file(s)' : ''}${consistency != null && consistency < 100 ? ': ' + consistency + '% consistency' : ''}.`, tasks: t, progress: autoComplete ? 100 : Math.round((consistency || 0) + (dupes === 0 ? 100 : 50)) / 2, status: autoComplete ? 'completed' : 'pending' });
  }

  console.log('After consistency phase, phases:', phases.length);
  console.log('Returning', phases.length, 'phases');
  return { phases, generatedAt: new Date().toISOString(), sourceReport: report.generatedAt };
}

try {
  const result = generateRoadmap(report);
  console.log('SUCCESS!');
  console.log('Phases:', result.phases.length);
  result.phases.forEach(p => console.log(`  - ${p.title}: ${p.status} (${p.progress}%)`));
} catch (e) {
  console.error('ERROR:', e.message);
  console.error(e.stack);
}
