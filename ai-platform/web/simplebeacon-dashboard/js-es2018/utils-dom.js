// simplebeacon-ignore memory-leak, security
import { setSafeHTML } from './utils-lib/dom.js';
/**
 * Escape HTML special characters.
 * @param {string|null|undefined} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let _toastQueue = [];
let _toastTimer = null;

/**
 * Pull the next toast from the queue and render it.
 * Reschedules itself while items remain.
 * @returns {void}
 */
function _drainToastQueue() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('toast-container');
  if (!container || _toastQueue.length === 0) {
    _toastTimer = null;
    return;
  }
  const item = _toastQueue.shift();
  if (!item) {
    _toastTimer = null;
    return;
  }
  try {
    const toast = document.createElement('div');
    toast.className = `toast ${item.type} show`;
    if (item.html) {
      setSafeHTML(toast, item.message);
    } else {
      toast.textContent = item.message;
    }
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, item.duration);
  } catch (err) {
    console.error('[Toast] Failed to render toast:', err);
  }
  _toastTimer = setTimeout(_drainToastQueue, 400);
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'info'|'success'|'warning'|'error'} [type='info']
 * @param {{html?:boolean,duration?:number,queue?:boolean}} [opts]
 */
export function showToast(message, type = 'info', opts = {}) {
  if (typeof document === 'undefined' || !document.body) {
    return;
  }
  const {
    html = false,
    duration = 3500,
    queue = true,
  } = opts && typeof opts === 'object' && !Array.isArray(opts) ? opts : {};
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText =
      'position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none;';
    document.body.appendChild(container);
  }
  if (queue) {
    _toastQueue.push({ message, type, html, duration });
    if (_toastQueue.length === 1 && !_toastTimer) {
      _drainToastQueue();
    }
    return;
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type} show`;
  if (html) {
    setSafeHTML(toast, message);
  } else {
    toast.textContent = message;
  }
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

/**
 * Remove the toast container from the DOM and clear the pending queue.
 * @returns {void}
 */
export function removeToastContainer() {
  clearTimeout(_toastTimer);
  _toastTimer = null;
  _toastQueue.length = 0;
  if (typeof document === 'undefined') return;
  const container = document.getElementById('toast-container');
  if (container) container.remove();
}

/**
 * Download a Blob as a file.
 * Uses VS Code webview message passing when in a sandboxed webview,
 * falls back to a standard anchor download in regular browsers.
 * @param {Blob} blob
 * @param {string} filename
 * @returns {void}
 * @throws {Error} When blob is missing or document is unavailable.
 */
export function downloadBlob(blob, filename) {
  if (!(blob instanceof Blob)) {
    throw new Error('Download is unavailable: no valid blob provided.');
  }
  // Standard anchor-based download (extracted so it can be reused as a fallback).
  function _anchorDownload() {
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
  }
  // VS Code: webview fallback — blob downloads via <a download> are blocked in sandboxed webviews
  if (typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function') {
    const vscode = window.acquireVsCodeApi();
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
      vscode.postMessage({
        command: 'downloadFile',
        filename: filename || 'download',
        mimeType: blob.type,
        base64,
      });
    };
    reader.onerror = () => {
      console.error(
        'FileReader failed to convert blob for VS Code download. Falling back to normal download.'
      );
      try {
        _anchorDownload();
      } catch (err) {
        console.error('Fallback download failed:', err);
      }
    };
    reader.readAsDataURL(blob);
    return;
  }
  _anchorDownload();
}

/**
 * Serialize data to JSON and trigger a download.
 * @param {any} data
 * @param {string} filename
 * @returns {void}
 * @throws {Error} When JSON serialization fails.
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
 * Create a text blob and trigger a download.
 * @param {string} content
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
 * Render a standardized empty-state block.
 * @param {Object} opts
 * @param {string} opts.icon
 * @param {string} opts.title
 * @param {string} [opts.body]
 * @param {Array<{label:string,id?:string,className?:string,onClick?:Function}>} [opts.actions]
 * @param {'svg'|'emoji'} [opts.iconWrapper='svg']
 * @returns {string | {html:string, attach:(container:HTMLElement)=>void}}
 */
export function renderEmptyState(opts) {
  if (!opts || typeof opts !== 'object' || Array.isArray(opts)) return '';
  const { icon, title, body = '', actions: rawActions = [], iconWrapper = 'svg' } = opts;
  const actions = Array.isArray(rawActions) ? rawActions : [];
  const safeIcon = String(icon || '');
  const iconHtml =
    iconWrapper === 'emoji'
      ? `<div class="empty-state-icon" style="font-size:3rem;background:none;width:auto;height:auto;">${escapeHtml(safeIcon)}</div>`
      : `<div class="empty-state-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${safeIcon}</svg></div>`;
  const bodyHtml = body ? `<p class="empty-state-body">${body}</p>` : '';
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

  if (actions.some((a) => typeof a.onClick === 'function')) {
    return {
      html,
      attach(container) {
        actions.forEach((action, idx) => {
          if (typeof action.onClick !== 'function') return;
          const selector = action.id ? `#${CSS.escape(action.id)}` : `[data-action-index="${idx}"]`;
          const btn = container.querySelector(selector);
          if (btn) btn.addEventListener('click', action.onClick);
        });
      },
    };
  }
  return html;
}

