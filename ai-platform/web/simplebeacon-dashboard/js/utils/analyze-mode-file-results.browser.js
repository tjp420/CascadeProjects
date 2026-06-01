/**
 * Per-file (or per-target) pass/fail rows for Analyze mode pills — from lastResult / report payloads.
 */

import { escapeHtml, formatNumber } from '../utils.js';

const MAX_ROWS = 200;


function normalizeRelPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function issuePaths(issue) {
  const paths = [
    issue?.filePath,
    issue?.file,
    ...(issue?.filePaths || []),
    ...(issue?.affectedFiles || [])
  ].filter(Boolean).map(normalizeRelPath);
  return [...new Set(paths)];
}

function severityToStatus(severity) {
  const s = String(severity || '').toLowerCase();
  if (s === 'critical' || s === 'high') return 'fail';
  if (s === 'medium' || s === 'low') return 'warn';
  return 'warn';
}

function upsertRow(map, path, row) {
  const key = normalizeRelPath(path);
  if (!key) return;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, row);
    return;
  }
  if (existing.status === 'fail') return;
  if (row.status === 'fail') {
    map.set(key, row);
    return;
  }
  if (existing.status === 'warn' && row.status === 'pass') return;
  map.set(key, { ...existing, ...row, detail: [existing.detail, row.detail].filter(Boolean).join(' · ') });
}

function rowsFromIssues(issues = [], ruleLabel = 'gate') {
  const map = new Map();
  for (const issue of issues) {
    for (const path of issuePaths(issue)) {
      upsertRow(map, path, {
        path,
        status: severityToStatus(issue.severity || issue.severityBand),
        rule: issue.type || ruleLabel,
        detail: issue.description || issue.recommendedAction || ''
      });
    }
  }
  return [...map.values()];
}

function rowsFromGateReport(report) {
  if (!report) return [];
  const issues = report.rawIssues || report.detectedIssues || [];
  const rows = rowsFromIssues(issues, 'simplebeacon-gate');
  const docs = report.euAiActSummary?.documentationFound || [];
  for (const path of docs) {
    upsertRow(rows.reduce((m, r) => { m.set(r.path, r); return m; }, new Map()), path, {
      path: normalizeRelPath(path),
      status: 'pass',
      rule: 'EUAI-003',
      detail: 'Documentation artifact detected'
    });
  }
  return [...rows, ...docs.map((p) => ({
    path: normalizeRelPath(p),
    status: 'pass',
    rule: 'EUAI-003',
    detail: 'Documentation artifact detected'
  }))].reduce((acc, row) => {
    upsertRow(acc, row.path, row);
    return acc;
  }, new Map()).values ? [...new Map([...rowsFromIssues([], ''), ...docs.map((p) => [normalizeRelPath(p), {
    path: normalizeRelPath(p),
    status: 'pass',
    rule: 'EUAI-003',
    detail: 'Documentation artifact detected'
  }])]).values()] : rows;
}

function rowsFromGateReportFixed(report) {
  if (!report) return { rows: [], summary: null };
  const map = new Map();
  const issues = report.rawIssues || report.detectedIssues || [];
  for (const issue of issues) {
    for (const path of issuePaths(issue)) {
      upsertRow(map, path, {
        path,
        status: severityToStatus(issue.severity || issue.severityBand),
        rule: issue.type || 'gate',
        detail: issue.description || ''
      });
    }
  }
  for (const path of report.euAiActSummary?.documentationFound || []) {
    upsertRow(map, path, {
      path: normalizeRelPath(path),
      status: 'pass',
      rule: 'EUAI-003',
      detail: 'Documentation artifact detected'
    });
  }
  const failN = [...map.values()].filter((r) => r.status === 'fail').length;
  const warnN = [...map.values()].filter((r) => r.status === 'warn').length;
  const scoped = report.ruleScopedFilesAnalyzed ?? report.scanScope?.ruleScopedFilesAnalyzed;
  const passImplicit = scoped != null
    ? Math.max(0, scoped - failN - warnN)
    : null;
  return {
    rows: [...map.values()],
    summary: {
      scoped,
      passImplicit,
      repositoryFiles: report.repositoryFilesTotal ?? report.scanScope?.repositoryFilesTotal
    }
  };
}

