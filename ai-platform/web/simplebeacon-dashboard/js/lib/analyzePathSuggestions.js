// simplebeacon-ignore documentation
/**
 * Shared path suggestion datalist for Analyze path bar + Dashboard scan input.
 */

import { escapeHtml, redactPathForDisplay, formatPathLabel } from '../utils.js';
import { normalizeProjectPath } from '../services/analyzeService.js';
import { isRemoteRepoUrl } from './analyzePathSources.js';

/**
 * P a t h  s u g g e s t i o n s  l i s t  i d.
 */
export const PATH_SUGGESTIONS_LIST_ID = 'project-path-suggestions';

const RECENT_PATHS_KEY = 'simplebeaconRecentPaths';

/**
 * Basename path.
 * @param {string} projectPath
 * @returns {any}
 */
export function basenamePath(projectPath) {
  if (!projectPath) return '';
  const parts = String(projectPath).replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] || projectPath;
}

/**
 * Is plausible suggestion path.
 * @param {any} value
 * @returns {any}
 */
export function isPlausibleSuggestionPath(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 280) return false;
  if (isRemoteRepoUrl(raw)) return true;
  if (/outside allowed analysis roots|projectPath is required|projectPath is outside/i.test(raw)) {
    return false;
  }
  if (/allowedAnalysisRoots|ANALYZE_ALLOWED_ROOTS|restart the server/i.test(raw)) {
    return false;
  }
  if (/\.(bat|cmd|exe|ps1|sh|js|json|html?|md|txt)$/i.test(raw)) return false;
  if (/^[a-zA-Z]:[\\/]/.test(raw)) return true;
  if (raw.startsWith('\\\\') || raw.startsWith('/')) return true;
  if (/^[\w.-]+([\\/]|$)/.test(raw)) return true;
  return false;
}

/**
 * Load recent paths.
 * @returns {any}
 */
export function loadRecentPaths() {
  try {
    const raw = localStorage.getItem(RECENT_PATHS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPlausibleSuggestionPath);
  } catch {
    return [];
  }
}

/**
 * Save recent path.
 * @param {string} path
 * @returns {any}
 */
export function saveRecentPath(path) {
  if (!isPlausibleSuggestionPath(path)) return;
  const recent = [path, ...loadRecentPaths().filter((p) => p !== path)].slice(0, 8);
  localStorage.setItem(RECENT_PATHS_KEY, JSON.stringify(recent));
}

/**
 * Remove recent path.
 * @param {string} path
 * @returns {any}
 */
export function removeRecentPath(path) {
  const raw = String(path || '').trim();
  if (!raw) return;
  const recent = loadRecentPaths().filter((p) => p !== raw);
  localStorage.setItem(RECENT_PATHS_KEY, JSON.stringify(recent));
}

/** Suggestion entries for datalist + redacted-path expansion. */
export function collectPathSuggestions(app, testSources = []) {
  const entries = [];
  const seen = new Set();

/**
 * Add.
 * @param {any} value
 * @param {any} label
 * @param {any} kind
 * @returns {any}
 */
  const add = (value, label, kind = 'path') => {
    const full = String(value || '').trim();
    if (!full || !isPlausibleSuggestionPath(full)) return;
    const key = normalizeProjectPath(full);
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({
      full,
      label: label || formatPathLabel(full) || basenamePath(full),
      kind,
      displayValue: isRemoteRepoUrl(full) ? full : redactPathForDisplay(full)
    });
  };

  const defaultPath = String(app?.state?.defaultProjectPath || '').trim();
  if (defaultPath) {
    add(defaultPath, `Server default · ${basenamePath(defaultPath)}`, 'default');
  }

  for (const recent of loadRecentPaths()) {
    if (recent === defaultPath) continue;
    add(recent, formatPathLabel(recent) || basenamePath(recent), 'recent');
  }

  for (const source of testSources || []) {
    add(source?.value, source?.label, source?.kind || 'preset');
  }

  return entries;
}

/**
 * Render path suggestions datalist html.
 * @param {Array} entries
 * @returns {any}
 */
export function renderPathSuggestionsDatalistHtml(entries = []) {
  if (!entries.length) return '';
  return entries.map(({ full, label, displayValue }) => {
    const value = displayValue || full;
    const title = full !== value ? full : label;
    return `<option value="${escapeHtml(value)}" label="${escapeHtml(label)}" title="${escapeHtml(title)}"></option>`;
  }).join('');
}

function createDatalistOptions(entries) {
  const fragment = document.createDocumentFragment();
  entries.forEach(({ full, label, displayValue }) => {
    const value = displayValue || full;
    const title = full !== value ? full : label;
    const opt = document.createElement('option');
    opt.value = value;
    opt.label = label;
    opt.title = title;
    fragment.appendChild(opt);
  });
  return fragment;
}

/**
 * Refresh path suggestions datalist.
 * @param {any} container
 * @param {any} app
 * @param {Array} testSources
 * @returns {any}
 */
export function refreshPathSuggestionsDatalist(container, app, testSources = []) {
  if (!container) return [];
  const entries = collectPathSuggestions(app, testSources);
  const datalist = container.querySelector(`#${PATH_SUGGESTIONS_LIST_ID}`);
  if (datalist) {
    datalist.replaceChildren(createDatalistOptions(entries));
  }
  return entries;
}

/** Map redacted UI path (…/CascadeProjects/foo) back to full server path when possible. */
export function expandDisplayPathToFull(inputValue, app, testSources = []) {
  const trimmed = String(inputValue || '').trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('…') && !trimmed.startsWith('...')) return trimmed;

  const entries = collectPathSuggestions(app, testSources);
  for (const entry of entries) {
    if (entry.displayValue === trimmed) return entry.full;
  }

  const suffix = trimmed.replace(/^(?:…|\.{3})/, '').replace(/\\/g, '/');
  if (suffix) {
    for (const entry of entries) {
      const norm = entry.full.replace(/\\/g, '/');
      if (norm.endsWith(suffix) || norm.toLowerCase().endsWith(suffix.toLowerCase())) {
        return entry.full;
      }
    }
    const defaultPath = String(app?.state?.defaultProjectPath || '').replace(/\\/g, '/');
    if (defaultPath && (defaultPath.endsWith(suffix) || defaultPath.toLowerCase().endsWith(suffix.toLowerCase()))) {
      return app.state.defaultProjectPath;
    }
  }

  return String(app?.state?.defaultProjectPath || '').trim() || trimmed;
}

/**
 * Path input list attr.
 * @returns {any}
 */
export function pathInputListAttr() {
  return PATH_SUGGESTIONS_LIST_ID;
}

/**
 * Render path suggestions datalist element.
 * @param {Array} entries
 * @returns {any}
 */
export function renderPathSuggestionsDatalistElement(entries = []) {
  return `<datalist id="${PATH_SUGGESTIONS_LIST_ID}">${renderPathSuggestionsDatalistHtml(entries)}</datalist>`;
}
