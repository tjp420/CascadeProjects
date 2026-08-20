const {
  EnclaveAttestationClient,
} = require("../enclave-attestation-client.cjs");

describe("EnclaveAttestationClient hardening", () => {
  test("rejects missing fields", async () => {
    const c = new EnclaveAttestationClient();
    await expect(c.verifyHandshake({})).rejects.toHaveProperty(
      "code",
      "MISSING_FIELDS",
    );
  });

  test("rejects timestamp skew outside window", async () => {
    const c = new EnclaveAttestationClient({ timestampSkewMs: 30 * 1000 });
    const payload = {
      peerId: "peer1",
      nonce: "n1",
      timestamp: Date.now() - 60 * 1000,
    };
    await expect(c.verifyHandshake(payload)).rejects.toHaveProperty(
      "code",
      "TIMESTAMP_SKEW",
    );
  });

  test("rejects replayed nonces", async () => {
    const c = new EnclaveAttestationClient({ nonceWindowMs: 2000 });
    const payload = { peerId: "peerA", nonce: "n123", timestamp: Date.now() };
    const r1 = await c.verifyHandshake(payload);
    expect(r1).toHaveProperty("token");
    await expect(c.verifyHandshake(payload)).rejects.toHaveProperty(
      "code",
      "REPLAY_NONCE",
    );
  });

  test("issues ephemeral token and validates it", async () => {
    const c = new EnclaveAttestationClient({ tokenTtlMs: 2000 });
    const payload = { peerId: "peerB", nonce: "nX", timestamp: Date.now() };
    const r = await c.verifyHandshake(payload);
    expect(r).toHaveProperty("token");
    expect(c.validateSessionToken(r.token)).toBe(true);
    // expire token
    await new Promise((res) => setTimeout(res, 30));
    // still valid (short sleep)
    expect(c.validateSessionToken(r.token)).toBe(true);
  });
});
