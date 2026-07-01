const constants = require('../config/constants.cjs');

function formatReportTimestamp(iso) {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  }
  return date.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
}

function formatScanDuration(durationMs) {
  const elapsedMs = Number(durationMs);
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return '—';
  if (elapsedMs < 1000) return `${(elapsedMs / constants.MS_PER_SECOND).toFixed(2)} seconds`;
  return `${(elapsedMs / constants.MS_PER_SECOND).toFixed(1)} seconds`;
}

function truncateForDisplay(text, maxLen = 96) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '—';
  if (clean.length <= maxLen) return clean;
  const slice = clean.slice(0, maxLen);
  const wordBreak = slice.lastIndexOf(' ');
  const cut = wordBreak > Math.floor(maxLen * 0.55) ? slice.slice(0, wordBreak) : slice;
  return `${cut.trim()}…`;
}

function redactSnippet(text) {
  if (!text) return '—';
  const redacted = String(text)
    .replace(/(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{10,}/gi, 'sk_****REDACTED****')
    .replace(/AKIA[0-9A-Z]{16}/g, 'AKIA****REDACTED****')
    .replace(/(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{4,}['"]/gi, (match) => match.replace(/(['"])[^'"]+(['"])/, '$1****REDACTED****$2'))
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '****@****.***');
  return truncateForDisplay(redacted, 96);
}

function buildReportId(iso) {
  const d = iso ? new Date(iso) : new Date();
  const stamp = Number.isNaN(d.getTime()) ? '00000000' : d.toISOString().slice(0, 10).replace(/-/g, '');
  return `SB-AUD-${stamp}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

module.exports = {
  formatReportTimestamp,
  formatScanDuration,
  truncateForDisplay,
  redactSnippet,
  buildReportId
};