/**
 * Debounce a function call.
 * @param {Function} fn
 * @param {number} [wait=300]
 * @returns {Function & {cancel:Function,flush:Function,pending:Function}}
 */
export function debounce(fn, wait = 300) {
  if (typeof fn !== 'function') throw new TypeError('debounce requires a function');
  const delay = Number.isFinite(wait) && wait > 0 ? wait : 0;
  let timeout = null;
  let lastArgs = null;
  let lastThis = null;
  const debounced = function (...args) {
    lastArgs = args;
    lastThis = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      const argsToUse = lastArgs;
      const self = lastThis;
      lastArgs = lastThis = null;
      if (argsToUse) {
        fn.apply(self, argsToUse);
      }
    }, delay);
  };
  debounced.cancel = () => {
    clearTimeout(timeout);
    timeout = lastArgs = lastThis = null;
  };
  debounced.flush = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
      const argsToUse = lastArgs;
      const self = lastThis;
      lastArgs = lastThis = null;
      if (argsToUse) {
        fn.apply(self, argsToUse);
      }
    }
  };
  debounced.pending = () => timeout !== null;
  return debounced;
}

/**
 * Throttle a function call.
 * @param {Function} fn
 * @param {number} [limit=300]
 * @returns {Function & {cancel:Function,flush:Function,pending:Function}}
 */
export function throttle(fn, limit = 300) {
  if (typeof fn !== 'function') throw new TypeError('throttle requires a function');
  const cooldown = Number.isFinite(limit) && limit > 0 ? limit : 0;
  let inThrottle = false;
  let pending = null;
  let pendingThis = null;
  let timer = null;
  const invoke = () => {
    const args2 = pending;
    const self = pendingThis;
    pending = pendingThis = null;
    inThrottle = true;
    try {
      fn.apply(self, args2);
    } catch (err) {
      inThrottle = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      throw err;
    }
  };
  const throttled = function (...args) {
    if (!inThrottle) {
      pending = args;
      pendingThis = this;
      invoke();
      timer = setTimeout(() => {
        inThrottle = false;
        timer = null;
        if (pending !== null) {
          const pendingArgs = pending;
          const pendingSelf = pendingThis;
          pending = pendingThis = null;
          throttled.apply(pendingSelf, pendingArgs);
        }
      }, cooldown);
    } else {
      pending = args;
      pendingThis = this;
    }
  };
  throttled.cancel = () => {
    inThrottle = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pending = pendingThis = null;
  };
  throttled.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending !== null) {
      inThrottle = true;
      const args2 = pending;
      const self = pendingThis;
      pending = pendingThis = null;
      try {
        fn.apply(self, args2);
      } catch (err) {
        inThrottle = false;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        throw err;
      }
      timer = setTimeout(() => {
        inThrottle = false;
        timer = null;
      }, cooldown);
    }
  };
  throttled.pending = () => timer !== null;
  return throttled;
}

/**
 * Check if the browser appears to be online.
 * @returns {boolean}
 */
export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Wrap a function so it can only be called once.
 * Subsequent calls return the result of the first invocation.
 * @param {Function} fn
 * @returns {Function}
 */
export function once(fn) {
  if (typeof fn !== 'function') throw new TypeError('once requires a function');
  let called = false;
  let result;
  let error;
  return function (...args) {
    if (called) {
      if (error) throw error;
      return result;
    }
    called = true;
    try {
      result = fn.apply(this, args);
      return result;
    } catch (err) {
      error = err;
      throw err;
    }
  };
}

/**
 * Generate a random nonce for CSP or script injection.
 * @returns {string} Hex-encoded 16-byte random string.
 */
