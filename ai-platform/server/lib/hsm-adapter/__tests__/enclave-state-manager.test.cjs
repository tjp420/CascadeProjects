const fs = require("fs");
const os = require("os");
const path = require("path");
const { EnclaveStateManager } = require("../enclave-state-manager.cjs");

// simple mock HSM: wrapKey/unwrapKey use XOR with a fixed wrapping key
function makeMockHsm(initialSecret) {
  let secret = initialSecret || Buffer.from("mock-wrap-key-0000000000000000");
  const wrapKey = async (buf) => {
    const w = secret;
    const out = Buffer.alloc(buf.length);
    for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ w[i % w.length];
    return out;
  };
  const unwrapKey = async (wrapped) => {
    const w = secret;
    const out = Buffer.alloc(wrapped.length);
    for (let i = 0; i < wrapped.length; i++)
      out[i] = wrapped[i] ^ w[i % w.length];
    return out;
  };
  const setSecret = (buf) => {
    secret = Buffer.from(buf);
  };
  return { wrapKey, unwrapKey, setSecret };
}

describe("EnclaveStateManager", () => {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "esm-test-"));
  const hsm = makeMockHsm();
  const m = new EnclaveStateManager({ hsm, storageDir: tmpdir });

  test("persist and load state roundtrip", async () => {
    const id = "test-state-1";
    const plain = Buffer.from("super-secret-data");
    await m.persistState(id, plain);
    const loaded = await m.loadState(id);
    expect(loaded.toString()).toBe("super-secret-data");
  });

  test("purgeState removes file", async () => {
    const id = "to-purge";
    await m.persistState(id, Buffer.from("erase-me"));
    const before = fs.existsSync(
      path.join(tmpdir, encodeURIComponent(id) + ".state"),
    );
    expect(before).toBe(true);
    const res = await m.purgeState(id);
    expect(res.purged).toBe(true);
    const after = fs.existsSync(
      path.join(tmpdir, encodeURIComponent(id) + ".state"),
    );
    expect(after).toBe(false);
  });

  test("rotateKek re-encrypts entries and can be loaded after HSM secret update", async () => {
    const id1 = "r1";
    const id2 = "r2";
    await m.persistState(id1, Buffer.from("data1"));
    await m.persistState(id2, Buffer.from("data2"));

    // new wrapping secret (simulated new KEK)
    const newSecret = Buffer.from("mock-wrap-key-NEW0000000000000");
    const newWrapFn = async (dataKey) => {
      const out = Buffer.alloc(dataKey.length);
      for (let i = 0; i < dataKey.length; i++)
        out[i] = dataKey[i] ^ newSecret[i % newSecret.length];
      return out;
    };

    // perform rotation (this will rewrap with newWrapped but HSM still knows old secret)
    await m.rotateKek(newWrapFn);

    // now update HSM to the new secret so it can unwrap rewrapped keys
    m._hsm.setSecret(newSecret);

    const l1 = await m.loadState(id1);
    const l2 = await m.loadState(id2);
    expect(l1.toString()).toBe("data1");
    expect(l2.toString()).toBe("data2");
  });
});
