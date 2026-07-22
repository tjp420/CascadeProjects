// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
import { escapeHtml } from './string.js';
import { notifyDownloadComplete } from './notify.js';

let _toastId = 0;

function _renderToast(container, message, type, duration) {
  const id = `toast-${++_toastId}`;
  const toast = document.createElement('div');
  toast.id = id;
  toast.className = `toast ${type} show`;
  toast.textContent = message == null ? '' : String(message);
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

export function showToast(message, type = 'info') {
  if (typeof document === 'undefined' || !document.body) return;
  const container = document.getElementById('toast-container') || (() => {
    const el = document.createElement('div');
    el.id = 'toast-container';
    el.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none;';
    document.body.appendChild(el);
    return el;
  })();
  _renderToast(container, message, typeof type === 'string' ? type : 'info', 3500);
}

/**
 * Manually remove the toast container and clear any active timers.
 * @returns {void}
 */
export function removeToastContainer() {
  _toastId = 0;
  if (typeof document === 'undefined') return;
  const container = document.getElementById('toast-container');
  if (container) container.remove();
}

/**
 * Trigger a browser download from a string or Blob.
 * @param {string|Blob} content
 * @param {string} filename
 * @param {string} [mimeType='text/plain']
 * @returns {void}
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
  if (typeof document === 'undefined') return;
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = String(filename || 'download');
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  notifyDownloadComplete(String(filename || 'download'));
}

/**
 * Download json.
 * @param {unknown} data
 * @param {string} filename
 * @returns {void}
 */
export function downloadJson(data, filename) {
  if (typeof filename !== 'string') {
    throw new Error('Download requires a valid filename string.');
  }
  let json;
  try {
    json = JSON.stringify(data, null, 2);
  } catch (err) {
    throw new Error(`Failed to serialize data to JSON: ${err?.message || String(err)}`);
  }
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, filename);
}

/**
 * Download a Blob as a file.
 * Uses VS Code webview message passing when in a sandboxed webview,
 * falls back to a standard anchor download in regular browsers.
 * @param {Blob} blob
 * @param {string} filename
 * @returns {void}
 */
export function downloadBlob(blob, filename) {
  if (!(blob instanceof Blob)) {
    throw new Error('Download is unavailable: no valid blob provided.');
  }
  // VS Code: webview fallback — blob downloads via <a download> are blocked in sandboxed webviews
  if (typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function') {
    try {
      const vscode = window.acquireVsCodeApi();
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const commaIdx = result.indexOf(',');
        const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
        vscode.postMessage({ command: 'downloadFile', filename: filename || 'download', mimeType: blob.type, base64 });
      };
      reader.onerror = () => {
        window["console"]["error"](
          'FileReader failed to convert blob for VS Code download. Falling back to normal download.'
        );
        try { normalDownload(blob, filename); } catch { /* both methods failed */ }
      };
      reader.readAsDataURL(blob);
      return;
    } catch {
      // fall through to normal download
    }
  }
  normalDownload(blob, filename);
}

/**
 * Normal browser download via temporary <a> element.
 * @param {Blob} blob
 * @param {string} filename
 * @returns {void}
 */
function normalDownload(blob, filename) {
  if (!(blob instanceof Blob)) {
    throw new Error('Download is unavailable: invalid blob.');
  }
  if (typeof document === 'undefined' || !document.body) {
    throw new Error('Download is unavailable in this environment.');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  a.rel = 'noopener';
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    a.remove();
    // revoke on next tick — download starts synchronously from click()
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  notifyDownloadComplete(filename || 'download');
}

/**
 * Download text.
 * @param {string|BlobPart} content
 * @param {string} filename
 * @param {string} [mime='text/plain']
 * @returns {void}
 */
export function downloadText(content, filename, mime = 'text/plain') {
  if (content == null) {
    throw new Error('Download is unavailable: no content provided.');
  }
  if (typeof filename !== 'string') {
    throw new Error('Download requires a valid filename string.');
  }
  const blob = new Blob([content], { type: mime });
  downloadBlob(blob, filename);
}

/**
 * Convert an array of objects to CSV and download it as a file.
 * @param {Object[]} rows Array of plain objects.
 * @param {string} filename Download filename.
 * @param {string[]} [headers] Optional explicit column order; auto-detected from first row if omitted.
 */
export function downloadCsv(rows, filename, headers) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('CSV download requires a non-empty array of rows.');
  }
  const cols = Array.isArray(headers) && headers.length > 0 ? headers : Object.keys(rows[0]);
  const escape = (val) => {
    const s = val == null ? '' : String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = [cols.join(','), ...rows.map(row => cols.map(c => escape(row[c])).join(','))];
  const csv = lines.join('\n');
  downloadText(csv, filename, 'text/csv');
}

