import { normalizeSlashes } from './string.js';

/**
 * Format an ISO or timestamp into a locale date string.
 * @param {string|number|Date} date
 * @param {{time?:boolean}} [opts]
 * @returns {string}
 */
export function formatDate(date, opts = {}) {
  if (date == null || date === '' || typeof date === 'symbol') return '—';
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
 * Format an AI summary skip message with user-friendly text.
 * @param {string} errorMessage
 * @returns {string}
 */
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

/**
 * Sanitizes input strings by replacing sensitive patterns with generic placeholders.
 * @param {string} text - The raw log or user input string.
 * @returns {string} The anonymized text.
 */
// simplebeacon-ignore hardcoded-api-key — patterns below are detection regexes for redaction, not actual secrets
export function sanitizePrivacyData(text) {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;

  // 1. Emails — require a word boundary before the local part to avoid matching version strings like v1.2.3@scope
  cleaned = cleaned.replace(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, '[REDACTED_EMAIL]');

  // 2. IPv4 addresses (avoid matching version numbers)
  cleaned = cleaned.replace(/(^|[^\w.])(?:(?:25[0-5]|2[0-4][0-9]|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?\d\d?)(?![\w.])/g, '$1[REDACTED_IP]');

  // 3. Quoted credentials: api_key="secret"
  // simplebeacon-ignore hardcoded-api-key — detection regex for redaction, not an actual secret
  cleaned = cleaned.replace(/(([a-zA-Z0-9_-]*(?:secret|token|key|pwd|password|auth))(=|:)\s*['"][^'"]+['"])/gi, '$2$3"[REDACTED_CREDENTIAL]"');

  // 4. Bearer tokens and Authorization headers
  cleaned = cleaned.replace(/\b(Bearer\s+)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED_TOKEN]');
  cleaned = cleaned.replace(/\b(Authorization[:\s]+).*?$/gmi, '$1[REDACTED_HEADER]');

  // 4a. GitHub tokens (ghp_, gho_, github_pat_)
  cleaned = cleaned.replace(/\b(gh[pousr]_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{22,})/gi, '[REDACTED_GITHUB_TOKEN]');

  // 4b. OpenAI keys (sk-, sk-proj-)
  cleaned = cleaned.replace(/\b(sk-[a-zA-Z0-9]{20,}|sk-proj-[a-zA-Z0-9_\-]{20,})/gi, '[REDACTED_OPENAI_KEY]');

  // 4c. AWS access keys (AKIA...)
  cleaned = cleaned.replace(/\b(AKIA[A-Z0-9]{16})\b/g, '[REDACTED_AWS_KEY]');

  // 4d. SendGrid API keys (SG.)
  cleaned = cleaned.replace(/\bSG\.[a-zA-Z0-9_\-]{22,}/g, '[REDACTED_SENDGRID_KEY]');

  // 5. MAC addresses (hex pairs separated by : or -)
  cleaned = cleaned.replace(/\b(?:[0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}\b/g, '[REDACTED_MAC]');

  // 6. Phone numbers (US-style with optional separators)
  cleaned = cleaned.replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]');

  // 7. Credit card numbers — grouped (13-24 digits with optional separators) or plain (13-19 digits)
  cleaned = cleaned.replace(/\b(?:\d{4}[-\s]?){3,5}\d{1,4}\b|\b\d{13,19}\b/g, '[REDACTED_CC]');

  return cleaned;
}

/** Pre-compiled redaction patterns for privacy-safe path display. */
const REDACTION_PATTERNS = [
  { regex: /^(?:…|\.{3})\/[^/]+(\/.+)?$/, replace: (m, rest) => rest ? `…${rest}` : '…' },
  { regex: /^[a-zA-Z]:\/Users\/[^/]+(\/.+)?$/i, replace: (m, rest) => rest ? `…${rest}` : '…' },
  { regex: /^\/Users\/[^/]+(\/.+)?$/, replace: (m, rest) => rest ? `…${rest}` : '…' },
  { regex: /^\/home\/[^/]+(\/.+)?$/, replace: (m, rest) => rest ? `…${rest}` : '…' },
  // User-home style absolute path: hide the first segment (but not system dirs)
  { regex: /^\/(?!usr\/|var\/|etc\/|opt\/|bin\/|sbin\/|tmp\/|dev\/|mnt\/|proc\/|sys\/|run\/)([^/]+)(\/.+)$/i, replace: (m, _, rest) => `…${rest}` },
];

/**
 * Display-only — hide C:\Users\… and /home/… prefixes in the UI.
 * @param {string} projectPath
 * @returns {string}
 */
export function redactPathForDisplay(projectPath) {
  if (typeof projectPath !== 'string' || !projectPath) return '';
  const normalized = normalizeSlashes(projectPath);

  for (const { regex, replace } of REDACTION_PATTERNS) {
    const m = normalized.match(regex);
    if (m) return replace(...m);
  }

  if (/(?:^|\/)(?:…|\.{3})\/[^/]+\//.test(normalized)) {
    return normalized.replace(/((?:^|\/)(?:…|\.{3}))\/[^/]+(\/)/, '$1$2');
  }
  return projectPath;
}

/**
 * True when the string is a privacy-redacted path (…/folder) rather than a full absolute path.
 * @param {string} displayPath
 * @returns {boolean}
 */
export function isRedactedPathDisplay(displayPath) {
  if (displayPath == null || displayPath === '') return false;
  const normalized = normalizeSlashes(displayPath).trim();
  if (/^(?:…|\.{3})(?:\/|$)/.test(normalized)) return true;
  if (/(?:^|\/)(?:…|\.{3})\//.test(normalized)) return true;
  return false;
}

/**
 * Editable path inputs — keep the full absolute path; normalize slashes only.
 * @param {string} projectPath
 * @returns {string}
 */
export function formatPathInputValue(projectPath) {
  if (typeof projectPath !== 'string' || !projectPath) return '';
  return normalizeSlashes(projectPath);
}

/**
 * Format scan path for display.
 * @param {string} scanPath
 * @param {string} [projectRoot]
 * @returns {string}
 */
export function formatScanPathForDisplay(scanPath, projectRoot) {
  if (typeof scanPath !== 'string' || !scanPath) return '';
  const normalized = normalizeSlashes(scanPath);
  const rawRoot = typeof projectRoot === 'string' ? normalizeSlashes(projectRoot) : '';
  const root = rawRoot === '/' ? rawRoot : rawRoot.replace(/\/$/, '');
  if (root && normalized.toLowerCase().startsWith(`${root.toLowerCase()}/`)) {
    return normalized.slice(root.length + 1);
  }
  if (root === '/' && normalized.startsWith('/')) {
    return normalized.slice(1);
  }
  if (!/^[a-zA-Z]:\//.test(normalized) && !normalized.startsWith('/')) {
    return normalized;
  }
  return redactPathForDisplay(scanPath);
}

/**
 * Format path label.
 * @param {string} projectPath
 * @returns {string}
 */
export function formatPathLabel(projectPath) {
  if (typeof projectPath !== 'string') return String(projectPath ?? '');
  const redacted = redactPathForDisplay(projectPath);
  if (redacted && redacted !== projectPath) return redacted;
  const normalized = normalizeSlashes(projectPath);
  const parts = normalized.split('/').filter(Boolean);
  // Preserve drive letter for Windows paths that are just a drive + one folder
  // (e.g. I:/AGI Chatbot should stay readable, not collapse to AGI Chatbot)
  if (parts.length <= 2 && /^[a-zA-Z]:$/.test(parts[0])) {
    return normalized;
  }
  return parts[parts.length - 1] || projectPath || '';
}
