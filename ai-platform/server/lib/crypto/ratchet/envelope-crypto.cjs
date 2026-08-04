const crypto = require('crypto');
const { resolveSecret } = require('../../secret-config.cjs');

function _deriveKey(kek) {
  // Normalize KEK to 32 bytes using SHA-256
  return crypto.createHash('sha256').update(String(kek)).digest();
}

/**
 * Encrypt a Buffer or string with AES-256-GCM using KEK string.
 * Returns a compact base64 string: iv:tag:ciphertext
 */
function encryptEnvelope(plaintext, kek) {
  if (!plaintext) return null;
  const key = _deriveKey(kek || resolveSecret('TRACK113_KEK'));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const input = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext), 'utf8');
  const ct = Buffer.concat([cipher.update(input), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/**
 * Decrypt string produced by encryptEnvelope using KEK string.
 * Returns a Buffer with plaintext.
 */
function decryptEnvelope(envelopeStr, kek) {
  if (!envelopeStr) return null;
  const [ivB64, tagB64, ctB64] = String(envelopeStr).split(':');
  if (!ivB64 || !tagB64 || !ctB64) throw new Error('invalid envelope');
  const key = _deriveKey(kek || resolveSecret('TRACK113_KEK'));
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt;
}

module.exports = { encryptEnvelope, decryptEnvelope };
