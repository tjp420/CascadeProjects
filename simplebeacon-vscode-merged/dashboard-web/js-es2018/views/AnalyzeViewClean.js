// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * Drive Scanner Analyze View
 * Replaces the old code-analysis Analyze page with a filesystem scanner.
 */
import { escapeHtml } from '../utils/string.js';
import { showToast } from '../utils/dom.js';
import { formatNumber, formatBytes } from '../utils/number.js';
import { formatDate } from '../utils/format.js';
import { authService } from '../services/authService.js?v=20260713sync1';

const LS_SCAN_PATHS = 'sb_analyze_scan_paths';
const SS_LAST_RESULT = 'sb_analyze_last_result';

function getScanPaths() {
    try { return JSON.parse(localStorage.getItem(LS_SCAN_PATHS) || '{}'); }
    catch { return {}; }
}

function setScanPath(folderName, fullPath) {
    try {
        const map = getScanPaths();
        const existing = map[folderName];
        if (Array.isArray(existing)) {
            const filtered = existing.filter((p) => p !== fullPath);
            map[folderName] = [fullPath, ...filtered].slice(0, 5);
        } else if (existing && existing !== fullPath) {
            map[folderName] = [fullPath, existing];
        } else {
            map[folderName] = [fullPath];
        }
        localStorage.setItem(LS_SCAN_PATHS, JSON.stringify(map));
    } catch { /* ignore */ }
}

function recallScanPath(folderName) {
    try {
        const map = getScanPaths();
        const existing = map[folderName];
        if (Array.isArray(existing) && existing.length > 0)
            return existing[0];
        if (typeof existing === 'string')
            return existing;
    } catch { /* ignore */ }
    return null;
}

export class AnalyzeView {
    constructor(app) {
        this.app = app;
        this.busy = false;
        this._root = null;
        this._lastResult = null;
        this._scanHistory = [];
        this._dirBrowserPath = '';
        this._dirBrowserStack = [];
        this._dirBrowserPathInput = null;
        this._cancelRequested = false;
        this._currentSort = 'severity';
        try {
            const saved = sessionStorage.getItem(SS_LAST_RESULT);
            if (saved) this._lastResult = JSON.parse(saved);
        } catch { /* ignore */ }
    }

    get id() { return 'analyze'; }

    getAnalyzerCatalog() {
        return [
            {
                category: 'Security',
                analyzers: [
                    { id: 1, name: 'Hardcoded Credentials', severity: 'critical', tier: 'free' },
                    { id: 2, name: 'AWS Access Key', severity: 'critical', tier: 'free' },
                    { id: 3, name: 'Private Key Material', severity: 'critical', tier: 'free' },
                    { id: 4, name: 'SQL Injection Risk', severity: 'high', tier: 'free' },
                    { id: 5, name: 'Cross-Site Scripting (XSS)', severity: 'high', tier: 'free' },
                    { id: 6, name: 'Dynamic Code Execution', severity: 'critical', tier: 'free' },
                    { id: 7, name: 'Command Injection', severity: 'critical', tier: 'free' },
                    { id: 8, name: 'Insecure HTTP URL', severity: 'medium', tier: 'free' },
                    { id: 9, name: 'Security TODO/FIXME', severity: 'medium', tier: 'free' },
                    { id: 10, name: 'LocalStorage Sensitive Data', severity: 'medium', tier: 'free' },
                    { id: 11, name: 'Disabled Certificate Validation', severity: 'high', tier: 'free' },
                    { id: 12, name: 'Weak Cryptography', severity: 'high', tier: 'free' },
                    { id: 13, name: 'Path Traversal Risk', severity: 'medium', tier: 'free' },
                    { id: 14, name: 'CSRF Protection Missing', severity: 'medium', tier: 'free' },
                    { id: 15, name: 'Debug Information Exposure', severity: 'medium', tier: 'pro' },
                    { id: 43, name: 'Prototype Pollution Risk', severity: 'high', tier: 'pro' }
                ]
            },
            {
                category: 'Code Quality',
                analyzers: [
                    { id: 16, name: 'Debug Statement Left in Code', severity: 'low', tier: 'free' },
                    { id: 17, name: 'Unresolved TODO/FIXME', severity: 'low', tier: 'free' },
                    { id: 18, name: 'Long Function', severity: 'medium', tier: 'free' },
                    { id: 19, name: 'Deep Nesting', severity: 'low', tier: 'free' },
                    { id: 20, name: 'Magic Number', severity: 'low', tier: 'free' },
                    { id: 21, name: 'Commented-Out Code', severity: 'low', tier: 'free' },
                    { id: 22, name: 'Empty Catch Block', severity: 'medium', tier: 'free' },
                    { id: 23, name: 'Callback Hell', severity: 'medium', tier: 'free' },
                    { id: 24, name: 'Var Usage', severity: 'low', tier: 'free' },
                    { id: 25, name: 'Unused Import Pattern', severity: 'low', tier: 'pro' },
                    { id: 26, name: 'Complex Conditional', severity: 'low', tier: 'pro' },
                    { id: 27, name: 'Duplicate Code Block', severity: 'low', tier: 'pro' }
                ]
            },
            {
                category: 'Type Safety',
                analyzers: [
                    { id: 28, name: 'Any Type Usage', severity: 'medium', tier: 'pro' },
                    { id: 29, name: 'TypeScript Ignore Directive', severity: 'medium', tier: 'pro' },
                    { id: 30, name: 'Non-Null Assertion', severity: 'medium', tier: 'pro' },
                    { id: 31, name: 'Prop-Types in TypeScript', severity: 'low', tier: 'pro' },
                    { id: 32, name: 'Inline Styles', severity: 'low', tier: 'pro' },
                    { id: 33, name: 'Inline Event Handler', severity: 'low', tier: 'pro' },
                    { id: 34, name: 'Deprecated API Usage', severity: 'medium', tier: 'pro' },
                    { id: 35, name: 'Unsafe Type Cast', severity: 'medium', tier: 'pro' },
                    { id: 36, name: 'String eval in Template', severity: 'high', tier: 'pro' },
                    { id: 37, name: 'Circular Dependency Risk', severity: 'low', tier: 'pro' }
                ]
            },
            {
                category: 'Performance',
                analyzers: [
                    { id: 38, name: 'Sync IO in Async Context', severity: 'medium', tier: 'pro' },
                    { id: 39, name: 'Memory Leak Pattern', severity: 'medium', tier: 'pro' },
                    { id: 40, name: 'Inefficient Loop', severity: 'low', tier: 'pro' },
                    { id: 41, name: 'String Concatenation in Loop', severity: 'low', tier: 'pro' },
                    { id: 42, name: 'N+1 Query Pattern', severity: 'medium', tier: 'pro' },
                    { id: 44, name: 'Large Dependency Import', severity: 'low', tier: 'pro' },
                    { id: 45, name: 'Unnecessary Re-render', severity: 'low', tier: 'pro' }
                ]
            },
            {
                category: 'AI / LLM',
                analyzers: [
                    { id: 46, name: 'LLM Slop Pattern', severity: 'medium', tier: 'pro' },
                    { id: 47, name: 'Token Bleed Pattern', severity: 'high', tier: 'pro' },
                    { id: 48, name: 'Fiction KPI', severity: 'medium', tier: 'pro' },
                    { id: 49, name: 'Architecture Drift', severity: 'medium', tier: 'pro' },
                    { id: 50, name: 'Placeholder Implementation', severity: 'medium', tier: 'pro' },
                    { id: 51, name: 'Hallucinated API Call', severity: 'high', tier: 'pro' },
                    { id: 52, name: 'Overconfident Comment', severity: 'low', tier: 'pro' },
                    { id: 53, name: 'AI Watermark', severity: 'low', tier: 'pro' },
                    { id: 54, name: 'Temperature Zero Hardcode', severity: 'low', tier: 'pro' },
                    { id: 55, name: 'System Prompt Leakage', severity: 'medium', tier: 'pro' }
                ]
            },
            {
                category: 'Configuration',
                analyzers: [
                    { id: 56, name: 'Hardcoded Environment Value', severity: 'medium', tier: 'pro' },
                    { id: 57, name: 'Missing Env Var Check', severity: 'medium', tier: 'pro' },
                    { id: 58, name: 'Debug Mode Enabled', severity: 'high', tier: 'pro' },
                    { id: 59, name: 'Excessive Logging', severity: 'low', tier: 'pro' },
                    { id: 60, name: 'Sensitive Config in VCS', severity: 'high', tier: 'pro' },
                    { id: 61, name: 'Weak Default Password', severity: 'critical', tier: 'pro' },
                    { id: 62, name: 'CORS Wildcard', severity: 'medium', tier: 'pro' },
                    { id: 63, name: 'Exposed Stack Trace', severity: 'medium', tier: 'pro' }
                ]
            }
        ];
    }

    renderAnalyzerCheckboxes() {
        const catalog = this.getAnalyzerCatalog();
        const isPaid = authService.isPaidTier();
        return catalog.map((group) => {
            const freeCount = group.analyzers.filter((a) => a.tier === 'free').length;
            const proCount = group.analyzers.filter((a) => a.tier === 'pro').length;
            return `
            <div class="analyze-analyzer-group">
                <div class="analyze-analyzer-group-hd">
                    <label class="analyze-analyzer-group-title">
                        <input type="checkbox" class="analyze-analyzer-group-toggle" data-category="${escapeHtml(group.category)}">
                        <span>${escapeHtml(group.category)}</span>
                        <span class="analyze-analyzer-count">${group.analyzers.length}</span>
                        ${!isPaid && proCount > 0 ? `<span class="analyze-pro-pill">${proCount} Pro</span>` : ''}
                    </label>
                    <div class="analyze-analyzer-group-actions">
                        <button type="button" class="analyze-analyzer-select-cat" data-category="${escapeHtml(group.category)}">All</button>
                        <button type="button" class="analyze-analyzer-clear-cat" data-category="${escapeHtml(group.category)}">None</button>
                    </div>
                </div>
                <div class="analyze-analyzer-list">
                    ${group.analyzers.map((a) => {
                        const isLocked = !isPaid && a.tier === 'pro';
                        const checked = isLocked ? '' : 'checked';
                        const disabled = isLocked ? 'disabled' : '';
                        const lockIcon = isLocked ? '<span class="analyze-lock-icon" title="Pro feature">&#x1F512;</span>' : '';
                        const proBadge = a.tier === 'pro' ? '<span class="analyze-tier-pro-badge">Pro</span>' : '';
                        return `
                        <label class="analyze-analyzer-item ${isLocked ? 'analyze-analyzer-locked' : ''}" title="${isLocked ? 'Pro feature — upgrade to unlock' : 'Severity: ' + escapeHtml(a.severity)}">
                            <input type="checkbox" class="analyze-analyzer-checkbox" value="${a.id}" data-category="${escapeHtml(group.category)}" data-tier="${a.tier}" ${checked} ${disabled}>
                            <span class="analyze-analyzer-severity analyze-severity-${escapeHtml(a.severity)}"></span>
                            <span class="analyze-analyzer-name">${escapeHtml(a.name)}</span>
                            ${proBadge}
                            ${lockIcon}
                        </label>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        }).join('');
    }

    renderTierBanner() {
        const isPaid = authService.isPaidTier();
        const tierLabel = authService.getTierLabel();
        if (isPaid) {
            return `
            <div class="analyze-tier-banner analyze-tier-pro">
                <div class="analyze-tier-icon">&#x2728;</div>
                <div class="analyze-tier-text">
                    <strong>${tierLabel} Plan</strong> — You have access to all <strong>63</strong> analyzer engines.
                </div>
            </div>`;
        }
        return `
            <div class="analyze-tier-banner analyze-tier-free">
                <div class="analyze-tier-icon">&#x1F512;</div>
                <div class="analyze-tier-text">
                    <strong>Solo (Free)</strong> — 24 of 63 analyzers active.
                    <a href="/pricing.html" target="_blank" class="analyze-tier-cta">Upgrade to Pro $9/mo &#x2192;</a>
                </div>
            </div>`;
    }

