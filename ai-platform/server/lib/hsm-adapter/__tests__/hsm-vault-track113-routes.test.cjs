const assert = require('assert');
const http = require('http');
process.env.NODE_ENV = 'test';
const path = require('path');
// Prevent loading repo .env files during tests so DASHBOARD_VAULT_PASSWORD isn't set
process.env.DOTENV_CONFIG_PATH = path.join(__dirname, 'no-dotenv-for-tests');
// Ensure vault auth is disabled in test runs to avoid vault_required responses
delete process.env.DASHBOARD_VAULT_PASSWORD;
const app = require('../../../index.cjs');
const kem = require('../../crypto/ratchet/kem-provider.cjs');

function postJson(port, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', c => buf += c);
      res.on('end', () => {
        let json = null;
        try { json = buf.length ? JSON.parse(buf) : null; } catch (e) { json = buf; }
        resolve({ statusCode: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  const server = app.listen(0);
  const port = server.address().port;

  // Happy path: initiate then respond
  const client = kem.generateKeyPair();
  const initResp = await postJson(port, '/api/track113/handshake/initiate', { tenantId: 'tenant-test', clientPublicKey: client.publicKeyDer.toString('base64') });
  assert.strictEqual(initResp.statusCode, 201, `init failed: ${JSON.stringify(initResp)}`);
  const { sessionId, ciphertext } = initResp.body;
  assert(sessionId && ciphertext, 'missing sessionId/ciphertext');

  // Respond with ciphertext — should succeed for correct tenant
  const respResp = await postJson(port, '/api/track113/handshake/respond', { tenantId: 'tenant-test', sessionId, ciphertext });
  assert.strictEqual(respResp.statusCode, 200, `respond failed: ${JSON.stringify(respResp)}`);

  // Negative test: wrong tenant
  const badResp = await postJson(port, '/api/track113/handshake/respond', { tenantId: 'attacker', sessionId, ciphertext });
  assert.strictEqual(badResp.statusCode, 403, `expected 403 for wrong tenant, got ${JSON.stringify(badResp)}`);

  server.close();
  console.log('hsm-vault-track113-routes: OK');
}

if (require.main === module) run().catch(err => { console.error(err); process.exit(1); });

module.exports = { run };
