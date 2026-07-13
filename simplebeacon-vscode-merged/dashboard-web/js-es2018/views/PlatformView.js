import { escapeHtml } from '../utils/string.js';
import { showToast } from '../utils/dom.js';
import { resolveJestTestsLabel, resolvePageSpecsLabel, hydrateDashboardHome } from '../services/analyzeService.js';
/**
 * Format percent.
 * @param {any} value
 * @returns {any}
 */
function formatPercent(value) {
    if (value == null || value === '')
        return '—';
    const str = String(value).trim();
    if (str.endsWith('%'))
        return str;
    const num = Number(str);
    if (Number.isFinite(num))
        return `${num}%`;
    return str;
}
/**
 * Parse numeric.
 * @param {any} value
 * @returns {any}
 */
function parseNumeric(value) {
    if (value == null)
        return null;
    const match = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
}
/**
 * Format signed delta.
 * @param {any} delta
 * @param {any} unit
 * @returns {any}
 */
function formatSignedDelta(delta, unit = '') {
    if (!Number.isFinite(delta))
        return '—';
    const sign = delta > 0 ? '+' : delta < 0 ? '' : '';
    const suffix = unit ? ` ${unit}` : '';
    return `${sign}${delta}${suffix}`;
}
/**
 * Build platform metrics.
 * @param {any} home
 * @param {number} report
 * @param {any} baseline
 * @returns {any}
 */
function buildPlatformMetrics(home, report, baseline) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const overview = (home === null || home === void 0 ? void 0 : home.overview) || {};
    return {
        mockScanFiles: (_b = (_a = report === null || report === void 0 ? void 0 : report.mockSampleFiles) !== null && _a !== void 0 ? _a : report === null || report === void 0 ? void 0 : report.totalFiles) !== null && _b !== void 0 ? _b : overview.totalFiles,
        qualityScore: (_c = report === null || report === void 0 ? void 0 : report.qualityScore) !== null && _c !== void 0 ? _c : parseNumeric(overview.codeQuality),
        schemaPassRate: (_d = report === null || report === void 0 ? void 0 : report.schemaCompliance) !== null && _d !== void 0 ? _d : overview.schemaPassRate,
        scannerIssues: (_e = report === null || report === void 0 ? void 0 : report.issueCount) !== null && _e !== void 0 ? _e : overview.scannerIssues,
        securityScore: (_f = overview.securityScore) !== null && _f !== void 0 ? _f : '80/100',
        jestTests: resolveJestTestsLabel(baseline, home, report),
        pageSamples: (_g = resolvePageSpecsLabel(report, baseline)) !== null && _g !== void 0 ? _g : overview.pageSamplesLabel,
        sampleJsonFiles: (_j = (_h = report === null || report === void 0 ? void 0 : report.mockSampleFiles) !== null && _h !== void 0 ? _h : report === null || report === void 0 ? void 0 : report.totalFiles) !== null && _j !== void 0 ? _j : overview.sampleJsonFiles
    };
}
/**
 * Build comparative rows.
 * @param {any} home
 * @param {Array} metrics
 * @returns {any}
 */