    renderKpiCards() {
        const catalog = this.getAnalyzerCatalog();
        const isPaid = authService.isPaidTier();
        const total = catalog.reduce((s, g) => s + g.analyzers.length, 0);
        const active = isPaid ? total : 24;
        const criticalHigh = catalog.reduce((s, g) => s + g.analyzers.filter((a) => (a.severity === 'critical' || a.severity === 'high') && (isPaid || a.tier === 'free')).length, 0);
        return `
        <div class="analyze-kpi-grid">
            <div class="analyze-kpi-card">
                <div class="analyze-kpi-value analyze-kpi-total">${total}</div>
                <div class="analyze-kpi-label">Total Engines</div>
            </div>
            <div class="analyze-kpi-card">
                <div class="analyze-kpi-value analyze-kpi-active">${active}</div>
                <div class="analyze-kpi-label">Active</div>
            </div>
            <div class="analyze-kpi-card">
                <div class="analyze-kpi-value analyze-kpi-warning">${criticalHigh}</div>
                <div class="analyze-kpi-label">Critical / High</div>
            </div>
            <div class="analyze-kpi-card">
                <div class="analyze-kpi-value analyze-kpi-coverage">${Math.round((active / total) * 100)}%</div>
                <div class="analyze-kpi-label">Coverage</div>
            </div>
        </div>`;
    }

    renderScanPresets() {
        const isVsCode = typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function';
        return `
        <div class="analyze-presets">
            <span class="analyze-presets-label">Quick Select:</span>
            <button type="button" class="analyze-preset-btn" data-preset="security">&#x1F6E1; Security Focus</button>
            <button type="button" class="analyze-preset-btn" data-preset="quality">&#x2705; Quality Sweep</button>
            ${isVsCode ? '<button type="button" class="analyze-preset-btn" data-preset="ai">&#x1F916; AI Audit</button>' : ''}
            <button type="button" class="analyze-preset-btn" data-preset="full">&#x1F680; Full Scan</button>
        </div>`;
    }

    renderSeverityFilter() {
        return `
        <div class="analyze-severity-filter">
            <button type="button" class="analyze-sev-pill analyze-sev-pill-active" data-sev="all">All</button>
            <button type="button" class="analyze-sev-pill" data-sev="critical">Critical</button>
            <button type="button" class="analyze-sev-pill" data-sev="high">High</button>
            <button type="button" class="analyze-sev-pill" data-sev="medium">Medium</button>
            <button type="button" class="analyze-sev-pill" data-sev="low">Low</button>
        </div>`;
    }

    renderSecurityScore(score) {
        const num = Math.max(0, Math.min(100, Math.round(score || 0)));
        let colorClass = 'analyze-score-bad';
        if (num >= 71) colorClass = 'analyze-score-good';
        else if (num >= 41) colorClass = 'analyze-score-mid';
        const circumference = 2 * Math.PI * 52;
        const offset = circumference - (num / 100) * circumference;
        return `
        <div class="analyze-score-card">
            <div class="analyze-score-ring ${colorClass}">
                <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" stroke-width="10" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" stroke-width="10"
                        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                        stroke-linecap="round" transform="rotate(-90 60 60)" />
                </svg>
                <div class="analyze-score-text">
                    <div class="analyze-score-num">${num}</div>
                    <div class="analyze-score-sub">Score</div>
                </div>
            </div>
            <div class="analyze-score-label">Security Posture</div>
        </div>`;
    }

    renderSeverityDonut(critical, high, medium, low) {
        const c = critical || 0, h = high || 0, m = medium || 0, l = low || 0;
        const total = c + h + m + l || 1;
        const colors = { c: '#ef4444', h: '#f97316', m: '#eab308', l: '#22c55e' };
        const makeSlice = (count, color, startAngle) => {
            if (count <= 0) return '';
            const angle = (count / total) * 360;
            const rad = Math.PI / 180;
            const x1 = 50 + 40 * Math.cos((startAngle - 90) * rad);
            const y1 = 50 + 40 * Math.sin((startAngle - 90) * rad);
            const x2 = 50 + 40 * Math.cos((startAngle + angle - 90) * rad);
            const y2 = 50 + 40 * Math.sin((startAngle + angle - 90) * rad);
            const largeArc = angle > 180 ? 1 : 0;
            return `<path d="M50,50 L${x1},${y1} A40,40 0 ${largeArc},1 ${x2},${y2} Z" fill="${color}" />`;
        };
        let start = 0;
        const paths = [
            makeSlice(c, colors.c, start), makeSlice(h, colors.h, start += (c / total) * 360),
            makeSlice(m, colors.m, start += (h / total) * 360), makeSlice(l, colors.l, start += (m / total) * 360)
        ].filter(Boolean).join('');
        return `
        <div class="analyze-donut-card">
            <div class="analyze-donut-wrap">
                <svg width="100" height="100" viewBox="0 0 100 100">${paths}</svg>
                <div class="analyze-donut-center">${total}</div>
            </div>
            <div class="analyze-donut-label">Findings</div>
            <div class="analyze-donut-legend">
                <span style="color:${colors.c}">&#x25CF; ${c} Critical</span>
                <span style="color:${colors.h}">&#x25CF; ${h} High</span>
                <span style="color:${colors.m}">&#x25CF; ${m} Medium</span>
                <span style="color:${colors.l}">&#x25CF; ${l} Low</span>
            </div>
        </div>`;
    }

    renderScanHistory() {
        const history = this._scanHistory.slice(0, 5);
        if (!history.length) return '';
        const rows = history.map((item) => `
            <div class="analyze-history-row" data-scan-id="${item.id || ''}">
                <span class="analyze-history-date">${formatDate(item.time)}</span>
                <span class="analyze-history-path" title="${escapeHtml(item.path)}">${escapeHtml(item.path)}</span>
                <span class="analyze-history-files">${formatNumber(item.fileCount || 0)} files</span>
                <span class="analyze-history-score ${item.score >= 71 ? 'analyze-score-good' : item.score >= 41 ? 'analyze-score-mid' : 'analyze-score-bad'}">${Math.round(item.score || 0)}</span>
            </div>
        `).join('');
        return `
        <div class="analyze-history-section">
            <h3 class="analyze-history-title">Recent Scans</h3>
            <div class="analyze-history-list">${rows}</div>
        </div>`;
    }

    mount() {
        this.refresh();
        if (this._lastResult) {
            const pathInput = document.getElementById('analyze-path-input');
            if (pathInput && this._lastResult.scannedPath) pathInput.value = this._lastResult.scannedPath;
            this.renderResults(this._lastResult, performance.now());
        }
    }

    unmount() {
        const main = document.getElementById('app-main');
        if (main)
            main.innerHTML = '';
    }

    refresh() {
        const main = document.getElementById('app-main');
        if (!main)
            return;
        main.innerHTML = this.render();
        this.bindEvents(main);
        // Drive selection removed — browse button and path input only
    }

