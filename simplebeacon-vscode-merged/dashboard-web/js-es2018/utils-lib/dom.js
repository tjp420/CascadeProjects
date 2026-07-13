/**
 * dom utilities.
 */

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
      toast.innerHTML = item.message;
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
 * Create and append a single toast element.
 * @param {HTMLElement} container
 * @param {string} message
 * @param {string} type
 * @param {boolean} html
 * @param {number} duration
 */
function _createToastElement(container, message, type, html, duration) {
  const toast = document.createElement('div');
  toast.className = `toast ${type} show`;
  if (html) {
    toast.innerHTML = message;
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
  const { html = false, duration = 3500, queue = true } = (opts && typeof opts === 'object' && !Array.isArray(opts)) ? opts : {};
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none;';
    document.body.appendChild(container);
  }
  if (queue) {
    _toastQueue.push({ message, type, html, duration });
    if (_toastQueue.length === 1 && !_toastTimer) {
      _drainToastQueue();
    }
    return;
  }
  // Immediate (non-queued) toast
  _createToastElement(container, message, type, html, duration);
}


/** Remove the toast container and clear the queue. */
export function removeToastContainer() {
  clearTimeout(_toastTimer);
  _toastTimer = null;
  _toastQueue.length = 0;
  if (typeof document === 'undefined') return;
  const container = document.getElementById('toast-container');
  if (container) container.remove();
}


/**
 * Create a DOM element with attributes and child nodes.
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
 * Render a standardized empty-state block.
 * @param {Object} opts
 * @param {string} opts.icon SVG icon markup (omit `<svg>` wrapper if providing inner paths only).
 * @param {string} opts.title Heading text.
 * @param {string} [opts.body] Descriptive paragraph (HTML allowed for links).
 * @param {Array<{label:string,id?:string,className?:string,onClick?:Function}>} [opts.actions] Button configs.
 * @param {string} [opts.iconWrapper='svg'] 'svg' or 'emoji' for rendering style.
 * @returns {string|{html:string,attach:function(HTMLElement):void}} HTML string, or an object with
 *   `html` and `attach(container)` when actions have `onClick` handlers.
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

  // If actions have onClick handlers, return an object with attach() so callers can wire events
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
 * Check whether an element has a CSS class.
 * @param {HTMLElement} el
 * @param {string} className
 * @returns {boolean}
 */
export function hasClass(el, className) {
  if (!el || !className) return false;
  if (el.classList && typeof el.classList.contains === 'function') {
    return el.classList.contains(className);
  }
  const classes = String(el.className || '').split(/\s+/);
  return classes.includes(className);
}


/**
 * Add a CSS class to an element.
 * @param {HTMLElement} el
 * @param {string} className
 * @returns {void}
 */
export function addClass(el, className) {
  if (!el || !className) return;
  if (el.classList && typeof el.classList.add === 'function') {
    el.classList.add(className);
    return;
  }
  const classes = String(el.className || '').split(/\s+/).filter(Boolean);
  if (!classes.includes(className)) {
    el.className = classes.concat(className).join(' ');
  }
}


/**
 * Remove a CSS class from an element.
 * @param {HTMLElement} el
 * @param {string} className
 * @returns {void}
 */
export function removeClass(el, className) {
  if (!el || !className) return;
  if (el.classList && typeof el.classList.remove === 'function') {
    el.classList.remove(className);
    return;
  }
  const classes = String(el.className || '').split(/\s+/).filter((c) => c && c !== className);
  el.className = classes.join(' ');
}


/**
 * Toggle a CSS class on an element.
 * @param {HTMLElement} el
 * @param {string} className
 * @returns {boolean} True when the class is present after toggling.
 */
export function toggleClass(el, className) {
  if (!el || !className) return false;
  const hasIt = hasClass(el, className);
  if (hasIt) {
    removeClass(el, className);
    return false;
  }
  addClass(el, className);
  return true;
}