export function getNonce() {
  const arr = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Deep-clone a serializable object.
 * Uses structuredClone when available, falls back to JSON round-trip.
 * Falls back to a shallow copy for objects/arrays instead of the original
 * reference to prevent accidental mutation.
 * @param {any} obj
 * @returns {any}
 */
export function deepClone(obj) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj);
    } catch {
      // structuredClone can fail on functions, DOM nodes, etc.
    }
  }
  return _deepClone(obj);
}

function _deepClone(obj, seen = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (seen.has(obj)) return seen.get(obj);
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags);
  if (obj instanceof Map) {
    const map = new Map();
    seen.set(obj, map);
    for (const [k, v] of obj) {
      map.set(_deepClone(k, seen), _deepClone(v, seen));
    }
    return map;
  }
  if (obj instanceof Set) {
    const set = new Set();
    seen.set(obj, set);
    for (const v of obj) {
      set.add(_deepClone(v, seen));
    }
    return set;
  }
  if (Array.isArray(obj)) {
    const arr = [];
    seen.set(obj, arr);
    for (let i = 0; i < obj.length; i++) {
      arr.push(_deepClone(obj[i], seen));
    }
    return arr;
  }
  const cloned = {};
  seen.set(obj, cloned);
  for (const key of Object.keys(obj)) {
    cloned[key] = _deepClone(obj[key], seen);
  }
  return cloned;
}

/**
 * Wait for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  const delay = Number.isFinite(ms) && ms > 0 ? ms : 0;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Memoize a function so repeated calls with the same arguments
 * return a cached result. Uses a simple JSON key for serialization.
 * @param {Function} fn
 * @param {number} [maxSize=1000] Maximum number of cached entries.
 * @returns {Function} Memoized function with `.clear()` method.
 */
export function memoize(fn, maxSize = 1000) {
  if (typeof fn !== 'function') throw new TypeError('memoize requires a function');
  const limit = Number.isFinite(maxSize) && maxSize > 0 ? Math.floor(maxSize) : 1000;
  const cache = new Map();
  const memoized = function (...args) {
    let key;
    try {
      key = JSON.stringify(args, (_k, v) => (v === undefined ? '__memo_undefined__' : v));
    } catch {
      return fn.apply(this, args);
    }
    if (cache.has(key)) {
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    }
    const result = fn.apply(this, args);
    cache.set(key, result);
    if (cache.size > limit) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    return result;
  };
  memoized.clear = () => cache.clear();
  Object.defineProperty(memoized, 'size', { get: () => cache.size });
  memoized.has = (key) => {
    if (key === undefined) return false;
    let k;
    try {
      k = JSON.stringify([key], (_k, v) => (v === undefined ? '__memo_undefined__' : v));
    } catch {
      return false;
    }
    return cache.has(k);
  };
  return memoized;
}

/**
 * Return an array with duplicate values removed (shallow comparison).
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
export function unique(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr)];
}

/**
 * Flatten nested arrays into a single-level array.
 * @template T
 * @param {(T | T[])[]} arr
 * @returns {T[]}
 */
export function flatten(arr) {
  const result = [];
  if (!Array.isArray(arr)) return result;
  for (const item of arr) {
    if (Array.isArray(item)) {
      result.push(...flatten(item));
    } else {
      result.push(item);
    }
  }
  return result;
}

/**
 * Generate an array of numbers from `start` (inclusive) to `end` (exclusive).
 * If only one argument is provided, it is treated as `end` and `start` becomes 0.
 * @param {number} start
 * @param {number} [end]
 * @param {number} [step=1]
 * @returns {number[]}
 */
export function range(start, end, step = 1) {
  const s = end === undefined ? 0 : start;
  const e = end === undefined ? start : end;
  if (step === 0 || !Number.isFinite(step) || !Number.isFinite(s) || !Number.isFinite(e)) return [];
  const result = [];
  if (step > 0) {
    for (let i = s; i < e; i += step) result.push(i);
  } else {
    for (let i = s; i > e; i += step) result.push(i);
  }
  return result;
}

/**
 * Retry an async operation with exponential backoff.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {number} [retries=3]
 * @param {number} [delayMs=200]
 * @param {number} [backoff=2]
 * @param {number} [maxDelayMs=30000]
 * @param {Function} [shouldRetry] Optional predicate to decide whether an error is retryable.
 * @returns {Promise<T>}
 */
