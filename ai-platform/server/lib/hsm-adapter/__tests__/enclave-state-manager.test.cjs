const fs = require('fs');
const os = require('os');
const path = require('path');
const { EnclaveStateManager } = require('../enclave-state-manager.cjs');

// simple mock HSM: wrapKey/unwrapKey use XOR with a fixed wrapping key
function makeMockHsm() {
  const wrapKey = async (buf) => {
    const w = Buffer.from('mock-wrap-key-0000000000000000');
    const out = Buffer.alloc(buf.length);
    for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ w[i % w.length];
    return out;
  };
  const unwrapKey = async (wrapped) => {
    const w = Buffer.from('mock-wrap-key-0000000000000000');
    const out = Buffer.alloc(wrapped.length);
    for (let i = 0; i < wrapped.length; i++) out[i] = wrapped[i] ^ w[i % w.length];
    return out;
  };
  return { wrapKey, unwrapKey };
}

describe('EnclaveStateManager', () => {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'esm-test-'));
  const hsm = makeMockHsm();
  const m = new EnclaveStateManager({ hsm, storageDir: tmpdir });

  test('persist and load state roundtrip', async () => {
    const id = 'test-state-1';
    const plain = Buffer.from('super-secret-data');
    await m.persistState(id, plain);
    const loaded = await m.loadState(id);
    expect(loaded.toString()).toBe('super-secret-data');
  });

  test('purgeState removes file', async () => {
    const id = 'to-purge';
    await m.persistState(id, Buffer.from('erase-me'));
    const before = fs.existsSync(path.join(tmpdir, encodeURIComponent(id) + '.state'));
    expect(before).toBe(true);
    const res = await m.purgeState(id);
    expect(res.purged).toBe(true);
    const after = fs.existsSync(path.join(tmpdir, encodeURIComponent(id) + '.state'));
    expect(after).toBe(false);
  });
});
