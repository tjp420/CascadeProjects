const { test, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const fetch = global.fetch || require('undici').fetch;
const path = require('path');
const fs = require('fs');
const os = require('os');

// Use isolated temp storage for certificates during the test
const TMP_DIR = path.join(os.tmpdir(), `sb-certs-${Date.now()}`);
process.env.CERTIFICATE_STORE_DIR = TMP_DIR;
process.env.URL_SIGNING_SECRET = 'test-signing-secret';

let server;
let baseUrl;

before(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });
});

after(() => {
  if (server && server.close) server.close();
  try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch (e) {}
});

test('certificate generate -> download -> verify and failure modes', async () => {
  const { registerRoutes, generateSignedUrl } = require('../src/api/certificates.cjs');

  const app = express();
  app.use(express.json());
  registerRoutes(app);

  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const addr = server.address();
  const port = addr.port;
  baseUrl = `http://127.0.0.1:${port}`;

  // 1) POST /api/certificates/generate
  const genRes = await fetch(`${baseUrl}/api/certificates/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId: 'test-session-1' })
  });
  assert.strictEqual(genRes.status, 200, 'generate should return 200');
  const genJson = await genRes.json();
  assert.ok(genJson.id, 'response contains id');
  assert.ok(genJson.downloadUrl, 'response contains downloadUrl');

  // 2) GET download (valid token)
  const downloadRes = await fetch(`${baseUrl}${genJson.downloadUrl}`);
  assert.strictEqual(downloadRes.status, 200, 'download should return 200');
  const ab = await downloadRes.arrayBuffer();
  const buf = Buffer.from(ab);
  const txt = buf.toString('utf8');
  assert.ok(txt.includes('SIMPLEBEACON-CERTIFICATE'), 'payload appears to be certificate');
  assert.ok(txt.includes('session:test-session-1'), 'certificate contains session id');

  // 3) Missing token => 400
  const missingRes = await fetch(`${baseUrl}/api/certificates/download`);
  assert.strictEqual(missingRes.status, 400, 'missing token should return 400');

  // 4) Forged signature -> 403
  const url = new URL(`${baseUrl}${genJson.downloadUrl}`, baseUrl);
  const token = url.searchParams.get('token');
  const sig = url.searchParams.get('sig') || '';
  const forgedSig = sig.slice(0, -1) + (sig.slice(-1) === '0' ? '1' : '0');
  const forgedRes = await fetch(`${baseUrl}/api/certificates/download?token=${encodeURIComponent(token)}&sig=${forgedSig}`);
  assert.strictEqual(forgedRes.status, 403, 'forged signature should return 403');

  // 5) Expired token -> 403 (use exported generateSignedUrl with past expiry)
  const certId = genJson.id;
  const past = Date.now() - 60 * 1000;
  const expiredQuery = generateSignedUrl(certId, past);
  const expiredRes = await fetch(`${baseUrl}/api/certificates/download?${expiredQuery}`);
  assert.strictEqual(expiredRes.status, 403, 'expired token should return 403');

  server.close();
  server = null;
});