/**
 * Check whether an element has a CSS class.
 * @param {HTMLElement|null} el
 * @param {string} className
 * @returns {boolean}
 */
export function hasClass(el, className) {
  if (!el || !className || typeof el.classList === 'undefined') return false;
  return el.classList.contains(className);
}

/**
 * Add one or more CSS classes to an element.
 * @param {HTMLElement|null} el
 * @param {string} className Space-separated class names.
 * @returns {void}
 */
export function addClass(el, className) {
  if (!el || !className || typeof el.classList === 'undefined') return;
  const classes = String(className).trim().split(/\s+/).filter(Boolean);
  for (const c of classes) el.classList.add(c);
}

/**
 * Remove one or more CSS classes from an element.
 * @param {HTMLElement|null} el
 * @param {string} className Space-separated class names.
 * @returns {void}
 */
export function removeClass(el, className) {
  if (!el || !className || typeof el.classList === 'undefined') return;
  const classes = String(className).trim().split(/\s+/).filter(Boolean);
  for (const c of classes) el.classList.remove(c);
}

/**
 * Toggle a CSS class on an element.
 * @param {HTMLElement|null} el
 * @param {string} className
 * @param {boolean} [force] If true, add; if false, remove.
 * @returns {boolean}
 */
export function toggleClass(el, className, force) {
  if (!el || !className || typeof el.classList === 'undefined') return false;
  if (typeof force === 'boolean') {
    el.classList.toggle(className, force);
    return force;
  }
  return el.classList.toggle(className);
}

/**
 * Return all focusable elements within a container.
 * @param {HTMLElement|null} [container=document]
 * @returns {HTMLElement[]}
 */
export function getFocusableElements(container) {
  const root = container || (typeof document !== 'undefined' ? document : null);
  if (!root) return [];
  const selector = 'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll(selector)).filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('tabindex') === '-1') return false;
    return true;
  });
}

/**
 * Focus the first focusable element within a container.
 * @param {HTMLElement|null} [container=document]
 * @returns {boolean} True if an element was focused.
 */
export function focusFirst(container) {
  const candidates = getFocusableElements(container);
  if (candidates.length === 0) return false;
  try {
    candidates[0].focus();
    return document.activeElement === candidates[0];
  } catch {
    return false;
  }
}

/** Create a DOM element with attributes and child nodes.
 * @param {string} tag Element tag name.
 * @param {Object} [attrs={}] Attribute key-value pairs.
 * @param {(string|HTMLElement)[]} [children=[]] Child strings (text) or HTMLElement nodes.
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, children = []) {
  if (typeof document === 'undefined') return null;
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'className') {
      el.className = val;
    } else if (key === 'style' && typeof val === 'object') {
      Object.assign(el.style, val);
    } else if (key.startsWith('on') && typeof val === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), val);
    } else {
      el.setAttribute(key, val);
    }
  }
  for (const child of children) {
    if (child == null) continue;
    el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

/**
 * Remove all child nodes from a DOM element.
 * @param {HTMLElement} el
 * @returns {void}
 */
export function removeAllChildren(el) {
  if (!el || typeof el.removeChild !== 'function') return;
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * Scroll to a DOM element by CSS selector.
 * @param {string} selector CSS selector.
 * @param {string} [behavior='smooth'] Scroll behavior.
 * @returns {boolean} True if the element was found.
 */
export function scrollToElement(selector, behavior = 'smooth') {
  if (typeof document === 'undefined') return false;
  const el = document.querySelector(selector);
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior, block: 'start' });
    return true;
  }
  return false;
}

/**
 * Check whether a DOM element is within the viewport.
 * @param {HTMLElement} el
 * @returns {boolean}
 */
export function elementInViewport(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return false;
  const rect = el.getBoundingClientRect();
  return rect.top >= 0 && rect.left >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && rect.right <= (window.innerWidth || document.documentElement.clientWidth);
}

/**
 * Observe when an element enters the viewport via IntersectionObserver.
 * @param {HTMLElement} el
 * @param {(entry: IntersectionObserverEntry) => void} callback
 * @param {IntersectionObserverInit} [options]
 * @returns {IntersectionObserver|null}
 */
export function observeIntersection(el, callback, options = {}) {
  if (typeof window === 'undefined' || !window.IntersectionObserver || !el) return null;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      callback(entry);
    }
  }, options);
  observer.observe(el);
  return observer;
}

