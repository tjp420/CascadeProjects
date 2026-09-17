const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-cbc';
const STORAGE_DIR = process.env.CERTIFICATE_STORE_DIR || path.join(__dirname, '../../.simplebeacon/certs');
const ENCRYPTION_KEY = process.env.CERTIFICATE_SECRET_KEY || crypto.randomBytes(32);

function ensureStorageDir() {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function encryptCertificate(buffer) {
  const iv = crypto.randomBytes(16);
  const key = Buffer.isBuffer(ENCRYPTION_KEY) ? ENCRYPTION_KEY : Buffer.from(ENCRYPTION_KEY);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted.toString('hex')
  };
}

function decryptCertificate(encryptedData, iv) {
  const key = Buffer.isBuffer(ENCRYPTION_KEY) ? ENCRYPTION_KEY : Buffer.from(ENCRYPTION_KEY);
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key), Buffer.from(iv, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedData, 'hex')), decipher.final()]);
  return decrypted;
}

function saveCertificate(certId, buffer, metadata = {}) {
  ensureStorageDir();
  const { iv, encryptedData } = encryptCertificate(buffer);
  const out = {
    id: certId,
    iv,
    encryptedData,
    metadata,
    createdAt: new Date().toISOString()
  };
  const filePath = path.join(STORAGE_DIR, `${certId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(out), 'utf8');
  return filePath;
}

function loadCertificate(certId) {
  const filePath = path.join(STORAGE_DIR, `${certId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const decrypted = decryptCertificate(parsed.encryptedData, parsed.iv);
    return { buffer: decrypted, metadata: parsed.metadata, createdAt: parsed.createdAt };
  } catch (err) {
    throw err;
  }
}

module.exports = { encryptCertificate, decryptCertificate, saveCertificate, loadCertificate, STORAGE_DIR };
