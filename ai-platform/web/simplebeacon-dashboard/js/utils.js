export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

export function formatNumber(n) {
  if (n == null) return '—';
  const numericCount = Number(n);
  if (!Number.isFinite(numericCount)) return '—';
  return numericCount.toLocaleString();
}

/** Parse ISO/RFC timestamps to epoch ms; returns null when input is missing or invalid. */
export function parseIsoTimestampMs(isoTimestamp) {
  if (isoTimestamp == null || isoTimestamp === '') return null;
  const epochMs = Date.parse(String(isoTimestamp));
  return Number.isFinite(epochMs) ? epochMs : null;
}

export function formatPercent(value) {
  if (value == null || value === '') return '—';
  const str = String(value).trim();
  if (str.endsWith('%')) return str;
  const num = Number(str);
  if (Number.isFinite(num)) return `${num}%`;
  return str;
}

/** Display-only — hide C:\\Users\\… and /home/… prefixes in the UI. */
export function redactPathForDisplay(projectPath) {
  if (!projectPath) return '';
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
export function isRedactedPathDisplay(value) {
  if (value == null || value === '') return false;
  const normalized = String(value).replace(/\\/g, '/').trim();
  if (/^(?:…|\.{3})(?:\/|$)/.test(normalized)) return true;
  if (/(?:^|\/)(?:…|\.{3})\//.test(normalized)) return true;
  return false;
}

/** Path string for text inputs — redacts home prefixes and normalizes slashes. */
export function formatPathInputValue(projectPath) {
  if (!projectPath) return '';
  const redacted = redactPathForDisplay(projectPath);
  return String(redacted).replace(/\\/g, '/');
}

export function formatScanPathForDisplay(scanPath, projectRoot) {
  if (!scanPath) return '';
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

export function formatPathLabel(projectPath) {
  const redacted = redactPathForDisplay(projectPath);
  if (redacted && redacted !== projectPath) return redacted;
  const parts = String(projectPath || '').replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] || projectPath || '';
}

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

export async function fetchWithTimeout(url, options = {}, ms = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out — is the server running? (${url})`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

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
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadText(content, filename, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  downloadBlob(blob, filename);
}
