const crypto = require('crypto');
const path = require('path');
const { saveCertificate, loadCertificate, STORAGE_DIR } = require('../../server/lib/certificate-store.cjs');
const { logAuditEvent } = require('../../server/lib/audit-log.cjs');

// In-memory metadata map (demo). Replace with DB-backed persistence in production.
const certificateMetadataDb = new Map();
const SIGNING_SECRET = process.env.URL_SIGNING_SECRET || crypto.randomBytes(32);

function generateSignedUrl(certId, expiresAt) {
  const payload = JSON.stringify({ certId, expiresAt });
  const hmac = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
  const token = Buffer.from(payload).toString('base64');
  return `token=${encodeURIComponent(token)}&sig=${hmac}`;
}

function verifySignedToken(tokenStr, sigStr) {
  try {
    const payload = Buffer.from(tokenStr, 'base64').toString('utf8');
    const expectedHmac = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sigStr), Buffer.from(expectedHmac))) return null;
    const parsed = JSON.parse(payload);
    if (Date.now() > parsed.expiresAt) return null;
    return parsed.certId;
  } catch (e) {
    return null;
  }
}

// Minimal express-style route registration. The host app can call registerRoutes(app).
function registerRoutes(app) {
  // Generate certificate endpoint
  app.post('/api/certificates/generate', async (req, res) => {
    try {
      const sessionId = req.body && (req.body.sessionId || req.body.sessionToken) || 'unknown';
      // Minimal validation placeholder — caller must validate license/session properly
      const certId = `cert-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

      // Create a demo certificate payload (replace with real cert generation)
      const certBuffer = Buffer.from(`SIMPLEBEACON-CERTIFICATE\nissued:${new Date().toISOString()}\nsession:${sessionId}\n id:${certId}\n`);

      saveCertificate(certId, certBuffer, { sessionId });
      const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minutes
      const tokenQuery = generateSignedUrl(certId, expiresAt);

      certificateMetadataDb.set(certId, { id: certId, sessionId, createdAt: Date.now(), expiresAt });

      logAuditEvent({ name: 'certificate.issued', sessionId, issuer: 'system', clientIp: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress });

      res.json({ id: certId, downloadUrl: `/api/certificates/download?${tokenQuery}`, expiresAt });
    } catch (err) {
      console.error('Failed to generate certificate', err);
      res.status(500).json({ error: 'failed' });
    }
  });

  // Download endpoint
  app.get('/api/certificates/download', async (req, res) => {
    try {
      const token = req.query && req.query.token;
      const sig = req.query && req.query.sig;
      if (!token || !sig) return res.status(400).send('missing token');
      const certId = verifySignedToken(token, sig);
      if (!certId) {
        logAuditEvent({ name: 'certificate.download_failed', sessionId: null, issuer: 'system', clientIp: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress, status: 'FAILED' });
        return res.status(403).send('invalid or expired token');
      }

      const entry = certificateMetadataDb.get(certId);
      if (!entry) return res.status(404).send('not found');

      const loaded = loadCertificate(certId);
      if (!loaded) return res.status(404).send('not found');

      logAuditEvent({ name: 'certificate.downloaded', sessionId: entry.sessionId, issuer: 'system', clientIp: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress });

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${certId}.bin"`);
      return res.send(loaded.buffer);
    } catch (err) {
      console.error('download error', err);
      res.status(500).send('server error');
    }
  });
}

module.exports = { registerRoutes, generateSignedUrl, verifySignedToken, certificateMetadataDb };
