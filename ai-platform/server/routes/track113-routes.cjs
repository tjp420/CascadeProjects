const crypto = require('crypto');
const kem = require('../lib/crypto/ratchet/kem-provider.cjs');
const ratchet = require('../lib/crypto/ratchet/index.cjs');
const { kdfRoot } = ratchet;
const SessionStore = require('../lib/crypto/ratchet/session-store.cjs');

module.exports = function registerTrack113Routes(app) {
  // Initiate handshake: client provides its public key and tenantId
  app.post('/api/track113/handshake/initiate', async (req, res) => {
    try {
      const { tenantId, clientPublicKey } = req.body || {};
      if (!tenantId || !clientPublicKey) return res.status(400).json({ error: 'missing tenantId or clientPublicKey' });
      const clientPubDer = Buffer.from(clientPublicKey, 'base64');
      const clientPubObj = crypto.createPublicKey({ key: clientPubDer, format: 'der', type: 'spki' });

      const local = kem.generateKeyPair();
      const sessionId = `track113-${Date.now()}-${Math.floor(Math.random()*1000)}`;

      // create session record with local keypair and remote public
      SessionStore.create({ sessionId, tenantId, localKeyPair: local, remotePublicKeyDer: clientPubDer });

      // Encapsulate to produce ciphertext to send back to client
      const { ciphertext } = kem.encapsulate(clientPubObj);

      return res.status(201).json({ sessionId, serverPublicKey: local.publicKeyDer.toString('base64'), ciphertext: ciphertext.toString('base64') });
    } catch (e) {
      return res.status(500).json({ error: 'server_error' });
    }
  });

  // Respond to a handshake: client sends ciphertext for a session
  app.post('/api/track113/handshake/respond', async (req, res) => {
    try {
      const { tenantId, sessionId, ciphertext } = req.body || {};
      if (!tenantId || !sessionId || !ciphertext) return res.status(400).json({ error: 'missing tenantId/sessionId/ciphertext' });
      const ct = Buffer.from(ciphertext, 'base64');
      const s = SessionStore.get(sessionId, tenantId);
      if (!s) return res.status(404).json({ error: 'session_not_found' });
      if (!s.localKeyPair || !s.localKeyPair.privateKeyObj) return res.status(500).json({ error: 'missing_local_key' });
      const shared = kem.decapsulate(ct, s.localKeyPair.privateKeyObj);
      const { root: newRoot, ck: newCk } = kdfRoot(s.root, shared);
      try { s.root.fill(0); } catch (e) {}
      s.root = newRoot; s.ck = newCk;
      SessionStore.set(sessionId, s);
      return res.status(200).json({ ok: true });
    } catch (e) {
      if (e && e.code === 'UNAUTHORIZED_SESSION_ACCESS') return res.status(403).json({ error: 'unauthorized' });
      return res.status(500).json({ error: 'server_error' });
    }
  });
};
