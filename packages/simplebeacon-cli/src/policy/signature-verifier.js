const crypto = require('crypto');

const BASE64_SIGNATURE_REGEX = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Deep-sort object keys for deterministic canonicalization.
 * @param {any} value
 * @returns {any}
 */
function sortKeysObject(value) {
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(sortKeysObject);
    }
    const out = {};
    for (const key of Object.keys(value).sort()) {
        out[key] = sortKeysObject(value[key]);
    }
    return out;
}

/**
 * Canonicalize policy JSON payload by removing integrity_signatures and sorting keys.
 * @param {string} rawJson
 * @returns {string}
 */
function canonicalizePolicy(rawJson) {
    const obj = JSON.parse(rawJson);
    if (obj && typeof obj === 'object' && obj.integrity_signatures) {
        delete obj.integrity_signatures;
    }
    return JSON.stringify(sortKeysObject(obj));
}

class TrustStore {
    /**
     * @param {Record<string, string>} initialKeys
     */
    constructor(initialKeys) {
        this.pinnedKeys = new Map();
        const source = initialKeys && typeof initialKeys === 'object' ? initialKeys : {};
        for (const [fingerprint, pemKey] of Object.entries(source)) {
            this.pinnedKeys.set(String(fingerprint).trim().toLowerCase(), String(pemKey));
        }
    }

    /**
     * @param {string} fingerprint
     * @returns {string|null}
     */
    getPublicKey(fingerprint) {
        const key = String(fingerprint || '').trim().toLowerCase();
        return this.pinnedKeys.get(key) || null;
    }
}

/**
 * Verify policy signature using trust store-pinned key material.
 * Exit codes follow CLI-safe conventions (not HTTP status codes).
 * @param {string} rawJson
 * @param {TrustStore} trustStore
 * @returns {{isValid:boolean,fingerprint:string,auditMessage:string,exitCode:number}}
 */
function verifyPolicySignature(rawJson, trustStore) {
    let parsedJson;
    try {
        parsedJson = JSON.parse(rawJson);
    } catch (err) {
        return {
            isValid: false,
            fingerprint: 'UNKNOWN',
            auditMessage: `[AUDIT FAILURE] Malformed configuration input file: ${err.message}`,
            exitCode: 78
        };
    }

    const signatureBlock = parsedJson && parsedJson.integrity_signatures ? parsedJson.integrity_signatures : null;
    if (!signatureBlock || !signatureBlock.signature) {
        return {
            isValid: false,
            fingerprint: 'UNKNOWN',
            auditMessage: "[AUDIT FAILURE] Policy rejects processing: Missing required 'integrity_signatures' manifest element.",
            exitCode: 78
        };
    }

    const signature = String(signatureBlock.signature || '').trim();
    if (!BASE64_SIGNATURE_REGEX.test(signature)) {
        return {
            isValid: false,
            fingerprint: String(signatureBlock.public_key_fingerprint || 'UNKNOWN').trim().toLowerCase() || 'UNKNOWN',
            auditMessage: '[AUDIT FAILURE] Refusing execution: Signature block format contains corrupted non-base64 character sets.',
            exitCode: 71
        };
    }

    const fingerprint = String(signatureBlock.public_key_fingerprint || '').trim().toLowerCase();
    const publicKeyPem = trustStore && typeof trustStore.getPublicKey === 'function'
        ? trustStore.getPublicKey(fingerprint)
        : null;

    if (!publicKeyPem) {
        return {
            isValid: false,
            fingerprint: fingerprint || 'UNKNOWN',
            auditMessage: `[AUDIT FAILURE] Untrusted corporate policy credential fingerprint pinned: ${fingerprint || 'UNKNOWN'}`,
            exitCode: 78
        };
    }

    try {
        const canonicalData = canonicalizePolicy(rawJson);
        const isVerified = crypto.verify(
            'sha256',
            Buffer.from(canonicalData, 'utf8'),
            {
                key: publicKeyPem,
                padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                saltLength: crypto.constants.RSA_PSS_SALTLENGTH_DIGEST
            },
            Buffer.from(signature, 'base64')
        );

        if (!isVerified) {
            return {
                isValid: false,
                fingerprint: fingerprint || 'UNKNOWN',
                auditMessage: '[AUDIT FAILURE] Cryptographic verification failed. Content modification or payload tampering detected!',
                exitCode: 71
            };
        }

        return {
            isValid: true,
            fingerprint: fingerprint || 'UNKNOWN',
            auditMessage: `[AUDIT SUCCESS] Policy successfully validated via corporate fingerprint token: ${fingerprint || 'UNKNOWN'}`,
            exitCode: 0
        };
    } catch (err) {
        return {
            isValid: false,
            fingerprint: fingerprint || 'UNKNOWN',
            auditMessage: `[AUDIT CRITICAL] Execution halted during validation operations: ${err.message}`,
            exitCode: 78
        };
    }
}

module.exports = {
    BASE64_SIGNATURE_REGEX,
    canonicalizePolicy,
    sortKeysObject,
    TrustStore,
    verifyPolicySignature
};
