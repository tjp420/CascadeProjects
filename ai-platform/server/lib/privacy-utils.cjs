/**
 * Privacy Utilities - Shared PII sanitization functions
 * 
 * This module provides centralized PII (Personally Identifiable Information) sanitization
 * to ensure consistent data protection across the entire SimpleBeacon platform.
 * 
 * Usage:
 * - Server-side: const { sanitizePrivacyData } = require('./lib/privacy-utils.cjs');
 * - ES modules: import { sanitizePrivacyData } from './server/lib/privacy-utils.cjs';
 */

/**
 * Sanitizes input strings by replacing sensitive patterns with generic placeholders.
 * This function redacts emails, IP addresses, and credentials to protect user privacy.
 * 
 * @param {string} text - The raw log or user input string.
 * @returns {string} The anonymized text with PII redacted.
 */
function sanitizePrivacyData(text) {
  if (!text || typeof text !== 'string') return text;

  let cleaned = text;

  // Redact Email Addresses
  // Pattern: standard email format (local@domain.tld)
  cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');

  // Redact IPv4 Addresses
  // Pattern: 0-255.0-255.0-255.0-255
  cleaned = cleaned.replace(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?\d\d?)\b/g, '[REDACTED_IP]');

  // Redact Bearer Tokens / API Keys / Password assignments
  // Pattern: matches secret|token|key|pwd|password|auth followed by = or : and a quoted value
  cleaned = cleaned.replace(/(([a-zA-Z0-9_-]*(?:secret|token|key|pwd|password|auth))(=|:)\s*['"][^'"]+['"])/gi, '$2$3"[REDACTED_CREDENTIAL]"');

  return cleaned;
}

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * This is a native implementation that doesn't require external dependencies.
 * 
 * @param {string} str - The raw string to escape.
 * @returns {string} The HTML-escaped string.
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = {
  sanitizePrivacyData,
  escapeHtml
};
