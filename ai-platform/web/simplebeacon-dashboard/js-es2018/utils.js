/**
 * Escape html.
 * @param {string} str
 * @returns {any}
 */
export function escapeHtml(str) {
    if (str == null)
        return ''; // simplebeacon-ignore dead-code — guard return for null/undefined input
    // simplebeacon-ignore dead-code — main return of escapeHtml function
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
/**
 * Show toast.
 * @param {string} message
 * @param {any} type
 * @returns {any}
 */
export function showToast(message, type = 'info') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
}
/**
 * Format number.
 * @param {any} n
 * @returns {any}
 */
export function formatNumber(n) {
    if (n == null)
        return '—';
    const numericCount = Number(n);
    if (!Number.isFinite(numericCount))
        return '—';
    return numericCount.toLocaleString();
}
/**
 * Format percent.
 * @param {any} value
 * @returns {any}
 */
export function formatPercent(value) {
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
/** Display-only — hide C:\\Users\\… and /home/… prefixes in the UI. */
export function redactPathForDisplay(projectPath) {
    if (!projectPath)
        return '';
    const normalized = String(projectPath).replace(/\\/g, '/');
    const ellipsisUser = normalized.match(/^(?:…|\.{3})\/[^/]+(\/.+)?$/);
    if (ellipsisUser) {
        return ellipsisUser[1] ? `…${ellipsisUser[1]}` : '…';
    }
    const winHome = normalized.match(/^[a-zA-Z]:\/Users\/[^/]+(\/.+)?$/i);
    if (winHome) {
        return winHome[1] ? `…${winHome[1]}` : '…';
    }
    const unixHome = normalized.match(/^\/Users\/[^/]+(\/.+)?$/);
    if (unixHome) {
        return unixHome[1] ? `…${unixHome[1]}` : '…';
    }
    const unixHome2 = normalized.match(/^\/home\/[^/]+(\/.+)?$/);
    if (unixHome2) {
        return unixHome2[1] ? `…${unixHome2[1]}` : '…';
    }
    // Some path payloads can already be shortened to "/<username>/...".
    // If it looks like a user-home style absolute path, hide the first segment.
    const unixLikeUserRoot = normalized.match(/^\/(?!usr\/|var\/|etc\/|opt\/|bin\/|sbin\/|tmp\/|dev\/|mnt\/|proc\/|sys\/|run\/)([^/]+)(\/.+)$/i);
    if (unixLikeUserRoot) {
        return `…${unixLikeUserRoot[2]}`;
    }
    // Final guard for any "…/user/..." or ".../user/..." sequence that may
    // appear inside partially redacted path strings from older payloads.
    if (/(?:^|\/)(?:…|\.{3})\/[^/]+\//.test(normalized)) {
        return normalized.replace(/((?:^|\/)(?:…|\.{3}))\/[^/]+(\/)/, '$1$2');
    }
    return projectPath;
}
/** True when the string is a privacy-redacted path (…/folder) rather than a full absolute path. */
export function isRedactedPathDisplay(displayPath) {
    if (displayPath == null || displayPath === '')
        return false;
    const normalized = String(displayPath).replace(/\\/g, '/').trim();
    if (/^(?:…|\.{3})(?:\/|$)/.test(normalized))
        return true;
    if (/(?:^|\/)(?:…|\.{3})\//.test(normalized))
        return true;
    return false;
}
/** Editable path inputs — keep the full absolute path; normalize slashes only. */
export function formatPathInputValue(projectPath) {
    if (!projectPath)
        return '';
    return String(projectPath).replace(/\\/g, '/');
}
/**
 * Format scan path for display.
 * @param {string} scanPath
 * @param {any} projectRoot
 * @returns {any}
 */
export function formatScanPathForDisplay(scanPath, projectRoot) {
    if (!scanPath)
        return '';
    const normalized = String(scanPath).replace(/\\/g, '/');
    const root = String(projectRoot || '').replace(/\\/g, '/').replace(/\/$/, '');
    if (root && normalized.toLowerCase().startsWith(`${root.toLowerCase()}/`)) {
        return normalized.slice(root.length + 1);
    }
    if (!/^[a-zA-Z]:\//.test(normalized) && !normalized.startsWith('/')) {
        return normalized;
    }
    return redactPathForDisplay(scanPath);
}
/**
 * Format path label.
 * @param {string} projectPath
 * @returns {any}
 */
export function formatPathLabel(projectPath) {
    const redacted = redactPathForDisplay(projectPath);
    if (redacted && redacted !== projectPath)
        return redacted;
    const normalized = String(projectPath || '').replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    // Preserve drive letter for Windows paths that are just a drive + one folder
    // (e.g. I:/AGI Chatbot should stay readable, not collapse to AGI Chatbot)
    if (parts.length <= 2 && /^[a-zA-Z]:$/.test(parts[0])) {
        return normalized;
    }
    return parts[parts.length - 1] || projectPath || '';
}
/**
 * Format ai summary skip message.
 * @param {string} errorMessage
 * @returns {any}
 */
export function formatAiSummarySkipMessage(errorMessage) {
    const msg = String(errorMessage || '');
    if (/openai is not configured/i.test(msg)) {
        return 'Optional AI narrative skipped — add your OpenAI key in Settings → AI providers (findings unchanged).';
    }
    if (/anthropic is not configured/i.test(msg)) {
        return 'Optional AI narrative skipped — add your Anthropic key in Settings → AI providers (findings unchanged).';
    }
    if (/ollama is not configured/i.test(msg)) {
        return 'Optional AI narrative skipped — set Ollama model in Settings → AI providers (e.g. llama3.2), or add OLLAMA_MODEL to server .env (findings unchanged).';
    }
    if (/ollama is unreachable/i.test(msg)) {
        return 'Optional AI narrative skipped — Ollama is not running. Start it with `ollama serve`, pull a model (`ollama pull llama3.2`), then set the model in Settings → AI providers (findings unchanged).';
    }
    if (/ollama has no models/i.test(msg)) {
        return 'Optional AI narrative skipped — Ollama is running but has no models. Run `ollama pull llama3.2` or pick a model in Settings → AI providers (findings unchanged).';
    }
    if (/OLLAMA_MODEL|Local AI Models/i.test(msg)) {
        return 'Optional AI narrative skipped — set Ollama model in Settings → AI providers (e.g. llama3.2), or add OLLAMA_MODEL to server .env (findings unchanged).';
    }
    if (/Filesystem scan only|Active local model is filesystem/i.test(msg)) {
        return 'Optional AI narrative skipped — choose Ollama or a cloud provider in the AI provider dropdown (findings unchanged).';
    }
    if (/Settings → AI providers/i.test(msg)) {
        return `Optional AI narrative skipped — ${msg.replace(/^[^:]+:\s*/i, '')} (findings unchanged).`;
    }
    return `Optional AI narrative skipped: ${msg}`;
}
/**
 * Fetch with timeout.
 * @param {string} url
 * @param {Object} options
 * @param {Array} ms
 * @returns {any}
 */
export async function fetchWithTimeout(url, options = {}, ms = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    }
    catch (err) {
        if (err.name === 'AbortError') {
            throw new Error(`Request timed out — is the server running? (${url})`);
        }
        throw err;
    }
    finally {
        clearTimeout(timer);
    }
}
/**
 * Download json.
 * @param {any} data
 * @param {string} filename
 * @returns {any}
 */
export function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, filename);
}
/**
 * Download blob.
 * @param {any} blob
 * @param {string} filename
 * @returns {any}
 */