export async function retry(
  fn,
  retries = 3,
  delayMs = 200,
  backoff = 2,
  maxDelayMs = 30000,
  shouldRetry
) {
  if (typeof fn !== 'function') throw new TypeError('retry expects a function');
  const maxAttempts = Math.max(0, Number.isFinite(retries) ? Math.floor(retries) : 0);
  let lastErr;
  let wait = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 0;
  const mult = Number.isFinite(backoff) && backoff > 0 ? backoff : 1;
  const cap = Number.isFinite(maxDelayMs) && maxDelayMs > 0 ? maxDelayMs : 30000;
  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        const retryable =
          typeof shouldRetry === 'function' ? shouldRetry(err) : shouldRetry !== false;
        if (retryable) {
          await sleep(wait);
          wait = Math.min(wait * mult, cap);
        } else {
          break;
        }
      } else {
        break;
      }
    }
  }
  throw lastErr;
}

/**
 * Debounce an async function so repeated calls within the wait window
 * reset the timer. Returns a promise that resolves with the latest result.
 * @param {Function} fn Async function to debounce.
 * @param {number} [wait=300] Delay in milliseconds.
 * @returns {Function} Debounced async function with `.cancel()`, `.flush()`, and `.pending()`.
 */
export function debounceAsync(fn, wait = 300) {
  if (typeof fn !== 'function') throw new TypeError('debounceAsync requires a function');
  const delay = Number.isFinite(wait) && wait > 0 ? wait : 0;
  let timeout = null;
  let lastArgs = null;
  let lastThis = null;
  let pendingPromise = null;
  let resolvePending = null;
  let rejectPending = null;

  const debounced = function (...args) {
    lastArgs = args;
    lastThis = this;
    if (timeout !== null) clearTimeout(timeout);

    if (!pendingPromise) {
      pendingPromise = new Promise((resolve, reject) => {
        resolvePending = resolve;
        rejectPending = reject;
      });
    }

    timeout = setTimeout(async () => {
      timeout = null;
      const argsToUse = lastArgs;
      const thisToUse = lastThis;
      lastArgs = lastThis = null;
      try {
        const result = await fn.apply(thisToUse, argsToUse);
        resolvePending?.(result);
      } catch (err) {
        rejectPending?.(err);
      } finally {
        pendingPromise = null;
        resolvePending = null;
        rejectPending = null;
      }
    }, delay);

    return pendingPromise;
  };

  debounced.cancel = () => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = lastArgs = lastThis = null;
    if (rejectPending) {
      rejectPending(new Error('Debounced call was cancelled'));
      pendingPromise = null;
      resolvePending = null;
      rejectPending = null;
    }
  };

  debounced.flush = async () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
      const argsToUse = lastArgs;
      const thisToUse = lastThis;
      lastArgs = lastThis = null;
      try {
        const result = await fn.apply(thisToUse, argsToUse);
        resolvePending?.(result);
        return result;
      } catch (err) {
        rejectPending?.(err);
        throw err;
      } finally {
        pendingPromise = null;
        resolvePending = null;
        rejectPending = null;
      }
    }
    return pendingPromise ?? undefined;
  };

  debounced.pending = () => timeout !== null;

  return debounced;
}

/**
 * Type guard: returns true if the value is neither null nor undefined.
 * @template T
 * @param {T | null | undefined} value
 * @returns {value is T}
 */
export function isDefined(value) {
  return value !== null && value !== undefined;
}

/**
 * Remove null and undefined values from an array, narrowing the type.
 * @template T
 * @param {(T | null | undefined)[]} arr
 * @returns {T[]}
 */
export function compact(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(isDefined);
}

/**
 * Pick a subset of keys from an object.
 * @template T, K
 * @param {T} obj
 * @param {K[]} keys
 * @returns {Object}
 */
export function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return {};
  const result = {};
  if (!keys || typeof keys === 'string' || typeof keys[Symbol.iterator] !== 'function')
    return result;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) result[key] = obj[key];
  }
  return result;
}

/**
 * Create a new object without the specified keys.
 * @template T, K
 * @param {T} obj
 * @param {K[]} keys
 * @returns {Object}
 */
export function omit(obj, keys) {
  if (!obj || typeof obj !== 'object') return {};
  const keySet = new Set(
    keys && typeof keys !== 'string' && typeof keys[Symbol.iterator] === 'function' ? keys : []
  );
  const result = {};
  for (const key of Object.keys(obj)) {
    if (!keySet.has(key)) result[key] = obj[key];
  }
  return result;
}

/**
 * Group array items by a key extracted from each item.
 * @template T, K
 * @param {T[]} arr
 * @param {(item: T) => K} keyFn
 * @returns {Map<K, T[]>}
 */
