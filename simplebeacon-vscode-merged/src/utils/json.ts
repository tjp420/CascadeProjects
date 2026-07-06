// simplebeacon-ignore memory-leak — JSON utility functions

/**
 * Safely parse JSON with an optional fallback value.
 * Swallows syntax errors and returns the fallback instead of throwing.
 * @param {string} text JSON string to parse.
 * @param {T} [fallback] Value returned when parsing fails.
 * @returns {T | undefined}
 */
export function parseJsonSafe<T>(text: string, fallback?: T): T | undefined {
  if (text == null) return fallback;
  try {
    return JSON.parse(String(text)) as T;
  } catch {
    return fallback;
  }
}

/**
 * Safely stringify a value, handling circular references.
 * @param {unknown} value
 * @param {number | string} [space]
 * @returns {string}
 */
export function stringifySafe(value: unknown, space?: number | string): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, val) => {
      if (val && typeof val === 'object') {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    }, space);
  } catch {
    return '';
  }
}

/**
 * Safely parse JSON from a fetch Response, returning a fallback on failure.
 * @param {Response} res
 * @param {any} [fallback]
 * @returns {Promise<any>}
 */
export async function parseResponseJson(res: Response, fallback?: any): Promise<any> {
  const contentType = String(res.headers?.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) return fallback ?? {};
  const text = await res.text();
  if (!text) return fallback ?? {};
  try {
    return JSON.parse(text);
  } catch {
    return fallback ?? {};
  }
}

/**
 * Check whether a string is valid JSON.
 * @param {string} text
 * @returns {boolean}
 */
export function isJson(text: string): boolean {
  if (typeof text !== 'string') return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}
