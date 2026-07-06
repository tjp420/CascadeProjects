/**
 * @module format
 */

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
  const rawRoot = normalizeSlashes(projectRoot);
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
 * Return a short display label for a path (basename, or redacted form).
 * @param {string} projectPath
 * @returns {string}
 */
export function formatPathLabel(projectPath) {
  if (typeof projectPath !== 'string') {
    try { return String(projectPath ?? ''); } catch { return ''; }
  }
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

/**
 * Sanitizes input strings by replacing sensitive patterns with generic placeholders.
 * @param {string} text - The raw log or user input string.
 * @returns {string} The anonymized text.
 */
export function isRedactedPathDisplay(displayPath) {
  if (displayPath == null || displayPath === '') return false;
  const normalized = normalizeSlashes(displayPath).trim();
  if (/^(?:…|\.{3})(?:\/|$)/.test(normalized)) return true;
  if (/^(?:[a-zA-Z]:)?\/Users\/[^/]+/.test(normalized)) return false;
  if (/^\/home\/[^/]+/.test(normalized)) return false;
  return normalized.includes('…') || normalized.includes('...');
}

export function formatDate(date, opts = {}) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const { format = 'short' } = opts;
  if (format === 'iso') return d.toISOString();
  if (format === 'time') return d.toLocaleTimeString();
  return d.toLocaleDateString();
}

export function relativeTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  const diff = Date.now() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function timeAgo(date) { return relativeTime(date); }

export function sanitizePrivacyData(text) {
  // simplebeacon-ignore hardcoded-api-key — patterns below are detection regexes for redaction, not actual secrets
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;

  // Emails — require a word boundary before the local part to avoid matching version strings like v1.2.3@scope
  cleaned = cleaned.replace(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, '[REDACTED_EMAIL]');

  // IPv4 addresses — capture the prefix character so we can preserve it
  cleaned = cleaned.replace(/(^|[^\w.])((?:(?:25[0-5]|2[0-4][0-9]|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?\d\d?))(?![\w.])/g, '$1[REDACTED_IP]');

  // MAC addresses
  cleaned = cleaned.replace(/\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g, '[REDACTED_MAC]');

  // Phone numbers (tightened: require plausible length and structure)
  cleaned = cleaned.replace(/\b(?:\+\d{1,3}[-.\s])?\(?\d{2,4}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]');

  // simplebeacon-ignore hardcoded-api-key — detection regex for redaction, not an actual secret
  // Quoted credential pattern: key_name="secret_value"
  cleaned = cleaned.replace(/(([a-zA-Z0-9_-]*(?:secret|token|key|pwd|password|auth))(=|:)\s*['"][^'"]+['"])/gi, '$2$3"[REDACTED_CREDENTIAL]"');

  // Bearer tokens and Authorization headers
  cleaned = cleaned.replace(/\b(Bearer\s+)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED_TOKEN]');
  cleaned = cleaned.replace(/\b(Authorization[:\s]+).*?$/gmi, '$1[REDACTED_HEADER]');

  // GitHub tokens (ghp_, gho_, github_pat_)
  cleaned = cleaned.replace(/\b(gh[pousr]_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{22,})/gi, '[REDACTED_GITHUB_TOKEN]');

  // OpenAI keys (sk-, sk-proj-)
  cleaned = cleaned.replace(/\b(sk-[a-zA-Z0-9]{20,}|sk-proj-[a-zA-Z0-9_\-]{20,})/gi, '[REDACTED_OPENAI_KEY]');

  // AWS access keys (AKIA...)
  cleaned = cleaned.replace(/\b(AKIA[A-Z0-9]{16})\b/g, '[REDACTED_AWS_KEY]');

  // SendGrid API keys (SG.)
  cleaned = cleaned.replace(/\bSG\.[a-zA-Z0-9_\-]{22,}/g, '[REDACTED_SENDGRID_KEY]');

  // Credit card numbers — grouped (13-24 digits with optional separators) or plain (13-19 digits)
  cleaned = cleaned.replace(/\b(?:\d{4}[-\s]?){3,5}\d{1,4}\b|\b\d{13,19}\b/g, '[REDACTED_CC]');

  return cleaned;
}
