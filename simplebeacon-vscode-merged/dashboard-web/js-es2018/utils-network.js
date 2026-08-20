/**
 * Fetch with timeout and optional retry.
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {number} [ms=10000]
 * @param {{count?:number,delay?:number,maxDelay?:number}} [retry]
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(
  url,
  options = {},
  ms = 10000,
  retry = { count: 0, delay: 1000, maxDelay: 30000 }
) {
  const target = String(url || '');
  let opts = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
  const timeoutMs = Number.isFinite(ms) && ms > 0 ? ms : 10000;
  const retryCfg = {
    count: 0,
    delay: 1000,
    maxDelay: 30000,
    ...(retry && typeof retry === 'object' && !Array.isArray(retry) ? retry : {}),
  };
  const attempt = async (attemptNum) => {
    const controller = new AbortController();
    let cleanup = null;
    if (opts.signal && typeof opts.signal.addEventListener === 'function') {
      if (opts.signal.aborted) {
        throw new Error('Request aborted by caller');
      }
      const onAbort = () => controller.abort();
      opts.signal.addEventListener('abort', onAbort, { once: true });
      cleanup = () => opts.signal.removeEventListener('abort', onAbort);
    }
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(target, { ...opts, signal: controller.signal });
      if (!res.ok) {
        const shouldRetry = retryCfg.count > 0 && attemptNum < retryCfg.count && res.status >= 500;
        if (shouldRetry) {
          const backoff = Math.min(retryCfg.delay * Math.pow(2, attemptNum), retryCfg.maxDelay);
          await new Promise((r) => setTimeout(r, backoff));
          return attempt(attemptNum + 1);
        }
      }
      return res;
    } catch (err) {
      if (err.name === 'AbortError') {
        if (opts.signal?.aborted) {
          throw new Error('Request aborted by caller');
        }
        throw new Error(`Request timed out — is the server running? (${target})`);
      }
      if (retryCfg.count > 0 && attemptNum < retryCfg.count) {
        const backoff = Math.min(retryCfg.delay * Math.pow(2, attemptNum), retryCfg.maxDelay);
        await new Promise((r) => setTimeout(r, backoff));
        return attempt(attemptNum + 1);
      }
      throw err;
    } finally {
      clearTimeout(timer);
      if (cleanup) cleanup();
    }
  };
  return attempt(0);
}

/**
 * Sanitize sensitive data in text.
 * @param {string} text
 * @returns {string}
 */
// simplebeacon-ignore hardcoded-api-key — patterns below are detection regexes for redaction, not actual secrets
export function sanitizePrivacyData(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text;
  // Emails — require word boundaries to avoid matching version strings like v1.2.3@scope
  cleaned = cleaned.replace(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, '[REDACTED_EMAIL]');
  // IPv4 addresses — capture the prefix character so we can preserve it
  cleaned = cleaned.replace(
    /(^|[^\w.])((?:(?:25[0-5]|2[0-4][0-9]|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?\d\d?))(?![\w.])/g,
    '$1[REDACTED_IP]'
  );
  // MAC addresses
  cleaned = cleaned.replace(/\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g, '[REDACTED_MAC]');
  // Phone numbers (tightened: require plausible length and structure)
  cleaned = cleaned.replace(/\b(?:\+\d{1,3}[-.\s])?\(?\d{2,4}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]');
  // Quoted credentials
  cleaned = cleaned.replace(
    /(([a-zA-Z0-9_-]*(?:secret|token|key|pwd|password|auth))(=|:)\s*['"][^'"]+['"])/gi,
    '$2$3"[REDACTED_CREDENTIAL]"'
  );
  // Bearer tokens and Authorization headers
  cleaned = cleaned.replace(/\b(Bearer\s+)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED_TOKEN]');
  cleaned = cleaned.replace(/\b(Authorization[:\s]+).*?$/gim, '$1[REDACTED_HEADER]');
  // Credit card numbers — grouped (13-24 digits with optional separators) or plain (13-19 digits)
  cleaned = cleaned.replace(/\b(?:\d{4}[-\s]?){3,5}\d{1,4}\b|\b\d{13,19}\b/g, '[REDACTED_CC]');
  return cleaned;
}

/**
 * Wrap a Promise with a timeout. Rejects if the promise doesn't settle in time.
 * @template T
 * @param {Promise<T>} promise Promise to race.
 * @param {number} ms Timeout in milliseconds.
 * @param {string} [message='Operation timed out'] Error message on timeout.
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, message = 'Operation timed out') {
  if (!promise || typeof promise.then !== 'function') {
    return Promise.reject(new TypeError('withTimeout requires a valid Promise'));
  }
  const timeoutMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) reject(new Error(message));
    }, timeoutMs);
    promise.then(
      (value) => {
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Parse a query string into a plain object.
 * @param {string} queryString Query string (with or without leading `?`).
 * @returns {Record<string, string>} Parsed key-value pairs.
 */
export function parseQueryString(queryString) {
  if (typeof queryString !== 'string') return {};
  const qs = queryString.startsWith('?') ? queryString.slice(1) : queryString;
  const result = {};
  if (!qs) return result;
  for (const pair of qs.split('&')) {
    const [rawKey, rawValue] = pair.split('=');
    if (!rawKey) continue;
    const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    const value = rawValue !== undefined ? decodeURIComponent(rawValue.replace(/\+/g, ' ')) : '';
    result[key] = value;
  }
  return result;
}

/**
 * Build a query string from a plain object.
 * @param {Record<string, string|number|boolean|null|undefined>} params
 * @returns {string} Query string without leading `?`.
 */
export function stringifyQueryString(params) {
  if (!params || typeof params !== 'object') return '';
  const pairs = [];
  for (const [key, value] of Object.entries(params)) {
    // simplebeacon-ignore memory-leak
    if (value == null || value === '') continue;
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return pairs.join('&');
}
