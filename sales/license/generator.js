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
    const payload = {
        companyId,
        tier,
        expiresAt
    };

    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');

    const sign = crypto.createSign('SHA256');
    sign.update(encodedPayload);
    const signature = sign.sign(privateKeyPem, 'base64');

    // Return an explicit, combined cryptographic string
    return `${encodedPayload}.${signature}`;
}

module.exports = { signLicense };
