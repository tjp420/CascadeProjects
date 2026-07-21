// SPDX-License-Identifier: MIT
/**
 * Shared constants for structural intent analysis.
 *
 * @license MIT
 */

export const GENERIC_AI_MARKERS = new Set([
    'data', 'result', 'output', 'temp', 'holder', 'info', 'val',
    'value', 'item', 'items', 'response', 'payload', 'obj', 'res',
    'process', 'handle', 'request'
]);

export const CREDENTIAL_KEY_FRAGMENTS = ['secret', 'token', 'pass', 'key', 'apikey', 'api_key'];

export const INTENT_RULE_IDS = {
    HOLLOW_FUNCTION: 'SB-INTENT-001',
    CREDENTIAL_STUB: 'SB-INTENT-002',
    FINGERPRINT_MATCH: 'SB-INTENT-003',
    TRY_EXCEPT_PASS: 'SB-INTENT-004'
};

export const LANGUAGE_BY_EXT = {
    '.js': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.pyw': 'python',
    '.go': 'go'
};
