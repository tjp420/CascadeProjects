/**
 * Minimal license token generator for Executive Clearance subscriptions.
 * In production, this would use a proper JWT library or HMAC signing.
 */

const crypto = require('crypto');

function generateLicenseToken(payload = {}, secret = process.env.SIMPLEBEACON_LICENSE_SECRET || 'simplebeacon-dev-insecure', expiresInMinutes = 60) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + (expiresInMinutes * 60 * 1000);
  const tokenPayload = {
    email: payload.email || '',
    tier: payload.tier || 'executive',
    features: payload.features || [],
    clientName: payload.clientName || payload.email || 'Client',
    projectName: payload.projectName || 'Project',
    iat: issuedAt,
    exp: expiresAt
  };
  const data = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyLicenseToken(token, secret = process.env.SIMPLEBEACON_LICENSE_SECRET || 'simplebeacon-dev-insecure') {
  if (!token || typeof token !== 'string') return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  generateLicenseToken,
  verifyLicenseToken
};