function rowsFromFindings(findings = [], rulePrefix = 'finding') {
  const map = new Map();
  for (const finding of findings) {
    const path = finding.path || finding.filePath || finding.file || finding.id;
    if (!path || String(path).includes(' ')) continue;
    upsertRow(map, path, {
      path: normalizeRelPath(path),
      status: severityToStatus(finding.severity),
      rule: finding.scanner || finding.category || finding.type || rulePrefix,
      detail: finding.message || finding.reason || finding.recommendation || ''
    });
  }
  return [...map.values()];
}

function rowsFromConsolidation(scan) {
  const map = new Map();
  for (const item of scan?.mergeCandidates || []) {
    for (const file of item.files || []) {
      const path = file.path || file;
      upsertRow(map, path, {
        path: normalizeRelPath(path),
        status: 'warn',
        rule: 'merge-candidate',
        detail: item.mergeType || 'Similar JSON — review merge'
      });
    }
  }
  for (const item of scan?.reductionOpportunities || []) {
    const path = item.path || item.file;
    if (!path) continue;
    upsertRow(map, path, {
      path: normalizeRelPath(path),
      status: 'warn',
      rule: 'reduction',
      detail: item.reason || 'Reduction opportunity'
    });
  }
  for (const group of scan?.exactDuplicateGroups || []) {
    for (const path of group.paths || group.files || []) {
      upsertRow(map, path, {
        path: normalizeRelPath(typeof path === 'string' ? path : path.path),
        status: 'warn',
        rule: 'duplicate-json',
        detail: 'Exact duplicate content group'
      });
    }
  }
  return [...map.values()];
}

function rowsFromNpmAudit(npmAudit) {
  const map = new Map();
  const vulns = npmAudit?.vulnerabilities || npmAudit?.advisories || [];
  const list = Array.isArray(vulns) ? vulns : Object.values(vulns || {});
  for (const vuln of list) {
    const name = vuln.name || vuln.module || vuln.packageName;
    if (!name) continue;
    upsertRow(map, name, {
      path: name,
      status: ['critical', 'high'].includes(String(vuln.severity).toLowerCase()) ? 'fail' : 'warn',
      rule: 'npm-audit',
      detail: vuln.title || vuln.recommendation || vuln.severity || 'Vulnerability'
    });
  }
  if (!map.size && npmAudit?.summary) {
    return [{
      path: 'package.json',
      status: 'pass',
      rule: 'npm-audit',
      detail: `${npmAudit.summary.total ?? 0} vulnerabilities · ${npmAudit.summary.dependencies ?? '—'} dependencies`
    }];
  }
  return [...map.values()];
}

function rowsFromCompliance(checklist) {
  return (checklist?.rules || []).map((rule) => ({
    path: rule.id,
    status: rule.status === 'pass' ? 'pass' : rule.status === 'fail' ? 'fail' : 'skip',
    rule: rule.id,
    detail: rule.evidence || rule.title || ''
  }));
}

function rowsFromCleanupBrief(brief) {
  const map = new Map();
  const tiers = brief?.tiers || {};
  for (const entry of tiers.safeNow?.directories || []) {
    upsertRow(map, entry.path, {
      path: normalizeRelPath(entry.path),
      status: 'pass',
      rule: 'cleanup-safe',
      detail: `Safe to delete · ${formatNumber(entry.files)} file(s)`
    });
  }
  for (const entry of tiers.reviewFirst?.items || []) {
    upsertRow(map, entry.path, {
      path: normalizeRelPath(entry.path),
      status: 'warn',
      rule: 'cleanup-review',
      detail: entry.reason || 'Review before delete'
    });
  }
  for (const entry of tiers.protected?.directories || []) {
    upsertRow(map, entry.path, {
      path: normalizeRelPath(entry.path),
      status: 'pass',
      rule: 'cleanup-protected',
      detail: 'Protected path — do not delete'
    });
  }
  return [...map.values()];
}

function stepPayload(lastResult, stepId) {
  if (lastResult?.kind === 'complete') {
    return lastResult.steps?.find((step) => step.id === stepId) ?? null;
  }
  return null;
}

