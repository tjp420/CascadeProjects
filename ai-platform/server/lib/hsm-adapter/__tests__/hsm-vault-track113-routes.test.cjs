const assert = require('assert');
const kem = require('../../crypto/ratchet/kem-provider.cjs');
const register = require('../../../routes/track113-routes.cjs');
const ratchet = require('../../crypto/ratchet/index.cjs');

function makeMockApp() {
  const routes = {};
  return {
    post: (path, handler) => { routes[path] = handler; },
    __routes: routes
  };
}

function makeRes() {
  const out = { statusCode: 200, body: null };
  return {
    status: (code) => { out.statusCode = code; return { json: (b) => { out.body = b; } }; },
    json: (b) => { out.body = b; },
    _out: out
  };
}

async function run() {
  const app = makeMockApp();
  register(app);
  const routes = app.__routes;
  assert(routes['/api/track113/handshake/initiate']);
  assert(routes['/api/track113/handshake/respond']);

  // Happy path: initiate then respond
  const client = kem.generateKeyPair();
  const reqInit = { body: { tenantId: 'tenant-test', clientPublicKey: client.publicKeyDer.toString('base64') } };
  const resInit = makeRes();
  await routes['/api/track113/handshake/initiate'](reqInit, resInit);
  assert.strictEqual(resInit._out.statusCode, 201);
  const { sessionId, ciphertext } = resInit._out.body;
  assert(sessionId && ciphertext);

  // Respond with ciphertext
  const reqResp = { body: { tenantId: 'tenant-test', sessionId, ciphertext } };
  const resResp = makeRes();
  // Try calling the ratchet responder directly to inspect errors
  try {
    await ratchet.dhRatchetRespond(sessionId, 'tenant-test', Buffer.from(ciphertext, 'base64'));
  } catch (e) {
    console.error('dhRatchetRespond threw:', e && e.stack ? e.stack : e);
  }
  await routes['/api/track113/handshake/respond'](reqResp, resResp);
  console.log('respond result:', resResp._out);
  assert.strictEqual(resResp._out.statusCode, 200);

  // Negative test: wrong tenant
  const reqBad = { body: { tenantId: 'attacker', sessionId, ciphertext } };
  const resBad = makeRes();
  await routes['/api/track113/handshake/respond'](reqBad, resBad);
  assert.strictEqual(resBad._out.statusCode, 403);

  console.log('hsm-vault-track113-routes: OK');
}

if (require.main === module) run().catch(err => { console.error(err); process.exit(1); });

module.exports = { run };