export function groupBy(arr, keyFn) {
  const map = new Map();
  if (!Array.isArray(arr) || typeof keyFn !== 'function') return map;
  for (const item of arr) {
    const key = keyFn(item);
    const list = map.get(key);
    if (list) {
      list.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

/**
 * Split an array into two groups based on a predicate.
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => boolean} predicate
 * @returns {[T[], T[]]}
 */
export function partition(arr, predicate) {
  const pass = [];
  const fail = [];
  if (!Array.isArray(arr) || typeof predicate !== 'function') return [pass, fail];
  for (const item of arr) {
    if (predicate(item)) {
      pass.push(item);
    } else {
      fail.push(item);
    }
  }
  return [pass, fail];
}

/**
 * Copy text to clipboard. Returns a promise resolving to true on success.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  const s = String(text ?? '');
  if (!s) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(s);
      return true;
    }
    if (typeof document !== 'undefined' && document.execCommand) {
      const ta = document.createElement('textarea');
      ta.value = s;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  } catch {
    // fall through
  }
  return false;
}

/**
 * Split an array into chunks of a given maximum size.
 * @template T
 * @param {T[]} arr Array to split.
 * @param {number} size Maximum chunk size (must be >= 1).
 * @returns {T[][]}
 */
export function chunk(arr, size) {
  if (!Array.isArray(arr)) return [];
  const chunkSize = Number.isFinite(size) && size >= 1 ? Math.floor(size) : 1;
  const result = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    result.push(arr.slice(i, i + chunkSize));
  }
  return result;
}

/**
 * Safely read from localStorage, returning a fallback on any error.
 * @template T
 * @param {string} key Storage key.
 * @param {T} [fallback] Fallback value when read fails or key is absent.
 * @returns {T | undefined}
 */
export function localStorageGet(key, fallback) {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Safely write to localStorage. Silently fails on quota exceeded or private mode.
 * @param {string} key Storage key.
 * @param {*} value Serializable value.
 * @returns {boolean} True if the write succeeded.
 */
export function localStorageSet(key, value) {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely remove a key from localStorage.
 * @param {string} key Storage key.
 * @returns {boolean} True if removal succeeded or key did not exist.
 */
export function localStorageRemove(key) {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely read from sessionStorage, returning a fallback on any error.
 * @template T
 * @param {string} key Storage key.
 * @param {T} [fallback] Fallback value when read fails or key is absent.
 * @returns {T | undefined}
 */
export function sessionStorageGet(key, fallback) {
  if (typeof window === 'undefined' || !window.sessionStorage) return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Safely write to sessionStorage. Silently fails on quota exceeded.
 * @param {string} key Storage key.
 * @param {*} value Serializable value.
 * @returns {boolean} True if the write succeeded.
 */
export function sessionStorageSet(key, value) {
  if (typeof window === 'undefined' || !window.sessionStorage) return false;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely remove a key from sessionStorage.
 * @param {string} key Storage key.
 * @returns {boolean} True if removal succeeded or key did not exist.
 */
export function sessionStorageRemove(key) {
  if (typeof window === 'undefined' || !window.sessionStorage) return false;
  try {
    window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether the user prefers reduced motion (accessibility).
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check whether the user's system is set to dark mode.
 * @returns {boolean}
 */
export function prefersDarkMode() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Check whether a value is "empty" — null, undefined, empty string, empty array,
 * or an object with no own enumerable keys.
 * @param {any} value
 * @returns {boolean}
 */
export function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Map || value instanceof Set) return value.size === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Wrap a value in an array if it isn't already one.
 * Null/undefined produces an empty array.
 * @template T
 * @param {T | T[] | null | undefined} value
 * @returns {T[]}
 */
export function ensureArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

/**
 * Deep equality check for plain objects, arrays, Dates, RegExps, Maps, Sets,
 * and primitive values.
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp)
    return a.source === b.source && a.flags === b.flags;

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!b.has(k) || !deepEqual(v, b.get(k))) return false;
    }
    return true;
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const v of a) {
      let found = false;
      for (const w of b) {
        if (deepEqual(v, w)) {
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

/**
 * Debounce a function so it fires on the leading edge and then ignores
 * subsequent calls until the cooldown expires.
 * @param {Function} fn Function to debounce.
 * @param {number} [wait=300] Delay in milliseconds.
 * @returns {Function} Debounced function with `.cancel()` method.
 */
export function debounceLeading(fn, wait = 300) {
  if (typeof fn !== 'function') throw new TypeError('debounceLeading requires a function');
  const delay = Number.isFinite(wait) && wait > 0 ? wait : 0;
  let timeout = null;
  const debounced = function (...args) {
    if (timeout === null) {
      fn.apply(this, args);
    } else {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      timeout = null;
    }, delay);
  };
  debounced.cancel = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  return debounced;
}

/**
 * Sort an array by a key extracted from each item (stable sort).
 * @template T
 * @param {T[]} arr Array to sort.
 * @param {(item: T) => any} keyFn Function returning the sort key.
 * @param {'asc' | 'desc'} [order='asc'] Sort direction.
 * @returns {T[]}
 */
export function sortBy(arr, keyFn, order = 'asc') {
  if (!Array.isArray(arr)) return [];
  if (typeof keyFn !== 'function') return [...arr];
  const sorted = [...arr];
  const dir = order === 'desc' ? -1 : 1;
  sorted.sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    if (ka === kb) return 0;
    if (ka == null) return dir;
    if (kb == null) return -dir;
    if (typeof ka === 'number' && typeof kb === 'number') return (ka - kb) * dir;
    if (ka instanceof Date && kb instanceof Date) return (ka.getTime() - kb.getTime()) * dir;
    return String(ka).localeCompare(String(kb)) * dir;
  });
  return sorted;
}

/**
 * Create a lookup object from an array, using a key-extractor function.
 * @template T
 * @param {T[]} arr Array to index.
 * @param {(item: T) => string} keyFn Function returning the lookup key.
 * @returns {Record<string, T>}
 */
export function keyBy(arr, keyFn) {
  if (!Array.isArray(arr) || typeof keyFn !== 'function') return {};
  const result = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (key != null && typeof key === 'string') {
      result[key] = item;
    }
  }
  return result;
}

// ── New Utility Helpers ─────────────────────────────────────────

/**
 * Generate a random alphanumeric ID.
 * @param {number} [length=8] Length of the ID.
 * @returns {string}
 */
export function randomId(length = 8) {
  const len = Math.max(1, Math.floor(Number(length) || 8));
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const max = chars.length;
  let id = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) id += chars[arr[i] % max];
  } else {
    for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * max)];
  }
  return id;
}

