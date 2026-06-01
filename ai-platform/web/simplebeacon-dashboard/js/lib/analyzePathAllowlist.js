import { fetchAnalyzeProviders, normalizeProjectPath } from '../services/analyzeService.js?v=20260531pathfix1';
import { isRemoteRepoUrl } from './analyzePathSources.js';

export function isPathWithinAllowedRoots(projectPath, allowedRoots = []) {
  const target = normalizeProjectPath(projectPath);
  if (!target || isRemoteRepoUrl(projectPath)) return true;
  return (allowedRoots || []).some((root) => {
    const rootKey = normalizeProjectPath(root);
    if (!rootKey) return false;
    return target === rootKey || target.startsWith(`${rootKey}/`);
  });
}

export function pathAllowlistMessage(projectPath, allowedRoots, summary) {
  const rootsText = summary
    || (allowedRoots || []).slice(0, 4).map((entry) => String(entry).replace(/\\/g, '/')).join('; ');
  const requested = String(projectPath || '').replace(/\\/g, '/');
  return (
    `Path is outside allowed analysis roots. Requested: ${requested}. `
    + `Allowed: ${rootsText || '(none)'}. `
    + 'Add the folder to ANALYZE_ALLOWED_ROOTS in .env.v1-internal or allowedAnalysisRoots in .simplebeacon/config.json, then restart the dashboard.'
  );
}

export async function ensureAllowedAnalysisRoots(app) {
  if (app?.state?.allowedAnalysisRoots?.length) {
    return app.state.allowedAnalysisRoots;
  }
  try {
    const info = await fetchAnalyzeProviders();
    if (app?.state) {
      app.state.allowedAnalysisRoots = info.allowedAnalysisRoots || [];
      app.state.allowedAnalysisRootsSummary = info.allowedAnalysisRootsSummary || '';
      if (info.defaultProjectPath && !app.state.defaultProjectPath) {
        app.state.defaultProjectPath = info.defaultProjectPath;
      }
    }
    return info.allowedAnalysisRoots || [];
  } catch {
    return app?.state?.allowedAnalysisRoots || [];
  }
}

export async function validateProjectPathAllowlist(projectPath, app) {
  const path = String(projectPath || '').trim();
  if (!path || isRemoteRepoUrl(path)) {
    return { allowed: true, path, message: null, roots: app?.state?.allowedAnalysisRoots || [] };
  }
  const roots = await ensureAllowedAnalysisRoots(app);
  const allowed = isPathWithinAllowedRoots(path, roots);
  const message = allowed
    ? null
    : pathAllowlistMessage(path, roots, app?.state?.allowedAnalysisRootsSummary);
  if (app?.state) {
    app.state.pathAllowlistError = message;
  }
  return { allowed, path, message, roots };
}

export function renderPathAllowlistWarning(message) {
  if (!message) return '';
  return `
    <div class="analyze-info-callout mb-4 analyze-path-allowlist-warning" data-path-allowlist-warning style="border-color: var(--color-warning, #f59e0b);">
      ${escapeHtml(message)}
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function updatePathAllowlistWarningDom(container, app, projectPath) {
  if (!container) return;
  const slot = container.querySelector('[data-path-allowlist-warning]');
  const path = String(projectPath || '').trim();
  if (!path) {
    if (app?.state) app.state.pathAllowlistError = null;
    slot?.remove();
    return;
  }
  const check = await validateProjectPathAllowlist(path, app);
  const html = renderPathAllowlistWarning(check.message);
  if (!html) {
    slot?.remove();
    return;
  }
  if (slot) {
    slot.outerHTML = html;
    return;
  }
  const bar = container.querySelector('[data-analyze-path-bar]');
  bar?.insertAdjacentHTML('afterend', html);
}
