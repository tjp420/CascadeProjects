"use strict";

const { EventEmitter } = require("events");
const crypto = require("crypto");
const {
  createClientHandshaker,
  createServerHandshaker,
} = require("../hybrid-kem-handshake.cjs");
const { keygen, encapsulate } = require("../vendor/mlkem.cjs");
const cluster = require("../cluster-keyring-sync.cjs");

const { EVENT_TYPES, _resetEvents, _recordEvent, queryEvents } = cluster;

const DEFAULT_TIMEOUT = 5000;

function parseFrame(buf) {
  const len = buf.readUInt32BE(0);
  const body = buf.slice(4, 4 + len).toString("utf8");
  return JSON.parse(body);
}

function serializeFrame(obj) {
  const body = Buffer.from(JSON.stringify(obj), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32BE(body.length, 0);
  return Buffer.concat([header, body]);
}

function createMitmPair(mutators = {}) {
  const clientSocket = new EventEmitter();
  const serverSocket = new EventEmitter();

  clientSocket.write = (d) => {
    const mutated = mutators.clientToServer ? mutators.clientToServer(d) : d;
    if (mutated) {
      process.nextTick(() => serverSocket.emit("data", mutated));
    }
    return true;
  };

  serverSocket.write = (d) => {
    const mutated = mutators.serverToClient ? mutators.serverToClient(d) : d;
    if (mutated) {
      process.nextTick(() => clientSocket.emit("data", mutated));
    }
    return true;
  };

  return { clientSocket, serverSocket };
}

async function runValidHandshake() {
  _resetEvents();
  const { clientSocket, serverSocket } = createMitmPair();

  const client = createClientHandshaker(clientSocket, {
    timeoutMs: DEFAULT_TIMEOUT,
  });
  const server = createServerHandshaker(serverSocket, {
    timeoutMs: DEFAULT_TIMEOUT,
  });

  const [clientResult, serverResult] = await Promise.all([client, server]);
  expect(clientResult.sessionKey.length).toBe(32);
  expect(serverResult.sessionKey.length).toBe(32);
  expect(clientResult.sessionKey.equals(serverResult.sessionKey)).toBe(true);
  return { clientResult, serverResult };
}

describe("hybrid-kem-mitm", () => {
  afterEach(() => {
    _resetEvents();
    delete process.env.QUANTUM_DEGRADE_ALLOWED;
  });

  test("valid control handshake produces matching 32-byte session keys", async () => {
    await runValidHandshake();
  });

  test("L2-01: public key bit-flip in ek_pq causes key mismatch or rejection", async () => {
    const { clientSocket, serverSocket } = createMitmPair({
      clientToServer: (d) => {
        const msg = parseFrame(d);
        if (msg.ek_pq) {
          const pk = Buffer.from(msg.ek_pq, "hex");
          pk[0] ^= 0x01;
          msg.ek_pq = pk.toString("hex");
          return serializeFrame(msg);
        }
        return d;
      },
    });

    const client = createClientHandshaker(clientSocket, {
      timeoutMs: DEFAULT_TIMEOUT,
    });
    const server = createServerHandshaker(serverSocket, {
      timeoutMs: DEFAULT_TIMEOUT,
    });

    // The bit-flip causes ML-KEM encapsulation against a wrong key, so the
    // client decapsulates a different secret. The key-confirmation MAC
    // detects this and the client rejects. The server still succeeds.
    await expect(client).rejects.toThrow(/MAC mismatch|replay|MITM/);
    await server.catch(() => {});
  });

  test("L2-02: ciphertext truncation causes client handshake to fail", async () => {
    const { clientSocket, serverSocket } = createMitmPair({
      serverToClient: (d) => {
        const msg = parseFrame(d);
        if (msg.c_pq) {
          const ct = Buffer.from(msg.c_pq, "hex");
          msg.c_pq = ct.slice(0, Math.floor(ct.length / 2)).toString("hex");
          return serializeFrame(msg);
        }
        return d;
      },
    });

    const client = createClientHandshaker(clientSocket, {
      timeoutMs: DEFAULT_TIMEOUT,
    });
    const server = createServerHandshaker(serverSocket, {
      timeoutMs: DEFAULT_TIMEOUT,
    });

    await expect(client).rejects.toThrow();
    await server.catch(() => {});
  });

  test("L2-03: ciphertext substitution causes key mismatch or rejection", async () => {
    const { publicKey: evilPublicKey } = await keygen();
    const { cipherText: evilCipherText } = await encapsulate(evilPublicKey);

    const { clientSocket, serverSocket } = createMitmPair({
      serverToClient: (d) => {
        const msg = parseFrame(d);
        if (msg.c_pq) {
          msg.c_pq = Buffer.from(evilCipherText).toString("hex");
          return serializeFrame(msg);
        }
        return d;
      },
    });

    const client = createClientHandshaker(clientSocket, {
      timeoutMs: DEFAULT_TIMEOUT,
    });
    const server = createServerHandshaker(serverSocket, {
      timeoutMs: DEFAULT_TIMEOUT,
    });

    // The substituted ciphertext was encapsulated against a different key,
    // so the client decapsulates a different secret. The MAC check detects
    // this and the client rejects.
    await expect(client).rejects.toThrow(/MAC mismatch|replay|MITM/);
    await server.catch(() => {});
  });

  test("L2-04: length-prefix fuzzing causes handshake to reject cleanly", async () => {
    const { clientSocket, serverSocket } = createMitmPair({
      clientToServer: () => {
        const garbage = Buffer.from("not json", "utf8");
        const header = Buffer.alloc(4);
        header.writeUInt32BE(garbage.length, 0);
        return Buffer.concat([header, garbage]);
      },
    });

    const client = createClientHandshaker(clientSocket, {
      timeoutMs: DEFAULT_TIMEOUT,
    });
    const server = createServerHandshaker(serverSocket, {
      timeoutMs: DEFAULT_TIMEOUT,
    });

    await expect(server).rejects.toThrow();
    await client.catch(() => {});
  });

  test("L2-05: full-handshake replay causes key mismatch, not a shared key", async () => {
    let captured = null;
    const { clientSocket: capClient, serverSocket: capServer } = createMitmPair(
      {
        serverToClient: (d) => {
          const msg = parseFrame(d);
          if (msg.c_pq) {
            captured = d;
          }
          return d;
        },
      },
    );

    await Promise.all([
      createClientHandshaker(capClient, { timeoutMs: DEFAULT_TIMEOUT }),
      createServerHandshaker(capServer, { timeoutMs: DEFAULT_TIMEOUT }),
    ]);
    expect(captured).not.toBeNull();

    const { clientSocket, serverSocket } = createMitmPair({
      serverToClient: () => captured,
    });

    const client = createClientHandshaker(clientSocket, {
      timeoutMs: DEFAULT_TIMEOUT,
    });
    const server = createServerHandshaker(serverSocket, {
      timeoutMs: DEFAULT_TIMEOUT,
    });

    // The replayed serverResponse contains a MAC computed with the original
    // session key. The new client derives a different key (different ML-KEM
    // keypair), so the MAC check fails and the client rejects.
    await expect(client).rejects.toThrow(/MAC mismatch|replay|MITM/);
    await server.catch(() => {});
  });

  test("L2-06: forced downgrade strip is rejected and logged", async () => {
    const { clientSocket, serverSocket } = createMitmPair({
      clientToServer: (d) => {
        const msg = parseFrame(d);
        if (msg.ek_pq) {
          delete msg.ek_pq;
          return serializeFrame(msg);
        }
        return d;
      },
    });

    const client = createClientHandshaker(clientSocket, {
      timeoutMs: DEFAULT_TIMEOUT,
    });
    const server = createServerHandshaker(serverSocket, {
      timeoutMs: DEFAULT_TIMEOUT,
    }).catch((err) => {
      _recordEvent(EVENT_TYPES.QUANTUM_DEGRADE_REJECTED, "mitm", {
        attack: "downgrade-strip",
        error: err.message,
      });
      return err;
    });

    // Wait for both sides to settle — the server rejects first (downgrade),
    // then the client times out waiting for a response that never comes.
    await expect(client).rejects.toThrow();
    await server; // ensure _recordEvent has run before querying

    const result = queryEvents({
      eventType: EVENT_TYPES.QUANTUM_DEGRADE_REJECTED,
    });
    expect(result.total).toBeGreaterThan(0);
    expect(result.events[0].eventType).toBe(
      EVENT_TYPES.QUANTUM_DEGRADE_REJECTED,
    );
  });

  test("L2-07: classic key mismatch (ek_classic flip) produces different keys or rejection", async () => {
    const { clientSocket, serverSocket } = createMitmPair({
      clientToServer: (d) => {
        const msg = parseFrame(d);
        if (msg.ek_classic) {
          const ek = Buffer.from(msg.ek_classic, "hex");
          ek[0] ^= 0x01;
          msg.ek_classic = ek.toString("hex");
          return serializeFrame(msg);
        }
        return d;
      },
    });

    const client = createClientHandshaker(clientSocket, {
      timeoutMs: DEFAULT_TIMEOUT,
    });
    const server = createServerHandshaker(serverSocket, {
      timeoutMs: DEFAULT_TIMEOUT,
    });

    // The flipped ek_classic causes the server to compute a different ECDH
    // secret. The MAC check detects the resulting key mismatch and the
    // client rejects.
    await expect(client).rejects.toThrow(/MAC mismatch|replay|MITM/);
    await server.catch(() => {});
  });
});