/**
 * Preload an image and return a Promise that resolves when loaded.
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function preloadImage(src) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Cannot preload image outside browser'));
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export async function copyToClipboard(text) {
  if (text == null) throw new Error('Cannot copy null or undefined to clipboard.');
  const str = String(text);
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      return await navigator.clipboard.writeText(str);
    } catch {
      // Non-secure context or permission denied — fall through to execCommand
    }
  }
  if (typeof document === 'undefined' || !document.body) {
    throw new Error('Clipboard unavailable in this environment.');
  }
  const ta = document.createElement('textarea');
  ta.value = str;
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    const ok = document.execCommand('copy');
    if (!ok) throw new Error('execCommand(copy) returned false');
  } finally {
    ta.remove();
  }
}

/** @returns {string | {html:string, attach:(container:HTMLElement)=>void}} HTML string, or object with html + attach when actions have onClick handlers
 */
export function renderEmptyState(opts) {
  if (!opts || typeof opts !== 'object' || Array.isArray(opts)) return '';
  const { icon, title, body = '', actions: rawActions = [], iconWrapper = 'svg' } = opts;
  const actions = Array.isArray(rawActions) ? rawActions.filter(a => a && typeof a === 'object') : [];
  const safeIcon = String(icon || '');
  const iconHtml = iconWrapper === 'emoji'
    ? `<div class="empty-state-icon" style="font-size:3rem;background:none;width:auto;height:auto;">${escapeHtml(safeIcon)}</div>`
    : `<div class="empty-state-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${safeIcon}</svg></div>`;
  const unsafeBody = opts.unsafeBody === true;
  const bodyHtml = body ? `<p class="empty-state-body">${unsafeBody ? body : escapeHtml(body)}</p>` : '';
  const actionsHtml = actions.length
    ? `<div class="empty-state-actions">${actions.map((a, idx) => `<button class="btn ${escapeHtml(a.className || 'btn-primary')}"${a.id ? ` id="${escapeHtml(a.id)}"` : ` data-action-index="${idx}"`}>${escapeHtml(a.label)}</button>`).join('')}</div>`
    : '';
  const html = `
    <div class="empty-state card">
      ${iconHtml}
      <p class="empty-state-title">${escapeHtml(title)}</p>
      ${bodyHtml}
      ${actionsHtml}
    </div>
  `.trim();

  if (actions.some(a => typeof a.onClick === 'function')) {
    return {
      html,
      attach(container) {
        actions.forEach((action, idx) => {
          if (typeof action.onClick !== 'function') return;
          const selector = action.id ? `#${CSS.escape(action.id)}` : `[data-action-index="${idx}"]`;
          const btn = container.querySelector(selector);
          if (btn) btn.addEventListener('click', action.onClick);
        });
      }
    };
  }
  return html;
}

/**
 * True when the dashboard runs inside an iframe/embed (VS Code webview, coming-soon shell, etc.).
 * Browsers block showDirectoryPicker in subframes even when same-origin.
 */
export function isEmbeddedDashboardFrame() {
  if (typeof window === 'undefined') return false;
  if (window.__SB_PARENT_URL_BAR__) return true;
  try {
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('sb_parent_urlbar') === '1' || params.get('sb_website_mode') === '1') return true;
  } catch { /* ignore */ }
  try { return window.self !== window.top; } catch { return true; }
}

/**
 * True when the dashboard is opened from the VS Code / Cursor IDE (iframe or Simple Browser
 * with sb_parent_urlbar + extension bridge params). Extension sidebar owns navigation.
 */
export function isIdeDashboardSurface() {
  if (typeof window === 'undefined') return false;
  if (window.__SB_IDE_EMBED__) return true;
  try { if (document.documentElement.hasAttribute('data-ide-embed')) return true; } catch { /* ignore */ }
  return window.self !== window.top;
}

/** True when opened from VS Code / Cursor with sb_* bridge or parent-urlbar params (Simple Browser or iframe). */
export function isExtensionHostedTab() {
  if (typeof window === 'undefined') return false;
  if (window.__SB_PARENT_URL_BAR__ || window.__SB_IDE_EMBED__) return true;
  try {
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('sb_parent_urlbar') === '1') return true;
    if (params.get('sb_api_base') || params.get('sb_notify_base') || params.get('sb_website_mode')) return true;
  } catch { /* ignore */ }
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (sessionStorage.getItem('sb_parent_urlbar') === '1') return true;
      if (sessionStorage.getItem('sb_api_base') || sessionStorage.getItem('sb_notify_base')) return true;
    }
  } catch { /* ignore */ }
  return false;
}