/**
 * Shallow merge: fill only undefined keys on the target.
 * @param {Object} target
 * @param {...Object} sources
 * @returns {Object}
 */
export function defaults(target, ...sources) {
  if (!target || typeof target !== 'object') return {};
  const result = { ...target };
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const key of Object.keys(src)) {
      if (!(key in result)) result[key] = src[key];
    }
  }
  return result;
}

/**
 * Recursive deep merge for plain objects. Arrays are replaced, not merged.
 * @param {Object} target
 * @param {...Object} sources
 * @returns {Object}
 */
export function merge(target, ...sources) {
  if (!target || typeof target !== 'object') return {};
  const result = { ...target };
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const key of Object.keys(src)) {
      const val = src[key];
      if (
        val &&
        typeof val === 'object' &&
        !Array.isArray(val) &&
        result[key] &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key])
      ) {
        result[key] = merge(result[key], val);
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

/**
 * Return the intersection of two arrays.
 * @template T
 * @param {T[]} a
 * @param {T[]} b
 * @returns {T[]}
 */
export function intersection(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return [];
  const setB = new Set(b);
  return a.filter((item) => setB.has(item));
}

/**
 * Return the set difference: items in `a` that are not in `b`.
 * @template T
 * @param {T[]} a
 * @param {T[]} b
 * @returns {T[]}
 */
export function difference(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return Array.isArray(a) ? [...a] : [];
  const setB = new Set(b);
  return a.filter((item) => !setB.has(item));
}

/**
 * Pick a random element from an array.
 * @template T
 * @param {T[]} arr
 * @returns {T|undefined}
 */
export function randomChoice(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)]; // simplebeacon-ignore weak-crypto
}

/**
 * Safe own-property check.
 * @param {Object} obj
 * @param {string} key
 * @returns {boolean}
 */
export function has(obj, key) {
  return obj != null && typeof obj === 'object' && Object.hasOwn(obj, key);
}

/**
 * Alias for {@link sleep} using common async library naming.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return sleep(ms);
}

/**
 * Compute a simple 32-bit hash for a string.
 * @param {string} str
 * @returns {number} Unsigned 32-bit hash.
 */
