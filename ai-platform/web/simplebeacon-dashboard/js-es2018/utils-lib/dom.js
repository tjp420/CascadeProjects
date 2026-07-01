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
    const iconHtml = iconWrapper === 'emoji'
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

