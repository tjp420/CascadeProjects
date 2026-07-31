/**
 * Utility functions for export bundle generation.
 */

function safeStringify(obj, space = 2) {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    },
    space
  );
}

function tryStringify(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return safeStringify(obj, 2);
  }
}

function slugify(text) {
  return (
    String(text || 'scan')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'scan'
  );
}

function dateStamp(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function detectScanKind(payload) {
  if (!payload || typeof payload !== 'object') return 'unknown';
  if (payload.type === 'simplebeacon-complete-scan') return 'complete';
  if (payload.kind) return payload.kind;
  if (payload.type === 'simplebeacon-eu-ai-act-sprint') return 'eu-ai-act';
  if (payload.gate || payload.rawIssues) return 'simplebeacon-report';
  return 'unknown';
}

module.exports = {
  safeStringify,
  tryStringify,
  slugify,
  dateStamp,
  detectScanKind,
};