function resolvePayload(mode, lastResult, report) {
  switch (mode) {
    case 'simplebeacon':
      if (lastResult?.kind === 'simplebeacon-report') return { kind: 'gate', report: lastResult.report };
      if (lastResult?.kind === 'complete') return { kind: 'gate', report: stepPayload(lastResult, 'simplebeacon')?.report };
      if (report?.type === 'simplebeacon-report') return { kind: 'gate', report };
      return null;
    case 'eu-ai-act':
      if (lastResult?.kind === 'eu-ai-act') return { kind: 'gate', report: lastResult.sprint?.report };
      if (lastResult?.kind === 'complete') return { kind: 'gate', report: stepPayload(lastResult, 'simplebeacon')?.report };
      return null;
    case 'mock-scan':
      if (lastResult?.kind === 'complete') {
        const step = stepPayload(lastResult, 'mock-scan');
        return { kind: 'fiction', report: step?.report, issues: step?.fictionIssues };
      }
      if (lastResult?.report) return { kind: 'fiction', report: lastResult.report, issues: lastResult.fictionIssues };
      return report ? { kind: 'fiction', report, issues: null } : null;
    case 'consolidation':
      if (lastResult?.kind === 'consolidation') return { kind: 'consolidation', scan: lastResult.scan };
      if (lastResult?.kind === 'complete') return { kind: 'consolidation', scan: stepPayload(lastResult, 'consolidation')?.scan };
      return null;
    case 'codebase':
      if (lastResult?.kind === 'codebase') return { kind: 'codebase', scan: lastResult.scan };
      if (lastResult?.kind === 'complete') return { kind: 'codebase', scan: stepPayload(lastResult, 'codebase')?.scan };
      return null;
    case 'file-reduction':
    case 'data-quality':
      if (lastResult?.kind === mode) return { kind: 'cleanup', scan: lastResult.scan };
      if (lastResult?.kind === 'complete') return { kind: 'cleanup', scan: stepPayload(lastResult, mode)?.scan };
      return null;
    case 'cleanup-assistant':
      if (lastResult?.kind === 'cleanup-assistant') return { kind: 'cleanup-brief', brief: lastResult.brief };
      if (lastResult?.kind === 'complete') return { kind: 'cleanup-brief', brief: stepPayload(lastResult, 'cleanup-assistant')?.brief };
      return null;
    case 'compliance':
      if (lastResult?.kind === 'compliance') return { kind: 'compliance', checklist: lastResult.checklist };
      if (lastResult?.kind === 'complete') return { kind: 'compliance', checklist: stepPayload(lastResult, 'compliance')?.checklist };
      return null;
    case 'npm-audit':
      if (lastResult?.kind === 'npm-audit') return { kind: 'npm', npmAudit: lastResult.npmAudit };
      if (lastResult?.kind === 'complete') return { kind: 'npm', npmAudit: stepPayload(lastResult, 'npm-audit')?.npmAudit };
      return null;
    case 'roadmap':
      if (lastResult?.kind === 'roadmap') return { kind: 'roadmap', data: lastResult.data || lastResult };
      if (lastResult?.kind === 'complete') return { kind: 'roadmap', data: stepPayload(lastResult, 'roadmap')?.data };
      return null;
    case 'complete':
      if (lastResult?.kind === 'complete') return { kind: 'complete', steps: lastResult.steps };
      return null;
    case 'auto':
      return resolvePayload(
        lastResult?.kind === 'roadmap' ? 'roadmap' : 'simplebeacon',
        lastResult,
        report
      );
    default:
      return null;
  }
}