    render() {
        return `
<div class="analyze-container" id="analyze-root">
  <header class="analyze-header">
    <h1>Analyze</h1>
    <p class="analyze-subtitle">Scan drives, folders, or file paths across connected volumes.</p>
  </header>

  <section class="analyze-card">
    <div class="analyze-drop-zone" id="analyze-drop-zone">
      <div class="analyze-drop-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg></div>
      <p><strong>Click to browse folders</strong></p>
      <p class="analyze-drop-hint">Browsers cannot reveal full paths. Click here to open the folder browser, or type a path below.</p>
    </div>

    <div class="analyze-controls">
      <div class="analyze-input-row">
        <input type="text" id="analyze-path-input" class="analyze-input"
               placeholder="C:\\\\Users\\\\Name\\\\Documents or click Browse to select"
               aria-label="Target path" />
        <button type="button" id="analyze-browse-btn" class="analyze-btn-secondary">
          Browse...
        </button>
        <button type="button" id="analyze-run-btn" class="analyze-btn-primary">
          <span id="analyze-run-label">Run Analyzer</span>
        </button>
      </div>
      <p class="analyze-hint">Type a full path, click Browse, or drag &amp; drop a folder to auto-locate.</p>
    </div>

    <!-- Scan Progress (hidden) -->
    <div class="analyze-progress-section" id="analyze-progress-section" style="display:none;">
      <div class="analyze-progress-hd">
        <span class="analyze-progress-status" id="analyze-progress-status">Scanning...</span>
        <button type="button" id="analyze-cancel-btn" class="analyze-btn-ghost">Cancel</button>
      </div>
      <div class="analyze-progress-bar-bg">
        <div class="analyze-progress-bar-fill" id="analyze-progress-bar-fill" style="width:0%"></div>
      </div>
      <div class="analyze-progress-meta" id="analyze-progress-meta"></div>
    </div>

    <!-- Website Scan -->
    <div class="analyze-card" id="analyze-website-section">
      <div class="analyze-analyzer-header">
        <h3>Website Scan</h3>
        ${!authService.isPaidTier() ? '<span class="analyze-pro-pill">Pro</span>' : ''}
      </div>
      <div class="analyze-controls">
        <div class="analyze-input-row">
          <input type="text" id="analyze-website-input" class="analyze-input"
                 placeholder="https://example.com"
                 aria-label="Website URL" />
          <button type="button" id="analyze-website-btn" class="analyze-btn-primary">
            <span id="analyze-website-label">Scan Website</span>
          </button>
        </div>
        <p class="analyze-hint">Enter a public URL to scan for AI slop patterns, PII leaks, and security issues.</p>
      </div>
      <div class="analyze-progress-section" id="analyze-website-progress" style="display:none;">
        <div class="analyze-progress-hd">
          <span class="analyze-progress-status" id="analyze-website-status">Scanning website...</span>
        </div>
        <div class="analyze-progress-bar-bg">
          <div class="analyze-progress-bar-fill" id="analyze-website-bar" style="width:0%"></div>
        </div>
      </div>
      <div class="analyze-results" id="analyze-website-results" style="display:none;">
        <div class="analyze-results-header">
          <h4>Website Scan Results</h4>
          <div class="analyze-results-actions">
            <button type="button" id="analyze-website-export-json" class="analyze-btn-ghost">Export JSON</button>
          </div>
        </div>
        <div class="analyze-metrics-grid" id="analyze-website-metrics"></div>
        <div class="analyze-issues-table-wrap" id="analyze-website-issues-wrap"></div>
      </div>
    </div>

    <!-- Analyzer Selection -->
    <div class="analyze-analyzer-section">
      ${this.renderTierBanner()}
      ${this.renderKpiCards()}
      ${this.renderScanPresets()}
      ${this.renderSeverityFilter()}
      <div class="analyze-analyzer-header">
        <h3>Analyzer Selection</h3>
        <div class="analyze-analyzer-actions">
          <button type="button" id="analyze-select-all" class="analyze-btn-ghost">Select All</button>
          <button type="button" id="analyze-clear-all" class="analyze-btn-ghost">Clear All</button>
        </div>
      </div>
      <div class="analyze-analyzer-grid" id="analyze-analyzer-grid">
        ${this.renderAnalyzerCheckboxes()}
      </div>
    </div>

    <!-- Directory Browser Modal -->
    <div class="analyze-dir-browser-overlay" id="analyze-dir-browser-overlay" style="display:none;">
      <div class="analyze-dir-browser">
        <div class="analyze-dir-browser-hd">
          <span class="analyze-dir-browser-title">Browse Directory</span>
          <button type="button" class="analyze-dir-browser-close" id="analyze-dir-browser-close" aria-label="Close">&times;</button>
        </div>
        <div class="analyze-dir-browser-path" id="analyze-dir-browser-path"></div>
        <div class="analyze-dir-browser-list" id="analyze-dir-browser-list">
          <div class="analyze-dir-browser-loading">Loading...</div>
        </div>
        <div class="analyze-dir-browser-actions">
          <button type="button" id="analyze-dir-browser-up" class="analyze-btn-secondary">Up</button>
          <button type="button" id="analyze-dir-browser-root" class="analyze-btn-secondary">Root</button>
          <button type="button" id="analyze-dir-browser-select" class="analyze-btn-primary">Select Folder</button>
        </div>
      </div>
    </div>
  </section>

  <section class="analyze-results" id="analyze-results" style="display:none;">
    <div class="analyze-results-header">
      <h2>Scan Results</h2>
      <div class="analyze-results-actions">
        <button type="button" id="analyze-export-json" class="analyze-btn-ghost">Export JSON</button>
        <button type="button" id="analyze-export-csv" class="analyze-btn-ghost">Export CSV</button>
        <button type="button" id="analyze-export-pdf" class="analyze-btn-ghost">Export PDF</button>
      </div>
    </div>
    <div class="analyze-results-dashboard" id="analyze-results-dashboard">
      <div class="analyze-results-left" id="analyze-score-slot"></div>
      <div class="analyze-results-right" id="analyze-donut-slot"></div>
    </div>
    <div class="analyze-metrics-grid">
      <div class="analyze-metric-card">
        <div class="analyze-metric-value" id="analyze-metric-files">—</div>
        <div class="analyze-metric-label">Total Files</div>
      </div>
      <div class="analyze-metric-card">
        <div class="analyze-metric-value" id="analyze-metric-size">—</div>
        <div class="analyze-metric-label">Total Size</div>
      </div>
      <div class="analyze-metric-card">
        <div class="analyze-metric-value" id="analyze-metric-ext">—</div>
        <div class="analyze-metric-label">Extensions Found</div>
      </div>
      <div class="analyze-metric-card">
        <div class="analyze-metric-value" id="analyze-metric-path">—</div>
        <div class="analyze-metric-label">Scanned Path</div>
      </div>
    </div>

    <div class="analyze-findings-section" id="analyze-findings-section" style="display:none;">
      <div class="analyze-findings-header">
        <h3>Findings</h3>
        <span class="analyze-findings-count" id="analyze-findings-count"></span>
      </div>
      <div class="analyze-findings-toolbar">
        <input type="text" id="analyze-findings-search" class="analyze-findings-search" placeholder="Search findings..." />
        <select id="analyze-findings-sort" class="analyze-findings-sort" title="Sort findings">
          <option value="severity">Severity</option>
          <option value="file">File</option>
          <option value="name">Name</option>
        </select>
        <div class="analyze-findings-sev-filter" id="analyze-findings-sev-filter">
          <button type="button" class="analyze-findings-sev-pill analyze-findings-sev-active" data-fsev="all">All</button>
          <button type="button" class="analyze-findings-sev-pill" data-fsev="critical">Critical</button>
          <button type="button" class="analyze-findings-sev-pill" data-fsev="high">High</button>
          <button type="button" class="analyze-findings-sev-pill" data-fsev="medium">Medium</button>
          <button type="button" class="analyze-findings-sev-pill" data-fsev="low">Low</button>
        </div>
        <div class="analyze-findings-badges" id="analyze-findings-badges"></div>
        <button type="button" id="analyze-findings-toggle" class="analyze-btn-ghost">Show all</button>
      </div>
      <div class="analyze-findings-list" id="analyze-findings-list"></div>
    </div>

    <div class="analyze-table-wrapper">
      <table class="analyze-table">
        <thead>
          <tr><th>Extension</th><th>Count</th><th>Percentage</th></tr>
        </thead>
        <tbody id="analyze-ext-table">
          <tr><td colspan="3" class="analyze-empty">No scan data yet.</td></tr>
        </tbody>
      </table>
    </div>
    ${this.renderScanHistory()}
  </section>
</div>
<style>
.analyze-container { padding: var(--space-6); max-width: 960px; margin: 0 auto; }
.analyze-header { margin-bottom: var(--space-6); }
.analyze-header h1 { font-size: var(--font-size-3xl); font-weight: 700; color: var(--text-primary); margin: 0 0 var(--space-2) 0; }
.analyze-subtitle { color: var(--text-secondary); font-size: var(--font-size-sm); margin: 0; }
.analyze-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-6); margin-bottom: var(--space-6); }
.analyze-drop-zone { border: 2px dashed var(--border); border-radius: var(--radius-lg); padding: var(--space-10); text-align: center; cursor: pointer; transition: all var(--transition); margin-bottom: var(--space-6); background: var(--surface-hover); }
.analyze-drop-zone:hover, .analyze-drop-zone.dragover { border-color: var(--primary); background: var(--primary-subtle); }
.analyze-drop-icon { color: var(--text-muted); margin-bottom: var(--space-3); display: flex; justify-content: center; }
.analyze-drop-zone:hover .analyze-drop-icon, .analyze-drop-zone.dragover .analyze-drop-icon { color: var(--primary); }
.analyze-drop-hint { font-size: var(--font-size-xs); color: var(--text-muted); margin: var(--space-2) 0 0 0; }
.analyze-controls { display: flex; flex-direction: column; gap: var(--space-3); }
.analyze-input-row { display: flex; gap: var(--space-3); align-items: stretch; flex-wrap: wrap; position: relative; }
.analyze-select { background: var(--surface-hover); border: 1px solid var(--border); color: var(--text-primary); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); min-width: 160px; cursor: pointer; }
.analyze-input { flex: 1; min-width: 240px; background: var(--surface-hover); border: 1px solid var(--border); color: var(--text-primary); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); }
.analyze-input::placeholder { color: var(--text-muted); }
.analyze-input:focus, .analyze-select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-subtle); }
.analyze-btn-primary { background: var(--primary); color: var(--text-inverse); border: none; padding: var(--space-3) var(--space-6); border-radius: var(--radius-md); font-size: var(--font-size-sm); font-weight: 600; cursor: pointer; transition: background var(--transition); white-space: nowrap; }
.analyze-btn-primary:hover { background: var(--primary-hover); }
.analyze-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.analyze-btn-secondary { background: var(--surface-hover); color: var(--text-primary); border: 1px solid var(--border); padding: var(--space-3) var(--space-5); border-radius: var(--radius-md); font-size: var(--font-size-sm); font-weight: 600; cursor: pointer; transition: all var(--transition); white-space: nowrap; }
.analyze-btn-secondary:hover { background: var(--surface); border-color: var(--primary); }
.analyze-hint { font-size: var(--font-size-xs); color: var(--text-muted); margin: 0; }
.analyze-dir-browser-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.analyze-dir-browser { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); width: 520px; max-width: 90vw; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; }
.analyze-dir-browser-hd { display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--border); }
.analyze-dir-browser-title { font-weight: 600; color: var(--text-primary); }
.analyze-dir-browser-close { background: none; border: none; color: var(--text-muted); font-size: var(--font-size-xl); cursor: pointer; line-height: 1; }
.analyze-dir-browser-close:hover { color: var(--text-primary); }
.analyze-dir-browser-path { padding: var(--space-2) var(--space-5); font-size: var(--font-size-xs); color: var(--text-secondary); background: var(--surface-hover); border-bottom: 1px solid var(--border); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.analyze-dir-browser-list { flex: 1; overflow-y: auto; padding: var(--space-2) 0; }
.analyze-dir-browser-item { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-5); cursor: pointer; font-size: var(--font-size-sm); color: var(--text-primary); transition: background var(--transition); }
.analyze-dir-browser-item:hover { background: var(--surface-hover); }
.analyze-dir-browser-item-icon { color: var(--primary); font-size: var(--font-size-lg); }
.analyze-dir-browser-loading { padding: var(--space-6); text-align: center; color: var(--text-muted); font-size: var(--font-size-sm); }
.analyze-dir-browser-empty { padding: var(--space-6); text-align: center; color: var(--text-muted); font-size: var(--font-size-sm); }
.analyze-dir-browser-actions { display: flex; gap: var(--space-3); padding: var(--space-4) var(--space-5); border-top: 1px solid var(--border); justify-content: flex-end; }
.analyze-find-picker-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 2000; }
.analyze-find-picker { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); width: 560px; max-width: 90vw; max-height: 70vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 16px 48px rgba(0,0,0,0.5); }
.analyze-find-picker-hd { padding: var(--space-4) var(--space-5); font-size: var(--font-size-sm); font-weight: 600; color: var(--text-primary); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
.analyze-find-picker-close { background: none; border: none; color: var(--text-muted); font-size: var(--font-size-xl); cursor: pointer; line-height: 1; }
.analyze-find-picker-close:hover { color: var(--text-primary); }
.analyze-find-picker-sub { padding: var(--space-2) var(--space-5); font-size: var(--font-size-xs); color: var(--text-muted); border-bottom: 1px solid var(--border); }
.analyze-find-picker-list { flex: 1; overflow-y: auto; padding: var(--space-2) 0; }
.analyze-find-picker-item { display: block; width: 100%; text-align: left; padding: var(--space-3) var(--space-5); background: none; border: none; border-bottom: 1px solid var(--border-subtle); color: var(--text-primary); font-size: var(--font-size-sm); cursor: pointer; font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.analyze-find-picker-item:hover { background: var(--surface-hover); color: var(--primary); }
.analyze-find-picker-item:last-child { border-bottom: none; }
.analyze-find-picker-actions { display: flex; justify-content: flex-end; padding: var(--space-4) var(--space-5); border-top: 1px solid var(--border); }
.analyze-results { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-6); }
.analyze-results-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); }
.analyze-results-header h2 { font-size: var(--font-size-xl); font-weight: 600; color: var(--text-primary); margin: 0; }
.analyze-results-time { font-size: var(--font-size-xs); color: var(--text-muted); }
.analyze-metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6); }
.analyze-metric-card { background: var(--surface-hover); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-5); text-align: center; }
.analyze-metric-value { font-size: var(--font-size-2xl); font-weight: 700; color: var(--primary); margin-bottom: var(--space-1); font-family: var(--font-mono); }
#analyze-metric-path { font-size: var(--font-size-sm); word-break: break-all; line-height: 1.4; }
.analyze-metric-label { font-size: var(--font-size-xs); color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
.analyze-table-wrapper { overflow-x: auto; }
.analyze-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
.analyze-table th { text-align: left; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--border); color: var(--text-secondary); font-weight: 600; font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.03em; }
.analyze-table td { padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--border-subtle); color: var(--text-primary); }
.analyze-table tr:last-child td { border-bottom: none; }
.analyze-empty { text-align: center; color: var(--text-muted); font-style: italic; }
.analyze-analyzer-section { margin-top: var(--space-6); padding-top: var(--space-6); border-top: 1px solid var(--border); }
.analyze-analyzer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); }
.analyze-analyzer-header h3 { font-size: var(--font-size-lg); font-weight: 600; color: var(--text-primary); margin: 0; }
.analyze-analyzer-actions { display: flex; gap: var(--space-2); }
.analyze-btn-ghost { background: transparent; color: var(--text-muted); border: 1px solid var(--border); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); font-size: var(--font-size-xs); font-weight: 500; cursor: pointer; transition: all var(--transition); }
.analyze-btn-ghost:hover { color: var(--primary); border-color: var(--primary); background: var(--primary-subtle); }
.analyze-analyzer-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); }
.analyze-analyzer-group { background: var(--surface-hover); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-4); }
.analyze-analyzer-group-hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3); padding-bottom: var(--space-3); border-bottom: 1px solid var(--border-subtle); }
.analyze-analyzer-group-title { display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-sm); font-weight: 600; color: var(--text-primary); cursor: pointer; margin: 0; }
.analyze-analyzer-count { background: var(--primary-subtle); color: var(--primary); font-size: var(--font-size-xs); font-weight: 700; padding: 2px 6px; border-radius: var(--radius-sm); }
.analyze-analyzer-group-actions { display: flex; gap: var(--space-1); }
.analyze-analyzer-select-cat, .analyze-analyzer-clear-cat { background: transparent; border: none; color: var(--text-muted); font-size: var(--font-size-xs); cursor: pointer; padding: 2px 6px; border-radius: var(--radius-sm); }
.analyze-analyzer-select-cat:hover, .analyze-analyzer-clear-cat:hover { color: var(--primary); background: var(--primary-subtle); }
.analyze-analyzer-list { display: flex; flex-direction: column; gap: var(--space-2); max-height: 200px; overflow-y: auto; }
.analyze-analyzer-item { display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-xs); color: var(--text-secondary); cursor: pointer; padding: 2px 4px; border-radius: var(--radius-sm); transition: background var(--transition); }
.analyze-analyzer-item:hover { background: var(--surface); }
.analyze-analyzer-item input { cursor: pointer; }
.analyze-analyzer-severity { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.analyze-severity-critical { background: #ef4444; }
.analyze-severity-high { background: #f97316; }
.analyze-severity-medium { background: #eab308; }
.analyze-severity-low { background: #22c55e; }
.analyze-analyzer-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.analyze-tier-pro-badge { background: var(--primary-subtle); color: var(--primary); font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: var(--radius-sm); text-transform: uppercase; margin-left: auto; flex-shrink: 0; }
.analyze-lock-icon { font-size: 10px; opacity: 0.7; margin-left: 2px; }
.analyze-analyzer-locked { opacity: 0.55; }
.analyze-analyzer-locked .analyze-analyzer-name { text-decoration: line-through; }
.analyze-pro-pill { background: var(--primary-subtle); color: var(--primary); font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: var(--radius-sm); margin-left: 4px; }
.analyze-tier-banner { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); margin-bottom: var(--space-4); font-size: var(--font-size-sm); }
.analyze-tier-banner .analyze-tier-icon { font-size: var(--font-size-lg); }
.analyze-tier-free { background: var(--surface-hover); border: 1px solid var(--border); color: var(--text-secondary); }
.analyze-tier-pro { background: rgba(5,150,105,0.08); border: 1px solid var(--success); color: var(--text-primary); }
.analyze-tier-cta { color: var(--primary); font-weight: 600; margin-left: var(--space-2); text-decoration: none; }
.analyze-tier-cta:hover { text-decoration: underline; }
.analyze-findings-section { margin-top: var(--space-6); }
.analyze-findings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); }
.analyze-findings-header h3 { font-size: var(--font-size-lg); font-weight: 600; color: var(--text-primary); margin: 0; }
.analyze-gate-badge { padding: var(--space-1) var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 700; text-transform: uppercase; }
.analyze-gate-pass { background: #22c55e22; color: #22c55e; border: 1px solid #22c55e44; }
.analyze-gate-fail { background: #ef444422; color: #ef4444; border: 1px solid #ef444444; }
.analyze-severity-bar { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); }
.analyze-severity-pill { padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 600; }
.analyze-pill-critical { background: #ef444422; color: #ef4444; }
.analyze-pill-high { background: #f9731622; color: #f97316; }
.analyze-pill-medium { background: #eab30822; color: #eab308; }
.analyze-pill-low { background: #22c55e22; color: #22c55e; }
.analyze-findings-table td { vertical-align: top; }
.analyze-findings-table .analyze-finding-file { font-family: var(--font-mono); font-size: var(--font-size-xs); color: var(--text-secondary); }
.analyze-findings-table .analyze-finding-line { color: var(--text-muted); font-size: var(--font-size-xs); }
.analyze-findings-table .analyze-finding-desc { font-size: var(--font-size-sm); }
.analyze-findings-table .analyze-finding-snippet { font-family: var(--font-mono); font-size: var(--font-size-xs); background: var(--surface-hover); padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); margin-top: var(--space-1); display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.analyze-quality-score { font-size: var(--font-size-3xl); font-weight: 700; font-family: var(--font-mono); }
.analyze-quality-label { font-size: var(--font-size-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
@media (max-width: 640px) {
  .analyze-input-row { flex-direction: column; }
  .analyze-select, .analyze-input, .analyze-btn-primary { width: 100%; }
}

/* KPI Cards */
.analyze-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-4); }
.analyze-kpi-card { background: var(--surface-hover); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-4); text-align: center; transition: transform var(--transition); }
.analyze-kpi-card:hover { transform: translateY(-2px); }
.analyze-kpi-value { font-size: var(--font-size-xl); font-weight: 700; margin-bottom: var(--space-1); }
.analyze-kpi-total { color: var(--primary); }
.analyze-kpi-active { color: #22c55e; }
.analyze-kpi-warning { color: #ef4444; }
.analyze-kpi-coverage { color: var(--text-primary); }
.analyze-kpi-label { font-size: var(--font-size-xs); color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }

/* Scan Presets */
.analyze-presets { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; margin-bottom: var(--space-4); }
.analyze-presets-label { font-size: var(--font-size-xs); color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
.analyze-preset-btn { background: var(--surface-hover); border: 1px solid var(--border); color: var(--text-primary); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 500; cursor: pointer; transition: all var(--transition); }
.analyze-preset-btn:hover { background: var(--primary-subtle); border-color: var(--primary); color: var(--primary); }
.analyze-preset-btn.active { background: var(--primary); border-color: var(--primary); color: var(--text-inverse); }

/* Severity Filter */
.analyze-severity-filter { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); flex-wrap: wrap; }
.analyze-sev-pill { background: var(--surface-hover); border: 1px solid var(--border); color: var(--text-muted); padding: 4px 12px; border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 500; cursor: pointer; transition: all var(--transition); }
.analyze-sev-pill:hover { border-color: var(--primary); color: var(--primary); }
.analyze-sev-pill-active { background: var(--primary); border-color: var(--primary); color: var(--text-inverse); }

/* Progress Bar */
.analyze-progress-section { margin-bottom: var(--space-4); padding: var(--space-4); background: var(--surface-hover); border: 1px solid var(--border); border-radius: var(--radius-md); }
.analyze-progress-hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3); }
.analyze-progress-status { font-size: var(--font-size-sm); font-weight: 600; color: var(--text-primary); }
.analyze-progress-bar-bg { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; margin-bottom: var(--space-2); }
.analyze-progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--primary), #60a5fa); border-radius: 4px; transition: width 0.3s ease; }
.analyze-progress-meta { font-size: var(--font-size-xs); color: var(--text-muted); }

/* Results Dashboard */
.analyze-results-dashboard { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-6); }
.analyze-results-left, .analyze-results-right { display: flex; justify-content: center; }

/* Security Score Gauge */
.analyze-score-card { text-align: center; }
.analyze-score-ring { position: relative; width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; color: #ef4444; }
.analyze-score-ring.analyze-score-mid { color: #eab308; }
.analyze-score-ring.analyze-score-good { color: #22c55e; }
.analyze-score-text { position: absolute; text-align: center; }
.analyze-score-num { font-size: var(--font-size-2xl); font-weight: 700; line-height: 1; }
.analyze-score-sub { font-size: var(--font-size-xs); color: var(--text-muted); }
.analyze-score-label { font-size: var(--font-size-sm); font-weight: 600; color: var(--text-secondary); margin-top: var(--space-2); }
.analyze-score-bad { color: #ef4444; }
.analyze-score-mid { color: #eab308; }
.analyze-score-good { color: #22c55e; }

/* Severity Donut */
.analyze-donut-card { text-align: center; }
.analyze-donut-wrap { position: relative; width: 100px; height: 100px; margin: 0 auto; }
.analyze-donut-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: var(--font-size-xl); font-weight: 700; }
.analyze-donut-label { font-size: var(--font-size-sm); font-weight: 600; color: var(--text-secondary); margin-top: var(--space-2); }
.analyze-donut-legend { display: flex; justify-content: center; gap: var(--space-3); margin-top: var(--space-2); font-size: var(--font-size-xs); flex-wrap: wrap; }

/* Findings */
.analyze-findings-section { margin-top: var(--space-6); }
.analyze-findings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); }
.analyze-findings-header h3 { font-size: var(--font-size-lg); font-weight: 600; color: var(--text-primary); margin: 0; }
.analyze-findings-count { font-size: var(--font-size-xs); color: var(--text-muted); }
.analyze-findings-list { display: flex; flex-direction: column; gap: var(--space-3); }
.analyze-finding-card { background: var(--surface-hover); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-4); }
.analyze-finding-card:hover { border-color: var(--primary); }
.analyze-finding-hd { display: flex; gap: var(--space-2); align-items: center; margin-bottom: var(--space-2); }
.analyze-finding-sev { font-size: var(--font-size-xs); font-weight: 700; padding: 2px 8px; border-radius: var(--radius-sm); text-transform: uppercase; }
.analyze-finding-sev-critical { background: #ef444422; color: #ef4444; }
.analyze-finding-sev-high { background: #f9731622; color: #f97316; }
.analyze-finding-sev-medium { background: #eab30822; color: #eab308; }
.analyze-finding-sev-low { background: #22c55e22; color: #22c55e; }
.analyze-finding-name { font-weight: 600; color: var(--text-primary); font-size: var(--font-size-sm); }
.analyze-finding-file { font-size: var(--font-size-xs); color: var(--text-secondary); font-family: var(--font-mono); margin-bottom: var(--space-1); }
.analyze-finding-desc { font-size: var(--font-size-xs); color: var(--text-muted); }

/* Scan History */
.analyze-history-section { margin-top: var(--space-6); padding-top: var(--space-6); border-top: 1px solid var(--border); }
.analyze-history-title { font-size: var(--font-size-lg); font-weight: 600; color: var(--text-primary); margin: 0 0 var(--space-4); }
.analyze-history-row { display: grid; grid-template-columns: 120px 1fr 80px 40px; gap: var(--space-3); align-items: center; padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm); font-size: var(--font-size-sm); cursor: pointer; transition: background var(--transition); }
.analyze-history-row { cursor: pointer; }
.analyze-history-row:hover { background: var(--surface-hover); }
.analyze-history-date { color: var(--text-muted); font-size: var(--font-size-xs); }
.analyze-history-path { color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: var(--font-mono); }
.analyze-history-files { color: var(--text-secondary); font-size: var(--font-size-xs); text-align: right; }
.analyze-history-score { font-weight: 700; text-align: right; }

/* Findings Toolbar */
.analyze-findings-toolbar { display: flex; gap: var(--space-3); align-items: center; flex-wrap: wrap; margin-bottom: var(--space-4); }
.analyze-findings-search { flex: 1; min-width: 200px; background: var(--surface-hover); border: 1px solid var(--border); color: var(--text-primary); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-sm); }
.analyze-findings-search::placeholder { color: var(--text-muted); }
.analyze-findings-search:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-subtle); }
.analyze-findings-sort { background: var(--surface-hover); border: 1px solid var(--border); color: var(--text-primary); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-sm); cursor: pointer; }
.analyze-findings-sort:focus { outline: none; border-color: var(--primary); }
.analyze-findings-sev-filter { display: flex; gap: var(--space-2); }
.analyze-findings-sev-pill { padding: var(--space-1) var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 600; border: 1px solid var(--border); background: var(--surface-hover); color: var(--text-muted); cursor: pointer; }
.analyze-findings-sev-pill:hover { border-color: var(--primary); color: var(--primary); }
.analyze-findings-sev-active { background: var(--primary-subtle); color: var(--primary); border-color: var(--primary); }
.analyze-findings-badges { display: flex; gap: var(--space-2); font-size: var(--font-size-xs); }
.analyze-findings-badge { padding: 2px 8px; border-radius: var(--radius-sm); font-weight: 600; }
.analyze-badge-critical { background: #ef444422; color: #ef4444; }
.analyze-badge-high { background: #f9731622; color: #f97316; }
.analyze-badge-medium { background: #eab30822; color: #eab308; }
.analyze-badge-low { background: #22c55e22; color: #22c55e; }
.analyze-finding-card { cursor: pointer; }
.analyze-finding-card.hidden { display: none; }

/* Finding Detail Modal */
.analyze-finding-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 2000; }
.analyze-finding-modal { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); width: 520px; max-width: 90vw; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; }
.analyze-finding-modal-hd { display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--border); }
.analyze-finding-modal-title { font-weight: 600; color: var(--text-primary); font-size: var(--font-size-md); }
.analyze-finding-modal-close { background: none; border: none; color: var(--text-muted); font-size: var(--font-size-xl); cursor: pointer; line-height: 1; }
.analyze-finding-modal-close:hover { color: var(--text-primary); }
.analyze-finding-modal-body { padding: var(--space-4) var(--space-5); overflow-y: auto; }
.analyze-finding-modal-row { margin-bottom: var(--space-3); }
.analyze-finding-modal-label { font-size: var(--font-size-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-1); }
.analyze-finding-modal-value { font-size: var(--font-size-sm); color: var(--text-primary); }
.analyze-finding-modal-value.mono { font-family: var(--font-mono); }
.analyze-finding-modal-actions { display: flex; gap: var(--space-3); padding: var(--space-4) var(--space-5); border-top: 1px solid var(--border); justify-content: flex-end; }

/* Export Actions */
.analyze-results-actions { display: flex; gap: var(--space-2); }
</style>
        `;
    }

