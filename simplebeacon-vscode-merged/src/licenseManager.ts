import * as crypto from 'crypto';

export interface LicenseMeta {
    companyId: string;
    tier: string;
    expiresAt: string;
}

/**
 * Validate a SimpleBeacon enterprise license token locally using
 * an embedded RSA public key. This verification occurs entirely on
 * the client device, eliminating server-side API round-trips.
 *
 * @param licenseToken - Combined cryptographic token (payloadBase64.signatureBase64)
 * @param publicKeyPem - PEM-encoded RSA public key
 * @returns LicenseMeta if valid and unexpired, otherwise null
 */
export function validateLicenseLocally(licenseToken: string, publicKeyPem: string): LicenseMeta | null {
    try {
        const [payloadBase64, signatureBase64] = licenseToken.split('.');
        if (!payloadBase64 || !signatureBase64) {
            return null;
        }

        // Verify authenticity via public key signature analysis
        const verify = crypto.createVerify('SHA256');
        verify.update(payloadBase64);
        const isAuthentic = verify.verify(publicKeyPem, signatureBase64, 'base64');

        if (!isAuthentic) {
            return null;
        }

        // Extract metadata structural context fields cleanly
        const meta: LicenseMeta = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));

        // Check expiration threshold
        if (new Date(meta.expiresAt) < new Date()) {
            return null; // License has expired
        }

        return meta;
    } catch {
        return null; // Fallback for corrupt structural tokens
    }
}