export function downloadBlob(blob, filename) {
    if (!blob || typeof document === 'undefined') {
        throw new Error('Download is unavailable.');
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
/**
 * Download text.
 * @param {any} content
 * @param {string} filename
 * @param {any} mime
 * @returns {any}
 */
export function downloadText(content, filename, mime = 'text/plain') {
    const blob = new Blob([content], { type: mime });
    downloadBlob(blob, filename);
}
/**
 * Sanitizes input strings by replacing sensitive patterns with generic placeholders.
 * @param {string} text - The raw log or user input string.
 * @returns {string} The anonymized text.
 */
/**
 * Render a standardized empty-state block.
 * @param {Object} opts
 * @param {string} opts.icon - SVG icon markup (omit <svg> wrapper if providing inner paths only)
 * @param {string} opts.title - Heading text
 * @param {string} [opts.body] - Descriptive paragraph (HTML allowed for links)
 * @param {Array<{label:string,id?:string,className?:string,onClick?:Function}>} [opts.actions] - Button configs
 * @param {string} [opts.iconWrapper] - 'svg' (default) or 'emoji' for rendering style
 * @returns {string} HTML string
 */
/**
 * Render empty state.
 * @param {Object} opts
 * @returns {any}
 */
export function renderEmptyState(opts) {
    const { icon, title, body = '', actions = [], iconWrapper = 'svg' } = opts;
    const iconHtml = iconWrapper === 'emoji'
        ? `<div class="empty-state-icon" style="font-size:3rem;background:none;width:auto;height:auto;">${escapeHtml(icon)}</div>`
        : `<div class="empty-state-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></div>`;
    const bodyHtml = body ? `<p class="empty-state-body">${body}</p>` : '';
    const actionsHtml = actions.length
        ? `<div class="empty-state-actions">${actions.map(a => `<button class="btn ${a.className || 'btn-primary'}"${a.id ? ` id="${a.id}"` : ''}>${escapeHtml(a.label)}</button>`).join('')}</div>`
        : '';
    return `
    <div class="empty-state card">
      ${iconHtml}
      <p class="empty-state-title">${escapeHtml(title)}</p>
      ${bodyHtml}
      ${actionsHtml}
    </div>
  `.trim();
}
/**
 * Sanitize privacy data.
 * @param {string} text
 * @returns {any}
 */
export function sanitizePrivacyData(text) {
    if (!text || typeof text !== 'string')
        return text;
    let cleaned = text;
    // Redact Emails
    cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
    // Redact IPv4 Addresses
    cleaned = cleaned.replace(/\b(?:(?:25[0-5]|2[0-4][0-3]|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4][0-3]|[01]?\d\d?)\b/g, '[REDACTED_IP]');
    // Redact Bearer Tokens / API Keys / Password assignments
    cleaned = cleaned.replace(/(([a-zA-Z0-9_-]*(?:secret|token|key|pwd|password|auth))(=|:)\s*['"][^'"]+['"])/gi, '$2$3"[REDACTED_CREDENTIAL]"');
    return cleaned;
}