export function hash(str) {
  const s = String(str ?? '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/**
 * Exhaustiveness checker for TypeScript-style discriminated unions.
 * @param {never} value
 * @param {string} [message]
 * @returns {never}
 */
export function assertNever(value, message = 'Unexpected value') {
  const display =
    typeof value === 'string'
      ? value
      : (() => {
          try {
            return JSON.stringify(value);
          } catch {
            return String(value);
          }
        })();
  throw new Error(`${message}: ${display}`);
}

/**
 * Safely parse a JSON string, returning a fallback on failure.
 * @template T
 * @param {string} text
 * @param {T} fallback
 * @returns {T}
 */
export function parseJsonSafe(text, fallback = null) {
  if (text == null) return fallback;
  try {
    return JSON.parse(String(text));
  } catch {
    return fallback;
  }
}

/**
 * Call a function n times and collect the results.
 * @template T
 * @param {number} n
 * @param {(index: number) => T} fn
 * @returns {T[]}
 */
export function times(n, fn) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  const result = [];
  for (let i = 0; i < count; i++) result.push(fn(i));
  return result;
}

/**
 * Safely get a nested property by dot-path string.
 * @param {Object} obj
 * @param {string} path
 * @param {any} [fallback]
 * @returns {any}
 */
export function get(obj, path, fallback) {
  if (!obj || typeof obj !== 'object' || typeof path !== 'string') return fallback;
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return fallback;
    current = current[key];
  }
  return current === undefined ? fallback : current;
}

/**
 * Safely set a nested property by dot-path string.
 * @param {Object} obj
 * @param {string} path
 * @param {any} value
 * @returns {Object}
 */
export function set(obj, path, value) {
  if (!obj || typeof obj !== 'object' || typeof path !== 'string') return obj;
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] == null || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
  return obj;
}

/**
 * Alias for {@link randomId}.
 * @returns {string}
 */
export function uid() {
  return randomId(8);
}

/**
 * Compose functions left-to-right.
 * @param {...Function} fns
 * @returns {Function}
 */
export function seq(...fns) {
  return (value) => fns.reduce((v, fn) => fn(v), value);
}

/**
 * Safely call a function and return a structured result.
 * @param {Function} fn Function to invoke.
 * @param {...any} args Arguments to pass to the function.
 * @returns {{ok: boolean, value?: any, error?: Error}}
 */
export function tryFn(fn, ...args) {
  try {
    return { ok: true, value: fn.apply(this, args) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Parallel map with optional concurrency limit.
 * @template T, R
 * @param {T[]} array
 * @param {(item: T, index: number) => Promise<R>} mapper
 * @param {number} [concurrency=Infinity]
 * @returns {Promise<R[]>}
 */
export async function pMap(array, mapper, concurrency = Infinity) {
  if (!Array.isArray(array)) return [];
  if (typeof mapper !== 'function') throw new TypeError('pMap expects a function');
  const limit =
    Number.isFinite(concurrency) && concurrency > 0 ? Math.floor(concurrency) : Infinity;
  if (limit === Infinity) return Promise.all(array.map(mapper));
  const results = [];
  let index = 0;
  let active = 0;
  return new Promise((resolve, reject) => {
    function next() {
      if (index >= array.length) {
        if (active === 0) resolve(results);
        return;
      }
      const i = index++;
      active++;
      Promise.resolve(mapper(array[i], i)).then((value) => {
        results[i] = value;
        active--;
        next();
      }, reject);
    }
    for (let j = 0; j < limit && j < array.length; j++) next();
  });
}

/**
 * Memoize an async function so repeated calls with the same arguments
 * return a cached promise.
 * @param {Function} fn Async function to memoize.
 * @param {Function} [resolver] Optional function to generate a cache key from arguments.
 * @returns {Function & {clear(): void, size: number, has(key: any): boolean}}
 */
export function memoizeAsync(fn, resolver) {
  if (typeof fn !== 'function') throw new TypeError('memoizeAsync expects a function');
  const cache = new Map();
  const memoized = function (...args) {
    const key = typeof resolver === 'function' ? resolver.apply(this, args) : JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const promise = fn.apply(this, args).catch((err) => {
      cache.delete(key);
      throw err;
    });
    cache.set(key, promise);
    return promise;
  };
  memoized.clear = () => cache.clear();
  Object.defineProperty(memoized, 'size', { get: () => cache.size });
  memoized.has = (key) => cache.has(key);
  return memoized;
}

/**
 * Poll a predicate until it returns truthy or times out.
 * @template T
 * @param {() => T} fn Predicate to poll.
 * @param {number} intervalMs Interval between polls.
 * @param {number} [timeoutMs=30000] Total timeout.
 * @returns {Promise<T>}
 */
export function poll(fn, intervalMs, timeoutMs = 30000) {
  if (typeof fn !== 'function') throw new TypeError('poll expects a function');
  const interval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 1000;
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000;
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tick() {
      try {
        const result = fn();
        if (result) return resolve(result);
      } catch (err) {
        return reject(err);
      }
      if (Date.now() - start > timeout) {
        return reject(new Error('Poll timed out'));
      }
      setTimeout(tick, interval);
    }
    tick();
  });
}

/**
 * Wait until a predicate returns truthy.
 * @param {() => boolean} predicate
 * @param {number} [intervalMs=100]
 * @param {number} [timeoutMs=30000]
 * @returns {Promise<void>}
 */
export function waitForAsync(predicate, intervalMs = 100, timeoutMs = 30000) {
  if (typeof predicate !== 'function') throw new TypeError('waitForAsync expects a function');
  const interval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 100;
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000;
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tick() {
      try {
        if (predicate()) return resolve();
      } catch (err) {
        return reject(err);
      }
      if (Date.now() - start > timeout) {
        return reject(new Error('waitForAsync timed out'));
      }
      setTimeout(tick, interval);
    }
    tick();
  });
}

