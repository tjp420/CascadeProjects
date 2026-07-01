/**
 * privacy utilities.
 */


/**
 * Sanitize input strings by replacing sensitive patterns with generic placeholders.
 * Covers: emails, IPv4, MAC addresses, phone numbers, quoted credentials,
 * Bearer tokens, Authorization headers, and credit card numbers.
 * @param {string} text Raw log or user input string.
 * @returns {string} Anonymized text.
 */
export function sanitizePrivacyData(text) {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;

  // 1. Emails — require a word boundary before the local part to avoid matching version strings like v1.2.3@scope
  cleaned = cleaned.replace(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, '[REDACTED_EMAIL]');

  // 2. IPv4 addresses (avoid matching version numbers by requiring start-of-string or non-word/dot prefix)
  cleaned = cleaned.replace(/(^|[^\w.])(?:(?:25[0-5]|2[0-4][0-9]|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?\d\d?)(?![\w.])/g, '$1[REDACTED_IP]');

  // 3. MAC addresses
  cleaned = cleaned.replace(/\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g, '[REDACTED_MAC]');

  // 4. Phone numbers (tightened: require plausible length and structure)
  cleaned = cleaned.replace(/\b(?:\+\d{1,3}[-.\s])?\(?\d{2,4}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]');

  // 5. Quoted credentials: api_key="secret"
  // simplebeacon-ignore hardcoded-api-key — patterns below are detection regexes for redaction, not actual secrets
  cleaned = cleaned.replace(/(([a-zA-Z0-9_-]*(?:secret|token|key|pwd|password|auth))(=|:)\s*['"][^'"]+['"])/gi, '$2$3"[REDACTED_CREDENTIAL]"');

  // 6. Bearer tokens and Authorization headers
  cleaned = cleaned.replace(/\b(Bearer\s+)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED_TOKEN]');
  cleaned = cleaned.replace(/\b(Authorization[:\s]+).*?$/gmi, '$1[REDACTED_HEADER]');

  // 6a. GitHub tokens (ghp_, gho_, github_pat_)
  cleaned = cleaned.replace(/\b(gh[pousr]_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{22,})/gi, '[REDACTED_GITHUB_TOKEN]');

  // 6b. OpenAI keys (sk-, sk-proj-)
  cleaned = cleaned.replace(/\b(sk-[a-zA-Z0-9]{20,}|sk-proj-[a-zA-Z0-9_\-]{20,})/gi, '[REDACTED_OPENAI_KEY]');

  // 6c. AWS access keys (AKIA...)
  cleaned = cleaned.replace(/\b(AKIA[A-Z0-9]{16})\b/g, '[REDACTED_AWS_KEY]');

  // 6d. SendGrid API keys (SG.)
  cleaned = cleaned.replace(/\bSG\.[a-zA-Z0-9_\-]{22,}/g, '[REDACTED_SENDGRID_KEY]');

  // 7. Credit card numbers — require at least 13 digits with valid grouping
  // simplebeacon-ignore hardcoded-api-key — detection regex for redaction, not an actual secret
  cleaned = cleaned.replace(/\b(?:\d{4}[-\s]){2,4}\d{4}\b|\b\d{13,19}\b/g, '[REDACTED_CC]');

  return cleaned;
}