function buildRows(mode, payload) {
  if (!payload) return { rows: [], summary: null, note: null };

  if (payload.kind === 'gate') {
    const { rows, summary } = rowsFromGateReportFixed(payload.report);
    return { rows, summary, note: null };
  }
  if (payload.kind === 'fiction') {
    const issues = payload.issues || (payload.report ? (payload.report.rawIssues || payload.report.detectedIssues || []) : []);
    const fictionOnly = issues.filter((i) => /fiction|fictional|consistency|kpi/i.test(String(i.type || '')));
    return {
      rows: rowsFromIssues(fictionOnly.length ? fictionOnly : issues, 'fiction'),
      summary: {
        scoped: payload.report?.fictionJsonFilesScanned ?? payload.report?.scanScope?.fictionJsonFilesScanned
      },
      note: null
    };
  }
  if (payload.kind === 'consolidation') {
    return {
      rows: rowsFromConsolidation(payload.scan),
      summary: {
        scoped: payload.scan?.summary?.jsonFilesAnalyzed ?? payload.scan?.summary?.sampleDataFilesAnalyzed
      },
      note: null
    };
  }
  if (payload.kind === 'codebase') {
    return {
      rows: rowsFromFindings(payload.scan?.findings || [], 'codebase'),
      summary: { scoped: payload.scan?.summary?.filesScanned ?? payload.scan?.summary?.codeFilesAnalyzed },
      note: null
    };
  }
  if (payload.kind === 'cleanup') {
    const scan = payload.scan;
    const top = scan?.topFindings || [];
    const scannerFindings = [];
    for (const [scannerId, block] of Object.entries(scan?.scanners || {})) {
      const items = block?.findings?.items || block?.findings || [];
      if (Array.isArray(items)) {
        for (const item of items) scannerFindings.push({ ...item, scanner: scannerId });
      }
    }
    return {
      rows: rowsFromFindings([...top, ...scannerFindings], scan?.scanProfile || 'cleanup'),
      summary: { scoped: scan?.inventory?.totalFiles ?? scan?.summary?.filesScanned },
      note: null
    };
  }
  if (payload.kind === 'cleanup-brief') {
    return { rows: rowsFromCleanupBrief(payload.brief), summary: null, note: null };
  }
  if (payload.kind === 'compliance') {
    return {
      rows: rowsFromCompliance(payload.checklist),
      summary: null,
      note: 'Compliance mode evaluates checklist rules — rows are rules, not individual source files.'
    };
  }
  if (payload.kind === 'npm') {
    return { rows: rowsFromNpmAudit(payload.npmAudit), summary: null, note: 'npm audit rows are packages, not source files.' };
  }
  if (payload.kind === 'roadmap') {
    const phases = payload.data?.roadmap?.phases || payload.data?.phases || [];
    return {
      rows: phases.slice(0, 20).map((phase, index) => ({
        path: phase.id || phase.name || `phase-${index + 1}`,
        status: 'pass',
        rule: 'roadmap',
        detail: phase.name || phase.title || 'Sprint phase'
      })),
      summary: null,
      note: 'Roadmap mode summarizes sprint phases — not a per-source-file gate.'
    };
  }
  if (payload.kind === 'complete' && payload.steps) {
    const map = new Map();
    for (const step of payload.steps) {
      const subMode = step.id === 'mock-scan' ? 'mock-scan' : step.id;
      const fakeLast = { kind: 'complete', steps: payload.steps, ...step };
      let subPayload = resolvePayload(subMode, fakeLast, null);
      if (subMode === 'simplebeacon') subPayload = { kind: 'gate', report: step.report };
      if (subMode === 'mock-scan') subPayload = { kind: 'fiction', report: step.report, issues: step.fictionIssues };
      if (subMode === 'consolidation') subPayload = { kind: 'consolidation', scan: step.scan };
      if (subMode === 'codebase') subPayload = { kind: 'codebase', scan: step.scan };
      if (subMode === 'file-reduction' || subMode === 'data-quality') subPayload = { kind: 'cleanup', scan: step.scan };
      if (subMode === 'cleanup-assistant') subPayload = { kind: 'cleanup-brief', brief: step.brief };
      if (subMode === 'compliance') subPayload = { kind: 'compliance', checklist: step.checklist };
      if (subMode === 'npm-audit') subPayload = { kind: 'npm', npmAudit: step.npmAudit };
      if (subMode === 'roadmap') subPayload = { kind: 'roadmap', data: step.data };
      const built = buildRows(subMode, subPayload);
      for (const row of built.rows) {
        upsertRow(map, `${step.id}:${row.path}`, { ...row, path: row.path, rule: `${step.id} · ${row.rule}` });
      }
    }
    return { rows: [...map.values()], summary: null, note: 'Complete bundle — combined rows from all ten steps.' };
  }
  return { rows: [], summary: null, note: null };
}