function buildComparativeRows(home, metrics) {
    var _a, _b;
    const staticRows = (home === null || home === void 0 ? void 0 : home.comparativeAnalysis) || [];
    const liveByMetric = {
        'jest tests': {
            current: (_b = parseNumeric((_a = metrics.jestTests) === null || _a === void 0 ? void 0 : _a.split('/')[0])) !== null && _b !== void 0 ? _b : parseNumeric(metrics.jestTests),
            format: (v) => (v == null ? '—' : String(v)),
            key: 'jestTests',
            type: 'count'
        },
        'sample json files': {
            current: metrics.sampleJsonFiles,
            format: (v) => (v == null ? '—' : String(v)),
            key: 'sampleJsonFiles',
            type: 'count'
        },
        'mock / sample files': {
            current: metrics.mockScanFiles,
            format: (v) => (v == null ? '—' : String(v)),
            key: 'mockSampleFiles',
            type: 'count'
        },
        'schema pass rate': {
            current: metrics.schemaPassRate,
            format: (v) => (v == null ? '—' : `${v}%`),
            key: 'schemaPass',
            type: 'percentage'
        },
        'security posture': {
            current: metrics.securityScore,
            format: (v) => (v == null ? '—' : String(v)),
            key: 'securityPosture',
            type: 'count'
        }
    };
    const lowerBadMetrics = ['jestTests', 'schemaPass', 'securityPosture'];
    return staticRows.map((row) => {
        const rowKey = String(row.metric || '').toLowerCase();
        const live = liveByMetric[rowKey];
        const previous = row.previous;
        const current = (live === null || live === void 0 ? void 0 : live.current) != null ? live.format(live.current) : row.current;
        const prevNum = parseNumeric(previous);
        const curNum = (live === null || live === void 0 ? void 0 : live.current) != null ? live.current : parseNumeric(current);
        let change = row.change;
        if (prevNum != null && curNum != null && prevNum !== curNum) {
            const unitMatch = String(row.change || '').match(/\s([a-z]+)$/i);
            const unit = (unitMatch === null || unitMatch === void 0 ? void 0 : unitMatch[1]) || '';
            if (String(row.metric).toLowerCase().includes('rate') || String(previous).includes('%')) {
                change = formatSignedDelta(curNum - prevNum, '%');
            }
            else if (String(row.metric).toLowerCase().includes('security')) {
                change = formatSignedDelta(curNum - prevNum, 'pts');
            }
            else {
                change = formatSignedDelta(curNum - prevNum, unit);
            }
        }
        const metricKey = (live === null || live === void 0 ? void 0 : live.key) || rowKey.replace(/\s+/g, '-');
        const metricType = (live === null || live === void 0 ? void 0 : live.type) || 'count';
        const delta = (curNum !== null && curNum !== void 0 ? curNum : 0) - (prevNum !== null && prevNum !== void 0 ? prevNum : 0);
        const isLowerBad = lowerBadMetrics.includes(metricKey);
        const isRegression = delta !== 0 && (isLowerBad ? delta < 0 : delta > 0);
        // Build a minimal history for the sparkline (prev -> current)
        const history = [prevNum !== null && prevNum !== void 0 ? prevNum : 0, curNum !== null && curNum !== void 0 ? curNum : 0];
        return { ...row, current, change, key: metricKey, type: metricType, delta, isRegression, history };
    });
}
/**
 * Platform view.
 */
