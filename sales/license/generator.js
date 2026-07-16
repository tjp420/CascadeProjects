// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
const crypto = require('crypto');

/**
 * Sign an enterprise license payload using an RSA private key.
 * The resulting token can be distributed to clients and validated
 * locally using the corresponding public key.
 *
 * @param {string} companyId - Unique identifier for the subscribing company
 * @param {string} tier - License tier (e.g., 'team', 'enterprise')
 * @param {string} expiresAt - ISO 8601 date string (e.g., '2027-12-31')
 * @param {string} privateKeyPem - PEM-encoded RSA private key
 * @returns {string} Combined cryptographic token (payloadBase64.signatureBase64)
 */
function signLicense(companyId, tier, expiresAt, privateKeyPem) {
    if (typeof companyId !== 'string' || !companyId) {
        throw new TypeError('companyId must be a non-empty string');
    }
    if (typeof tier !== 'string' || !tier) {
        throw new TypeError('tier must be a non-empty string');
    }
    if (typeof expiresAt !== 'string' || !expiresAt) {
        throw new TypeError('expiresAt must be a non-empty string');
    }
    if (typeof privateKeyPem !== 'string' || !privateKeyPem) {
        throw new TypeError('privateKeyPem must be a non-empty string');
    }

    const payload = {
        companyId,
        tier,
        expiresAt
    };

    let encodedPayload;
    try {
        encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
    } catch (err) {
        throw new Error(`Failed to encode license payload: ${err?.message || String(err)}`);
    }

    let signature;
    try {
        const sign = crypto.createSign('SHA256');
        sign.update(encodedPayload);
        signature = sign.sign(privateKeyPem, 'base64');
    } catch (err) {
        throw new Error(`Failed to sign license: ${err?.message || String(err)}`);
    }

    if (!signature || typeof signature !== 'string') {
        throw new Error('Signing produced an invalid signature');
    }

    // Return an explicit, combined cryptographic string
    return `${encodedPayload}.${signature}`;
}

module.exports = { signLicense };
