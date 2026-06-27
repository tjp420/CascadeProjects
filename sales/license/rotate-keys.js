const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { signLicense } = require('./generator.js');

/**
 * Rotates an active client license token from an old private key signature to a new one.
 */
function rotateLicenseToken(oldToken, oldPublicKeyPem, newPrivateKeyPem) {
    try {
        const [payloadBase64, signatureBase64] = oldToken.split('.');

        // 1. Verify token validity against the old public key footprint
        const verify = crypto.createVerify('SHA256');
        verify.update(payloadBase64);
        const isValid = verify.verify(oldPublicKeyPem, signatureBase64, 'base64');

        if (!isValid) {
            throw new Error('Token verification failed against the provided old public key.');
        }

        // 2. Decode the underlying metadata payload context cleanly
        const meta = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));

        // 3. Re-sign the identical metadata structures utilizing the fresh new private key
        const newToken = signLicense(meta.companyId, meta.tier, meta.expiresAt, newPrivateKeyPem);

        return {
            success: true,
            companyId: meta.companyId,
            newToken
        };
    } catch (error) {
        return { success: false, error: error.message };
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