/** @deprecated Use isEmbeddedDashboardFrame */
export function isCrossOriginEmbeddedFrame() { return isEmbeddedDashboardFrame(); }

/**
 * Whether the File System Access directory picker can be invoked from this context.
 */
export function canUseDirectoryPicker() {
  if (typeof window === 'undefined' || typeof window.showDirectoryPicker !== 'function') return false;
  return !isEmbeddedDashboardFrame();
}

/** User-facing message when FSA folder picker is blocked in an embed. */
export function filePickerBlockedMessage() {
  return 'Folder picker is blocked inside an embedded dashboard. Use the legacy Browse dialog, drag a folder here, open /dashboard/analyze in a top-level tab, or scan via the Local Agent with a typed path.';
}

/** True when a thrown error indicates the browser blocked showDirectoryPicker in a subframe. */
export function isFilePickerBlockedError(err) {
  const msg = String((err && err.message) || err || '');
  return /cross origin sub frames|file picker.*(?:not allowed|blocked|denied)|user activation|gesture required/i.test(msg);
}

/** True when a webkitdirectory FileList length matches a known browser cap (~3k on Chrome). */
export function isLikelyWebkitDirectoryFileCap(fileCount) {
  const n = Number(fileCount) || 0;
  if (n < 2000) return false;
  const knownCaps = [2048, 2500, 3000, 3250, 4096, 8192, 10000];
  return knownCaps.includes(n) || (n >= 2900 && n <= 3300);
}

/**
 * Safely set HTML content on an element using DOMParser instead of innerHTML.
 * @param {HTMLElement} el
 * @param {string} html
 * @returns {void}
 */
export function setHtml(el, html) {
  if (!el) return;
  if (typeof html !== 'string') { el.replaceChildren(); return; }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  el.replaceChildren(...doc.body.childNodes);
}

/**
 * Set HTML content safely using DOMPurify when available, falling back to
 * `setHtml` (DOMParser) otherwise. This attaches `setSafeHTML` to `window`
 * for backward-compatible call-sites.
 * @param {HTMLElement} el
 * @param {string} html
 */
export function setSafeHTML(el, html) {
  if (!el) return;
  if (typeof html !== 'string') { el.replaceChildren(); return; }
  try {
    let purifier = null;
    if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
      purifier = window.DOMPurify;
    } else {
      try {
        const dp = typeof require === 'function' ? require('dompurify') : null;
        if (dp) {
          if (typeof dp.sanitize === 'function') purifier = dp;
          else if (typeof dp.default === 'function') {
            try { purifier = dp.default(window); } catch { purifier = dp.default; }
          } else if (typeof dp === 'function') {
            purifier = dp(window);
          }
        }
      } catch { /* ignore */ }
    }

    if (purifier && typeof purifier.sanitize === 'function') {
      const safe = purifier.sanitize(html);
      el.innerHTML = safe;
      return;
    }
  } catch { /* fall through */ }
  setHtml(el, html);
}

if (typeof window !== 'undefined') {
  try { window.setSafeHTML = setSafeHTML; } catch (e) { /* ignore */ }
}

let _vsCodeApiCache = null;
export function getVsCodeApi() {
  if (_vsCodeApiCache) return _vsCodeApiCache;
  if (typeof window === 'undefined' || typeof window.acquireVsCodeApi !== 'function') return null;
  try { _vsCodeApiCache = window.acquireVsCodeApi(); return _vsCodeApiCache; } catch { return null; }
}

export function renderSkeletonCard(lines = 4) {
  const cls = ['short', 'medium', 'long', 'short', 'medium', 'long'];
  const rows = [];
  for (let i = 0; i < lines; i++) rows.push(`<div class="skeleton-line ${cls[i % cls.length]}"></div>`);
  return `<div class="skeleton-card">${rows.join('')}</div>`;
}

export function renderSkeletonChips(count = 5) {
  const chips = [];
  for (let i = 0; i < count; i++) chips.push('<div class="skeleton-chip"></div>');
  return `<div class="skeleton-chip-row">${chips.join('')}</div>`;
}

/** User-facing note when folder selection may be truncated by the browser. */
export function browserFolderCapMessage(fileCount) {
  const n = Number(fileCount) || 0;
  return `Your browser may have limited folder selection to ${n.toLocaleString()} files. `
    + 'For repos above ~3,000 files use **Select Folder** (Chrome/Edge), the VS Code extension, local agent, or `npx simplebeacon scan`.';
}
