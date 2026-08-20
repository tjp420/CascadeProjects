"use strict";

/**
 * Hardware Attestation Perimeter — Test Suite
 *
 * Tests TPM 2.0 quote verification, nonce challenge-response freshness,
 * SIEM alerting on attestation failures, and sandbox engine integration.
 */

const crypto = require("crypto");
const {
  HardwareAttestationVerifier,
  ATTESTATION_NONCE_TTL_MS,
  ATTESTATION_TIMESTAMP_SKEW_MS,
  ATTESTATION_NONCE_BYTES,
} = require("../../../lib/hsm-adapter/hardware-attestation-verify.cjs");
const {
  MockTpmQuoteGenerator,
  DEFAULT_EXPECTED_PCRS,
  DEFAULT_EXPECTED_MRENCLAVE,
} = require("../../../lib/hsm-adapter/mock-tpm-quote-generator.cjs");
const {
  ConfidentialSandboxEngine,
  SANDBOX_STATES,
} = require("../../../lib/hsm-adapter/confidential-sandbox-engine.cjs");
const {
  HsmAdapterError,
} = require("../../../lib/hsm-adapter/base-adapter.cjs");

describe("Hardware Attestation Perimeter", () => {
  let quoteGen;
  let verifier;
  const expectedMeasurements = {
    tpm2: { pcrs: DEFAULT_EXPECTED_PCRS },
    "sev-snp": { mrenclave: DEFAULT_EXPECTED_MRENCLAVE["sev-snp"] },
    sgx: { mrenclave: DEFAULT_EXPECTED_MRENCLAVE["sgx"] },
  };

  beforeEach(() => {
    quoteGen = new MockTpmQuoteGenerator();
    verifier = new HardwareAttestationVerifier({ expectedMeasurements });
  });

  // ── L2-01: TPM 2.0 quote with valid PCR values passes ─────────────

  describe("L2-01: TPM 2.0 quote with valid PCR values", () => {
    test("valid TPM 2.0 quote passes verification", () => {
      const sandboxId = "sbx-test-1";
      const challenge = verifier.issueChallenge(sandboxId);
      const quote = quoteGen.generateQuote(challenge.nonce);
      const result = verifier.verify(sandboxId, quote);

      expect(result.verified).toBe(true);
      expect(result.measurement).toBeDefined();
      expect(result.authority).toBe("tpm2");
    });
  });

  // ── L2-02: TPM 2.0 quote with wrong PCR values rejected ───────────

  describe("L2-02: Wrong PCR values rejected", () => {
    test("wrong PCR values throw ATTESTATION_UNTRUSTED_MEASUREMENT", () => {
      const sandboxId = "sbx-test-2";
      const challenge = verifier.issueChallenge(sandboxId);
      const quote = quoteGen.generateWrongMeasurementQuote(challenge.nonce);

      try {
        verifier.verify(sandboxId, quote);
        fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe("ATTESTATION_UNTRUSTED_MEASUREMENT");
      }
    });
  });

  // ── L2-03: Nonce challenge-response succeeds ───────────────────────

  describe("L2-03: Nonce challenge-response succeeds", () => {
    test("matching nonce from challenge passes", () => {
      const sandboxId = "sbx-test-3";
      const challenge = verifier.issueChallenge(sandboxId);
      expect(challenge.nonce).toBeDefined();
      expect(challenge.issuedAt).toBeDefined();

      const quote = quoteGen.generateQuote(challenge.nonce);
      const result = verifier.verify(sandboxId, quote);
      expect(result.verified).toBe(true);
    });
  });

  // ── L2-04: Nonce replay rejected ──────────────────────────────────

  describe("L2-04: Nonce replay rejected", () => {
    test("same nonce used twice throws ATTESTATION_REPLAY_DETECTED", () => {
      const sandboxId1 = "sbx-replay-1";
      const sandboxId2 = "sbx-replay-2";

      // First sandbox: issue challenge and verify
      const challenge1 = verifier.issueChallenge(sandboxId1);
      const quote1 = quoteGen.generateQuote(challenge1.nonce);
      verifier.verify(sandboxId1, quote1);

      // Second sandbox: use the same nonce (replay attempt)
      const challenge2 = verifier.issueChallenge(sandboxId2);
      // Manually create a quote with the first nonce but second challenge's timestamp
      const replayQuote = quoteGen.generateQuote(challenge1.nonce);
      // Override the nonce to match challenge2 so it passes nonce match check
      // Actually, we need to use challenge2's nonce but try to replay challenge1's nonce
      // The correct test: use the same nonce for a different sandbox
      const quote2 = quoteGen.generateQuote(challenge2.nonce);
      // Now try to use challenge1's nonce again with a new sandbox
      const sandboxId3 = "sbx-replay-3";
      const challenge3 = verifier.issueChallenge(sandboxId3);
      // Create quote with challenge3's nonce but then try to verify with challenge1's nonce
      // Actually, the replay protection is on the nonce in the attestation, not the challenge
      // Let's test: verify a second attestation with the same nonce
      const replayQuote2 = quoteGen.generateQuote(challenge1.nonce);
      // We need a challenge that has the same nonce - but challenges are random
      // The real test: after a successful verify, the nonce is recorded. If we try
      // to verify another attestation with the same nonce, it should be rejected.
      // But the challenge won't match... Let me think about this differently.
      //
      // The replay protection works like this:
      // 1. Nonce is recorded in _seenNonces after successful verify
      // 2. If the same nonce appears in a future verify, it's rejected
      //
      // To test this, we need to manually inject a nonce into the seen registry
      // and then try to verify with it.
      verifier._seenNonces.set(challenge3.nonce, Date.now());
      const replayQuote3 = quoteGen.generateQuote(challenge3.nonce);
      try {
        verifier.verify(sandboxId3, replayQuote3);
        fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe("ATTESTATION_REPLAY_DETECTED");
      }
    });
  });

  // ── L2-05: Expired nonce rejected ─────────────────────────────────

  describe("L2-05: Expired nonce rejected", () => {
    test("challenge older than 5 minutes throws ATTESTATION_CHALLENGE_EXPIRED", () => {
      const sandboxId = "sbx-expired-1";
      const challenge = verifier.issueChallenge(sandboxId);

      // Simulate expiration by backdating the challenge
      const pending = verifier.getPendingChallenge(sandboxId);
      pending.issuedAt = Date.now() - (ATTESTATION_NONCE_TTL_MS + 1000);

      const quote = quoteGen.generateQuote(challenge.nonce);
      try {
        verifier.verify(sandboxId, quote);
        fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe("ATTESTATION_CHALLENGE_EXPIRED");
      }
    });
  });

  // ── L2-06: Mismatched nonce rejected ──────────────────────────────

  describe("L2-06: Mismatched nonce rejected", () => {
    test("wrong nonce throws ATTESTATION_NONCE_MISMATCH", () => {
      const sandboxId = "sbx-mismatch-1";
      verifier.issueChallenge(sandboxId);

      // Generate quote with a different nonce
      const wrongNonce = crypto.randomBytes(32).toString("hex");
      const quote = quoteGen.generateQuote(wrongNonce);

      try {
        verifier.verify(sandboxId, quote);
        fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe("ATTESTATION_NONCE_MISMATCH");
      }
    });
  });

  // ── L2-07: Untrusted authority rejected ───────────────────────────

  describe("L2-07: Untrusted authority rejected", () => {
    test("authority not in allowlist throws ATTESTATION_UNTRUSTED_AUTHORITY", () => {
      const restrictedVerifier = new HardwareAttestationVerifier({
        expectedMeasurements,
        allowedAuthorities: ["tpm2"], // only TPM 2.0
      });
      const sandboxId = "sbx-auth-1";
      const challenge = restrictedVerifier.issueChallenge(sandboxId);
      const quote = quoteGen.generateSevSnpQuote(challenge.nonce);

      try {
        restrictedVerifier.verify(sandboxId, quote);
        fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe("ATTESTATION_UNTRUSTED_AUTHORITY");
      }
    });
  });

  // ── L2-08: Invalid signature rejected ─────────────────────────────

  describe("L2-08: Invalid signature rejected", () => {
    test("tampered signature throws ATTESTATION_SIGNATURE_INVALID", () => {
      const sandboxId = "sbx-sig-1";
      const challenge = verifier.issueChallenge(sandboxId);
      const quote = quoteGen.generateTamperedQuote(challenge.nonce);

      try {
        verifier.verify(sandboxId, quote);
        fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe("ATTESTATION_SIGNATURE_INVALID");
      }
    });
  });

  // ── L2-09: SIEM alert on attestation rejection ────────────────────

  describe("L2-09: SIEM alert on attestation rejection", () => {
    test("SIEM alert emitted with high severity on rejection", () => {
      const auditEvents = [];
      const verifierWithAudit = new HardwareAttestationVerifier({
        expectedMeasurements,
        audit: (event, data) => auditEvents.push({ event, data }),
      });
      const sandboxId = "sbx-siem-1";
      verifierWithAudit.issueChallenge(sandboxId);
      const wrongNonce = crypto.randomBytes(32).toString("hex");
      const quote = quoteGen.generateQuote(wrongNonce);

      try {
        verifierWithAudit.verify(sandboxId, quote);
      } catch (e) {
        // Expected
      }

      const siemEvent = auditEvents.find(
        (e) => e.event === "ATTESTATION_NONCE_MISMATCH",
      );
      expect(siemEvent).toBeDefined();
      expect(siemEvent.data.siemSeverity).toBe("high");
      expect(siemEvent.data.siemCategory).toBe("attestation_nonce_mismatch");
    });
  });

  // ── L2-10: Sandbox engine attest() uses new verification ──────────

  describe("L2-10: Sandbox engine integration", () => {
    test("sandbox transitions to ATTESTED with valid challenge-response", () => {
      const engine = new ConfidentialSandboxEngine({
        expectedMeasurements,
      });
      const sandbox = engine.create("tenant-1");
      const challenge = engine.issueChallenge(sandbox.id);
      const quote = quoteGen.generateQuote(challenge.nonce);

      engine.attest(sandbox.id, quote);
      expect(sandbox.state).toBe(SANDBOX_STATES.ATTESTED);
    });
  });

  // ── L3-01: SEV-SNP profile ────────────────────────────────────────

  describe("L3-01: SEV-SNP profile", () => {
    test("valid SEV-SNP quote passes", () => {
      const sandboxId = "sbx-sev-1";
      const challenge = verifier.issueChallenge(sandboxId);
      const quote = quoteGen.generateSevSnpQuote(challenge.nonce);
      const result = verifier.verify(sandboxId, quote);

      expect(result.verified).toBe(true);
      expect(result.authority).toBe("sev-snp");
      expect(result.measurement).toBe(DEFAULT_EXPECTED_MRENCLAVE["sev-snp"]);
    });
  });

  // ── L3-02: SGX profile ────────────────────────────────────────────

  describe("L3-02: SGX profile", () => {
    test("valid SGX quote passes", () => {
      const sandboxId = "sbx-sgx-1";
      const challenge = verifier.issueChallenge(sandboxId);
      const quote = quoteGen.generateSgxQuote(challenge.nonce);
      const result = verifier.verify(sandboxId, quote);

      expect(result.verified).toBe(true);
      expect(result.authority).toBe("sgx");
      expect(result.measurement).toBe(DEFAULT_EXPECTED_MRENCLAVE["sgx"]);
    });
  });

  // ── L3-03: Timestamp skew rejected ────────────────────────────────

  describe("L3-03: Timestamp skew > 10s rejected", () => {
    test("timestamp 15s off throws TIMESTAMP_SKEW", () => {
      const sandboxId = "sbx-skew-1";
      const challenge = verifier.issueChallenge(sandboxId);
      const quote = quoteGen.generateQuote(challenge.nonce, {
        timestamp: Date.now() - 15000, // 15s in the past
      });

      try {
        verifier.verify(sandboxId, quote);
        fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe("TIMESTAMP_SKEW");
      }
    });
  });

  // ── L3-04: Missing nonce rejected ─────────────────────────────────

  describe("L3-04: Missing nonce in response rejected", () => {
    test("attestation without nonce throws ATTESTATION_CHALLENGE_MISSING", () => {
      const sandboxId = "sbx-no-nonce-1";
      const challenge = verifier.issueChallenge(sandboxId);
      const quote = quoteGen.generateQuote(challenge.nonce);
      delete quote.nonce;

      try {
        verifier.verify(sandboxId, quote);
        fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe("ATTESTATION_CHALLENGE_MISSING");
      }
    });
  });

  // ── L3-05: Missing measurement rejected ───────────────────────────

  describe("L3-05: Missing measurement rejected", () => {
    test("attestation without PCRs throws ATTESTATION_UNTRUSTED_MEASUREMENT", () => {
      const sandboxId = "sbx-no-meas-1";
      const challenge = verifier.issueChallenge(sandboxId);
      const quote = quoteGen.generateQuote(challenge.nonce);
      delete quote.pcrs;

      try {
        verifier.verify(sandboxId, quote);
        fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe("ATTESTATION_UNTRUSTED_MEASUREMENT");
      }
    });
  });

  // ── L3-06: Existing sandbox lifecycle unaffected ──────────────────

  describe("L3-06: Existing sandbox lifecycle with attestation", () => {
    test("create → challenge → attest → execute → zeroize → destroy", () => {
      const engine = new ConfidentialSandboxEngine({ expectedMeasurements });
      const sandbox = engine.create("tenant-1");
      expect(sandbox.state).toBe(SANDBOX_STATES.CREATED);

      const challenge = engine.issueChallenge(sandbox.id);
      const quote = quoteGen.generateQuote(challenge.nonce);
      engine.attest(sandbox.id, quote);
      expect(sandbox.state).toBe(SANDBOX_STATES.ATTESTED);

      const result = engine.execute(sandbox.id, "hash", {
        data: Buffer.from("test"),
      });
      expect(sandbox.state).toBe(SANDBOX_STATES.COMPLETED);
      expect(result.digest).toBeDefined();

      engine.zeroize(sandbox.id);
      expect(sandbox.state).toBe(SANDBOX_STATES.ZEROIZED);

      engine.destroy(sandbox.id);
      expect(sandbox.state).toBe(SANDBOX_STATES.DESTROYED);
    });
  });

  // ── L3-07: Multiple sandboxes attested independently ──────────────

  describe("L3-07: Multiple sandboxes attested independently", () => {
    test("two sandboxes get separate challenges and attestations", () => {
      const engine = new ConfidentialSandboxEngine({ expectedMeasurements });
      const sandbox1 = engine.create("tenant-1");
      const sandbox2 = engine.create("tenant-2");

      const challenge1 = engine.issueChallenge(sandbox1.id);
      const challenge2 = engine.issueChallenge(sandbox2.id);

      // Challenges should be different
      expect(challenge1.nonce).not.toBe(challenge2.nonce);

      const quote1 = quoteGen.generateQuote(challenge1.nonce);
      const quote2 = quoteGen.generateQuote(challenge2.nonce);

      engine.attest(sandbox1.id, quote1);
      engine.attest(sandbox2.id, quote2);

      expect(sandbox1.state).toBe(SANDBOX_STATES.ATTESTED);
      expect(sandbox2.state).toBe(SANDBOX_STATES.ATTESTED);
    });
  });

  // ── L3-08: Nonce challenge expires after 5 minutes ────────────────

  describe("L3-08: Nonce challenge expires after 5 minutes", () => {
    test("backdated challenge throws ATTESTATION_CHALLENGE_EXPIRED", () => {
      const sandboxId = "sbx-ttl-1";
      const challenge = verifier.issueChallenge(sandboxId);

      // Backdate the challenge
      const pending = verifier.getPendingChallenge(sandboxId);
      pending.issuedAt = Date.now() - (ATTESTATION_NONCE_TTL_MS + 5000);

      const quote = quoteGen.generateQuote(challenge.nonce);
      try {
        verifier.verify(sandboxId, quote);
        fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe("ATTESTATION_CHALLENGE_EXPIRED");
      }
    });
  });

  // ── S-01: Mock fallback no longer unconditionally trusts ──────────

  describe("S-01: Mock fallback eradicated", () => {
    test("engine without verifier or client fails closed", () => {
      const engine = new ConfidentialSandboxEngine(); // no verifier, no client
      const sandbox = engine.create("tenant-1");

      try {
        engine.attest(sandbox.id, { verified: true });
        fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe("ATTESTATION_NOT_CONFIGURED");
      }
    });

    test("engine without verifier rejects { verified: true } mock", () => {
      const engine = new ConfidentialSandboxEngine(); // no verifier
      const sandbox = engine.create("tenant-1");

      try {
        engine.attest(sandbox.id, { verified: true, measurement: "fake" });
        fail("Should have thrown");
      } catch (e) {
        expect(e.code).toBe("ATTESTATION_NOT_CONFIGURED");
      }
    });
  });

  // ── S-04: Nonce TTL is 5 minutes (hardcoded) ──────────────────────

  describe("S-04: Nonce TTL is 5 minutes", () => {
    test("ATTESTATION_NONCE_TTL_MS is exactly 300000", () => {
      expect(ATTESTATION_NONCE_TTL_MS).toBe(5 * 60 * 1000);
    });
  });

  // ── S-06: Timestamp skew limit ±10 seconds ────────────────────────

  describe("S-06: Timestamp skew limit", () => {
    test("ATTESTATION_TIMESTAMP_SKEW_MS is exactly 10000", () => {
      expect(ATTESTATION_TIMESTAMP_SKEW_MS).toBe(10 * 1000);
    });
  });

  // ── S-09: SIEM alert on every rejection path ──────────────────────

  describe("S-09: SIEM alerts on all rejection paths", () => {
    test("SIEM alert on missing challenge", () => {
      const auditEvents = [];
      const v = new HardwareAttestationVerifier({
        expectedMeasurements,
        audit: (event, data) => auditEvents.push({ event, data }),
      });
      try {
        v.verify("sbx-no-challenge", { nonce: "x", timestamp: Date.now() });
      } catch (e) {}
      expect(
        auditEvents.some((e) => e.event === "ATTESTATION_CHALLENGE_MISSING"),
      ).toBe(true);
    });

    test("SIEM alert on wrong measurement", () => {
      const auditEvents = [];
      const v = new HardwareAttestationVerifier({
        expectedMeasurements,
        audit: (event, data) => auditEvents.push({ event, data }),
      });
      const sandboxId = "sbx-siem-wrong";
      const challenge = v.issueChallenge(sandboxId);
      const quote = quoteGen.generateWrongMeasurementQuote(challenge.nonce);
      try {
        v.verify(sandboxId, quote);
      } catch (e) {}
      expect(
        auditEvents.some(
          (e) => e.event === "ATTESTATION_UNTRUSTED_MEASUREMENT",
        ),
      ).toBe(true);
    });

    test("SIEM alert on invalid signature", () => {
      const auditEvents = [];
      const v = new HardwareAttestationVerifier({
        expectedMeasurements,
        audit: (event, data) => auditEvents.push({ event, data }),
      });
      const sandboxId = "sbx-siem-sig";
      const challenge = v.issueChallenge(sandboxId);
      const quote = quoteGen.generateTamperedQuote(challenge.nonce);
      try {
        v.verify(sandboxId, quote);
      } catch (e) {}
      expect(
        auditEvents.some((e) => e.event === "ATTESTATION_SIGNATURE_INVALID"),
      ).toBe(true);
    });
  });

  // ── Entropy verification: 256-bit nonce randomness ────────────────

  describe("Nonce entropy verification", () => {
    test("1000 generated nonces are all unique", () => {
      const nonces = new Set();
      for (let i = 0; i < 1000; i++) {
        const challenge = verifier.issueChallenge("sbx-entropy-" + i);
        nonces.add(challenge.nonce);
      }
      expect(nonces.size).toBe(1000);
    });

    test("each nonce is 64 hex characters (256 bits)", () => {
      const challenge = verifier.issueChallenge("sbx-entropy-length");
      expect(challenge.nonce.length).toBe(64); // 32 bytes * 2 hex chars
      expect(/^[0-9a-f]+$/.test(challenge.nonce)).toBe(true);
    });

    test("ATTESTATION_NONCE_BYTES is 32", () => {
      expect(ATTESTATION_NONCE_BYTES).toBe(32);
    });
  });

  // ── Lazy pruning verification ─────────────────────────────────────

  describe("Lazy pruning of expired challenges", () => {
    test("expired challenges are pruned during issueChallenge", () => {
      // Issue a challenge and backdate it
      verifier.issueChallenge("sbx-prune-1");
      const pending = verifier.getPendingChallenge("sbx-prune-1");
      pending.issuedAt = Date.now() - (ATTESTATION_NONCE_TTL_MS + 10000);

      // Issue another challenge — should trigger pruning
      verifier.issueChallenge("sbx-prune-2");

      // The expired challenge should be gone
      expect(verifier.getPendingChallenge("sbx-prune-1")).toBeUndefined();
    });
  });
});
