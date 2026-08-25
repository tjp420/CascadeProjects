/**
 * @module privacy
 */

/**
 * Sanitize sensitive data in text.
 * @param {string} text
 * @returns {string}
 */
export function sanitizePrivacyData(text) {
  if (!text || typeof text !== "string") return "";
  let cleaned = text;
  // Emails
  cleaned = cleaned.replace(
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
    "[REDACTED_EMAIL]",
  );
  // IPv4 addresses
  cleaned = cleaned.replace(
    /(^|[^\w.])((?:(?:25[0-5]|2[0-4][0-9]|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?\d\d?))(?![\w.])/g,
    "$1[REDACTED_IP]",
  );
  // MAC addresses
  cleaned = cleaned.replace(
    /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g,
    "[REDACTED_MAC]",
  );
  // Phone numbers
  cleaned = cleaned.replace(
    /\b(?:\+\d{1,3}[-.\s])?\(?\d{2,4}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    "[REDACTED_PHONE]",
  );
  // Quoted credentials
  cleaned = cleaned.replace(
    /(([a-zA-Z0-9_-]*(?:secret|token|key|pwd|password|auth))(=|:)\s*['"][^'"]+['"])/gi,
    '$2$3"[REDACTED_CREDENTIAL]"',
  );
  // Bearer tokens and Authorization headers
  cleaned = cleaned.replace(
    /\b(Bearer\s+)[a-zA-Z0-9_\-\.]+/gi,
    "$1[REDACTED_TOKEN]",
  );
  cleaned = cleaned.replace(
    /\b(Authorization[:\s]+).*?$/gim,
    "$1[REDACTED_HEADER]",
  );
  // Credit card numbers
  cleaned = cleaned.replace(
    /\b(?:\d{4}[-\s]?){3,5}\d{1,4}\b|\b\d{13,19}\b/g,
    "[REDACTED_CC]",
  );
  return cleaned;
}
