import * as crypto from 'crypto';

export interface LicenseMeta {
  companyId: string;
  tier: string;
  expiresAt: string;
}

/** Tier alias map: canonical -> aliases. Tokens may use alternate names. */
const TIER_ALIASES: Record<string, string> = {
  free: 'developer',
  pro: 'pro',
  enterprise: 'compliance',
};

/** Reverse map: alias -> canonical. */
const ALIAS_TO_CANONICAL: Record<string, string> = Object.fromEntries(
  Object.entries(TIER_ALIASES).map(([k, v]) => [v, k])
);

/**
 * Normalize a tier name to canonical form (free, pro, team, enterprise).
 * @param tier - Raw tier string from token
 * @returns Canonical tier name
 */
export function normalizeTier(tier: string): string {
  const t = (tier || 'free').toLowerCase();
  return ALIAS_TO_CANONICAL[t] || t;
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
