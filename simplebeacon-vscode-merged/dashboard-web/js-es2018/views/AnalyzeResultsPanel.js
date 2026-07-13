import { escapeHtml } from '../utils/string.js';
import { formatNumber } from '../utils/number.js';
import { formatPathInputValue, redactPathForDisplay } from '../utils/format.js';
import { getScanFileMetrics } from '../services/analyzeService.js?v=20260710inventory1';
import { getCompleteEngineLabel } from './AnalyzeEngineGrid.js';

/**
 * Summarize complete step metric.
 * @param {string} engineId
 * @param {any} result
 * @param {number} canonicalCount
 * @returns {any}
 */
export function summarizeCompleteStepMetric(engineId, result, canonicalCount = null) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34;
    if (!result)
        return '';
    switch (engineId) {
        case 'simplebeacon': {
            const m = getScanFileMetrics(result.report);
            const count = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : m.repositoryFiles;
            const parts = [];
            if (m.ruleScopedFilesAnalyzed != null) {
                parts.push(`${formatNumber(m.ruleScopedFilesAnalyzed)} analyzed`);
            }
            if (count != null && count !== m.ruleScopedFilesAnalyzed) {
                parts.push(`${formatNumber(count)} total`);
            }
            return parts.join(' · ');
        }
        case 'consolidation': {
            const count = (_f = (_c = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : (_b = (_a = result.scan) === null || _a === void 0 ? void 0 : _a.summary) === null || _b === void 0 ? void 0 : _b.repositoryFilesTotal) !== null && _c !== void 0 ? _c : (_e = (_d = result.scan) === null || _d === void 0 ? void 0 : _d.repositoryInventory) === null || _e === void 0 ? void 0 : _e.totalFiles) !== null && _f !== void 0 ? _f : (_h = (_g = result.scan) === null || _g === void 0 ? void 0 : _g.summary) === null || _h === void 0 ? void 0 : _h.filesAnalyzed;
            return count != null ? `${formatNumber(count)} files` : '';
        }
        case 'mock-scan': {
            const hits = (result.fictionIssues || []).reduce((sum, item) => sum + (item.count || 1), 0);
            const m = getScanFileMetrics(result.report);
            const count = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : m.mockSampleFiles;
            if (count != null && hits) {
                return `${formatNumber(count)} sample files · ${formatNumber(hits)} KPI hits`;
            }
            if (count != null)
                return `${formatNumber(count)} sample files`;
            return hits ? `${formatNumber(hits)} KPI hits` : '';
        }
        case 'roadmap': {
            const count = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : (_l = (_k = (_j = result.roadmap) === null || _j === void 0 ? void 0 : _j.codeAnalysis) === null || _k === void 0 ? void 0 : _k.structure) === null || _l === void 0 ? void 0 : _l.totalFiles;
            return count != null ? `${formatNumber(count)} files scanned` : '';
        }
        case 'codebase': {
            const count = (_s = (_p = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : (_o = (_m = result.report) === null || _m === void 0 ? void 0 : _m.summary) === null || _o === void 0 ? void 0 : _o.codeFilesAnalyzed) !== null && _p !== void 0 ? _p : (_r = (_q = result.report) === null || _q === void 0 ? void 0 : _q.summary) === null || _r === void 0 ? void 0 : _r.filesAnalyzed) !== null && _s !== void 0 ? _s : (_t = result.report) === null || _t === void 0 ? void 0 : _t.filesAnalyzed;
            return count != null ? `${formatNumber(count)} code files` : '';
        }
        case 'file-reduction': {
            const findings = (_x = (_v = (_u = result.summary) === null || _u === void 0 ? void 0 : _u.totalFindings) !== null && _v !== void 0 ? _v : (_w = result.summary) === null || _w === void 0 ? void 0 : _w.mergeCandidates) !== null && _x !== void 0 ? _x : null;
            const count = (_2 = (_z = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : (_y = result.inventory) === null || _y === void 0 ? void 0 : _y.totalFiles) !== null && _z !== void 0 ? _z : (_1 = (_0 = result.scan) === null || _0 === void 0 ? void 0 : _0.inventory) === null || _1 === void 0 ? void 0 : _1.totalFiles) !== null && _2 !== void 0 ? _2 : (_4 = (_3 = result.scan) === null || _3 === void 0 ? void 0 : _3.repositoryInventory) === null || _4 === void 0 ? void 0 : _4.totalFiles;
            if (findings != null && count != null) {
                return `${formatNumber(findings)} finding${findings === 1 ? '' : 's'} · ${formatNumber(count)} files inventoried`;
            }
            return count != null ? `${formatNumber(count)} files inventoried` : '';
        }
        case 'data-quality': {
            const count = (_9 = (_6 = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : (_5 = result.inventory) === null || _5 === void 0 ? void 0 : _5.totalFiles) !== null && _6 !== void 0 ? _6 : (_8 = (_7 = result.scan) === null || _7 === void 0 ? void 0 : _7.inventory) === null || _8 === void 0 ? void 0 : _8.totalFiles) !== null && _9 !== void 0 ? _9 : (_11 = (_10 = result.scan) === null || _10 === void 0 ? void 0 : _10.repositoryInventory) === null || _11 === void 0 ? void 0 : _11.totalFiles;
            return count != null ? `${formatNumber(count)} files inventoried` : '';
        }
        case 'cleanup-assistant': {
            const count = (_13 = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : (_12 = result.repositoryInventory) === null || _12 === void 0 ? void 0 : _12.totalFiles) !== null && _13 !== void 0 ? _13 : (_15 = (_14 = result.brief) === null || _14 === void 0 ? void 0 : _14.projectedInventory) === null || _15 === void 0 ? void 0 : _15.totalFiles;
            return count != null ? `${formatNumber(count)} files in brief` : '';
        }
        case 'npm-audit': {
            const n = (_18 = (_17 = (_16 = result.npmAudit) === null || _16 === void 0 ? void 0 : _16.summary) === null || _17 === void 0 ? void 0 : _17.total) !== null && _18 !== void 0 ? _18 : (_20 = (_19 = result.npmAudit) === null || _19 === void 0 ? void 0 : _19.vulnerabilities) === null || _20 === void 0 ? void 0 : _20.length;
            return n != null ? `${formatNumber(n)} vulnerabilities` : '';
        }
        case 'compliance': {
            const total = checklistRuleTotal(result.checklist);
            const passed = (_22 = (_21 = result.checklist) === null || _21 === void 0 ? void 0 : _21.summary) === null || _22 === void 0 ? void 0 : _22.passed;
            return passed != null && total ? `${passed}/${total} rules passed` : '';
        }
        case 'eu-ai-act': {
            const count = (_25 = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : (_24 = (_23 = result.sprint) === null || _23 === void 0 ? void 0 : _23.report) === null || _24 === void 0 ? void 0 : _24.repositoryFilesTotal) !== null && _25 !== void 0 ? _25 : (_28 = (_27 = (_26 = result.sprint) === null || _26 === void 0 ? void 0 : _26.report) === null || _27 === void 0 ? void 0 : _27.repositoryInventory) === null || _28 === void 0 ? void 0 : _28.totalFiles;
            return count != null ? `${formatNumber(count)} files audited` : '';
        }
        default: {
            const findings = (_31 = (_29 = result === null || result === void 0 ? void 0 : result.findingsCount) !== null && _29 !== void 0 ? _29 : (_30 = result === null || result === void 0 ? void 0 : result.category) === null || _30 === void 0 ? void 0 : _30.count) !== null && _31 !== void 0 ? _31 : null;
            const files = (_34 = (_32 = result === null || result === void 0 ? void 0 : result.fileCount) !== null && _32 !== void 0 ? _32 : (_33 = result === null || result === void 0 ? void 0 : result.category) === null || _33 === void 0 ? void 0 : _33.fileCount) !== null && _34 !== void 0 ? _34 : 0;
            if (findings != null) {
                return `${findings} finding${findings === 1 ? '' : 's'} in ${files} file${files === 1 ? '' : 's'}`;
            }
            return '';
        }
    }
}

