import { fetchAnalyzeProviders, normalizeProjectPath, shouldClearHostedServerDefaultPath } from '../services/analyzeService.js?v=20260716cachefix1';
import { isRemoteRepoUrl } from './analyzePathSources.js';
/**
 * Is path within allowed roots.
 * @param {string} projectPath
 * @param {Array} allowedRoots
 * @returns {any}
 */
export function isPathWithinAllowedRoots(projectPath, allowedRoots = []) {
    let target = normalizeProjectPath(projectPath);
    if (!target || isRemoteRepoUrl(projectPath))
        return true;
    // Resolve bare directory names against each allowed root
    const roots = allowedRoots || [];
    if (!target.includes('/') && roots.length > 0) {
        return roots.some((root) => {
            const rootKey = normalizeProjectPath(root);
            if (!rootKey)
                return false;
            const resolved = normalizeProjectPath(`${root}/${target}`);
            return resolved === rootKey || resolved.startsWith(`${rootKey}/`);
        });
    }
    return roots.some((root) => {
        const rootKey = normalizeProjectPath(root);
        if (!rootKey)
            return false;
        return target === rootKey || target.startsWith(`${rootKey}/`);
    });
}
/**
 * Path allowlist message.
 * @param {string} projectPath
 * @param {Array} allowedRoots
 * @param {any} summary
 * @returns {any}
 */
export function pathAllowlistMessage(projectPath, allowedRoots, summary) {
    const rootsText = summary
        || (allowedRoots || []).slice(0, 4).map((entry) => String(entry).replace(/\\/g, '/')).join('; ');
    const requested = String(projectPath || '').replace(/\\/g, '/');
    return (`Path is outside allowed analysis roots. Requested: ${requested}. `
        + `Allowed: ${rootsText || '(none)'}. `
        + 'Add the folder to ANALYZE_ALLOWED_ROOTS in .env.v1-internal or allowedAnalysisRoots in .simplebeacon/config.json, then restart the dashboard.');
}
/**
 * Ensure allowed analysis roots.
 * @param {any} app
 * @returns {any}
 */
export async function ensureAllowedAnalysisRoots(app) {
    var _a, _b, _c;
    if ((_b = (_a = app === null || app === void 0 ? void 0 : app.state) === null || _a === void 0 ? void 0 : _a.allowedAnalysisRoots) === null || _b === void 0 ? void 0 : _b.length) {
        return app.state.allowedAnalysisRoots;
    }
    try {
        const info = await fetchAnalyzeProviders();
        if (app === null || app === void 0 ? void 0 : app.state) {
            app.state.allowedAnalysisRoots = info.allowedAnalysisRoots || [];
            app.state.allowedAnalysisRootsSummary = info.allowedAnalysisRootsSummary || '';
            if (info.defaultProjectPath && !app.state.defaultProjectPath && !shouldClearHostedServerDefaultPath(info.defaultProjectPath)) {
                app.state.defaultProjectPath = info.defaultProjectPath;
            }
        }
        return info.allowedAnalysisRoots || [];
    }
    catch (_d) {
        return ((_c = app === null || app === void 0 ? void 0 : app.state) === null || _c === void 0 ? void 0 : _c.allowedAnalysisRoots) || [];
    }
}
/**
 * Validate project path allowlist.
 * @param {string} projectPath
 * @param {any} app
 * @returns {any}
 */
export async function validateProjectPathAllowlist(projectPath, app) {
    var _a, _b;
    const path = String(projectPath || '').trim();
    if (!path || isRemoteRepoUrl(path)) {
        return { allowed: true, path, message: null, roots: ((_a = app === null || app === void 0 ? void 0 : app.state) === null || _a === void 0 ? void 0 : _a.allowedAnalysisRoots) || [] };
    }
    const roots = await ensureAllowedAnalysisRoots(app);
    const allowed = isPathWithinAllowedRoots(path, roots);
    const message = allowed
        ? null
        : pathAllowlistMessage(path, roots, (_b = app === null || app === void 0 ? void 0 : app.state) === null || _b === void 0 ? void 0 : _b.allowedAnalysisRootsSummary);
    if (app === null || app === void 0 ? void 0 : app.state) {
        app.state.pathAllowlistError = message;
    }
    return { allowed, path, message, roots };
}
/**
 * Render path allowlist warning.
 * @param {string} message
 * @returns {any}
 */
export function renderPathAllowlistWarning(message) {
    if (!message)
        return '';
    return `
    <div class="analyze-info-callout mb-4 analyze-path-allowlist-warning" data-path-allowlist-warning style="border-color: var(--color-warning, #f59e0b);">
      ${escapeHtml(message)}
    </div>
  `;
}
/**
 * Escape html.
 * @param {any} value
 * @returns {any}
 */
function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
/**
 * Update path allowlist warning dom.
 * @param {any} container
 * @param {any} app
 * @param {string} projectPath
 * @returns {any}
 */
export async function updatePathAllowlistWarningDom(container, app, projectPath) {
    if (!container)
        return;
    const slot = container.querySelector('[data-path-allowlist-warning]');
    const path = String(projectPath || '').trim();
    if (!path) {
        if (app === null || app === void 0 ? void 0 : app.state)
            app.state.pathAllowlistError = null;
        slot === null || slot === void 0 ? void 0 : slot.remove();
        return;
    }
    const check = await validateProjectPathAllowlist(path, app);
    const html = renderPathAllowlistWarning(check.message);
    if (!html) {
        slot === null || slot === void 0 ? void 0 : slot.remove();
        return;
    }
    if (slot) {
        slot.outerHTML = html;
        return;
    }
    const bar = container.querySelector('[data-analyze-path-bar]');
    bar === null || bar === void 0 ? void 0 : bar.insertAdjacentHTML('afterend', html);
}
