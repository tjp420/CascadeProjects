import { formatPathLabel, redactPathForDisplay, showToast, escapeHtml } from '../utils.js';
import { refreshLiveReport, normalizeProjectPath, shouldPreferLiveReport, shouldClearHostedServerDefaultPath } from '../services/analyzeService.js?v=20260716cachefix1';
import { isDemoMode, demoReadOnlyMessage } from '../demoMode.js';
import { isBenchmarkCachePath } from '../utils/complete-scan-artifact-profile.browser.js';
import { isRemoteRepoUrl } from './analyzePathSources.js';
/** Known artifact / export directory suffixes that should not be part of a project path. */
const ARTIFACT_SUFFIXES = [
    /[/\\]simplebeacon-export-[^/\\]+$/i,
    /[/\\]complete-scan-[^/\\]+\.json$/i,
    /[/\\]cleanup-export-[^/\\]+\.json$/i,
    /[/\\]fiction-digest-[^/\\]+\.json$/i,
    /[/\\]file-reduction-[^/\\]+\.json$/i,
    /[/\\]data-quality-[^/\\]+\.json$/i,
    /[/\\]roadmap-[^/\\]+\.json$/i,
    /[/\\]consolidation-[^/\\]+\.json$/i,
    /[/\\]codebase-[^/\\]+\.json$/i,
    /[/\\]npm-audit-[^/\\]+\.json$/i,
];
/**
 * Strip artifact suffixes.
 * @param {string} path
 * @returns {any}
 */
function stripArtifactSuffixes(path) {
    const raw = String(path || '').trim().replace(/\\/g, '/');
    for (const pattern of ARTIFACT_SUFFIXES) {
        if (pattern.test(raw)) {
            return raw.replace(pattern, '');
        }
    }
    return path;
}
/**
 * Is plausible project path.
 * @param {any} value
 * @returns {any}
 */
function isPlausibleProjectPath(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.length > 280)
        return false;
    if (isRemoteRepoUrl(raw))
        return true;
    if (/outside allowed analysis roots|projectPath is required|projectPath is outside/i.test(raw)) {
        return false;
    }
    const cleaned = stripArtifactSuffixes(raw);
    if (/^[a-zA-Z]:[\\/]/.test(cleaned))
        return true;
    if (cleaned.startsWith('\\\\') || cleaned.startsWith('/'))
        return true;
    if (/^[\w.-]+([\\/]|$)/.test(cleaned))
        return true;
    return false;
}
/** Read typed path from the active page path bar (Analyze bar or Dashboard scan input). */
export function readProjectPathInput(root) {
    var _a;
    const scope = root && typeof root.querySelector === 'function' ? root : document;
    const el = scope.querySelector('#project-path-input') || scope.querySelector('#scan-root-input');
    return (_a = el === null || el === void 0 ? void 0 : el.value) !== null && _a !== void 0 ? _a : '';
}
/**
 * Resolve the repo path for dashboard page scans — uses the typed path as-is
 * (no silent upgrade to the server default / nested ai-platform folder).
 */
/**
 * Detects a suspicious nested duplicate path such as /foo/foo inside /foo.
 * These often occur when the user accidentally selects a duplicate folder.
 * @param {string} candidate
 * @param {string} defaultPath
 * @returns {boolean}
 */
function isSuspiciousNestedPath(candidate, defaultPath) {
    const c = String(candidate || '').replace(/\\/g, '/').replace(/\/+$/, '');
    const d = String(defaultPath || '').replace(/\\/g, '/').replace(/\/+$/, '');
    if (!c || !d || c === d)
        return false;
    const candidateBasename = c.split('/').pop();
    const defaultBasename = d.split('/').pop();
    return Boolean(candidateBasename && defaultBasename && candidateBasename === defaultBasename && c.startsWith(d + '/'));
}
/**
 * Detects a client/server path mismatch: a saved local path (e.g., C:\Users\...) is being
 * reused against a remote server whose default path is on a different OS (e.g., /opt/render/...).
 * In that case the saved path cannot be scanned by the server, so we fall back to the default.
 * @param {string} candidate
 * @param {string} defaultPath
 * @returns {boolean}
 */