function statusBadge(status) {
  if (status === 'pass') return '<span class="gate-badge pass">PASS</span>';
  if (status === 'fail') return '<span class="gate-badge warn">FAIL</span>';
  if (status === 'warn') return '<span class="gate-badge" style="border-color:#f59e0b;color:#fbbf24">WARN</span>';
  if (status === 'skip') return '<span class="gate-badge">SKIP</span>';
  return '<span class="gate-badge">—</span>';
}

function sortRows(rows) {
  const order = { fail: 0, warn: 1, skip: 2, pass: 3 };
  return [...rows].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.path.localeCompare(b.path));
}

/**
 * @param {string} modeValue
 * @param {{ lastResult?: object, report?: object }} context
 */
export function renderModeFileResultsPanel(modeValue, context = {}) {
  const payload = resolvePayload(modeValue, context.lastResult, context.report);
  const { rows, summary, note } = buildRows(modeValue, payload);

  if (!payload) {
    return `
      <div class="analyze-mode-file-results">
        <h3 class="analyze-mode-scope-title">Per-file / per-target results</h3>
        <p class="text-muted analyze-mode-scope-intro" style="margin:0;">
          Run <strong>${escapeHtml(modeValue)}</strong> analysis to populate pass/fail rows for files, packages, or checklist rules.
        </p>
      </div>
    `;
  }

  const sorted = sortRows(rows);
  const passN = sorted.filter((r) => r.status === 'pass').length;
  const failN = sorted.filter((r) => r.status === 'fail').length;
  const warnN = sorted.filter((r) => r.status === 'warn').length;
  const shown = sorted.slice(0, MAX_ROWS);
  const hidden = sorted.length - shown.length;

  const implicitNote = summary?.passImplicit > 0
    ? `${formatNumber(summary.passImplicit)} additional gate-scoped file(s) passed with no listed findings.`
    : '';
  const scopedNote = summary?.scoped != null
    ? `${formatNumber(summary.scoped)} file(s) in scan scope · ${formatNumber(summary.repositoryFiles)} repo inventory.`
    : '';

  return `
    <div class="analyze-mode-file-results" data-mode-file-results="${escapeHtml(modeValue)}">
      <h3 class="analyze-mode-scope-title">Per-file / per-target results</h3>
      <p class="text-muted analyze-mode-scope-intro">
        ${formatNumber(sorted.length)} listed · ${passN} pass · ${failN} fail · ${warnN} warn
        ${scopedNote ? ` · ${escapeHtml(scopedNote)}` : ''}
      </p>
      ${note ? `<p class="text-muted" style="font-size:var(--font-size-xs);margin:0 0 0.5rem;">${escapeHtml(note)}</p>` : ''}
      ${implicitNote ? `<p class="text-muted" style="font-size:var(--font-size-xs);margin:0 0 0.5rem;">${escapeHtml(implicitNote)}</p>` : ''}
      ${!shown.length ? `
        <p class="text-muted card" style="font-size:var(--font-size-sm);margin:0;">
          No file-level failures listed — scan completed with no targeted findings in the export payload.
          ${summary?.passImplicit ? ` ${escapeHtml(implicitNote)}` : ''}
        </p>
      ` : `
        <div class="table-scroll analyze-mode-file-results-table">
          <table class="data-table">
            <thead>
              <tr>
                <th>File / target</th>
                <th>Status</th>
                <th>Rule</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              ${shown.map((row) => `
                <tr>
                  <td><code>${escapeHtml(row.path)}</code></td>
                  <td>${statusBadge(row.status)}</td>
                  <td class="text-muted" style="font-size:var(--font-size-xs);">${escapeHtml(String(row.rule || '—'))}</td>
                  <td class="text-muted" style="font-size:var(--font-size-xs);">${escapeHtml(String(row.detail || '—'))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${hidden > 0 ? `<p class="text-muted" style="font-size:var(--font-size-xs);margin:0.5rem 0 0;">+ ${formatNumber(hidden)} more row(s) not shown.</p>` : ''}
      `}
    </div>
  `;
}
