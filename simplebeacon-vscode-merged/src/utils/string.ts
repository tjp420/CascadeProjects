// simplebeacon-ignore memory-leak — pure string utility functions

/**
 * Escape a string for safe HTML attribute or text injection.
 * Handles `null`/`undefined` by returning an empty string.
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function escapeHtml(str: string | null | undefined): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escape special regex characters in a string so it can be used literally in a RegExp.
 * @param {string} str Input string.
 * @returns {string} Escaped string.
 */
export function escapeRegExp(str: string): string {
  return String(str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Truncate a string to a maximum length, adding an ellipsis if trimmed.
 * @param {string} str Input string.
 * @param {number} [maxLen=80] Maximum length before truncation.
 * @param {string} [suffix='…'] Suffix appended when truncated.
 * @returns {string}
 */
export function truncate(str: string, maxLen = 80, suffix = '…'): string {
  const s = String(str ?? '');
  const limit = Number.isFinite(maxLen) && maxLen > 0 ? Math.floor(maxLen) : 80;
  if (s.length <= limit) return s;
  const endLen = Math.max(0, limit - String(suffix ?? '…').length);
  return s.slice(0, endLen) + String(suffix ?? '…');
}

/**
 * Capitalize the first letter of a string.
 * @param {string} str Input string.
 * @returns {string}
 */
export function capitalize(str: string | null | undefined): string {
  const s = String(str ?? '');
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Remove HTML tags from a string, returning plain text.
 * @param {string} str
 * @returns {string}
 */
export function stripHtml(str: string | null | undefined): string {
  if (str == null || typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Convert a string to kebab-case.
 * @param {string} str
 * @returns {string}
 */
export function kebabCase(str: string | null | undefined): string {
  return String(str ?? '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert a string to camelCase.
 * @param {string} str
 * @returns {string}
 */
export function camelCase(str: string | null | undefined): string {
  return String(str ?? '')
    .replace(/[-_\s]+(.)?/g, (_, ch) => (ch ? ch.toUpperCase() : ''))
    .replace(/^[A-Z]/, (ch) => ch.toLowerCase());
}

/**
 * Convert a string to snake_case.
 * @param {string} str
 * @returns {string}
 */
export function snakeCase(str: string | null | undefined): string {
  return String(str ?? '')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

/**
 * Pad the start of a string to a given length.
 * @param {string | number} str
 * @param {number} len
 * @param {string} [char=' ']
 * @returns {string}
 */
export function padStart(str: string | number, len: number, char = ' '): string {
  const s = String(str);
  const targetLen = Math.max(0, Math.floor(Number(len) || 0));
  const padChar = String(char || ' ').slice(0, 1);
  if (s.length >= targetLen) return s;
  const pad = padChar.repeat(targetLen - s.length);
  return pad + s;
}

/**
 * Pad the end of a string to a given length.
 * @param {string | number} str
 * @param {number} len
 * @param {string} [char=' ']
 * @returns {string}
 */
export function padEnd(str: string | number, len: number, char = ' '): string {
  const s = String(str);
  const targetLen = Math.max(0, Math.floor(Number(len) || 0));
  const padChar = String(char || ' ').slice(0, 1);
  if (s.length >= targetLen) return s;
  const pad = padChar.repeat(targetLen - s.length);
  return s + pad;
}

/**
 * Return the singular or plural form of a word based on count.
 * @param {number} count
 * @param {string} singular Form used when count === 1.
 * @param {string} [plural=singular + 's'] Form used otherwise.
 * @returns {string}
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const n = Number(count);
  if (!Number.isFinite(n)) return `${count} ${singular}`;
  const word = n === 1 ? singular : (plural ?? `${singular}s`);
  return `${n} ${word}`;
}

/**
 * Format a percentage value with configurable decimal places.
 * @param {number | string | null | undefined} value
 * @param {number} [fractionDigits=1]
 * @returns {string}
 */
export function formatPercent(value: number | string | null | undefined, fractionDigits = 1): string {
  if (value == null || value === '') return '—';
  const str = String(value).trim();
  if (str.endsWith('%')) return str;
  const num = Number(str);
  if (!Number.isFinite(num)) return '—';
  const digits = Number.isFinite(fractionDigits) ? Math.max(0, Math.min(20, Math.floor(Number(fractionDigits) || 0))) : 1;
  return `${num.toFixed(digits)}%`;
}

/**
 * Format an ISO timestamp or Date into a locale date string.
 * @param {string | number | Date | null | undefined} date
 * @param {{time?: boolean}} [opts]
 * @returns {string}
 */
export function formatDate(date: string | number | Date | null | undefined, opts: { time?: boolean } = {}): string {
  if (date == null || date === '' || typeof date === 'symbol') return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const { time = false } = (opts && typeof opts === 'object' && !Array.isArray(opts)) ? opts : {};
  const dateStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  if (!time) return dateStr;
  const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} ${timeStr}`;
}

/**
 * Format a date as relative time (e.g., "2 hours ago").
 * @param {string | number | Date | null | undefined} date
 * @returns {string}
 */
export function relativeTime(date: string | number | Date | null | undefined): string {
  if (date == null || date === '' || typeof date === 'symbol') return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const isFuture = diff < 0;
  const abs = Math.abs(diff);
  const seconds = Math.floor(abs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30.44);
  const years = Math.floor(days / 365.25);
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
 * Format a millisecond duration into a human-readable string.
 * @param {number | null | undefined} ms Duration in milliseconds.
 * @returns {string} Formatted duration string.
 */
export function formatDuration(ms: number | null | undefined): string {
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
  const months = Math.floor(days / 30.44);
  const remWeeks = Math.floor((days % 30.44) / 7);
  if (months < 12) return `${months}mo ${remWeeks}w`;
  const years = Math.floor(days / 365.25);
  const remMonths = Math.floor((days % 365.25) / 30.44);
  return `${years}y ${remMonths}mo`;
}

/**
 * Convert a string to Title Case (capitalize first letter of each word).
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function titleCase(str: string | null | undefined): string {
  const s = String(str ?? '');
  return s.toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/**
 * Reverse a string.
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function reverse(str: string | null | undefined): string {
  return String(str ?? '').split('').reverse().join('');
}

/**
 * Convert a string to a URL-safe slug.
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function slugify(str: string | null | undefined): string {
  return String(str ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Repeat a string N times.
 * @param {string | null | undefined} str
 * @param {number} count
 * @returns {string}
 */
export function repeat(str: string | null | undefined, count: number): string {
  const s = String(str ?? '');
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return s.repeat(n);
}

/**
 * Check if a string starts with a given substring.
 * @param {string | null | undefined} str
 * @param {string} search
 * @returns {boolean}
 */
export function startsWith(str: string | null | undefined, search: string): boolean {
  return String(str ?? '').startsWith(search);
}

/**
 * Check if a string ends with a given substring.
 * @param {string | null | undefined} str
 * @param {string} search
 * @returns {boolean}
 */
export function endsWith(str: string | null | undefined, search: string): boolean {
  return String(str ?? '').endsWith(search);
}

/**
 * Trim whitespace from both ends of a string.
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function trim(str: string | null | undefined): string {
  return String(str ?? '').trim();
}

/**
 * Split a string into lines (handles \n, \r\n, and \r).
 * @param {string | null | undefined} str
 * @returns {string[]}
 */
export function splitLines(str: string | null | undefined): string[] {
  const s = String(str ?? '');
  if (!s) return [];
  return s.split(/\r?\n|\r/);
}

/**
 * Strip ANSI escape codes from a string.
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function stripAnsi(str: string | null | undefined): string {
  return String(str ?? '').replace(/\u001B\[[0-9;]*m/g, '');
}

/**
 * Count words in a string (sequences of alphanumeric characters).
 * @param {string | null | undefined} str
 * @returns {number}
 */
export function wordCount(str: string | null | undefined): number {
  const matches = String(str ?? '').match(/\w+/g);
  return matches ? matches.length : 0;
}