function isClientServerPathMismatch(candidate, defaultPath) {
    const c = String(candidate || '').trim();
    const d = String(defaultPath || '').trim();
    if (!c || !d)
        return false;
    const cIsWindows = /^[a-zA-Z]:[\\/]/.test(c);
    const dIsWindows = /^[a-zA-Z]:[\\/]/.test(d);
    const cIsUnix = c.startsWith('/');
    const dIsUnix = d.startsWith('/');
    return (cIsWindows && dIsUnix) || (cIsUnix && dIsWindows);
}
/** Truncated or server-leaked paths that cannot be scanned from a hosted browser. */
function isLikelyCorruptedLocalPath(path) {
    const n = String(path || '').replace(/\\/g, '/').trim();
    if (!n)
        return false;
    if (/^s\/[^/]+\//i.test(n))
        return true;
    if (/^Users\/[^/]+\//i.test(n))
        return true;
    return false;
}
/**
 * Resolve page project path.
 * @param {any} inputValue
 * @param {any} app
 * @returns {any}
 */
export function resolvePageProjectPath(inputValue, app) {
    const trimmed = stripArtifactSuffixes(String(inputValue || '').trim());
    const defaultPath = String(app.state.defaultProjectPath || '').trim();
    // A bare filesystem root sentinel means "use the default project path".
    if (trimmed === '/' || trimmed === '\\') {
        return defaultPath || trimmed;
    }
    // Resolve bare directory names (no drive letter or slash prefix) against default path
    if (trimmed && !trimmed.startsWith('…') && isPlausibleProjectPath(trimmed)) {
        const cleaned = stripArtifactSuffixes(trimmed);
        const isBareName = cleaned && !/^[a-zA-Z]:[\\/]/.test(cleaned) && !cleaned.startsWith('//') && !cleaned.startsWith('/');
        if (isBareName && defaultPath) {
            const resolved = defaultPath.replace(/\\/g, '/').replace(/\/$/, '') + '/' + cleaned;
            if (resolved.startsWith(defaultPath.replace(/\\/g, '/'))) {
                return resolved;
            }
        }
        return trimmed;
    }
    const cleanedLast = stripArtifactSuffixes(app.state.lastProjectPath || '');
    if (cleanedLast && isPlausibleProjectPath(cleanedLast) && !isSuspiciousNestedPath(cleanedLast, defaultPath) && !isClientServerPathMismatch(cleanedLast, defaultPath)) {
        return cleanedLast;
    }
    if (trimmed.startsWith('…')) {
        return shouldClearHostedServerDefaultPath(defaultPath) ? '' : defaultPath;
    }
    const safeDefault = shouldClearHostedServerDefaultPath(defaultPath) ? '' : defaultPath;
    if (shouldClearHostedServerDefaultPath(trimmed)) {
        return safeDefault || '';
    }
    if (isLikelyCorruptedLocalPath(trimmed)) {
        return safeDefault || '';
    }
    return trimmed || safeDefault || '';
}
/** Value to show in path inputs — returns the current path so re-renders preserve it. */
export function getPathInputDisplayValue(app) {
    if (!app || !app.state)
        return '';
    const candidate = app.state.pathInputDraft || app.state.lastProjectPath || '';
    const defaultPath = String(app.state.defaultProjectPath || '').trim();
    if (defaultPath && isSuspiciousNestedPath(candidate, defaultPath)) {
        return defaultPath;
    }
    if (isClientServerPathMismatch(candidate, defaultPath)) {
        return shouldClearHostedServerDefaultPath(defaultPath) ? '' : defaultPath;
    }
    if (shouldClearHostedServerDefaultPath(candidate)) {
        return '';
    }
    if (isLikelyCorruptedLocalPath(candidate)) {
        return '';
    }
    if (!candidate && shouldClearHostedServerDefaultPath(defaultPath)) {
        return '';
    }
    return stripArtifactSuffixes(candidate);
}
/** Active path for the current page — prefers typed input, then last scan, then default. */
export function getPageProjectPath(app, root) {
    const inputValue = root ? readProjectPathInput(root) : readProjectPathInput(document);
    return resolvePageProjectPath(inputValue, app);
}
/** Product platform root when path sits under github-cache/ (e.g. …/ai-platform/github-cache/foo). */
export function productPlatformRootFromBenchmarkPath(projectPath) {
    const normalized = String(projectPath || '').replace(/\\/g, '/');
    const idx = normalized.toLowerCase().indexOf('/github-cache/');
    return idx > 0 ? normalized.slice(0, idx) : null;
}
/**
 * EU compliance / handoff scans must target product code — not OSS benchmark clones.
 * Falls back to server default when the typed or remembered path is under github-cache/.
 */
/**
 * Resolve product compliance path.
 * @param {any} inputValue
 * @param {any} app
 * @returns {any}
 */
export function resolveProductCompliancePath(inputValue, app) {
    const resolved = resolvePageProjectPath(inputValue, app);
    const defaultPath = String(app.state.defaultProjectPath || '').trim();
    if (resolved && isBenchmarkCachePath(resolved)) {
        if (defaultPath && !isBenchmarkCachePath(defaultPath)) {
            return defaultPath;
        }
        const productRoot = productPlatformRootFromBenchmarkPath(resolved);
        if (productRoot && !isBenchmarkCachePath(productRoot)) {
            return productRoot;
        }
    }
    return resolved || defaultPath;
}
/**
 * Ensure product compliance path.
 * @param {any} app
 * @param {any} root
 * @returns {any}
 */
export function ensureProductCompliancePath(app, root) {
    const current = getPageProjectPath(app, root);
    const defaultPath = String(app.state.defaultProjectPath || '').trim();
    if (current && isBenchmarkCachePath(current)) {
        const productRoot = resolveProductCompliancePath(current, app);
        if (productRoot && productRoot !== current) {
            app.state.lastProjectPath = productRoot;
            return productRoot;
        }
    }
    return current;
}
/**
 * Report matches page path.
 * @param {number} report
 * @param {string} projectPath
 * @returns {any}
 */
export function reportMatchesPagePath(report, projectPath) {
    if (!(report === null || report === void 0 ? void 0 : report.projectRoot) || !projectPath)
        return false;
    const a = normalizeProjectPath(report.projectRoot);
    const b = normalizeProjectPath(projectPath);
    if (a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`))
        return true;
    // In-browser scans often store the folder basename while the path bar shows a full OS path.
    const baseA = a.split('/').filter(Boolean).pop() || '';
    const baseB = b.split('/').filter(Boolean).pop() || '';
    return baseA.length > 1 && baseA === baseB;
}
/** Same as reportMatchesPagePath but accepts bare scannedRoot strings (no report wrapper). */
export function pathsLooselyMatch(scannedRoot, pagePath) {
    if (!scannedRoot || !pagePath)
        return true;
    return reportMatchesPagePath({ projectRoot: scannedRoot }, pagePath);
}
/** Report artifact that matches the requested repo path (ignores stale global report). */
export function reportForProjectPath(app, projectPath) {
    var _a;
    const path = String(projectPath || '').trim();
    if (!path)
        return null;
    if (app.state.report && reportMatchesPagePath(app.state.report, path)) {
        return app.state.report;
    }
    const analyzeReport = (_a = app.state.analyzeResult) === null || _a === void 0 ? void 0 : _a.report;
    if (analyzeReport && reportMatchesPagePath(analyzeReport, path)) {
        return analyzeReport;
    }
    return null;
}
/** Report for the path currently selected on a dashboard page. */
export function getPageReport(app, root) {
    return reportForProjectPath(app, getPageProjectPath(app, root));
}
/**
 * Sync path chip states.
 * @param {any} root
 * @param {string} projectPath
 * @returns {any}
 */
export function syncPathChipStates(root, projectPath) {
    if (!root)
        return;
    const activeNorm = projectPath ? normalizeProjectPath(projectPath) : '';
    root.querySelectorAll('.analyze-path-chip-wrap').forEach((wrap) => {
        const chip = wrap.querySelector('.analyze-path-chip');
        const chipPath = (chip === null || chip === void 0 ? void 0 : chip.dataset.path) || '';
        const active = Boolean(activeNorm && chipPath && normalizeProjectPath(chipPath) === activeNorm);
        wrap.classList.toggle('active', active);
        chip === null || chip === void 0 ? void 0 : chip.classList.toggle('active', active);
    });
}
/**
 * Render page scan context.
 * @param {any} app
 * @param {Object} options
 * @returns {any}
 */
export function renderPageScanContext(app, options = {}) {
    var _a, _b;
    const requested = options.requestedPath
        || (options.container ? getPageProjectPath(app, options.container) : getPageProjectPath(app));
    const report = (_a = options.report) !== null && _a !== void 0 ? _a : reportForProjectPath(app, requested);
    const reportRoot = (report === null || report === void 0 ? void 0 : report.projectRoot) || '';
    const bundleRoot = options.bundleProjectPath || '';
    const scannedRoot = bundleRoot || reportRoot;
    if (!requested && !scannedRoot && !options.force)
        return '';
    const requestedLabel = requested ? formatPathLabel(requested) || redactPathForDisplay(requested) : '';
    const scannedLabel = scannedRoot ? formatPathLabel(scannedRoot) || redactPathForDisplay(scannedRoot) : '';
    const mismatch = requested && scannedRoot && !reportMatchesPagePath({ projectRoot: scannedRoot }, requested);
    const gate = (_b = report === null || report === void 0 ? void 0 : report.gate) === null || _b === void 0 ? void 0 : _b.pass;
    const gateChip = gate === true
        ? '<span class="gate-badge pass">GATE PASS</span>'
        : gate === false
            ? '<span class="gate-badge warn">GATE REVIEW</span>'
            : '';
    const scannedAt = (report === null || report === void 0 ? void 0 : report.generatedAt)
        ? new Date(report.generatedAt).toLocaleString()
        : '';
    return `
    <div class="card mb-4 analyze-page-scan-context" data-page-scan-context>
      <p class="text-muted" style="margin:0;font-size:var(--font-size-sm);">
        ${requestedLabel
        ? `Scan target: <code>${escapeHtml(requestedLabel)}</code>`
        : 'Enter a folder path above, then run scan.'}
        ${scannedLabel && requestedLabel && mismatch
        ? ` · Artifacts loaded from <code>${escapeHtml(scannedLabel)}</code>`
        : scannedLabel && !requestedLabel
            ? ` · Showing results for <code>${escapeHtml(scannedLabel)}</code>`
            : ''}
        ${gateChip ? ` ${gateChip}` : ''}
        ${scannedAt ? ` · ${escapeHtml(scannedAt)}` : ''}
      </p>
      ${mismatch ? `
        <p class="text-warning" style="margin:0.35rem 0 0;font-size:var(--font-size-xs);">
          Requested path differs from loaded artifact root — run scan again on this page or pick the exact repo folder.
        </p>
      ` : ''}
    </div>
  `;
}
/**
 * Update page scan context dom.
 * @param {any} container
 * @param {any} app
 * @param {Object} options
 * @returns {any}
 */
export function updatePageScanContextDom(container, app, options = {}) {
    if (!container)
        return;
    const pathInput = container.querySelector('#project-path-input');
    const projectPath = getPageProjectPath(app, container);
    const report = reportForProjectPath(app, projectPath);
    const slot = container.querySelector('[data-page-scan-context]');
    const html = renderPageScanContext(app, {
        ...options,
        container,
        requestedPath: projectPath,
        report
    });
    if (slot) {
        slot.outerHTML = html || '';
    }
    else if (html) {
        const bar = container.querySelector('[data-analyze-path-bar]');
        bar === null || bar === void 0 ? void 0 : bar.insertAdjacentHTML('afterend', html);
    }
}
/** Load report.json for the given path into app.state (when available). */
export async function refreshAppReportForPath(app, projectPath, root) {
    const path = String(projectPath
        || (root ? getPageProjectPath(app, root) : getPageProjectPath(app))
        || '').trim();
    if (!path) {
        return refreshLiveReport(app.scanService, app.state);
    }
    try {
        const live = await app.scanService.fetchReport(path);
        if (live && reportMatchesPagePath(live, path)) {
            const staleRoot = app.state.report && !reportMatchesPagePath(app.state.report, path);
            if (!app.state.report || staleRoot || shouldPreferLiveReport(app.state.report, live)) {
                app.state.report = live;
            }
        }
    }
    catch (_a) {
        /* No report on disk for this path yet — page panels use config defaults. */
    }
    return app.state.report;
}
/** Gate scan via SimpleBeacon API for the path entered on the current page. */
export async function runPageRepoScan(app, projectPath, options = {}) {
    var _a, _b;
    if (isDemoMode()) {
        showToast(demoReadOnlyMessage(), 'info');
        return null;
    }
    if (app.state.scanning)
        return null;
    const root = options.container;
    const resolved = String(projectPath
        || (root ? getPageProjectPath(app, root) : resolvePageProjectPath('', app))
        || '').trim();
    if (!resolved) {
        showToast('Enter a project path on the dashboard server', 'error');
        return null;
    }
    app.state.scanning = true;
    if (typeof app.refreshCurrentView === 'function') {
        app.refreshCurrentView();
    }
    try {
        await app.scanService.runScan(resolved);
        app.state.lastProjectPath = resolved;
        Object.assign(app.state, {
            report: app.scanService.report,
            baseline: app.scanService.baseline,
            config: app.scanService.config,
            history: app.scanService.history,
            audit: null
        });
        await refreshAppReportForPath(app, resolved, root);
        (_b = (_a = app.views.audit) === null || _a === void 0 ? void 0 : _a.invalidateCache) === null || _b === void 0 ? void 0 : _b.call(_a);
        return { projectPath: resolved, report: app.state.report };
    }
    finally {
        app.state.scanning = false;
    }
}
