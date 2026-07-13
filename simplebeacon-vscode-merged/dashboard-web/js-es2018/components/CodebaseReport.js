import { escapeHtml } from '../utils/string.js';
import { formatNumber } from '../utils/number.js';
/**
 * Severity class.
 * @param {any} severity
 * @returns {any}
 */
function severityClass(severity) {
    if (severity === 'critical')
        return 'warn';
    if (severity === 'high')
        return 'warn';
    if (severity === 'medium')
        return 'warn';
    return '';
}
/**
 * Render codebase panel.
 * @param {Object} options
 * @param {any} loading
 * @param {any} error }
 * @returns {any}
 */
export function renderCodebasePanel({ scan, loading, error } = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
    if (loading) {
        return '<p class="text-muted"><span class="loading-spinner"></span> Analyzing codebase…</p>';
    }
    if (error) {
        return `<p class="text-danger">${escapeHtml(error)}</p>`;
    }
    // Normalize flat API responses (extension data-server stubs) into the nested shape this renderer expects
    if (scan && !scan.summary && (Array.isArray(scan.findings) || scan.severityCounts || scan.qualityScore != null)) {
        scan = {
            ...scan,
            summary: {
                repositoryFilesTotal: scan.fileCount || scan.totalFiles || 0,
                codeFilesAnalyzed: scan.filesAnalyzed || 0,
                healthScore: scan.qualityScore ?? 100,
                findingsTotal: (scan.findings || []).length,
                severityCounts: scan.severityCounts || {},
                eslintErrors: 0,
                eslintWarnings: 0
            }
        };
    }
    if (!(scan === null || scan === void 0 ? void 0 : scan.summary)) {
        return '<p class="text-muted card">No codebase analysis yet — run the scan to find technical debt, broken files, and placeholder data.</p>';
    }
    const s = scan.summary;
    const categories = (scan.categories || []).slice(0, 8);
    const findings = (scan.findings || []).slice(0, 12);
    const analyzerCounts = s.analyzerCounts || {};
    const eslintSummary = scan.eslintSummary || {};
    const rubric = scan.rubric || {};
    return `
    <div class="metrics-row mb-4">
      <div class="metric-chip" title="Audit-scoped repository inventory">
        <strong>${formatNumber((_a = s.repositoryFilesTotal) !== null && _a !== void 0 ? _a : (_b = scan.repositoryInventory) === null || _b === void 0 ? void 0 : _b.totalFiles)}</strong> repo files
      </div>
      <div class="metric-chip" title="Source-like files content-scanned">
        <strong>${formatNumber(s.codeFilesAnalyzed)}</strong> code files analyzed
      </div>
      <div class="metric-chip" title="0–100 health score (lower = more findings)">
        <strong>${(_c = s.healthScore) !== null && _c !== void 0 ? _c : '—'}%</strong> health
      </div>
      <div class="metric-chip"><strong>${formatNumber(s.findingsTotal)}</strong> findings</div>
      <div class="metric-chip gate-badge ${((_e = (_d = s.severityCounts) === null || _d === void 0 ? void 0 : _d.critical) !== null && _e !== void 0 ? _e : 0) === 0 ? 'pass' : 'warn'}">
        <strong>${(_g = (_f = s.severityCounts) === null || _f === void 0 ? void 0 : _f.critical) !== null && _g !== void 0 ? _g : 0}</strong> critical
      </div>
      <div class="metric-chip gate-badge ${((_j = (_h = s.severityCounts) === null || _h === void 0 ? void 0 : _h.high) !== null && _j !== void 0 ? _j : 0) === 0 ? 'pass' : 'warn'}">
        <strong>${(_l = (_k = s.severityCounts) === null || _k === void 0 ? void 0 : _k.high) !== null && _l !== void 0 ? _l : 0}</strong> high
      </div>
      <div class="metric-chip"><strong>${(_m = s.eslintErrors) !== null && _m !== void 0 ? _m : 0}</strong> eslint errors</div>
      <div class="metric-chip"><strong>${(_o = s.eslintWarnings) !== null && _o !== void 0 ? _o : 0}</strong> eslint warnings</div>
      <div class="metric-chip"><strong>${(_p = analyzerCounts.debugArtifacts) !== null && _p !== void 0 ? _p : 0}</strong> debug artifacts</div>
      <div class="metric-chip"><strong>${(_q = analyzerCounts.placeholderOrFictionalData) !== null && _q !== void 0 ? _q : 0}</strong> placeholder/fiction hits</div>
      ${((_r = scan.scanScope) === null || _r === void 0 ? void 0 : _r.scanProfile) ? `
        <div class="metric-chip" title="Extension profile for this scan">
          <strong>${escapeHtml(scan.scanScope.scanProfile)}</strong> profile
        </div>
      ` : ''}
      ${((_s = scan.codeUnderstanding) === null || _s === void 0 ? void 0 : _s.mode) && scan.codeUnderstanding.mode !== 'off' ? `
        <div class="metric-chip" title="Semantic/context understanding layer">
          <strong>${escapeHtml(scan.codeUnderstanding.mode)}</strong> understanding
        </div>
      ` : ''}
      ${((_u = (_t = scan.structureInsights) === null || _t === void 0 ? void 0 : _t.summary) === null || _u === void 0 ? void 0 : _u.sampledFiles) ? `
        <div class="metric-chip" title="Tier-1 structure hints from language plugins">
          <strong>${formatNumber(scan.structureInsights.summary.sampledFiles)}</strong> structure samples
        </div>
      ` : ''}
      ${((_v = scan.scanScope) === null || _v === void 0 ? void 0 : _v.universalLanguageCount) ? `
        <div class="metric-chip" title="Registered language analyzer plugins">
          <strong>${formatNumber(scan.scanScope.universalLanguageCount)}</strong> language plugins
        </div>
      ` : ''}
    </div>
    ${(rubric === null || rubric === void 0 ? void 0 : rubric.severityBands) ? `
      <div class="card mb-4">
        <p class="text-muted mb-2" style="font-size: var(--font-size-xs); margin-top: 0;">Severity rubric</p>
        <p class="text-muted" style="font-size: var(--font-size-sm); margin: 0;">
          <strong>High</strong>: ${escapeHtml(rubric.severityBands.high)} ·
          <strong>Medium</strong>: ${escapeHtml(rubric.severityBands.medium)} ·
          <strong>Low</strong>: ${escapeHtml(rubric.severityBands.low)}
        </p>
      </div>
    ` : ''}
    ${(eslintSummary === null || eslintSummary === void 0 ? void 0 : eslintSummary.totalIssues) ? `
      <div class="card mb-4">
        <p class="text-muted mb-2" style="font-size: var(--font-size-xs); margin-top: 0;">
          ESLint integration ${eslintSummary.source === 'artifact' ? '(report artifact)' : '(live command)'}
        </p>
        <div class="metrics-row mb-2">
          <div class="metric-chip"><strong>${formatNumber(eslintSummary.totalIssues)}</strong> total eslint issues</div>
          <div class="metric-chip"><strong>${formatNumber(eslintSummary.filesWithIssues)}</strong> files with issues</div>
        </div>
        ${((_w = eslintSummary.categorizedWarnings) === null || _w === void 0 ? void 0 : _w.length) ? `
          <p class="text-muted" style="font-size: var(--font-size-sm); margin: 0;">
            Categories: ${eslintSummary.categorizedWarnings.slice(0, 5).map((c) => `${escapeHtml(c.category)} (${c.count})`).join(' · ')}
          </p>
        ` : ''}
      </div>
    ` : ''}
    ${((_x = scan.scanScope) === null || _x === void 0 ? void 0 : _x.description) ? `
      <p class="text-muted mb-4" style="font-size: var(--font-size-xs);">
        ${escapeHtml(scan.scanScope.description)}
      </p>
    ` : ''}
    ${categories.length ? `
      <h3 class="mb-2" style="font-size: var(--font-size-base);">Finding categories</h3>
      <div class="consolidation-list mb-4">
        ${categories.map((cat) => {
        var _a;
        return `
          <div class="consolidation-card card">
            <div class="consolidation-meta">${escapeHtml(cat.label || cat.category)} · ${cat.count} hit(s) · ${cat.fileCount} file(s)</div>
            <p class="text-muted" style="font-size: var(--font-size-sm); margin: 0;">
              ${((_a = cat.topFiles) === null || _a === void 0 ? void 0 : _a.length) ? cat.topFiles.map((f) => `<code>${escapeHtml(f)}</code>`).join(', ') : '—'}
            </p>
          </div>
        `;
    }).join('')}
      </div>
    ` : ''}
    ${findings.length ? `
      <h3 class="mb-2" style="font-size: var(--font-size-base);">Top findings</h3>
      <div class="consolidation-list">
        ${findings.map((item) => `
          <div class="consolidation-card card">
            <div class="consolidation-meta">
              <span class="gate-badge ${severityClass(item.severity)}">${escapeHtml(item.severity || '—')}</span>
              ${escapeHtml(item.category || item.type || 'finding')}
              ${item.line ? ` · line ${item.line}` : ''}
            </div>
            <p><code>${escapeHtml(item.filePath || '—')}</code></p>
            <p class="text-muted" style="font-size: var(--font-size-sm);">${escapeHtml(item.description || '')}</p>
            ${item.recommendedAction ? `<p class="text-muted" style="font-size: var(--font-size-xs);">${escapeHtml(item.recommendedAction)}</p>` : ''}
          </div>
        `).join('')}
      </div>
    ` : `
      <p class="text-muted card">No significant issues found in analyzed code files.</p>
    `}
    ${((_z = (_y = scan.structureInsights) === null || _y === void 0 ? void 0 : _y.samples) === null || _z === void 0 ? void 0 : _z.length) ? `
      <div class="card mb-4">
        <h3 class="section-title">Structure hints (Tier-1)</h3>
        <p class="text-muted" style="font-size: var(--font-size-sm);">
          Regex-based estimates from language plugins — ${formatNumber((_0 = scan.structureInsights.summary) === null || _0 === void 0 ? void 0 : _0.sampledFiles)} file(s) sampled.
        </p>
        <div class="consolidation-list">
          ${scan.structureInsights.samples.slice(0, 6).map((item) => `
            <div class="consolidation-item">
              <div class="consolidation-meta">
                <span class="gate-badge pass">${escapeHtml(item.language || 'generic')}</span>
                ${escapeHtml(item.complexity || 'low')} complexity
                · ${formatNumber(item.approximateFunctions)} fn · ${formatNumber(item.approximateClasses)} types
              </div>
              <p><code>${escapeHtml(item.filePath || '—')}</code></p>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}
/**
 * Build codebase conclusion.
 * @param {any} scan
 * @returns {any}
 */
export function buildCodebaseConclusion(scan) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    if (scan && !scan.summary && (Array.isArray(scan.findings) || scan.severityCounts || scan.qualityScore != null)) {
        scan = {
            ...scan,
            summary: {
                repositoryFilesTotal: scan.fileCount || scan.totalFiles || 0,
                codeFilesAnalyzed: scan.filesAnalyzed || 0,
                healthScore: scan.qualityScore ?? 100,
                findingsTotal: (scan.findings || []).length,
                severityCounts: scan.severityCounts || {},
                eslintErrors: 0,
                eslintWarnings: 0
            }
        };
    }
    if (!(scan === null || scan === void 0 ? void 0 : scan.summary))
        return 'No codebase analysis available.';
    const s = scan.summary;
    const critical = (_b = (_a = s.severityCounts) === null || _a === void 0 ? void 0 : _a.critical) !== null && _b !== void 0 ? _b : 0;
    const high = (_d = (_c = s.severityCounts) === null || _c === void 0 ? void 0 : _c.high) !== null && _d !== void 0 ? _d : 0;
    const medium = (_f = (_e = s.severityCounts) === null || _e === void 0 ? void 0 : _e.medium) !== null && _f !== void 0 ? _f : 0;
    const low = (_h = (_g = s.severityCounts) === null || _g === void 0 ? void 0 : _g.low) !== null && _h !== void 0 ? _h : 0;
    const repo = (_j = s.repositoryFilesTotal) !== null && _j !== void 0 ? _j : (_k = scan.repositoryInventory) === null || _k === void 0 ? void 0 : _k.totalFiles;
    const repoNote = repo != null
        ? ` Repository inventory: ${Number(repo).toLocaleString()} files; ${Number((_l = s.codeFilesAnalyzed) !== null && _l !== void 0 ? _l : 0).toLocaleString()} code files content-scanned.`
        : '';
    if (!s.findingsTotal) {
        return `No codebase issues detected in ${(_m = s.codeFilesAnalyzed) !== null && _m !== void 0 ? _m : 0} analyzed files.${repoNote} Health score: ${(_o = s.healthScore) !== null && _o !== void 0 ? _o : 100}%.`;
    }
    return `${s.findingsTotal} finding(s) — ${critical} critical, ${high} high, ${medium} medium, ${low} low.${repoNote} Health score: ${(_p = s.healthScore) !== null && _p !== void 0 ? _p : '—'}%. ESLint: ${(_q = s.eslintErrors) !== null && _q !== void 0 ? _q : 0} errors, ${(_r = s.eslintWarnings) !== null && _r !== void 0 ? _r : 0} warnings.`;
}