/**
 * Format complete step line.
 * @param {any} step
 * @returns {any}
 */
export function formatCompleteStepLine(step) {
    const metric = step.metric ? ` · ${step.metric}` : '';
    const err = step.error ? ` — ${step.error}` : '';
    return `${step.label}${metric}${err}`;
}

/**
 * Checklist rule total.
 * @param {any} checklist
 * @returns {any}
 */
export function checklistRuleTotal(checklist) {
    var _a;
    const fromSummary = (_a = checklist === null || checklist === void 0 ? void 0 : checklist.summary) === null || _a === void 0 ? void 0 : _a.total;
    if (Number.isFinite(fromSummary) && fromSummary > 0)
        return fromSummary;
    const fromRules = ((checklist === null || checklist === void 0 ? void 0 : checklist.rules) || []).length;
    return fromRules > 0 ? fromRules : 0;
}

/**
 * Normalize path key.
 * @param {any} value
 * @returns {any}
 */
export function normalizePathKey(value) {
    return String(value || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/**
 * Render browser analyzer result.
 * @param {any} step
 * @param {Array} errors
 * @returns {any}
 */
export function renderBrowserAnalyzerResult(step, errors = []) {
    var _a, _b, _c, _d, _e, _f, _g;
    const label = getCompleteEngineLabel(step.id);
    const metric = summarizeCompleteStepMetric(step.id, step);
    const error = ((_a = errors.find((e) => { var _a; return (_a = e.step) === null || _a === void 0 ? void 0 : _a.includes(label); })) === null || _a === void 0 ? void 0 : _a.message) || '';
    const findingsCount = (_d = (_b = step.findingsCount) !== null && _b !== void 0 ? _b : (_c = step.category) === null || _c === void 0 ? void 0 : _c.count) !== null && _d !== void 0 ? _d : 0;
    const fileCount = (_g = (_e = step.fileCount) !== null && _e !== void 0 ? _e : (_f = step.category) === null || _f === void 0 ? void 0 : _f.fileCount) !== null && _g !== void 0 ? _g : 0;
    const hasFindings = findingsCount > 0;
    const findings = step.findings || [];
    const findingsTable = findings.length
        ? `<table class="results-table mt-3">
        <thead>
          <tr><th>Severity</th><th>File</th><th>Line</th><th>Description</th><th>Recommended Action</th></tr>
        </thead>
        <tbody>
          ${findings.map((f) => {
            var _a;
            return `
            <tr>
              <td><span class="severity-pill ${escapeHtml(f.severity || 'low')}">${escapeHtml(f.severity || 'low')}</span></td>
              <td><code>${escapeHtml(f.filePath ? f.filePath.split('/').pop().split('\\').pop() : '—')}</code></td>
              <td>${(_a = f.line) !== null && _a !== void 0 ? _a : '—'}</td>
              <td>${escapeHtml(f.description || f.type || '—')}</td>
              <td>${escapeHtml(f.recommendedAction || 'Review and fix manually')}</td>
            </tr>
          `;
        }).join('')}
        </tbody>
      </table>
      <div class="flex gap-2 mt-3">
        <button type="button" class="btn btn-secondary btn-sm analyze-download-step-json" data-step-id="${escapeHtml(step.id)}" title="Download raw JSON for this category">Download JSON</button>
      </div>
      ${findingsCount > findings.length ? `<p class="text-muted mt-2">+ ${findingsCount - findings.length} more finding(s) in JSON download.</p>` : ''}`
        : '';
    return `
    <details class="card mb-4">
      <summary><strong>${escapeHtml(label)}</strong> ${error ? '⚠️' : '✅'} <span class="text-muted" style="font-weight:400;">${escapeHtml(metric || 'No findings')}</span></summary>
      <div class="mt-4">
        ${error ? `<p class="text-muted" style="color: var(--warning-color, #f59e0b);">${escapeHtml(error)}</p>` : ''}
        ${hasFindings
        ? `<p class="text-muted">${formatNumber(findingsCount)} finding${findingsCount === 1 ? '' : 's'} in ${formatNumber(fileCount)} file${fileCount === 1 ? '' : 's'}</p>${findingsTable}`
        : '<p class="text-muted">No findings detected.</p>'}
      </div>
    </details>
  `;
}

/**
 * Render compliance checklist panel.
 * @param {any} checklist
 * @param {Object} options
 * @returns {any}
 */
export function renderComplianceChecklistPanel(checklist, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    const downloadId = (_a = options.downloadButtonId) !== null && _a !== void 0 ? _a : 'download-compliance-json';
    if (!checklist) {
        return '<p class="text-muted mt-4">Compliance checklist did not run.</p>';
    }
    const ruleTotal = checklistRuleTotal(checklist);
    const profileLabel = options.profileLabel
        || (((_b = checklist.summary) === null || _b === void 0 ? void 0 : _b.checklistProfile) === 'eu-ai-act' ? 'EU AI Act technical (10 rules)' : 'Corporate safety (8 rules)');
    const notHandoff = ((_c = checklist.summary) === null || _c === void 0 ? void 0 : _c.benchmarkScan) || ((_d = checklist.summary) === null || _d === void 0 ? void 0 : _d.hollowGate) || ((_e = checklist.summary) === null || _e === void 0 ? void 0 : _e.handoffEligible) === false;
    const passHandoff = options.handoffEligible === true || ((_f = checklist.summary) === null || _f === void 0 ? void 0 : _f.handoffEligible) === true;
    const legalReady = ((_g = checklist.summary) === null || _g === void 0 ? void 0 : _g.legalHandoffEligible) === true;
    const callout = notHandoff && ((_h = checklist.summary) === null || _h === void 0 ? void 0 : _h.headline)
        ? `<div class="analyze-info-callout mb-4">${escapeHtml(checklist.summary.headline)}</div>`
        : legalReady
            ? '<div class="analyze-info-callout mb-4" style="border-color: var(--color-success, #22c55e);">Technical controls pass and legal classification is signed — ready for counsel-reviewed EU handoff pack.</div>'
            : passHandoff
                ? '<div class="analyze-info-callout mb-4" style="border-color: var(--color-success, #22c55e);">Technical checklist pass for this scan profile. Legal classification sign-off still required for EU conformity handoff.</div>'
                : '';
    const exportNotes = Array.isArray(options.exportNotes) && options.exportNotes.length
        ? `<ul class="text-muted mb-3" style="font-size: var(--font-size-sm);">${options.exportNotes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`
        : '';
    return `
    <p class="text-muted mb-2" style="font-size: var(--font-size-xs);">Profile: <strong>${escapeHtml(profileLabel)}</strong> · static scan only — not legal conformity certification.</p>
    ${callout}
    ${exportNotes}
    <div class="metrics-row mb-4 mt-4">
      <div class="metric-chip gate-badge ${((_j = checklist.summary) === null || _j === void 0 ? void 0 : _j.failed) ? 'warn' : 'pass'}">
        ${(_l = (_k = checklist.summary) === null || _k === void 0 ? void 0 : _k.passed) !== null && _l !== void 0 ? _l : 0}/${ruleTotal} passed
      </div>
      <div class="metric-chip"><strong>${(_o = (_m = checklist.summary) === null || _m === void 0 ? void 0 : _m.failed) !== null && _o !== void 0 ? _o : 0}</strong> failed</div>
      ${((_p = checklist.summary) === null || _p === void 0 ? void 0 : _p.skipped) ? `<div class="metric-chip"><strong>${checklist.summary.skipped}</strong> skipped</div>` : ''}
      ${((_q = checklist.summary) === null || _q === void 0 ? void 0 : _q.readyForAutomation) === false ? '<div class="metric-chip"><strong>Not automation-ready</strong></div>' : ''}
    </div>
    <ul class="analyze-mode-steps">
      ${(checklist.rules || []).map((rule) => `
        <li><strong>${escapeHtml(rule.id)}</strong> — ${escapeHtml(rule.title || rule.name || '')}
          <span class="text-muted"> (${escapeHtml(rule.status || 'unknown')})</span></li>
      `).join('')}
    </ul>
    ${downloadId ? `<button type="button" class="btn btn-secondary btn-sm mb-4 mt-4" id="${escapeHtml(downloadId)}">Download compliance JSON</button>` : ''}
  `;
}

/**
 * Render npm audit panel.
 * @param {any} npmAudit
 * @param {Object} options
 * @returns {any}
 */
export function renderNpmAuditPanel(npmAudit, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    const downloadId = (_a = options.downloadButtonId) !== null && _a !== void 0 ? _a : 'download-npm-audit-json';
    if (!npmAudit || npmAudit.error) {
        return `<p class="text-muted mt-4">${escapeHtml((npmAudit === null || npmAudit === void 0 ? void 0 : npmAudit.error) || 'npm audit did not run.')}</p>`;
    }
    if (npmAudit.skipped) {
        return `
      <div class="analyze-info-callout mb-4">${escapeHtml(npmAudit.scopeNote || 'npm audit was not run for this scan path.')}</div>
      <p class="text-muted mb-3" style="font-size: var(--font-size-sm);">
        Scan profile: <code>${escapeHtml(npmAudit.scanTargetProfile || 'non-npm-project')}</code>
        ${npmAudit.handoffEligible === false ? ' · not valid for Simplebeacon platform handoff' : ''}
      </p>
      ${downloadId ? `<button type="button" class="btn btn-secondary btn-sm mb-4" id="${escapeHtml(downloadId)}">Download npm audit JSON</button>` : ''}
    `;
    }
    const auditRootNote = npmAudit.auditRoot && npmAudit.projectPath
        && normalizePathKey(npmAudit.auditRoot) !== normalizePathKey(npmAudit.projectPath)
        ? `<p class="text-muted mb-3" style="font-size: var(--font-size-sm);">
        Audited <code>${escapeHtml(formatPathInputValue(npmAudit.auditRoot))}</code>
        (Node platform root for scan path <code>${escapeHtml(formatPathInputValue(npmAudit.projectPath))}</code>).
      </p>`
        : npmAudit.auditRoot
            ? `<p class="text-muted mb-3" style="font-size: var(--font-size-sm);">
          Audited <code>${escapeHtml(redactPathForDisplay(npmAudit.auditRoot))}</code>.
        </p>`
            : '';
    const supplyStatus = npmAudit.supplyChainStatus
        || (((_b = npmAudit.summary) === null || _b === void 0 ? void 0 : _b.critical) === 0 && ((_c = npmAudit.summary) === null || _c === void 0 ? void 0 : _c.high) === 0 ? 'pass' : 'review');
    const passCallout = supplyStatus === 'pass'
        ? `<div class="analyze-info-callout mb-4" style="border-color: var(--color-success, #22c55e);">
        Supply chain: <strong>pass</strong> — 0 critical and 0 high npm audit findings.
        ${npmAudit.handoffEligible ? ' Eligible for platform handoff supply-chain rules.' : ''}
      </div>`
        : '';
    const exportNotes = Array.isArray(npmAudit.exportNotes) && npmAudit.exportNotes.length
        ? `<ul class="text-muted mb-3" style="font-size: var(--font-size-sm);">
        ${npmAudit.exportNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}
      </ul>`
        : '';
    return `
    ${passCallout}
    ${auditRootNote}
    ${exportNotes}
    <div class="metrics-row mb-4 mt-4">
      <div class="metric-chip"><strong>${(_g = (_e = (_d = npmAudit.summary) === null || _d === void 0 ? void 0 : _d.dependencies) !== null && _e !== void 0 ? _e : (_f = npmAudit.dependencies) === null || _f === void 0 ? void 0 : _f.total) !== null && _g !== void 0 ? _g : '—'}</strong> dependencies</div>
      <div class="metric-chip"><strong>${(_k = (_j = (_h = npmAudit.summary) === null || _h === void 0 ? void 0 : _h.total) !== null && _j !== void 0 ? _j : npmAudit.vulnerabilityTotal) !== null && _k !== void 0 ? _k : 0}</strong> vulnerabilities</div>
      ${((_l = npmAudit.summary) === null || _l === void 0 ? void 0 : _l.critical) != null ? `<div class="metric-chip"><strong>${npmAudit.summary.critical}</strong> critical</div>` : ''}
      ${((_m = npmAudit.summary) === null || _m === void 0 ? void 0 : _m.high) != null ? `<div class="metric-chip"><strong>${npmAudit.summary.high}</strong> high</div>` : ''}
      ${((_o = npmAudit.summary) === null || _o === void 0 ? void 0 : _o.moderate) != null ? `<div class="metric-chip"><strong>${npmAudit.summary.moderate}</strong> moderate</div>` : ''}
    </div>
    ${downloadId ? `<button type="button" class="btn btn-secondary btn-sm mb-4" id="${escapeHtml(downloadId)}">Download npm audit JSON</button>` : ''}
  `;
}

/**
 * Render eu ai act sprint panel.
 * @param {any} sprint
 * @param {Object} options
 * @returns {any}
 */
export function renderEuAiActSprintPanel(sprint, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z;
    if (!sprint) {
        return '<p class="text-muted mt-4">EU AI Act sprint did not run.</p>';
    }
    const s = sprint;
    const failedRules = ((_a = s.compliance) === null || _a === void 0 ? void 0 : _a.failedRules) || [];
    const failedRulesHtml = failedRules.length
        ? `<ul class="analyze-mode-steps mb-4">${failedRules.map((rule) => `
        <li><strong>${escapeHtml(rule.id)}</strong> — ${escapeHtml(rule.title || '')}
          <span class="text-muted"> (${escapeHtml(rule.evidence || '')})</span></li>
      `).join('')}</ul>`
        : '';
    const downloadId = (_b = options.downloadButtonId) !== null && _b !== void 0 ? _b : 'download-eu-compliance-json';
    const showIntro = options.showIntro !== false;
    const showActions = options.showActions !== false;
    // Categorize rules by EU AI Act article
    const rules = ((_c = s.complianceChecklist) === null || _c === void 0 ? void 0 : _c.rules) || ((_d = s.compliance) === null || _d === void 0 ? void 0 : _d.rules) || [];
    const art5Rules = rules.filter(r => /ART-5|prohibited|banned|subliminal|manipulation|social scoring|biometric.*mass/i.test((r.id || '') + ' ' + (r.title || '')));
    const art50Rules = rules.filter(r => /T50|transparency|disclosure|article.*50/i.test((r.id || '') + ' ' + (r.title || '')));
    const otherRules = rules.filter(r => !art5Rules.includes(r) && !art50Rules.includes(r));
    const art5Status = art5Rules.length ? (art5Rules.every(r => r.status === 'pass') ? 'pass' : 'warn') : 'pass';
    const art50Status = art50Rules.length ? (art50Rules.every(r => r.status === 'pass') ? 'pass' : 'warn') : 'info';
    const highRiskStatus = ((_e = s.summary) === null || _e === void 0 ? void 0 : _e.highRiskIndicators) > 0 ? 'warn' : 'pass';
    const aiSystemStatus = ((_f = s.summary) === null || _f === void 0 ? void 0 : _f.aiSystemIndicators) > 0 ? 'info' : 'pass';
    /**
     * Render article card.
     * @param {any} title
     * @param {any} article
     * @param {Array} status
     * @param {any} rulesList
     * @param {any} description
     * @returns {any}
     */
    const renderArticleCard = (title, article, status, rulesList, description) => {
        const badgeClass = status === 'pass' ? 'pass' : status === 'warn' ? 'warn' : 'info';
        const badgeText = status === 'pass' ? 'PASS' : status === 'warn' ? 'WARN' : 'INFO';
        return `
      <div class="card mb-3" style="border-left: 4px solid var(--${badgeClass === 'pass' ? 'color-success' : badgeClass === 'warn' ? 'warning-color' : 'accent-color'}, ${badgeClass === 'pass' ? '#22c55e' : badgeClass === 'warn' ? '#f59e0b' : '#3b82f6'});">
        <div style="padding: 16px 20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <h4 style="margin:0;font-size:0.95rem;font-weight:600;">${escapeHtml(title)}</h4>
            <span class="metric-chip gate-badge ${badgeClass}" style="font-size:0.75rem;">${badgeText}</span>
          </div>
          <p style="margin:0 0 8px;font-size:0.8rem;color:var(--text-muted);">${escapeHtml(article)}</p>
          ${description ? `<p style="margin:0 0 12px;font-size:0.8rem;color:var(--text-muted);">${escapeHtml(description)}</p>` : ''}
          ${rulesList.length ? `
            <ul style="margin:0;padding-left:18px;font-size:0.8rem;color:var(--text-muted);">
              ${rulesList.map(r => `<li><strong>${escapeHtml(r.id)}</strong> — ${escapeHtml(r.title || '')} <span style="color:${r.status === 'pass' ? 'var(--color-success,#22c55e)' : 'var(--warning-color,#f59e0b)'};">(${escapeHtml(r.status || 'unknown')})</span></li>`).join('')}
            </ul>
          ` : `<p style="margin:0;font-size:0.8rem;color:var(--text-muted);">No specific rules triggered.</p>`}
        </div>
      </div>
    `;
    };
    return `
    ${showIntro ? `<p class="text-muted mb-3" style="font-size: var(--font-size-sm);">
      <strong>Reference scan</strong> — not an active paid SKU. EU pattern hits flag AI integrations (usually MEDIUM warnings).
      Gate FAIL means ${(_h = (_g = s.gate) === null || _g === void 0 ? void 0 : _g.blockingCount) !== null && _h !== void 0 ? _h : '—'} HIGH-severity blocking issue(s) under <code>failOn: high</code>.
    </p>` : ''}

    <div class="metrics-row mb-4">
      <div class="metric-chip gate-badge ${((_j = s.gate) === null || _j === void 0 ? void 0 : _j.pass) ? 'pass' : 'warn'}">${((_k = s.gate) === null || _k === void 0 ? void 0 : _k.pass) ? 'PASS' : 'FAIL'}</div>
      <div class="metric-chip"><strong>${(_m = (_l = s.gate) === null || _l === void 0 ? void 0 : _l.blockingCount) !== null && _m !== void 0 ? _m : '—'}</strong> blocking (high)</div>
      <div class="metric-chip"><strong>${(_q = (_p = (_o = s.gate) === null || _o === void 0 ? void 0 : _o.warningCount) !== null && _p !== void 0 ? _p : s.euPatternHits) !== null && _q !== void 0 ? _q : '—'}</strong> warnings (medium)</div>
      <div class="metric-chip"><strong>${(_s = (_r = s.compliance) === null || _r === void 0 ? void 0 : _r.passed) !== null && _s !== void 0 ? _s : 0}/${(_u = (_t = s.compliance) === null || _t === void 0 ? void 0 : _t.total) !== null && _u !== void 0 ? _u : 0}</strong> checklist</div>
      <div class="metric-chip"><strong>${(_w = (_v = s.compliance) === null || _v === void 0 ? void 0 : _v.score) !== null && _w !== void 0 ? _w : '—'}%</strong> readiness</div>
      ${s.scannedAt || s.timestamp ? `<div class="metric-chip" style="font-size:0.75rem;color:var(--text-muted);">Scanned: ${escapeHtml(new Date(s.scannedAt || s.timestamp).toLocaleString())}</div>` : ''}
    </div>

    ${renderArticleCard('Prohibited AI Practices', 'Article 5 — Subliminal manipulation, social scoring, biometric mass surveillance', art5Status, art5Rules, art5Status === 'pass' ? 'No prohibited practices detected.' : 'Review required: potential high-risk indicators found.')}

    ${renderArticleCard('Transparency Obligations', 'Article 50 — AI disclosure to users, content labeling, system documentation', art50Status, art50Rules, 'Ensure AI-generated content is disclosed to end users.')}

    ${renderArticleCard('High-Risk System Indicators', 'Annex III — Employment, credit, biometric, education, insurance, law enforcement', highRiskStatus, [], ((_x = s.summary) === null || _x === void 0 ? void 0 : _x.highRiskIndicators) > 0 ? `${s.summary.highRiskIndicators} high-risk pattern(s) detected.` : 'No Annex III high-risk patterns detected.')}

    ${renderArticleCard('AI System Detection', 'System inventory — LLM integrations, model inference, generative AI usage', aiSystemStatus, [], ((_y = s.summary) === null || _y === void 0 ? void 0 : _y.aiSystemIndicators) > 0 ? `${s.summary.aiSystemIndicators} AI system(s) detected in codebase.` : 'No AI systems detected.')}

    ${((_z = s.compliance) === null || _z === void 0 ? void 0 : _z.headline) ? `<p class="text-muted mb-3" style="font-size: var(--font-size-sm);">${escapeHtml(s.compliance.headline)}</p>` : ''}
    ${s.complianceChecklist ? renderComplianceChecklistPanel(s.complianceChecklist, {
        downloadButtonId: downloadId,
        profileLabel: 'EU AI Act technical + legal (10 rules)'
    }) : ''}
    ${!s.complianceChecklist && failedRules.length ? `<h3 class="mb-2" style="font-size: var(--font-size-base);">Failed checklist rules</h3>${failedRulesHtml}` : ''}
    ${s.relativeArtifacts ? `
      <h3 class="mb-2" style="font-size: var(--font-size-base);">Artifacts</h3>
      <ul class="analyze-mode-steps mb-4">
        ${Object.entries(s.relativeArtifacts).map(([key, rel]) => `<li><strong>${escapeHtml(key)}</strong> — <code>${escapeHtml(rel)}</code></li>`).join('')}
      </ul>
    ` : ''}
    <p class="text-muted mb-4" style="font-size: var(--font-size-sm);">${escapeHtml(s.disclaimer || 'Static technical readiness — not legal conformity certification.')}</p>
    ${showActions ? `
      <div class="analyze-action-row mb-4">
        <a class="btn btn-primary btn-sm" href="/dashboard/eu-ai-act">Open EU AI Act results</a>
        <button type="button" class="btn btn-accent btn-sm" id="download-eu-ai-act-pdf">Download EU PDF</button>
        <a class="btn btn-secondary btn-sm" href="/eu-ai-act-sample-report" target="_blank" rel="noopener">Sample report layout</a>
        <a class="btn btn-ghost btn-sm" href="/dashboard/results">Gate blocking issues</a>
      </div>
    ` : `
      <div class="analyze-action-row mb-4">
        <button type="button" class="btn btn-accent btn-sm" id="download-eu-ai-act-pdf">Download EU PDF</button>
        <a class="btn btn-ghost btn-sm" href="/dashboard/eu-ai-act">Open EU AI Act page</a>
      </div>
    `}
  `;
}
