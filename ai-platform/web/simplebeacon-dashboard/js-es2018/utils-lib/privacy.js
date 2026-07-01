/**
 * privacy utilities.
 */


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
    cleaned = cleaned.replace(/(^|[^\w.])((?:(?:25[0-5]|2[0-4][0-9]|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?\d\d?))(?![\w.])/g, '$1[REDACTED_IP]');
    // MAC addresses
    cleaned = cleaned.replace(/\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g, '[REDACTED_MAC]');
    // Phone numbers (tightened: require plausible length and structure)
    cleaned = cleaned.replace(/\b(?:\+\d{1,3}[-.\s])?\(?\d{2,4}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]');
    // Quoted credentials
    cleaned = cleaned.replace(/(([a-zA-Z0-9_-]*(?:secret|token|key|pwd|password|auth))(=|:)\s*['"][^'"]+['"])/gi, '$2$3"[REDACTED_CREDENTIAL]"');
    // Bearer tokens and Authorization headers
    cleaned = cleaned.replace(/\b(Bearer\s+)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED_TOKEN]');
    cleaned = cleaned.replace(/\b(Authorization[:\s]+).*?$/gmi, '$1[REDACTED_HEADER]');
    // Credit card numbers — grouped (13-24 digits with optional separators) or plain (13-19 digits)
    cleaned = cleaned.replace(/\b(?:\d{4}[-\s]?){3,5}\d{1,4}\b|\b\d{13,19}\b/g, '[REDACTED_CC]');
    return cleaned;
}