/**
 * Throttle an async function so it runs at most once per wait window.
 * @param {Function} fn Async function to throttle.
 * @param {number} [wait=300] Delay in milliseconds.
 * @returns {Function & {cancel(): void, flush(): Promise<any>, pending(): boolean}}
 */
export function throttleAsync(fn, wait = 300) {
  if (typeof fn !== 'function') throw new TypeError('throttleAsync requires a function');
  const delay = Number.isFinite(wait) && wait > 0 ? wait : 0;
  let timeout = null;
  let lastArgs = null;
  let lastThis = null;
  let pendingPromise = null;
  let resolvePending = null;
  let rejectPending = null;
  const throttled = function (...args) {
    lastArgs = args;
    lastThis = this;
    if (timeout !== null) return pendingPromise;
    if (!pendingPromise) {
      pendingPromise = new Promise((resolve, reject) => {
        resolvePending = resolve;
        rejectPending = reject;
      });
    }
    const invoke = async () => {
      timeout = null;
      const argsToUse = lastArgs;
      const self = lastThis;
      lastArgs = lastThis = null;
      try {
        const result = await fn.apply(self, argsToUse);
        resolvePending?.(result);
      } catch (err) {
        rejectPending?.(err);
      } finally {
        pendingPromise = null;
        resolvePending = null;
        rejectPending = null;
      }
    };
    invoke();
    timeout = setTimeout(() => {
      timeout = null;
      if (lastArgs) throttled.apply(lastThis, lastArgs);
    }, delay);
    return pendingPromise;
  };
  throttled.cancel = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    lastArgs = lastThis = null;
    if (rejectPending) {
      rejectPending(new Error('Throttled call was cancelled'));
      pendingPromise = null;
      resolvePending = null;
      rejectPending = null;
    }
  };
  throttled.flush = async () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (lastArgs) {
      const argsToUse = lastArgs;
      const self = lastThis;
      lastArgs = lastThis = null;
      try {
        const result = await fn.apply(self, argsToUse);
        resolvePending?.(result);
        return result;
      } catch (err) {
        rejectPending?.(err);
        throw err;
      } finally {
        pendingPromise = null;
        resolvePending = null;
        rejectPending = null;
      }
    }
    return pendingPromise ?? undefined;
  };
  throttled.pending = () => timeout !== null || pendingPromise !== null;
  return throttled;
}

/**
 * Check whether a string is a valid absolute URL.
 * @param {string} str
 * @returns {boolean}
 */
export function isValidUrl(str) {
  if (typeof str !== 'string') return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Parse a string as an integer, returning a fallback on failure.
 * @param {string|number} str
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function safeParseInt(str, fallback = 0) {
  if (typeof str === 'number') return Number.isFinite(str) ? Math.floor(str) : fallback;
  if (typeof str !== 'string') return fallback;
  const parsed = Number.parseInt(str, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Parse a string as a float, returning a fallback on failure.
 * @param {string|number} str
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function safeParseFloat(str, fallback = 0) {
  if (typeof str === 'number') return Number.isFinite(str) ? str : fallback;
  if (typeof str !== 'string') return fallback;
  const parsed = Number.parseFloat(str);
  return Number.isFinite(parsed) ? parsed : fallback;
}
