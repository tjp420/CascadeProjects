/**
 * format utilities.
 */

const DAYS_PER_MONTH = 30.44;

const DAYS_PER_YEAR = 365.25;

const SKIP_PREFIX = 'Optional AI narrative skipped';

const FINDINGS_NOTE = '(findings unchanged)';

const AI_SKIP_PATTERNS = [
    { test: /openai is not configured/i, msg: 'add your OpenAI key in Settings → AI providers' },
    { test: /anthropic is not configured/i, msg: 'add your Anthropic key in Settings → AI providers' },
    { test: /ollama is not configured/i, msg: 'set Ollama model in Settings → AI providers (e.g. llama3.2), or add OLLAMA_MODEL to server .env' },
    { test: /ollama is unreachable/i, msg: 'Ollama is not running. Start it with `ollama serve`, pull a model (`ollama pull llama3.2`), then set the model in Settings → AI providers' },
    { test: /ollama has no models/i, msg: 'Ollama is running but has no models. Run `ollama pull llama3.2` or pick a model in Settings → AI providers' },
    { test: /OLLAMA_MODEL|Local AI Models/i, msg: 'set Ollama model in Settings → AI providers (e.g. llama3.2), or add OLLAMA_MODEL to server .env' },
    { test: /Filesystem scan only|Active local model is filesystem/i, msg: 'choose Ollama or a cloud provider in the AI provider dropdown' },
];


/**
 * Format a number with locale separators.
 * @param {number|string|null|undefined} n
 * @returns {string}
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
 * Format a value as a percentage string.
 * @param {number|string|null|undefined} value
 * @param {number} [fractionDigits=1]
 * @returns {string}
 */
export function formatPercent(value, fractionDigits = 1) {
    if (value == null || value === '')
        return '—';
    const str = String(value).trim();
    if (str.endsWith('%'))
        return str;
    const num = Number(str);
    if (!Number.isFinite(num))
        return '—';
    const digits = Number.isFinite(fractionDigits)
        ? Math.max(0, Math.min(20, Math.floor(Number(fractionDigits) || 0)))
        : 1;
    return `${num.toFixed(digits)}%`;
}


/**
 * Format bytes to a human-readable string.
 * @param {number} bytes
 * @param {number} [decimals=2] Digits after the decimal point.
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 2) {
    if (bytes == null || !Number.isFinite(bytes) || bytes < 0)
        return '—';
    if (bytes === 0)
        return '0 B';
    const digits = Number.isFinite(decimals) ? Math.max(0, Math.min(20, Math.floor(Number(decimals) || 0))) : 2;
    if (bytes < 1)
        return `${bytes.toFixed(digits)} B`;
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return `${(bytes / k ** i).toFixed(digits)} ${sizes[i]}`;
}


/**
 * Format a millisecond duration into a human-readable string.
 * @param {number} ms — duration in milliseconds
 * @returns {string}
 */
export function formatDuration(ms) {
    if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    if (hours < 24) return `${hours}h ${remMinutes}m`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (days < 7) return `${days}d ${remHours}h`;
    const weeks = Math.floor(days / 7);
    const remDays = days % 7;
    if (weeks < 4) return `${weeks}w ${remDays}d`;
    const months = Math.floor(days / 30);
    const remDaysAfterMonths = days % 30;
    if (months < 12) return `${months}mo ${remDaysAfterMonths}d`;
    const years = Math.floor(days / 365);
    const remMonths = Math.floor((days % 365) / 30);
    return `${years}y ${remMonths}mo`;
}


/**
 * Format an ISO or timestamp into a locale date string.
 * @param {string|number|Date} date
 * @param {Object} [opts]
 * @param {boolean} [opts.time=false]
 * @returns {string}
 */
export function formatDate(date, opts = {}) {
    if (date == null || date === '') return '—';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '—';
    const safeOpts = (opts && typeof opts === 'object' && !Array.isArray(opts)) ? opts : {};
    const { time = false } = safeOpts;
    const dateStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    if (!time) return dateStr;
    const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} ${timeStr}`;
}

/**
 * Format a timestamp as a relative "time ago" string.
 * Alias for {@link relativeTime}.
 * @param {string|number|Date} date
 * @returns {string}
 */
export function timeAgo(date) {
    return relativeTime(date);
}


/**
 * Format a date as relative time (e.g., "2 hours ago").
 * @param {string|number|Date} date
 * @returns {string}
 */
export function relativeTime(date) {
    if (date == null || date === '') return '—';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '—';
    const diff = Date.now() - d.getTime();
    const isFuture = diff < 0;
    const absDiff = Math.abs(diff);
    const seconds = Math.floor(absDiff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / DAYS_PER_MONTH);
    const years = Math.floor(days / DAYS_PER_YEAR);
    const suffix = isFuture ? 'from now' : 'ago';
    if (years > 0) return `${years}y ${suffix}`;
    if (months > 0) return `${months}mo ${suffix}`;
    if (days > 0) return `${days}d ${suffix}`;
    if (hours > 0) return `${hours}h ${suffix}`;
    if (minutes > 0) return `${minutes}m ${suffix}`;
    if (seconds > 0) return isFuture ? `in ${seconds}s` : `${seconds}s ago`;
    return 'just now';
}


/**
 * Format an AI summary skip message with user-friendly text.
 * @param {string} errorMessage
 * @returns {string}
 */
export function formatAiSummarySkipMessage(errorMessage) {
    let msg;
    try {
        msg = String(errorMessage || '');
    } catch {
        msg = '';
    }
    for (const { test, msg: userMsg } of AI_SKIP_PATTERNS) {
        if (test.test(msg)) {
            return `${SKIP_PREFIX} — ${userMsg} ${FINDINGS_NOTE}.`;
        }
    }
    if (/Settings → AI providers/i.test(msg)) {
        return `${SKIP_PREFIX} — ${msg.replace(/^[^:]+:\s*/i, '')} ${FINDINGS_NOTE}.`;
    }
    return `${SKIP_PREFIX}: ${msg}`;
}

