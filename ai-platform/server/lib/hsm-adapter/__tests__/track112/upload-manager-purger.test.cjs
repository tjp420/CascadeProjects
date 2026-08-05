"use strict";

const fs = require('fs');
const path = require('path');
const UploadManager = require('../../../storage/upload-manager.cjs');
const Purger = require('../../../storage/purger.cjs');

describe('UploadManager + Purger lifecycle', () => {
  const base = path.join(process.cwd(), '.data', 'test-upload');

  beforeEach(() => {
    if (fs.existsSync(base)) fs.rmSync(base, { recursive: true, force: true });
    fs.mkdirSync(base, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(base)) fs.rmSync(base, { recursive: true, force: true });
  });

  test('purger deletes stale uncommitted sessions', async () => {
    const mgr = new UploadManager({ baseDir: base, defaultTenant: 't1' });
    const purger = new Purger({ baseDir: base, ttlHours: 0, intervalMinutes: 1 });
    const sid = mgr.createSession({ tenant: 't1', maxBytes: 100, traceId: 'trace-1' });
    // write a chunk
    await mgr.writeChunkFromBuffer(sid, 0, Buffer.from('hello'));
    // touch meta to backdate
    const dir = path.join(base, 't1', sid);
    const metaPath = path.join(dir, 'meta.json');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    meta.lastTouch = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
    fs.writeFileSync(metaPath, JSON.stringify(meta));

    purger._scanOnce();

    // session dir should be removed
    expect(fs.existsSync(dir)).toBe(false);
  });

  test('committed sessions are not purged', async () => {
    const mgr = new UploadManager({ baseDir: base, defaultTenant: 't1' });
    const purger = new Purger({ baseDir: base, ttlHours: 0, intervalMinutes: 1 });
    const sid = mgr.createSession({ tenant: 't1', maxBytes: 100, traceId: 'trace-2' });
    await mgr.writeChunkFromBuffer(sid, 0, Buffer.from('world'));
    // commit by moving to committed dir
    const fakeKeyPair = require('crypto').generateKeyPairSync('ed25519');
    const pub = fakeKeyPair.publicKey.export({ type: 'spki', format: 'pem' });
    const data = Buffer.from('world');
    const root = require('crypto').createHash('sha256').update(data).digest();
    const sig = cryptoSign(root, fakeKeyPair.privateKey);
    const result = mgr.verifyAndCommitSession(sid, pub, sig);
    expect(result.ok).toBe(true);
    // now purger should not remove committed session
    purger._scanOnce();
    const committedDir = path.join(base, '_committed', 't1', sid);
    expect(fs.existsSync(committedDir)).toBe(true);
  });
});

function cryptoSign(buf, priv) {
  const sig = require('crypto').sign(null, buf, priv);
  return sig.toString('base64');
}