export class PlatformView {
    constructor(app) {
        this.app = app;
    }
    extractTimestamp(source) {
        var _a;
        if (!source)
            return null;
        const rawDate = source.generatedAt || source.lastScanTime || source.timestamp || ((_a = source.meta) === null || _a === void 0 ? void 0 : _a.timestamp) || source.scannedAt;
        if (!rawDate)
            return null;
        const parsed = new Date(rawDate);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    checkBaselineFreshness() {
        var _a, _b, _c, _d, _e, _f;
        const liveScanTime = this.extractTimestamp((_b = (_a = this.app) === null || _a === void 0 ? void 0 : _a.state) === null || _b === void 0 ? void 0 : _b.report);
        const baselineTime = this.extractTimestamp(((_d = (_c = this.app) === null || _c === void 0 ? void 0 : _c.state) === null || _d === void 0 ? void 0 : _d.baseline) || ((_f = (_e = this.app) === null || _e === void 0 ? void 0 : _e.state) === null || _f === void 0 ? void 0 : _f.dashboardHome));
        if (!liveScanTime || !baselineTime)
            return;
        const deltaMs = Math.abs(liveScanTime.getTime() - baselineTime.getTime());
        const deltaHours = deltaMs / (1000 * 60 * 60);
        const STALE_THRESHOLD_HOURS = 24;
        if (deltaHours > STALE_THRESHOLD_HOURS) {
            const daysPast = Math.floor(deltaHours / 24);
            const displayTime = daysPast > 0 ? `${daysPast} day${daysPast > 1 ? 's' : ''}` : `${Math.round(deltaHours)} hours`;
            this.renderFreshnessBanner(displayTime);
        }
    }
    renderFreshnessBanner(outOfSyncDuration) {
        if (document.getElementById('sb-platform-freshness-banner'))
            return;
        const targetHeader = document.querySelector('.platform-redesign');
        if (!targetHeader)
            return;
        const banner = document.createElement('div');
        banner.id = 'sb-platform-freshness-banner';
        banner.className = 'platform-alert-banner animation-slide-down';
        banner.innerHTML = `
      <div class="banner-body-message">
        <i data-lucide="alert-triangle" class="icon-18 warning-pulse-icon"></i>
        <p>
          <strong>Baseline Desynchronization Alert:</strong> Your engineering metrics are approximately
          <span class="stale-highlight-text">${escapeHtml(outOfSyncDuration)}</span> out of sync with your live workspace repository state.
        </p>
      </div>
      <div class="banner-controls-group">
        <button type="button" class="btn btn-warning btn-sm banner-action-btn sync-baseline-trigger" id="sb-trigger-sync-baseline-btn">
          <i data-lucide="refresh-cw" class="icon-14"></i> Reconcile Baseline
        </button>
        <button type="button" class="banner-close-icon-btn" aria-label="Dismiss alert" id="sb-dismiss-freshness-banner-btn">×</button>
      </div>
    `;
        targetHeader.insertAdjacentElement('afterbegin', banner);
    }
    renderScanPathTrackerTemplate() {
        return `
      <div class="platform-card scan-path-tracker-card">
        <div class="panel-header">
          <div class="panel-title-group">
            <i data-lucide="folder-open" class="icon-18"></i>
            <h3 style="margin:0;font-size:var(--font-size-base);">Interactive Scan Path Tracing</h3>
          </div>
          <span class="panel-subtitle">Visualizing directory file density and repository coverage distribution</span>
        </div>
        <div class="path-tracker-workspace-grid">
          <div class="path-visualizer-canvas-pane">
            <div id="path-tracing-chart-container"></div>
          </div>
          <div class="path-inspector-details-pane">
            <div class="inspector-card-shell" id="path-inspector-live-card">
              <div class="empty-inspector-state">
                <i data-lucide="info" class="icon-18"></i>
                <p>Hover over or click a directory block in the map to audit specific file volumes and path boundaries.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    }
    initPathTracingChart(pathsData) {
        const normalizedData = (pathsData && pathsData.length) ? pathsData : this.normalizeScanPaths();
        const container = document.getElementById('path-tracing-chart-container');
        if (!container)
            return;
        if (!normalizedData || normalizedData.length === 0) {
            container.innerHTML = `<div class="chart-empty-state">No configured scan paths resolved for this workspace profile.</div>`;
            return;
        }
        this.renderProportionalTreeGrid(normalizedData);
        this.bindPathInspectorEvents(normalizedData);
    }
    normalizeScanPaths() {
        var _a, _b, _c, _d, _e;
        const report = ((_b = (_a = this.app) === null || _a === void 0 ? void 0 : _a.state) === null || _b === void 0 ? void 0 : _b.report) || {};
        const categories = report.mockDataCategories || [];
        const scanPaths = report.scanPaths || ((_e = (_d = (_c = this.app) === null || _c === void 0 ? void 0 : _c.state) === null || _d === void 0 ? void 0 : _d.config) === null || _e === void 0 ? void 0 : _e.scanPaths) || [];
        if (categories.length) {
            return categories.map((c) => ({
                path: c.category || 'unknown',
                files: c.fileCount || 0,
                size: c.totalSize || '—'
            }));
        }
        const totalFiles = report.totalFiles || report.mockSampleFiles || scanPaths.length || 1;
        const baseCount = Math.floor(totalFiles / scanPaths.length) || 1;
        return scanPaths.map((p, idx) => ({
            path: typeof p === 'string' ? p : String(p),
            files: baseCount + (idx < (totalFiles % scanPaths.length) ? 1 : 0),
            size: '—'
        }));
    }
    renderProportionalTreeGrid(data) {
        const container = document.getElementById('path-tracing-chart-container');
        if (!container)
            return;
        const sortedPaths = [...data].sort((a, b) => b.files - a.files);
        const totalFiles = sortedPaths.reduce((acc, item) => acc + item.files, 0);
        const htmlGridBlocks = sortedPaths.map((item, index) => {
            const proportionalWeight = totalFiles > 0 ? ((item.files / totalFiles) * 100).toFixed(1) : 0;
            const opacityTier = Math.max(0.1, 0.4 - (index * 0.05));
            const cleanPath = (item.path || '').replace(/^\/+|\/+$/g, '');
            return `
        <div class="trace-tree-block" data-index="${index}" style="flex-grow: ${item.files}; flex-basis: ${proportionalWeight}%;">
          <div class="block-inner-content">
            <span class="block-folder-name">${escapeHtml(cleanPath.split('/').pop() || 'root')}</span>
            <span class="block-meta-weight">${proportionalWeight}% · ${item.files} files</span>
          </div>
        </div>
      `;
        }).join('');
        container.innerHTML = `<div class="tree-grid-flex-canvas">${htmlGridBlocks}</div>`;
    }
    bindPathInspectorEvents(data) {
        const container = document.getElementById('path-tracing-chart-container');
        const inspectorCard = document.getElementById('path-inspector-live-card');
        if (!container || !inspectorCard)
            return;
        container.addEventListener('mouseover', (e) => {
            const block = e.target.closest('.trace-tree-block');
            if (!block)
                return;
            const targetIndex = parseInt(block.getAttribute('data-index'), 10);
            const targetData = data[targetIndex];
            if (targetData)
                this.updateInspectorCardUI(inspectorCard, targetData);
        });
        container.addEventListener('mouseleave', () => {
            inspectorCard.innerHTML = `
        <div class="empty-inspector-state">
          <i data-lucide="info" class="icon-18"></i>
          <p>Hover over or click a directory block in the map to audit specific file volumes and path boundaries.</p>
        </div>
      `;
        });
    }
    updateInspectorCardUI(domElement, itemData) {
        const cleanPath = itemData.path || 'Root Scope Workspace';
        domElement.innerHTML = `
      <div class="inspector-active-view">
        <div class="inspector-header-block">
          <i data-lucide="folder" class="icon-16"></i>
          <h4>${escapeHtml(cleanPath.split('/').pop() || 'root')}</h4>
        </div>
        <div class="inspector-data-metrics-list">
          <div class="inspector-metric-row">
            <span class="label">Full Path Trace:</span>
            <code class="value text-truncate" title="${escapeHtml(cleanPath)}">${escapeHtml(cleanPath)}</code>
          </div>
          <div class="inspector-metric-row">
            <span class="label">Analyzed Files:</span>
            <span class="value strong-highlight">${itemData.files} modules</span>
          </div>
          <div class="inspector-metric-row">
            <span class="label">Disk Footprint:</span>
            <span class="value">${escapeHtml(itemData.size || 'Uncalculated')}</span>
          </div>
          <div class="inspector-metric-row">
            <span class="label">Postures Check:</span>
            <span class="value status-badge passed">Active Track</span>
          </div>
        </div>
      </div>
    `;
    }
    generateMicroSparkline(historyArray, isRegression) {
        if (!historyArray || historyArray.length < 2) {
            return `<svg width="70" height="20" class="spark-empty"><line x1="0" y1="10" x2="70" y2="10" stroke="rgba(255,255,255,0.1)" stroke-dasharray="2"/></svg>`;
        }
        const width = 70;
        const height = 18;
        const padding = 2;
        const min = Math.min(...historyArray);
        const max = Math.max(...historyArray);
        const range = max - min === 0 ? 1 : max - min;
        const points = historyArray.map((val, index) => {
            const x = (index / (historyArray.length - 1)) * (width - padding * 2) + padding;
            const y = height - ((val - min) / range) * (height - padding * 2) - padding;
            return `${x},${y}`;
        }).join(' ');
        const strokeColor = isRegression ? '#f87171' : '#34d399';
        const lastPoint = points.split(' ').pop() || '0,0';
        const lastY = lastPoint.split(',')[1];
        return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="inline-sparkline-canvas">
        <polyline fill="none" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" points="${points}"/>
        <circle cx="${width - padding}" cy="${lastY}" r="2" fill="${strokeColor}"/>
      </svg>
    `;
    }
    renderComparativeRows(rows) {
        return rows.map((row) => {
            const unit = row.type === 'percentage' ? '%' : '';
            const deltaClass = row.delta === 0 ? 'delta-neutral' : (row.isRegression ? 'delta-danger' : 'delta-success');
            const sparklineSvg = this.generateMicroSparkline(row.history, row.isRegression);
            const rowClass = row.isRegression ? 'db-v3-platform-row has-regression' : 'db-v3-platform-row';
            const rowInteractive = row.isRegression ? `data-metric-key="${escapeHtml(row.key)}" title="Click to pinpoint introduced regressions"` : '';
            const chevron = row.isRegression ? '<span class="row-chevron"><i data-lucide="chevron-right" class="icon-14"></i></span>' : '';
            const drawer = row.isRegression ? `
        <tr class="db-v3-regression-drawer-row" id="regression-drawer-${escapeHtml(row.key)}">
          <td colspan="6">
            <div class="regression-drawer-content">
              <h5><i data-lucide="bug" class="icon-14"></i> Introduced Regressions Inside Workspace</h5>
              <div class="regression-targets-feed" id="regression-feed-${escapeHtml(row.key)}">
                <div class="drawer-loading-spinner"><span class="spinner"></span> Resolving delta differences...</div>
              </div>
            </div>
          </td>
        </tr>
      ` : '';
            return `
        <tr class="${rowClass}" ${rowInteractive}>
          <td>
            <div class="metric-name-cell">
              ${row.isRegression ? '<i data-lucide="alert-triangle" class="icon-14 regression-indicator-dot"></i>' : ''}
              <strong>${escapeHtml(row.metric)}</strong>
            </div>
          </td>
          <td class="mono-font">${escapeHtml(String(row.previous))}${unit}</td>
          <td class="mono-font">${escapeHtml(String(row.current))}${unit}</td>
          <td><span class="platform-delta-badge ${deltaClass}">${escapeHtml(row.change)}</span></td>
          <td><div class="table-sparkline-wrapper">${sparklineSvg}</div></td>
          <td>${chevron}</td>
        </tr>
        ${drawer}
      `;
        }).join('');
    }
    async resolveIntroducedRegressions(metricKey, report) {
        const findings = (report === null || report === void 0 ? void 0 : report.findings) || (report === null || report === void 0 ? void 0 : report.rawIssues) || (report === null || report === void 0 ? void 0 : report.detectedIssues) || [];
        if (metricKey === 'securityPosture') {
            return findings.filter((f) => ['critical', 'high'].includes((f.severity || '').toLowerCase()));
        }
        if (metricKey === 'schemaPass') {
            return findings.filter((f) => (f.category || '').toLowerCase() === 'schema' || (f.type || '').toLowerCase().includes('schema'));
        }
        if (metricKey === 'jestTests') {
            return findings.filter((f) => (f.type || '').toLowerCase().includes('test') || (f.category || '').toLowerCase().includes('test'));
        }
        return findings.slice(0, 3);
    }
    async populateRegressionFeed(metricKey) {
        var _a, _b;
        const feedContainer = document.getElementById(`regression-feed-${metricKey}`);
        if (!feedContainer)
            return;
        try {
            const reportData = ((_b = (_a = this.app) === null || _a === void 0 ? void 0 : _a.state) === null || _b === void 0 ? void 0 : _b.report) || {};
            const regressionList = await this.resolveIntroducedRegressions(metricKey, reportData);
            if (!regressionList || regressionList.length === 0) {
                feedContainer.innerHTML = `<div class="feed-empty-state">No line-level regression mappings detected for this snapshot delta block.</div>`;
                return;
            }
            feedContainer.innerHTML = regressionList.map((item) => `
        <div class="regression-finding-strip">
          <div class="strip-meta-block">
            <span class="strip-severity-tag high">NEW</span>
            <span class="strip-title-text"><strong>${escapeHtml(item.type || 'Regression Block')}</strong> — ${escapeHtml(item.description || '')}</span>
          </div>
          <button type="button" class="regression-link-btn" data-file="${escapeHtml(item.filePath || '')}" data-line="${item.line || 1}" title="Jump straight to line in editor">
            <i data-lucide="file-code" class="icon-14"></i>
            <code>${escapeHtml(item.filePath || '—')}:${item.line || 1}</code>
          </button>
        </div>
      `).join('');
        }
        catch (err) {
            feedContainer.innerHTML = `<div class="feed-error-state">Failed to track down regression coordinates: ${escapeHtml(err.message)}</div>`;
        }
    }
    bindEvents(container) {
        const viewContainer = container || document.querySelector('.platform-redesign') || document.body;
        viewContainer.addEventListener('click', (e) => {
            const syncBtn = e.target.closest('#sb-trigger-sync-baseline-btn');
            if (syncBtn) {
                e.preventDefault();
                const vscode = typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function' ? window.acquireVsCodeApi() : null;
                if (vscode) {
                    vscode.postMessage({ command: 'syncBaseline' });
                }
                else {
                    showToast('Workspace bridge offline. Please run Tools → Baseline sync in the extension.', 'info');
                }
                return;
            }
            if (e.target.closest('#sb-dismiss-freshness-banner-btn')) {
                const banner = document.getElementById('sb-platform-freshness-banner');
                if (banner) {
                    banner.classList.add('animation-fade-out');
                    banner.addEventListener('animationend', () => banner.remove());
                }
                return;
            }
            const regressionRow = e.target.closest('.has-regression');
            if (regressionRow && !e.target.closest('.regression-link-btn')) {
                e.preventDefault();
                const metricKey = regressionRow.getAttribute('data-metric-key');
                const drawerRow = document.getElementById(`regression-drawer-${metricKey}`);
                const chevron = regressionRow.querySelector('.row-chevron');
                if (!drawerRow)
                    return;
                const isExpanded = drawerRow.classList.contains('is-expanded');
                if (isExpanded) {
                    drawerRow.classList.remove('is-expanded');
                    regressionRow.classList.remove('drawer-active');
                    if (chevron)
                        chevron.style.transform = 'rotate(0deg)';
                }
                else {
                    drawerRow.classList.add('is-expanded');
                    regressionRow.classList.add('drawer-active');
                    if (chevron)
                        chevron.style.transform = 'rotate(90deg)';
                    this.populateRegressionFeed(metricKey);
                }
                return;
            }
            const deepLinkBtn = e.target.closest('.regression-link-btn');
            if (deepLinkBtn) {
                const filePath = deepLinkBtn.getAttribute('data-file');
                const line = parseInt(deepLinkBtn.getAttribute('data-line'), 10) || 1;
                const vscode = typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function' ? window.acquireVsCodeApi() : null;
                if (vscode) {
                    vscode.postMessage({ command: 'openFile', filePath, line });
                }
                else {
                    showToast(`Open ${filePath}:${line} in the editor`, 'info');
                }
            }
        });
    }
    render() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const home = hydrateDashboardHome(this.app.state.dashboardHome, this.app.state.baseline);
        const report = this.app.state.report;
        const baseline = this.app.state.baseline;
        const metrics = buildPlatformMetrics(home, report, baseline);
        const comparativeRows = buildComparativeRows(home, metrics);
        const el = document.createElement('div');
        el.className = 'fade-in platform-redesign';
        el.innerHTML = `
      <style>
        .platform-redesign .platform-hero { text-align: center; margin: var(--space-6) 0 var(--space-5); }
        .platform-redesign .platform-hero h1 { font-size: 1.75rem; font-weight: 800; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
        .platform-redesign .platform-hero p { color: var(--text-muted); font-size: 0.95rem; max-width: 560px; margin: 0 auto; }
        .platform-redesign .platform-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-5); }
        .platform-redesign .platform-stat { background: var(--surface-elevated); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); }
        .platform-redesign .platform-stat.primary { background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.04)); border-color: rgba(99,102,241,0.15); }
        .platform-redesign .platform-stat.success { background: rgba(5,150,105,0.06); border-color: rgba(5,150,105,0.15); }
        .platform-redesign .psv-value { font-size: var(--font-size-2xl); font-weight: 800; color: var(--text-primary); line-height: 1.1; }
        .platform-redesign .psv-value.success { color: var(--success); }
        .platform-redesign .psv-label { font-size: var(--font-size-xs); font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .platform-redesign .platform-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-5); }
        .platform-redesign .platform-card { background: var(--surface-elevated); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-4); }
        .platform-redesign .platform-card-header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3); font-weight: 700; font-size: var(--font-size-base); color: var(--text-primary); }
        .platform-redesign .platform-card-header i { color: var(--primary); }
        .platform-redesign .platform-row { display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--border); font-size: var(--font-size-sm); }
        .platform-redesign .platform-row:last-child { border-bottom: none; }
        .platform-redesign .platform-row .pr-label { color: var(--text-muted); }
        .platform-redesign .platform-row .pr-value { font-weight: 600; color: var(--text-primary); }
        .platform-redesign .platform-path-list { margin: 0; padding: 0; list-style: none; }
        .platform-redesign .platform-path-list li { padding: var(--space-2) 0; border-bottom: 1px solid var(--border); font-size: var(--font-size-sm); }
        .platform-redesign .platform-path-list li:last-child { border-bottom: none; }
        .platform-redesign .platform-path-list code { background: var(--surface); padding: 2px 6px; border-radius: var(--radius-sm); }
        .platform-redesign .platform-empty { font-size: var(--font-size-sm); color: var(--text-muted); }
        .platform-redesign .platform-hint { font-size: var(--font-size-xs); color: var(--text-muted); margin-top: var(--space-2); }

        /* Baseline freshness alert banner */
        .platform-alert-banner { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 12px 18px; margin: 12px 0 20px 0; border-radius: 6px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
        .banner-body-message { display: flex; align-items: center; gap: 10px; color: var(--text-secondary); font-size: 0.85rem; }
        .banner-body-message p { margin: 0; line-height: 1.4; }
        .warning-pulse-icon { color: var(--warning); font-size: 1.1rem; animation: simpleWarningPulse 2s infinite ease-in-out; }
        .stale-highlight-text { color: var(--warning); font-weight: bold; text-decoration: underline; text-underline-offset: 2px; }
        .banner-controls-group { display: flex; align-items: center; gap: 12px; }
        .banner-close-icon-btn { background: none; border: none; color: var(--text-muted); font-size: 1.3rem; cursor: pointer; line-height: 1; padding: 0 4px; }
        .banner-close-icon-btn:hover { color: var(--text-primary); }
        .animation-slide-down { animation: alertSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animation-fade-out { animation: alertFadeOut 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes simpleWarningPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.8; } }
        @keyframes alertSlideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes alertFadeOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-4px); } }

        /* Comparative table sparklines and regression drawer */
        .platform-comparative-table .metric-name-cell { display: flex; align-items: center; gap: 6px; }
        .db-v3-platform-row.has-regression { cursor: pointer; transition: background-color 0.15s ease; }
        .db-v3-platform-row.has-regression:hover { background: rgba(239,68,68,0.03) !important; }
        .db-v3-platform-row.drawer-active { background: rgba(239,68,68,0.02) !important; }
        .row-chevron { display: inline-block; color: var(--text-muted); transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
        .regression-indicator-dot { color: var(--danger); animation: simpleAlertPulse 2.5s infinite ease-in-out; }
        .platform-delta-badge { font-size: 0.75rem; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
        .platform-delta-badge.delta-success { background: rgba(16,185,129,0.15); color: #34d399; }
        .platform-delta-badge.delta-danger { background: rgba(239,68,68,0.15); color: #f87171; }
        .platform-delta-badge.delta-neutral { background: var(--surface); color: var(--text-muted); }
        .table-sparkline-wrapper { display: flex; align-items: center; height: 100%; }
        .inline-sparkline-canvas { overflow: visible; }
        .db-v3-regression-drawer-row { display: none; background: var(--surface); }
        .db-v3-regression-drawer-row.is-expanded { display: table-row; }
        .regression-drawer-content { padding: 14px 18px; margin: 4px 12px 12px 12px; border-radius: 6px; border: 1px solid rgba(239,68,68,0.15); background: var(--surface-elevated); }
        .regression-drawer-content h5 { margin: 0 0 10px 0; color: var(--danger); font-size: 0.85rem; display: flex; align-items: center; gap: 6px; }
        .regression-finding-strip { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 4px; margin-bottom: 6px; background: var(--surface); border: 1px solid var(--border); gap: 16px; }
        .regression-finding-strip:last-child { margin-bottom: 0; }
        .strip-meta-block { display: flex; align-items: center; gap: 10px; font-size: 0.8rem; color: var(--text-secondary); }
        .strip-severity-tag.high { background: rgba(239,68,68,0.2); color: #f87171; font-size: 0.65rem; font-weight: bold; padding: 1px 4px; border-radius: 3px; }
        .regression-link-btn { background: var(--surface-elevated); border: 1px solid var(--border); border-radius: 4px; color: var(--text-muted); padding: 4px 8px; cursor: pointer; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 6px; transition: all 0.12s ease; }
        .regression-link-btn:hover { background: var(--surface); border-color: var(--border); color: var(--text-primary); }
        .regression-link-btn code { font-family: var(--font-mono); color: #93c5fd; }
        .drawer-loading-spinner, .feed-empty-state, .feed-error-state { font-size: 0.8rem; color: var(--text-muted); padding: 8px 0; }
        @keyframes simpleAlertPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.05); } }

        /* Scan path tracing chart */
        .scan-path-tracker-card .panel-header { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
        .scan-path-tracker-card .panel-title-group { display: flex; align-items: center; gap: 10px; }
        .scan-path-tracker-card .panel-title-group h3 { margin: 0; font-size: var(--font-size-base); }
        .scan-path-tracker-card .panel-subtitle { font-size: 0.8rem; color: var(--text-muted); }
        .path-tracker-workspace-grid { display: flex; gap: 16px; margin-top: 14px; }
        @media (max-width: 820px) { .path-tracker-workspace-grid { flex-direction: column; } }
        .path-visualizer-canvas-pane { flex: 5; height: 260px; padding: 12px; border-radius: 8px; background: var(--surface); border: 1px solid var(--border); display: flex; }
        .path-inspector-details-pane { flex: 3; display: flex; flex-direction: column; }
        #path-tracing-chart-container { width: 100%; height: 100%; }
        .tree-grid-flex-canvas { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; height: 100%; }
        .trace-tree-block { border: 1px solid var(--border); border-radius: 6px; padding: 12px; display: flex; align-items: flex-end; cursor: pointer; overflow: hidden; position: relative; transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s, box-shadow 0.2s; background: rgba(59,130,246,0.15); }
        .trace-tree-block:hover { transform: scale(1.02); border-color: #3b82f6; box-shadow: 0 8px 24px rgba(0,0,0,0.3); z-index: 5; }
        .block-inner-content { display: flex; flex-direction: column; width: 100%; pointer-events: none; }
        .block-folder-name { font-size: 0.85rem; font-weight: bold; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .block-meta-weight { font-size: 0.7rem; color: var(--text-muted); margin-top: 2px; }
        .inspector-card-shell { flex: 1; border-radius: 8px; padding: 20px; display: flex; flex-direction: column; justify-content: center; min-height: 200px; background: var(--surface-elevated); border: 1px solid var(--border); }
        .empty-inspector-state { text-align: center; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .empty-inspector-state p { margin: 0; font-size: 0.8rem; line-height: 1.5; }
        .inspector-header-block { display: flex; align-items: center; gap: 8px; color: var(--text-primary); border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 14px; }
        .inspector-header-block h4 { margin: 0; font-size: 1rem; text-transform: capitalize; }
        .inspector-data-metrics-list { display: flex; flex-direction: column; gap: 12px; }
        .inspector-metric-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; gap: 16px; }
        .inspector-metric-row .label { color: var(--text-muted); }
        .inspector-metric-row .value { color: var(--text-primary); text-align: right; }
        .inspector-metric-row code.value { color: #93c5fd; background: var(--surface); padding: 2px 4px; border-radius: 4px; font-size: 0.75rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
        .inspector-metric-row .strong-highlight { color: #60a5fa; font-weight: 600; }
        .status-badge.passed { background: rgba(16,185,129,0.15); color: #34d399; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 500; }
        .chart-empty-state { font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; justify-content: center; height: 100%; }
      </style>

      <div class="platform-hero">
        <h1>Platform</h1>
        <p>${escapeHtml((home === null || home === void 0 ? void 0 : home.subtitle) || 'Engineering baseline from repository audit + Simplebeacon scan')}</p>
      </div>

      <div class="platform-stats">
        <div class="platform-stat">
          <span class="psv-value">${(_a = metrics.mockScanFiles) !== null && _a !== void 0 ? _a : '—'}</span>
          <span class="psv-label">${escapeHtml(((_c = (_b = home === null || home === void 0 ? void 0 : home.overview) === null || _b === void 0 ? void 0 : _b.statLabels) === null || _c === void 0 ? void 0 : _c.totalFiles) || 'Mock scan files')}</span>
        </div>
        <div class="platform-stat success">
          <span class="psv-value success">${formatPercent(metrics.qualityScore)}</span>
          <span class="psv-label">${escapeHtml(((_e = (_d = home === null || home === void 0 ? void 0 : home.overview) === null || _d === void 0 ? void 0 : _d.statLabels) === null || _e === void 0 ? void 0 : _e.codeQuality) || 'Scan quality')}</span>
        </div>
        <div class="platform-stat primary">
          <span class="psv-value">${escapeHtml((_f = metrics.securityScore) !== null && _f !== void 0 ? _f : '—')}</span>
          <span class="psv-label">${escapeHtml(((_h = (_g = home === null || home === void 0 ? void 0 : home.overview) === null || _g === void 0 ? void 0 : _g.statLabels) === null || _h === void 0 ? void 0 : _h.securityScore) || 'Security posture')}</span>
        </div>
      </div>

      <div class="platform-grid">
        <div class="platform-card">
          <div class="platform-card-header"><i data-lucide="activity" class="icon-16"></i> Test Health</div>
          <div class="platform-row"><span class="pr-label">Jest tests</span><span class="pr-value">${escapeHtml((_j = metrics.jestTests) !== null && _j !== void 0 ? _j : '—')}</span></div>
          <div class="platform-row"><span class="pr-label">Page samples</span><span class="pr-value">${escapeHtml((_k = metrics.pageSamples) !== null && _k !== void 0 ? _k : '—')}</span></div>
          <div class="platform-row"><span class="pr-label">Schema pass</span><span class="pr-value">${formatPercent(metrics.schemaPassRate)}</span></div>
          <div class="platform-row"><span class="pr-label">Scanner issues</span><span class="pr-value">${(_l = metrics.scannerIssues) !== null && _l !== void 0 ? _l : '—'}</span></div>
          ${metrics.jestTests ? '' : '<p class="platform-hint">Run <strong>Tools → Baseline sync</strong> or enable <code>jest-baseline</code> in config.</p>'}
        </div>
        ${this.renderScanPathTrackerTemplate()}
      </div>

      ${comparativeRows.length ? `
        <div class="section-block">
          <div class="section-heading"><h2>Comparative Analysis</h2></div>
          <div class="card" style="padding:0;overflow:hidden;">
            <table class="results-table platform-comparative-table">
              <thead><tr><th>Metric</th><th>Previous</th><th>Current</th><th>Change</th><th>Trend</th><th></th></tr></thead>
              <tbody id="platform-comparative-table-body">
                ${this.renderComparativeRows(comparativeRows)}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      ${((_m = home === null || home === void 0 ? void 0 : home.insights) === null || _m === void 0 ? void 0 : _m.length) ? `
        <div class="section-block">
          <div class="section-heading"><h2>Insights</h2></div>
          <div class="insight-list">
            ${home.insights.map((i) => `
              <div class="insight-item card">
                <h3>${escapeHtml(i.title)}</h3>
                <p>${escapeHtml(i.description)}</p>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${((_o = report === null || report === void 0 ? void 0 : report.mockDataCategories) === null || _o === void 0 ? void 0 : _o.length) ? `
        <div class="section-block">
          <div class="section-heading"><h2>Mock Data Categories</h2></div>
          <div class="card" style="padding:0;overflow:hidden;">
            <table class="results-table">
              <thead><tr><th>Category</th><th>Files</th><th>Size</th><th>Quality</th><th>Issues</th></tr></thead>
              <tbody>
                ${report.mockDataCategories.map((c) => `
                  <tr>
                    <td>${escapeHtml(c.category)}</td>
                    <td>${c.fileCount}</td>
                    <td>${escapeHtml(c.totalSize)}</td>
                    <td>${formatPercent(c.qualityScore)}</td>
                    <td>${c.issues}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
    `;
        return el;
    }
    mount(container) {
        container.innerHTML = '';
        container.appendChild(this.render());
        this.checkBaselineFreshness();
        this.bindEvents(container);
        this.initPathTracingChart();
    }
}