    bindEvents(root) {
        this._root = root;
        const dropZone = root.querySelector('#analyze-drop-zone');
        const pathInput = root.querySelector('#analyze-path-input');
        const runBtn = root.querySelector('#analyze-run-btn');
        let dragDepth = 0;

        if (dropZone) {
            dropZone.addEventListener('dragenter', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dragDepth++;
                dropZone.classList.add('dragover');
            });
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer)
                    e.dataTransfer.dropEffect = 'copy';
                dropZone.classList.add('dragover');
            });
            dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dragDepth--;
                if (dragDepth <= 0) {
                    dropZone.classList.remove('dragover');
                    dragDepth = 0;
                }
            });
            dropZone.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                dragDepth = 0;
                dropZone.classList.remove('dragover');
                await this.handleDrop(e, pathInput);
            });
            dropZone.addEventListener('click', () => {
                this.openDirBrowser(pathInput);
            });
        }

        const browseBtn = root.querySelector('#analyze-browse-btn');
        if (browseBtn) {
            browseBtn.addEventListener('click', () => this.openDirBrowser(pathInput));
        }

        if (runBtn) {
            runBtn.addEventListener('click', () => this.runScan(pathInput));
        }

        if (pathInput) {
            pathInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.runScan(pathInput);
            });
        }

        // Analyzer checkbox handlers
        const selectAllBtn = root.querySelector('#analyze-select-all');
        const clearAllBtn = root.querySelector('#analyze-clear-all');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                const isPaid = authService.isPaidTier();
                root.querySelectorAll('.analyze-analyzer-checkbox').forEach((cb) => {
                    if (!isPaid && cb.dataset.tier === 'pro') return;
                    cb.checked = true;
                });
            });
        }
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                root.querySelectorAll('.analyze-analyzer-checkbox').forEach((cb) => { cb.checked = false; });
            });
        }
        root.querySelectorAll('.analyze-analyzer-select-cat').forEach((btn) => {
            btn.addEventListener('click', () => {
                const cat = btn.dataset.category;
                const isPaid = authService.isPaidTier();
                root.querySelectorAll(`.analyze-analyzer-checkbox[data-category="${cat}"]`).forEach((cb) => {
                    if (!isPaid && cb.dataset.tier === 'pro') return;
                    cb.checked = true;
                });
            });
        });
        root.querySelectorAll('.analyze-analyzer-clear-cat').forEach((btn) => {
            btn.addEventListener('click', () => {
                const cat = btn.dataset.category;
                root.querySelectorAll(`.analyze-analyzer-checkbox[data-category="${cat}"]`).forEach((cb) => { cb.checked = false; });
            });
        });
        root.querySelectorAll('.analyze-analyzer-group-toggle').forEach((toggle) => {
            toggle.addEventListener('change', () => {
                const cat = toggle.dataset.category;
                const checked = toggle.checked;
                const isPaid = authService.isPaidTier();
                root.querySelectorAll(`.analyze-analyzer-checkbox[data-category="${cat}"]`).forEach((cb) => {
                    if (!isPaid && cb.dataset.tier === 'pro') return;
                    cb.checked = checked;
                });
            });
        });

        // Scan preset buttons
        root.querySelectorAll('.analyze-preset-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                const isPaid = authService.isPaidTier();
                const map = {
                    security: ['Security'],
                    quality: ['Code Quality', 'Type Safety'],
                    ai: ['AI / LLM', 'Configuration'],
                    full: null
                };
                const cats = map[preset];
                root.querySelectorAll('.analyze-analyzer-checkbox').forEach((cb) => {
                    const cat = cb.dataset.category;
                    const tierOk = isPaid || cb.dataset.tier === 'free';
                    cb.checked = tierOk && (cats ? cats.includes(cat) : true);
                });
                // Update group toggles
                root.querySelectorAll('.analyze-analyzer-group-toggle').forEach((toggle) => {
                    const cat = toggle.dataset.category;
                    const anyUnchecked = root.querySelectorAll(`.analyze-analyzer-checkbox[data-category="${cat}"]`).length > 0 &&
                        Array.from(root.querySelectorAll(`.analyze-analyzer-checkbox[data-category="${cat}"]`)).some((cb) => !cb.checked);
                    toggle.checked = !anyUnchecked && root.querySelectorAll(`.analyze-analyzer-checkbox[data-category="${cat}"]`).length > 0;
                });
            });
        });

        // Severity filter pills
        root.querySelectorAll('.analyze-sev-pill').forEach((pill) => {
            pill.addEventListener('click', () => {
                root.querySelectorAll('.analyze-sev-pill').forEach((p) => p.classList.remove('analyze-sev-pill-active'));
                pill.classList.add('analyze-sev-pill-active');
                const sev = pill.dataset.sev;
                root.querySelectorAll('.analyze-analyzer-item').forEach((item) => {
                    const checkbox = item.querySelector('.analyze-analyzer-checkbox');
                    if (!checkbox) return;
                    const itemSev = checkbox.closest('.analyze-analyzer-item').getAttribute('title').replace('Severity: ', '');
                    if (sev === 'all' || itemSev === sev || itemSev === `Severity: ${sev}`) {
                        item.style.display = 'flex';
                    } else {
                        item.style.display = 'none';
                    }
                });
            });
        });

        // Cancel button
        const cancelBtn = root.querySelector('#analyze-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this._cancelRequested = true;
                showToast('Scan cancellation requested...', 'warning');
            });
        }

        // Export buttons
        const exportJsonBtn = root.querySelector('#analyze-export-json');
        const exportCsvBtn = root.querySelector('#analyze-export-csv');
        const exportPdfBtn = root.querySelector('#analyze-export-pdf');
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => this.exportJson());
        }
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => this.exportCsv());
        }
        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', () => this.exportPdf());
        }

        // Website scan bindings
        const websiteInput = root.querySelector('#analyze-website-input');
        const websiteBtn = root.querySelector('#analyze-website-btn');
        const websiteExportJson = root.querySelector('#analyze-website-export-json');
        if (websiteBtn) {
            websiteBtn.addEventListener('click', () => this.runWebsiteScan(websiteInput));
        }
        if (websiteInput) {
            websiteInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.runWebsiteScan(websiteInput);
            });
        }
        if (websiteExportJson) {
            websiteExportJson.addEventListener('click', () => this.exportWebsiteJson());
        }

        // Findings search
        const findingsSearch = root.querySelector('#analyze-findings-search');
        if (findingsSearch) {
            findingsSearch.addEventListener('input', () => this._applyFindingsFilter());
        }

        // Findings sort
        const findingsSort = root.querySelector('#analyze-findings-sort');
        if (findingsSort) {
            findingsSort.addEventListener('change', () => {
                this._currentSort = findingsSort.value;
                this._applyFindingsFilter();
            });
        }

        // Findings severity filter pills
        root.querySelectorAll('.analyze-findings-sev-pill').forEach((pill) => {
            pill.addEventListener('click', () => {
                root.querySelectorAll('.analyze-findings-sev-pill').forEach((p) => p.classList.remove('analyze-findings-sev-active'));
                pill.classList.add('analyze-findings-sev-active');
                this._applyFindingsFilter();
            });
        });

        // Findings show-all toggle
        const findingsToggle = root.querySelector('#analyze-findings-toggle');
        if (findingsToggle) {
            findingsToggle.addEventListener('click', () => {
                const expanded = findingsToggle.dataset.expanded === 'true';
                findingsToggle.dataset.expanded = expanded ? 'false' : 'true';
                findingsToggle.textContent = expanded ? 'Show all' : 'Show 10';
                this._applyFindingsFilter();
            });
        }

        // Keyboard shortcuts
        root.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.runScan(pathInput);
            }
            if (e.key === 'Escape') {
                this._cancelRequested = true;
                this.closeDirBrowser();
                this.closeFindingModal();
            }
        });

        // Scan history click
        root.querySelectorAll('.analyze-history-row').forEach((row) => {
            row.addEventListener('click', () => {
                const path = row.querySelector('.analyze-history-path');
                if (path && pathInput) {
                    pathInput.value = path.getAttribute('title') || path.textContent;
                    pathInput.focus();
                }
            });
        });

        // Block free users from clicking Pro checkboxes
        const isPaid = authService.isPaidTier();
        if (!isPaid) {
            root.querySelectorAll('.analyze-analyzer-checkbox[data-tier="pro"]').forEach((cb) => {
                cb.addEventListener('click', (e) => {
                    e.preventDefault();
                    showToast('This analyzer is a Pro feature. Upgrade to unlock all 63 engines.', 'error');
                });
            });
        }

        // Modal close handlers
        const overlay = root.querySelector('#analyze-dir-browser-overlay');
        const closeBtn = root.querySelector('#analyze-dir-browser-close');
        const upBtn = root.querySelector('#analyze-dir-browser-up');
        const rootBtn = root.querySelector('#analyze-dir-browser-root');
        const selectBtn = root.querySelector('#analyze-dir-browser-select');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closeDirBrowser();
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeDirBrowser());
        }
        if (upBtn) {
            upBtn.addEventListener('click', () => this.dirBrowserUp());
        }
        if (rootBtn) {
            rootBtn.addEventListener('click', () => this.dirBrowserRoot());
        }
        if (selectBtn) {
            selectBtn.addEventListener('click', () => this.dirBrowserSelect(pathInput));
        }
    }

    async loadDrives() {
        const driveSelect = this._root && this._root.querySelector('#analyze-drive-select');
        const pathInput = this._root && this._root.querySelector('#analyze-path-input');
        if (!driveSelect) return;
        const previousValue = driveSelect.value;
        try {
            const res = await fetch('/api/drives');
            const data = await res.json();
            driveSelect.innerHTML = '';
            if (data.drives && data.drives.length > 0) {
                data.drives.forEach((drive) => {
                    const option = document.createElement('option');
                    option.value = drive;
                    option.textContent = `Drive ${drive}`;
                    driveSelect.appendChild(option);
                });
                // Sync with path input if it has a drive letter
                let targetDrive = previousValue;
                if (pathInput && pathInput.value) {
                    const driveMatch = pathInput.value.match(/^([a-zA-Z]):/);
                    if (driveMatch) {
                        const driveLetter = driveMatch[1].toUpperCase() + ':';
                        if (data.drives.includes(driveLetter)) {
                            targetDrive = driveLetter;
                        }
                    }
                }
                if (targetDrive && data.drives.includes(targetDrive)) {
                    driveSelect.value = targetDrive;
                }
                if (pathInput && !pathInput.value && driveSelect.value) {
                    pathInput.value = driveSelect.value + '\\';
                }
            } else {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No drives found';
                driveSelect.appendChild(option);
            }
        } catch {
            driveSelect.innerHTML = '';
            const option = document.createElement('option');
            option.value = 'C:';
            option.textContent = 'Drive C:';
            driveSelect.appendChild(option);
        }
    }

    async handleDrop(e, pathInput) {
        const dt = e.dataTransfer;
        if (!dt) {
            showToast('No drop data received.', 'warning');
            return;
        }
        let actualPath = null;
        let entryName = '';
        let entryFullPath = '';
        let fsHandle = null;

        // 0. Try modern File System Access API (Chrome/Edge) — gives reliable directory handle and name
        if (dt.items && dt.items.length > 0 && typeof dt.items[0].getAsFileSystemHandle === 'function') {
            try {
                const handle = await dt.items[0].getAsFileSystemHandle();
                if (handle && handle.kind === 'directory') {
                    fsHandle = handle;
                    entryName = handle.name || '';
                }
            } catch {}
        }

        // 1. Try webkitGetAsEntry + getAsFile().path (Electron / VS Code: webview with enableDragAndDrop)
        if (dt.items && dt.items.length > 0) {
            const item = dt.items[0];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                if (entry) {
                    if (!entryName) entryName = entry.name || '';
                    entryFullPath = (entry.fullPath || entry.name || '').replace(/^\//, '');
                    try {
                        const droppedFile = item.getAsFile ? item.getAsFile() : null;
                        if (droppedFile && typeof droppedFile.path === 'string' && droppedFile.path.length > 0) {
                            actualPath = droppedFile.path;
                        }
                    } catch {}
                }
            }
        }

        // 2. Fallback: derive from dt.files (Electron / VS Code:)
        if (!actualPath && dt.files && dt.files.length > 0) {
            const firstFile = dt.files[0];
            if (typeof firstFile.path === 'string' && firstFile.path.length > 0) {
                const relativePath = firstFile.webkitRelativePath || '';
                if (relativePath) {
                    const parts = relativePath.split(/[\\/]/);
                    if (parts.length > 0) {
                        const lastSep = firstFile.path.lastIndexOf('\\');
                        const fileDir = lastSep > 0 ? firstFile.path.slice(0, lastSep) : firstFile.path;
                        const dirIdx = fileDir.toLowerCase().lastIndexOf(parts[0].toLowerCase());
                        if (dirIdx >= 0) {
                            actualPath = fileDir.slice(0, dirIdx + parts[0].length);
                        } else {
                            actualPath = fileDir;
                        }
                    } else {
                        const lastSep = firstFile.path.lastIndexOf('\\');
                        actualPath = lastSep > 0 ? firstFile.path.slice(0, lastSep) : firstFile.path;
                    }
                } else {
                    const lastSep = firstFile.path.lastIndexOf('\\');
                    actualPath = lastSep > 0 ? firstFile.path.slice(0, lastSep) : firstFile.path;
                }
            }
        }

        // 3. Fallback: file:// URI or raw Windows path from text/uri-list / text/plain
        if (!actualPath) {
            try {
                const raw = dt.getData('text/uri-list') || dt.getData('URL') || dt.getData('text/plain') || '';
                if (raw) {
                    const fileMatch = raw.match(/^file:\/\/\/([A-Za-z]:\/.*)$/);
                    if (fileMatch) {
                        actualPath = decodeURIComponent(fileMatch[1]).replace(/\//g, '\\\\').replace(/[\\\/$]+$/g, '');
                    } else {
                        const windowsMatch = raw.match(/^([A-Za-z]:\\\\.*)$/);
                        if (windowsMatch) {
                            actualPath = windowsMatch[1].replace(/[\\\/$]+$/g, '');
                        }
                    }
                }
            } catch {}
        }

        // If we got an absolute path, use it and remember it
        if (actualPath) {
            const isAbsolute = /^[a-zA-Z]:[\\\\/]|^\\\\|^\//.test(actualPath);
            if (pathInput) {
                pathInput.value = actualPath;
            }
            const folderName = entryName || String(actualPath).replace(/\\\\/g, '/').split('/').pop() || '';
            if (folderName && isAbsolute) {
                setScanPath(folderName, actualPath);
                showToast(`Detected path: ${actualPath}`, 'success');
            } else {
                showToast(`Detected relative path "${actualPath}" -- please verify and click Run`, 'warning');
            }
            return;
        }

        // Browser sandbox: no absolute path available -- try to extract folder name from various sources
        if (!entryName && dt.items && dt.items.length > 0) {
            const item = dt.items[0].webkitGetAsEntry ? dt.items[0].webkitGetAsEntry() : null;
            if (item) {
                entryName = item.name || entryName;
            }
        }
        if (!entryName && dt.files && dt.files.length > 0) {
            entryName = dt.files[0].name || '';
        }
        // Fallback: try to get name from text/plain drop data
        if (!entryName) {
            try {
                const plain = dt.getData('text/plain') || '';
                if (plain) {
                    const lastPart = plain.replace(/\\/g, '/').split('/').pop() || '';
                    if (lastPart && !lastPart.includes(':')) entryName = lastPart;
                }
            } catch {}
        }
        // Fallback: try to get name from text/uri-list
        if (!entryName) {
            try {
                const uri = dt.getData('text/uri-list') || '';
                if (uri) {
                    const decoded = decodeURIComponent(uri).replace(/\\/g, '/');
                    const lastPart = decoded.split('/').pop() || '';
                    if (lastPart && !lastPart.includes(':')) entryName = lastPart;
                }
            } catch {}
        }

        const rememberedPath = entryName ? recallScanPath(entryName) : null;
        if (rememberedPath && pathInput) {
            pathInput.value = rememberedPath;
            showToast(`Recalled path for "${entryName}": ${rememberedPath}. Click Run to scan.`, 'info');
            return;
        }
        if (!entryName) {
            showToast('Could not determine folder name from drop. Please browse manually.', 'warning');
            return;
        }
        showToast(`Searching drives for "${entryName}"...`, 'info');
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const body = { folderName: entryName, maxDepth: 4 };
            const res = await fetch('/api/find-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const data = await res.json();
            if (data.success && data.results.length > 0) {
                if (data.results.length === 1) {
                    const foundPath = data.results[0];
                    if (pathInput) pathInput.value = foundPath;
                    setScanPath(entryName, foundPath);
                    showToast(`Auto-located "${entryName}" at ${foundPath}. Click Run to scan.`, 'success');
                } else {
                    this.showFindPicker(pathInput, entryName, data.results);
                }
                return;
            }
        } catch (err) {
            if (err && err.name === 'AbortError') {
                showToast(`Search timed out. Please select the folder manually.`, 'warning');
            } else {
                console.error('find-folder fetch failed:', err);
            }
        }
        if (pathInput && entryName) {
            pathInput.value = entryName;
        }
        showToast(
            `Browsers can't reveal full paths. Please browse or type the full path to "${entryName}".`,
            'warning'
        );
    }

    openDirBrowser(pathInput) {
        const overlay = this._root.querySelector('#analyze-dir-browser-overlay');
        if (overlay) overlay.style.display = 'flex';
        const currentPath = pathInput && pathInput.value ? pathInput.value.trim() : '';
        const startPath = /^[a-zA-Z]:[\\/]|^\\/.test(currentPath) ? currentPath : 'C:\\';
        this._dirBrowserPath = startPath;
        this._dirBrowserStack = [];
        this._dirBrowserPathInput = pathInput;
        this.loadDirBrowser(startPath);
    }

    closeDirBrowser() {
        const overlay = this._root.querySelector('#analyze-dir-browser-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    showFindPicker(pathInput, folderName, paths) {
        const existing = this._root.querySelector('.analyze-find-picker-overlay');
        if (existing) existing.remove();
        const overlay = document.createElement('div');
        overlay.className = 'analyze-find-picker-overlay';
        overlay.innerHTML = '<div class="analyze-find-picker">' +
            '<div class="analyze-find-picker-hd">' +
            '<span>Select "' + escapeHtml(folderName) + '" location</span>' +
            '<button type="button" class="analyze-find-picker-close" aria-label="Close">&times;</button>' +
            '</div>' +
            '<div class="analyze-find-picker-sub">Multiple matches found — click the correct path:</div>' +
            '<div class="analyze-find-picker-list">' +
            paths.map((p, i) => '<button type="button" class="analyze-find-picker-item" data-index="' + i + '">' + escapeHtml(p) + '</button>').join('') +
            '</div>' +
            '<div class="analyze-find-picker-actions">' +
            '<button type="button" class="analyze-btn-secondary" id="analyze-find-picker-browse">Browse manually</button>' +
            '</div>' +
            '</div>';
        this._root.appendChild(overlay);
        const closeBtn = overlay.querySelector('.analyze-find-picker-close');
        const browseBtn = overlay.querySelector('#analyze-find-picker-browse');
        const removeOverlay = () => {
            overlay.remove();
            document.removeEventListener('keydown', keyDismiss);
        };
        const keyDismiss = (e) => {
            if (e.key === 'Escape') removeOverlay();
        };
        if (closeBtn) closeBtn.addEventListener('click', removeOverlay);
        if (browseBtn) browseBtn.addEventListener('click', () => {
            removeOverlay();
            this.openDirBrowser(pathInput);
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) removeOverlay();
        });
        overlay.querySelectorAll('.analyze-find-picker-item').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index || '0', 10);
                const selected = paths[idx];
                if (selected && pathInput) {
                    pathInput.value = selected;
                    setScanPath(folderName, selected);
                    showToast(`Selected "${folderName}" at ${selected}. Click Run to scan.`, 'success');
                }
                removeOverlay();
            });
        });
        document.addEventListener('keydown', keyDismiss);
    }

    dirBrowserUp() {
        if (this._dirBrowserStack.length > 0) {
            const parent = this._dirBrowserStack.pop();
            this._dirBrowserPath = parent;
            this.loadDirBrowser(parent);
            return;
        }
        const parts = this._dirBrowserPath.split('\\').filter(Boolean);
        if (parts.length > 1) {
            parts.pop();
            const parent = parts.join('\\') || '\\';
            this._dirBrowserPath = parent;
            this.loadDirBrowser(parent);
        } else {
            // At drive root -- show all drives
            this.loadDrivesBrowser();
        }
    }

    dirBrowserRoot() {
        const driveMatch = this._dirBrowserPath.match(/^([a-zA-Z]:)/);
        if (driveMatch) {
            const root = driveMatch[1] + '\\';
            this._dirBrowserPath = root;
            this._dirBrowserStack = [];
            this.loadDirBrowser(root);
        } else {
            this.loadDrivesBrowser();
        }
    }

    async loadDrivesBrowser() {
        const listEl = this._root.querySelector('#analyze-dir-browser-list');
        const pathEl = this._root.querySelector('#analyze-dir-browser-path');
        if (pathEl) pathEl.textContent = 'Drives';
        if (listEl) listEl.innerHTML = '<div class="analyze-dir-browser-loading">Loading...</div>';
        try {
            const res = await fetch('/api/drives');
            const data = await res.json();
            if (data.drives && listEl) {
                listEl.innerHTML = data.drives.map((drive) =>
                    `<div class="analyze-dir-browser-item" data-path="${escapeHtml(drive + '\\')}">` +
                    `<span class="analyze-dir-browser-item-icon">&#128190;</span>` +
                    `<span>Drive ${escapeHtml(drive)}</span>` +
                    '</div>'
                ).join('');
                listEl.querySelectorAll('.analyze-dir-browser-item').forEach((item) => {
                    item.addEventListener('click', () => {
                        const nextPath = item.dataset.path;
                        if (nextPath) {
                            this._dirBrowserStack.push(this._dirBrowserPath);
                            this._dirBrowserPath = nextPath;
                            this.loadDirBrowser(nextPath);
                        }
                    });
                });
            } else {
                if (listEl) listEl.innerHTML = '<div class="analyze-dir-browser-empty">No drives found</div>';
            }
        } catch {
            if (listEl) listEl.innerHTML = '<div class="analyze-dir-browser-empty">Failed to load drives</div>';
        }
    }

    dirBrowserSelect(pathInput) {
        if (pathInput) {
            pathInput.value = this._dirBrowserPath;
        }
        this.closeDirBrowser();
        showToast(`Selected: ${this._dirBrowserPath}`, 'info');
    }

    async loadDirBrowser(dirPath) {
        const listEl = this._root.querySelector('#analyze-dir-browser-list');
        const pathEl = this._root.querySelector('#analyze-dir-browser-path');
        if (pathEl) pathEl.textContent = dirPath;
        if (listEl) listEl.innerHTML = '<div class="analyze-dir-browser-loading">Loading...</div>';
        try {
            const res = await fetch('/api/list-directory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: dirPath })
            });
            const data = await res.json();
            if (data.success && listEl) {
                if (data.entries.length === 0) {
                    listEl.innerHTML = '<div class="analyze-dir-browser-empty">No subdirectories</div>';
                } else {
                    listEl.innerHTML = data.entries.map((entry) =>
                        `<div class="analyze-dir-browser-item" data-path="${escapeHtml(entry.path)}">` +
                        `<span class="analyze-dir-browser-item-icon">&#128193;</span>` +
                        `<span>${escapeHtml(entry.name)}</span>` +
                        '</div>'
                    ).join('');
                    listEl.querySelectorAll('.analyze-dir-browser-item').forEach((item) => {
                        item.addEventListener('click', () => {
                            const nextPath = item.dataset.path;
                            console.log('[AnalyzeView] folder clicked:', nextPath);
                            if (nextPath) {
                                this._dirBrowserPath = nextPath;
                                this.dirBrowserSelect(this._dirBrowserPathInput);
                            }
                        });
                    });
                }
            } else {
                if (listEl) listEl.innerHTML = '<div class="analyze-dir-browser-empty">Unable to read directory</div>';
            }
        } catch {
            if (listEl) listEl.innerHTML = '<div class="analyze-dir-browser-empty">Failed to load directory</div>';
        }
    }

    async runScan(pathInput) {
        if (!pathInput)
            return;
        const targetPath = pathInput.value.trim();
        if (!targetPath) {
            showToast('Please enter a target path.', 'warning');
            pathInput.focus();
            return;
        }
        if (this.busy)
            return;
        this.busy = true;
        this._cancelRequested = false;
        const runBtn = this._root.querySelector('#analyze-run-btn');
        const runLabel = this._root.querySelector('#analyze-run-label');
        const progressSection = this._root.querySelector('#analyze-progress-section');
        const progressBar = this._root.querySelector('#analyze-progress-bar-fill');
        const progressMeta = this._root.querySelector('#analyze-progress-meta');
        const progressStatus = this._root.querySelector('#analyze-progress-status');
        if (runBtn)
            runBtn.disabled = true;
        if (runLabel)
            runLabel.textContent = 'Scanning...';
        if (progressSection)
            progressSection.style.display = 'block';
        if (progressBar)
            progressBar.style.width = '5%';
        if (progressStatus)
            progressStatus.textContent = 'Initializing scan...';

        const resultsSection = this._root.querySelector('#analyze-results');
        if (resultsSection)
            resultsSection.style.display = 'none';

        // Collect selected analyzer IDs (filter by tier for free users)
        const isPaid = authService.isPaidTier();
        const selectedIds = Array.from(this._root.querySelectorAll('.analyze-analyzer-checkbox:checked'))
            .map((cb) => parseInt(cb.value, 10))
            .filter((id) => isPaid || id <= 24);

        const startTime = performance.now();
        try {
            // Simulate progress updates
            let progress = 5;
            const progressInterval = setInterval(() => {
                if (this._cancelRequested) {
                    clearInterval(progressInterval);
                    return;
                }
                progress = Math.min(progress + Math.random() * 15, 90);
                if (progressBar)
                    progressBar.style.width = `${progress}%`;
                if (progressMeta)
                    progressMeta.textContent = `Scanning ${Math.floor(progress)}% complete...`;
            }, 800);

            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: targetPath, analyzerIds: selectedIds })
            });
            clearInterval(progressInterval);
            if (this._cancelRequested) {
                showToast('Scan cancelled.', 'warning');
                return;
            }

            if (progressBar)
                progressBar.style.width = '100%';
            if (progressStatus)
                progressStatus.textContent = 'Finalizing...';

            const data = await response.json();
            if (data.success) {
                this._lastResult = data;
                try { sessionStorage.setItem(SS_LAST_RESULT, JSON.stringify(data)); } catch { }
                this.renderResults(data, startTime);
                const report = data.report || {};
                const totalFindings = (report.rawIssues || []).length;
                showToast(`Scan complete: ${formatNumber(data.metrics.totalFiles)} files, ${formatNumber(totalFindings)} findings.`, 'success');
                // Add to history
                const score = this.computeSecurityScore(report);
                this._scanHistory.unshift({
                    time: new Date(),
                    path: data.scannedPath || targetPath,
                    fileCount: data.metrics.totalFiles,
                    score: score
                });
            } else {
                showToast(data.error || 'Scan failed.', 'error');
            }
        } catch (err) {
            showToast('Scan request failed. Is the backend running?', 'error');
            console.error(err);
        } finally {
            this.busy = false;
            if (runBtn)
                runBtn.disabled = false;
            if (runLabel)
                runLabel.textContent = 'Run Analyzer';
            setTimeout(() => {
                if (progressSection)
                    progressSection.style.display = 'none';
                if (progressBar)
                    progressBar.style.width = '0%';
            }, 500);
        }
    }

    computeSecurityScore(report) {
        const sev = report.severityCounts || { critical: 0, high: 0, medium: 0, low: 0 };
        const raw = report.rawIssues || [];
        const total = raw.length || 1;
        const weighted = sev.critical * 16 + sev.high * 8 + sev.medium * 4 + sev.low;
        const maxPossible = total * 16 || 16;
        return Math.max(0, 100 - Math.round((weighted / maxPossible) * 100));
    }

    exportJson() {
        if (!this._lastResult) {
            showToast('No scan results to export.', 'warning');
            return;
        }
        const blob = new Blob([JSON.stringify(this._lastResult, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simplebeacon-scan-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('JSON exported.', 'success');
    }

    async runWebsiteScan(inputEl) {
        if (!inputEl) return;
        const url = String(inputEl.value || '').trim();
        if (!url) {
            showToast('Please enter a website URL.', 'warning');
            return;
        }
        if (!/^https?:\/\//i.test(url)) {
            showToast('URL must start with http:// or https://', 'warning');
            return;
        }
        if (!authService.isPaidTier()) {
            showToast('Website scanning requires a Pro or higher tier.', 'warning');
            return;
        }
        const root = this._root;
        const progress = root.querySelector('#analyze-website-progress');
        const bar = root.querySelector('#analyze-website-bar');
        const status = root.querySelector('#analyze-website-status');
        const results = root.querySelector('#analyze-website-results');
        const btn = root.querySelector('#analyze-website-btn');
        const label = root.querySelector('#analyze-website-label');

        if (progress) progress.style.display = '';
        if (bar) bar.style.width = '30%';
        if (status) status.textContent = 'Scanning website...';
        if (results) results.style.display = 'none';
        if (btn) btn.disabled = true;
        if (label) label.textContent = 'Scanning...';

        try {
            const res = await fetch('/api/analyze/website', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, scanTypes: ['ai-slop', 'pii'] })
            });
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || 'Website scan failed');
            }
            this._lastWebsiteResult = data;
            if (bar) bar.style.width = '100%';
            if (status) status.textContent = 'Scan complete';
            this.renderWebsiteResults(data);
            if (results) results.style.display = '';
            showToast('Website scan complete.', 'success');
        } catch (err) {
            if (status) status.textContent = 'Scan failed';
            showToast(err.message || 'Website scan failed', 'error');
        } finally {
            if (btn) btn.disabled = false;
            if (label) label.textContent = 'Scan Website';
            setTimeout(() => { if (progress) progress.style.display = 'none'; }, 1200);
        }
    }

    renderWebsiteResults(data) {
        const root = this._root;
        const metricsEl = root.querySelector('#analyze-website-metrics');
        const issuesWrap = root.querySelector('#analyze-website-issues-wrap');
        const sev = data.severityCounts || {};
        const findings = data.findings || [];

        if (metricsEl) {
            metricsEl.innerHTML = `
                <div class="analyze-metric-card">
                    <div class="analyze-metric-value">${findings.length}</div>
                    <div class="analyze-metric-label">Findings</div>
                </div>
                <div class="analyze-metric-card">
                    <div class="analyze-metric-value" style="color:#ef4444">${sev.critical || 0}</div>
                    <div class="analyze-metric-label">Critical</div>
                </div>
                <div class="analyze-metric-card">
                    <div class="analyze-metric-value" style="color:#f97316">${sev.high || 0}</div>
                    <div class="analyze-metric-label">High</div>
                </div>
                <div class="analyze-metric-card">
                    <div class="analyze-metric-value" style="color:#eab308">${sev.medium || 0}</div>
                    <div class="analyze-metric-label">Medium</div>
                </div>
                <div class="analyze-metric-card">
                    <div class="analyze-metric-value">${data.scanTimeMs || 0}ms</div>
                    <div class="analyze-metric-label">Scan Time</div>
                </div>
            `;
        }

        if (issuesWrap) {
            if (findings.length === 0) {
                issuesWrap.innerHTML = '<div class="analyze-empty">No findings detected.</div>';
            } else {
                const rows = findings.map((f) => {
                    const s = (f.severity || 'low').toLowerCase();
                    const color = s === 'critical' ? '#ef4444' : s === 'high' ? '#f97316' : s === 'medium' ? '#eab308' : '#22c55e';
                    return `<tr>
                        <td style="padding:8px;border-bottom:1px solid #eee;font-size:11px;text-transform:uppercase;color:${color};font-weight:600">${s}</td>
                        <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px;font-family:monospace">${escapeHtml(f.id)}</td>
                        <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px">${escapeHtml(f.message)}</td>
                        <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px;color:#666;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(f.match)}">${escapeHtml(f.match)}</td>
                        <td style="padding:8px;border-bottom:1px solid #eee;font-size:11px;color:#888">${escapeHtml(f.source)}</td>
                    </tr>`;
                }).join('');
                issuesWrap.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px">
                    <thead><tr>
                        <th style="text-align:left;padding:8px;border-bottom:2px solid #e5e7eb;font-size:11px;text-transform:uppercase;color:#666">Severity</th>
                        <th style="text-align:left;padding:8px;border-bottom:2px solid #e5e7eb;font-size:11px;text-transform:uppercase;color:#666">ID</th>
                        <th style="text-align:left;padding:8px;border-bottom:2px solid #e5e7eb;font-size:11px;text-transform:uppercase;color:#666">Message</th>
                        <th style="text-align:left;padding:8px;border-bottom:2px solid #e5e7eb;font-size:11px;text-transform:uppercase;color:#666">Match</th>
                        <th style="text-align:left;padding:8px;border-bottom:2px solid #e5e7eb;font-size:11px;text-transform:uppercase;color:#666">Source</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>`;
            }
        }
    }

    exportWebsiteJson() {
        if (!this._lastWebsiteResult) {
            showToast('No website scan results to export.', 'warning');
            return;
        }
        const blob = new Blob([JSON.stringify(this._lastWebsiteResult, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simplebeacon-website-scan-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Website scan JSON exported.', 'success');
    }

    exportPdf() {
        if (!this._lastResult) {
            showToast('No scan results to export.', 'warning');
            return;
        }
        const report = this._lastResult.report || {};
        const rawIssues = report.rawIssues || [];
        const sev = report.severityCounts || { critical: 0, high: 0, medium: 0, low: 0 };
        const score = this.computeSecurityScore(report);
        const metrics = this._lastResult.metrics || {};
        const path = escapeHtml(this._lastResult.scannedPath || '—');

        const rows = rawIssues.map((issue) => {
            const s = (issue.severity || 'low').toLowerCase();
            return `<tr>
                <td style="padding:8px;border-bottom:1px solid #ddd;font-size:12px;text-transform:uppercase;color:${s === 'critical' ? '#ef4444' : s === 'high' ? '#f97316' : s === 'medium' ? '#eab308' : '#22c55e'}">${s}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;font-size:12px;font-family:monospace">${escapeHtml(issue.file || '—')}${issue.line ? ':' + issue.line : ''}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;font-size:12px">${escapeHtml(issue.name || issue.analyzer || 'Finding')}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;font-size:12px;color:#666">${escapeHtml(issue.message || issue.description || '')}</td>
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>SimpleBeacon Scan Report</title>
<style>
body { font-family: Inter, system-ui, sans-serif; padding: 40px; color: #111; background: #fff; }
h1 { font-size: 24px; margin-bottom: 8px; }
.meta { color: #666; font-size: 13px; margin-bottom: 24px; }
.kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.kpi-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; }
.kpi-val { font-size: 20px; font-weight: 700; }
.kpi-lbl { font-size: 11px; color: #666; text-transform: uppercase; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { text-align: left; padding: 8px; border-bottom: 2px solid #e5e7eb; font-size: 11px; text-transform: uppercase; color: #666; }
</style></head>
<body>
<h1>SimpleBeacon Scan Report</h1>
<div class="meta">Path: ${path} &middot; Score: ${score}/100 &middot; Files: ${formatNumber(metrics.totalFiles || 0)} &middot; Date: ${formatDate(new Date())}</div>
<div class="kpi">
  <div class="kpi-box"><div class="kpi-val" style="color:#ef4444">${sev.critical || 0}</div><div class="kpi-lbl">Critical</div></div>
  <div class="kpi-box"><div class="kpi-val" style="color:#f97316">${sev.high || 0}</div><div class="kpi-lbl">High</div></div>
  <div class="kpi-box"><div class="kpi-val" style="color:#eab308">${sev.medium || 0}</div><div class="kpi-lbl">Medium</div></div>
  <div class="kpi-box"><div class="kpi-val" style="color:#22c55e">${sev.low || 0}</div><div class="kpi-lbl">Low</div></div>
</div>
<table><thead><tr><th>Severity</th><th>File</th><th>Issue</th><th>Description</th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="padding:8px;color:#666">No issues found.</td></tr>'}</tbody></table>
</body></html>`;

        const w = window.open('', '_blank');
        if (w) {
            w.document.write(html);
            w.document.close();
            w.print();
        } else {
            showToast('Pop-up blocked. Please allow pop-ups for PDF export.', 'warning');
        }
    }

    renderResults(data, startTime) {
        const resultsSection = this._root.querySelector('#analyze-results');
        const timeSpan = this._root.querySelector('#analyze-results-time');
        const filesMetric = this._root.querySelector('#analyze-metric-files');
        const sizeMetric = this._root.querySelector('#analyze-metric-size');
        const extMetric = this._root.querySelector('#analyze-metric-ext');
        const pathMetric = this._root.querySelector('#analyze-metric-path');
        const tableBody = this._root.querySelector('#analyze-ext-table');
        const report = data.report || {};
        const scoreSlot = this._root.querySelector('#analyze-score-slot');
        const donutSlot = this._root.querySelector('#analyze-donut-slot');
        const score = this.computeSecurityScore(report);
        const sev = report.severityCounts || { critical: 0, high: 0, medium: 0, low: 0 };

        if (resultsSection)
            resultsSection.style.display = 'block';
        if (timeSpan)
            timeSpan.textContent = `Scanned in ${((performance.now() - startTime) / 1000).toFixed(2)}s · ${formatDate(new Date())}`;
        if (filesMetric)
            filesMetric.textContent = formatNumber(data.metrics.totalFiles);
        if (sizeMetric)
            sizeMetric.textContent = formatBytes(data.metrics.totalSize);
        if (extMetric) {
            const extCount = Object.keys(data.metrics.breakdown).length;
            extMetric.textContent = formatNumber(extCount);
        }
        if (pathMetric)
            pathMetric.textContent = escapeHtml(data.scannedPath);
        if (scoreSlot)
            scoreSlot.innerHTML = this.renderSecurityScore(score);
        if (donutSlot)
            donutSlot.innerHTML = this.renderSeverityDonut(sev.critical, sev.high, sev.medium, sev.low);

        if (tableBody) {
            const entries = Object.entries(data.metrics.breakdown)
                .sort((a, b) => b[1] - a[1]);
            const total = data.metrics.totalFiles || 1;
            if (entries.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="3" class="analyze-empty">No files found.</td></tr>`;
            } else {
                tableBody.innerHTML = entries.map(([ext, count]) => {
                    const pct = ((count / total) * 100).toFixed(1);
                    return `<tr><td>${escapeHtml(ext)}</td><td>${formatNumber(count)}</td><td>${pct}%</td></tr>`;
                }).join('');
            }
        }

        // Render SimpleBeacon findings
        this.renderFindings(report);
    }

    renderFindings(report) {
        if (!report) return;
        const findingsSection = this._root.querySelector('#analyze-findings-section');
        const findingsCount = this._root.querySelector('#analyze-findings-count');
        const findingsList = this._root.querySelector('#analyze-findings-list');
        const toggleBtn = this._root.querySelector('#analyze-findings-toggle');
        if (!findingsSection || !findingsList) return;

        const findings = report.findings || [];
        const rawIssues = report.rawIssues || [];
        const severityCounts = report.severityCounts || { critical: 0, high: 0, medium: 0, low: 0 };
        const gate = report.gate || {};

        const totalIssues = rawIssues.length;
        if (totalIssues === 0 && findings.length === 0) {
            findingsSection.style.display = 'none';
            return;
        }
        findingsSection.style.display = 'block';
        if (findingsCount)
            findingsCount.textContent = `${totalIssues} issues · ${gate.pass ? 'PASS' : 'FAIL'}`;
        if (toggleBtn)
            toggleBtn.textContent = rawIssues.length > 10 ? 'Show all' : '';

        const allIssues = rawIssues.length > 0 ? rawIssues : findings;

        // Render severity breakdown badges
        const badgesEl = this._root.querySelector('#analyze-findings-badges');
        if (badgesEl) {
            const sev = severityCounts;
            const badges = [];
            if (sev.critical) badges.push(`<span class="analyze-findings-badge analyze-badge-critical">Critical: ${sev.critical}</span>`);
            if (sev.high) badges.push(`<span class="analyze-findings-badge analyze-badge-high">High: ${sev.high}</span>`);
            if (sev.medium) badges.push(`<span class="analyze-findings-badge analyze-badge-medium">Medium: ${sev.medium}</span>`);
            if (sev.low) badges.push(`<span class="analyze-findings-badge analyze-badge-low">Low: ${sev.low}</span>`);
            badgesEl.innerHTML = badges.join('');
        }

        if (allIssues.length > 0) {
            findingsList.innerHTML = allIssues.map((issue, idx) => {
                const sev = (issue.severity || 'low').toLowerCase();
                const name = escapeHtml(issue.name || issue.analyzer || 'Finding');
                const file = escapeHtml(issue.file || '—') + (issue.line ? ':' + issue.line : '');
                const desc = escapeHtml(issue.message || issue.description || '');
                const hidden = idx >= 10 ? 'hidden' : '';
                return `
                <div class="analyze-finding-card ${hidden}" data-sev="${sev}" data-name="${name.toLowerCase()}" data-file="${file.toLowerCase()}" data-desc="${desc.toLowerCase()}" data-issue='${escapeHtml(JSON.stringify(issue))}'>
                    <div class="analyze-finding-hd">
                        <span class="analyze-finding-sev analyze-finding-sev-${sev}">${sev}</span>
                        <span class="analyze-finding-name">${name}</span>
                    </div>
                    <div class="analyze-finding-file">${file}</div>
                    <div class="analyze-finding-desc">${desc}</div>
                </div>`;
            }).join('');
            findingsList.querySelectorAll('.analyze-finding-card').forEach((card) => {
                card.addEventListener('click', () => this.openFindingModal(card));
            });
        } else {
            findingsList.innerHTML = '<p class="analyze-empty">No issues detected.</p>';
        }

        // Reset search and filter states
        const searchInput = this._root.querySelector('#analyze-findings-search');
        if (searchInput) searchInput.value = '';
        this._root.querySelectorAll('.analyze-findings-sev-pill').forEach((p) => p.classList.remove('analyze-findings-sev-active'));
        const allPill = this._root.querySelector('.analyze-findings-sev-pill[data-fsev="all"]');
        if (allPill) allPill.classList.add('analyze-findings-sev-active');
    }

    openFindingModal(card) {
        const issueRaw = card.dataset.issue;
        if (!issueRaw) return;
        let issue;
        try { issue = JSON.parse(issueRaw); } catch { return; }
        const sev = (issue.severity || 'low').toLowerCase();
        const name = escapeHtml(issue.name || issue.analyzer || 'Finding');
        const file = escapeHtml(issue.file || '—');
        const line = issue.line || '';
        const desc = escapeHtml(issue.message || issue.description || '');
        const overlay = document.createElement('div');
        overlay.className = 'analyze-finding-modal-overlay';
        overlay.id = 'analyze-finding-modal-overlay';
        overlay.innerHTML = `
        <div class="analyze-finding-modal">
            <div class="analyze-finding-modal-hd">
                <span class="analyze-finding-modal-title">${name}</span>
                <button type="button" class="analyze-finding-modal-close" id="analyze-finding-modal-close" aria-label="Close">&times;</button>
            </div>
            <div class="analyze-finding-modal-body">
                <div class="analyze-finding-modal-row">
                    <div class="analyze-finding-modal-label">Severity</div>
                    <div class="analyze-finding-modal-value"><span class="analyze-finding-sev analyze-finding-sev-${sev}">${sev}</span></div>
                </div>
                <div class="analyze-finding-modal-row">
                    <div class="analyze-finding-modal-label">File</div>
                    <div class="analyze-finding-modal-value mono">${file}${line ? ':' + line : ''}</div>
                </div>
                <div class="analyze-finding-modal-row">
                    <div class="analyze-finding-modal-label">Description</div>
                    <div class="analyze-finding-modal-value">${desc || '—'}</div>
                </div>
            </div>
            <div class="analyze-finding-modal-actions">
                <button type="button" class="analyze-btn-secondary" id="analyze-finding-modal-copy">Copy details</button>
                <button type="button" class="analyze-btn-primary" id="analyze-finding-modal-close-btn">Close</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeFindingModal(); });
        const closeBtn = overlay.querySelector('#analyze-finding-modal-close');
        const closeBtn2 = overlay.querySelector('#analyze-finding-modal-close-btn');
        const copyBtn = overlay.querySelector('#analyze-finding-modal-copy');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeFindingModal());
        if (closeBtn2) closeBtn2.addEventListener('click', () => this.closeFindingModal());
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const text = `${name}\nSeverity: ${sev}\nFile: ${file}${line ? ':' + line : ''}\n${desc}`;
                const tryCopy = () => {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        return navigator.clipboard.writeText(text);
                    }
                    return Promise.reject(new Error('Clipboard API unavailable'));
                };
                tryCopy().then(() => showToast('Copied to clipboard', 'success')).catch(() => {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.position = 'fixed';
                    ta.style.left = '-9999px';
                    document.body.appendChild(ta);
                    ta.focus();
                    ta.select();
                    let ok = false;
                    try { ok = document.execCommand('copy'); } catch { /* ignore */ }
                    document.body.removeChild(ta);
                    showToast(ok ? 'Copied to clipboard' : 'Copy failed', ok ? 'success' : 'error');
                });
            });
        }
    }

    closeFindingModal() {
        const overlay = document.getElementById('analyze-finding-modal-overlay');
        if (overlay) overlay.remove();
    }

    exportCsv() {
        if (!this._lastResult) {
            showToast('No scan results to export.', 'warning');
            return;
        }
        const report = this._lastResult.report || {};
        const rawIssues = report.rawIssues || [];
        const rows = rawIssues.map((issue) => {
            const sev = (issue.severity || 'low').toLowerCase();
            const name = (issue.name || issue.analyzer || 'Finding').replace(/"/g, '""');
            const file = (issue.file || '—').replace(/"/g, '""');
            const line = issue.line || '';
            const desc = (issue.message || issue.description || '').replace(/"/g, '""');
            return `"${sev}","${name}","${file}","${line}","${desc}"`;
        });
        const csv = 'Severity,Name,File,Line,Description\n' + rows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simplebeacon-scan-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('CSV exported.', 'success');
    }

    _applyFindingsFilter() {
        const root = this._root;
        if (!root) return;
        const searchInput = root.querySelector('#analyze-findings-search');
        const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
        const activeSevPill = root.querySelector('.analyze-findings-sev-pill.analyze-findings-sev-active');
        const sevFilter = activeSevPill ? activeSevPill.dataset.fsev : 'all';
        const toggleBtn = root.querySelector('#analyze-findings-toggle');
        const showAll = toggleBtn ? toggleBtn.dataset.expanded === 'true' : false;
        const sortMode = this._currentSort || 'severity';

        // Collect matching cards
        const cards = Array.from(root.querySelectorAll('.analyze-finding-card'));
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const matching = [];
        cards.forEach((card) => {
            const sev = card.dataset.sev || '';
            const name = card.dataset.name || '';
            const file = card.dataset.file || '';
            const desc = card.dataset.desc || '';

            const matchesSev = sevFilter === 'all' || sev === sevFilter;
            const matchesSearch = !query || name.includes(query) || file.includes(query) || desc.includes(query);

            if (matchesSev && matchesSearch) {
                matching.push(card);
            } else {
                card.classList.add('hidden');
            }
        });

        // Sort matching cards
        matching.sort((a, b) => {
            if (sortMode === 'severity') {
                return (severityOrder[a.dataset.sev] || 99) - (severityOrder[b.dataset.sev] || 99);
            }
            if (sortMode === 'file') {
                return (a.dataset.file || '').localeCompare(b.dataset.file || '');
            }
            if (sortMode === 'name') {
                return (a.dataset.name || '').localeCompare(b.dataset.name || '');
            }
            return 0;
        });

        // Show/hide based on limit
        matching.forEach((card, idx) => {
            if (!showAll && idx >= 10) {
                card.classList.add('hidden');
            } else {
                card.classList.remove('hidden');
            }
        });
    }
}
