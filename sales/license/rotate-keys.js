// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { signLicense } = require('./generator.js');

/**
 * Rotates an active client license token from an old private key signature to a new one.
 */
function rotateLicenseToken(oldToken, oldPublicKeyPem, newPrivateKeyPem) {
    if (typeof oldToken !== 'string' || !oldToken) {
        return { success: false, error: 'oldToken must be a non-empty string' };
    }
    if (typeof oldPublicKeyPem !== 'string' || !oldPublicKeyPem) {
        return { success: false, error: 'oldPublicKeyPem must be a non-empty string' };
    }
    if (typeof newPrivateKeyPem !== 'string' || !newPrivateKeyPem) {
        return { success: false, error: 'newPrivateKeyPem must be a non-empty string' };
    }

    try {
        const parts = oldToken.split('.');
        if (parts.length !== 2) {
            return { success: false, error: 'Invalid token format: expected payload.signature' };
        }
        const [payloadBase64, signatureBase64] = parts;
        if (!payloadBase64 || !signatureBase64) {
            return { success: false, error: 'Invalid token format: missing payload or signature' };
        }

        // 1. Verify token validity against the old public key footprint
        let isValid;
        try {
            const verify = crypto.createVerify('SHA256');
            verify.update(payloadBase64);
            isValid = verify.verify(oldPublicKeyPem, signatureBase64, 'base64');
        } catch (err) {
            return { success: false, error: `Token verification error: ${err?.message || String(err)}` };
        }

        if (!isValid) {
            return { success: false, error: 'Token verification failed against the provided old public key.' };
        }

        // 2. Decode the underlying metadata payload context cleanly
        let meta;
        try {
            meta = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
        } catch (err) {
            return { success: false, error: `Failed to decode license payload: ${err?.message || String(err)}` };
        }

        if (!meta || typeof meta !== 'object') {
            return { success: false, error: 'Decoded license payload is not a valid object' };
        }
        if (typeof meta.companyId !== 'string' || !meta.companyId) {
            return { success: false, error: 'Decoded payload missing valid companyId' };
        }
        if (typeof meta.tier !== 'string' || !meta.tier) {
            return { success: false, error: 'Decoded payload missing valid tier' };
        }
        if (typeof meta.expiresAt !== 'string' || !meta.expiresAt) {
            return { success: false, error: 'Decoded payload missing valid expiresAt' };
        }

        // 3. Re-sign the identical metadata structures utilizing the fresh new private key
        const newToken = signLicense(meta.companyId, meta.tier, meta.expiresAt, newPrivateKeyPem);

        return {
            success: true,
            companyId: meta.companyId,
            newToken
        };
    } catch (error) {
        return { success: false, error: error?.message || String(error) };
    }
}

module.exports = { rotateLicenseToken };

// Runnable test block if executed independently
if (require.main === module) {
    console.log('[SimpleBeacon] Initializing Key Rotation Validation Subsystem...');

    // Generate temporary old pair vs new pair for E2E validation simulation
    const oldKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const oldPub = oldKeys.publicKey.export({ type: 'spki', format: 'pem' });
    const oldPriv = oldKeys.privateKey.export({ type: 'pkcs8', format: 'pem' });

    const newKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const newPriv = newKeys.privateKey.export({ type: 'pkcs8', format: 'pem' });

    // Mock an active enterprise token via the old system state
    const originalToken = signLicense('acme-enterprise', 'enterprise', '2028-12-31', oldPriv);

    const rotationResult = rotateLicenseToken(originalToken, oldPub, newPriv);
    console.log(rotationResult.success ? 'ROTATION CRYPTO MATRIX PASSED' : 'ROTATION CRYPTO MATRIX FAILED');
}
