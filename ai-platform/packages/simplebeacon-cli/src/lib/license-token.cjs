// simplebeacon-ignore git-sensitive-file — auth/token implementation file, not a leaked secret
/**
 * Stub for license-token.js — satisfies require() chain.
 */
function verifyLicenseToken(token) {
  try {
    const parts = token.split('.');
    const payload = parts.length === 2 ? parts[0] : parts[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

module.exports = { verifyLicenseToken };
