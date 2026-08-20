"use strict";

/**
 * Hardware Attestation — SEV-SNP and SGX Binary Report Parsing Tests
 *
 * Tests the real-world hardware integration profiles:
 *   - SEV-SNP: 4096-byte attestation report parsing and verification
 *   - SGX: DCAP quote parsing and verification
 *
 * Verifies that the verifier can parse raw binary attestation reports
 * from real hardware (AMD SEV-SNP, Intel SGX DCAP) and validate the
 * MRENCLAVE/MEASUREMENT fields against expected values.
 */

const crypto = require("crypto");
const {
  HardwareAttestationVerifier,
  parseSevSnpReport,
  parseSgxQuote,
  SEV_SNP_REPORT_SIZE,
} = require("../../../lib/hsm-adapter/hardware-attestation-verify.cjs");
const {
  MockTpmQuoteGenerator,
  DEFAULT_EXPECTED_MRENCLAVE,
} = require("../../../lib/hsm-adapter/mock-tpm-quote-generator.cjs");
const {
  HsmAdapterError,
} = require("../../../lib/hsm-adapter/base-adapter.cjs");

describe("Hardware Attestation — SEV-SNP Binary Report Parsing", () => {
  let quoteGen;
  let verifier;
  const expectedMeasurements = {
    "sev-snp": { mrenclave: DEFAULT_EXPECTED_MRENCLAVE["sev-snp"] },
    sgx: { mrenclave: DEFAULT_EXPECTED_MRENCLAVE["sgx"] },
  };

  beforeEach(() => {
    quoteGen = new MockTpmQuoteGenerator();
    verifier = new HardwareAttestationVerifier({ expectedMeasurements });
  });

  // ── SEV-SNP Report Parser ──────────────────────────────────────────

  describe("parseSevSnpReport", () => {
    test("parses a valid 4096-byte SEV-SNP report", () => {
      const report = quoteGen.generateSevSnpRawReport(
        crypto.randomBytes(32).toString("hex"),
      );
      const parsed = parseSevSnpReport(report.rawReport);
      expect(parsed).not.toBeNull();
      expect(parsed.version).toBe(1);
      expect(parsed.policy).toBe(0x1f);
      expect(parsed.measurement).toBe(DEFAULT_EXPECTED_MRENCLAVE["sev-snp"]);
      expect(parsed.reportData).toBeDefined();
      expect(parsed.signature).toBeDefined();
    });

    test("returns null for undersized buffer", () => {
      const shortBuf = Buffer.alloc(100, 0);
      expect(parseSevSnpReport(shortBuf)).toBeNull();
    });

    test("returns null for invalid input", () => {
      expect(parseSevSnpReport(null)).toBeNull();
      expect(parseSevSnpReport("not-hex")).toBeNull();
      expect(parseSevSnpReport(undefined)).toBeNull();
    });

    test("extracts REPORT_DATA with nonce padded to 48 bytes", () => {
      const nonce = crypto.randomBytes(32).toString("hex");
      const report = quoteGen.generateSevSnpRawReport(nonce);
      const parsed = parseSevSnpReport(report.rawReport);
      // REPORT_DATA is 48 bytes; nonce is 32 bytes, padded with 16 zero bytes
      const expectedReportData = Buffer.concat([
        Buffer.from(nonce, "hex"),
        Buffer.alloc(16),
      ]).toString("hex");
      expect(parsed.reportData).toBe(expectedReportData);
    });

    test("accepts hex string input", () => {
      const report = quoteGen.generateSevSnpRawReport(
        crypto.randomBytes(32).toString("hex"),
      );
      const hexReport = report.rawReport.toString("hex");
      const parsed = parseSevSnpReport(hexReport);
      expect(parsed).not.toBeNull();
      expect(parsed.measurement).toBe(DEFAULT_EXPECTED_MRENCLAVE["sev-snp"]);
    });
  });

  // ── SEV-SNP Verification with Raw Report ───────────────────────────

  describe("SEV-SNP raw report verification", () => {
    test("valid SEV-SNP raw report passes verification", () => {
      const sandboxId = "sbx-sev-raw-1";
      const challenge = verifier.issueChallenge(sandboxId);
      const report = quoteGen.generateSevSnpRawReport(challenge.nonce);
      const result = verifier.verify(sandboxId, report);

      expect(result.verified).toBe(true);
      expect(result.authority).toBe("sev-snp");
      expect(result.measurement).toBe(DEFAULT_EXPECTED_MRENCLAVE["sev-snp"]);
    });

    test("SEV-SNP raw report with wrong MEASUREMENT is rejected", () => {
      const sandboxId = "sbx-sev-raw-2";
      const challenge = verifier.issueChallenge(sandboxId);
      const report = quoteGen.generateSevSnpWrongMeasurementReport(
        challenge.nonce,
      );

      try {
        verifier.verify(sandboxId, report);
        fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe("ATTESTATION_UNTRUSTED_MEASUREMENT");
      }
    });

    test("SEV-SNP raw report with policy constraint passes when policy matches", () => {
      const policyVerifier = new HardwareAttestationVerifier({
        expectedMeasurements: {
          "sev-snp": {
            mrenclave: DEFAULT_EXPECTED_MRENCLAVE["sev-snp"],
            policy: 0x1f,
          },
        },
      });
      const sandboxId = "sbx-sev-policy-1";
      const challenge = policyVerifier.issueChallenge(sandboxId);
      const report = quoteGen.generateSevSnpRawReport(challenge.nonce, {
        policy: 0x1f,
      });
      const result = policyVerifier.verify(sandboxId, report);
      expect(result.verified).toBe(true);
    });

    test("SEV-SNP raw report with wrong policy is rejected", () => {
      const policyVerifier = new HardwareAttestationVerifier({
        expectedMeasurements: {
          "sev-snp": {
            mrenclave: DEFAULT_EXPECTED_MRENCLAVE["sev-snp"],
            policy: 0x1f,
          },
        },
      });
      const sandboxId = "sbx-sev-policy-2";
      const challenge = policyVerifier.issueChallenge(sandboxId);
      const report = quoteGen.generateSevSnpRawReport(challenge.nonce, {
        policy: 0x00,
      });
      try {
        policyVerifier.verify(sandboxId, report);
        fail("Should have thrown");
      } catch (e) {
        expect(e.code).toBe("ATTESTATION_UNTRUSTED_MEASUREMENT");
      }
    });

    test("SEV-SNP raw report with minVersion constraint", () => {
      const versionVerifier = new HardwareAttestationVerifier({
        expectedMeasurements: {
          "sev-snp": {
            mrenclave: DEFAULT_EXPECTED_MRENCLAVE["sev-snp"],
            minVersion: 1,
          },
        },
      });
      const sandboxId = "sbx-sev-ver-1";
      const challenge = versionVerifier.issueChallenge(sandboxId);
      const report = quoteGen.generateSevSnpRawReport(challenge.nonce, {
        version: 1,
      });
      const result = versionVerifier.verify(sandboxId, report);
      expect(result.verified).toBe(true);
    });

    test("SEV-SNP raw report below minVersion is rejected", () => {
      const versionVerifier = new HardwareAttestationVerifier({
        expectedMeasurements: {
          "sev-snp": {
            mrenclave: DEFAULT_EXPECTED_MRENCLAVE["sev-snp"],
            minVersion: 2,
          },
        },
      });
      const sandboxId = "sbx-sev-ver-2";
      const challenge = versionVerifier.issueChallenge(sandboxId);
      const report = quoteGen.generateSevSnpRawReport(challenge.nonce, {
        version: 1,
      });
      try {
        versionVerifier.verify(sandboxId, report);
        fail("Should have thrown");
      } catch (e) {
        expect(e.code).toBe("ATTESTATION_UNTRUSTED_MEASUREMENT");
      }
    });

    test("SEV-SNP raw report nonce in REPORT_DATA must match challenge", () => {
      const sandboxId = "sbx-sev-nonce-1";
      const challenge = verifier.issueChallenge(sandboxId);
      // Generate report with a different nonce
      const wrongNonce = crypto.randomBytes(32).toString("hex");
      const report = quoteGen.generateSevSnpRawReport(wrongNonce);
      // Override the nonce field to match challenge (so nonce check passes)
      // but the REPORT_DATA in the raw report won't match
      report.nonce = challenge.nonce;

      try {
        verifier.verify(sandboxId, report);
        fail("Should have thrown");
      } catch (e) {
        expect(e.code).toBe("ATTESTATION_UNTRUSTED_MEASUREMENT");
      }
    });
  });

  // ── Backward Compatibility ─────────────────────────────────────────

  describe("SEV-SNP backward compatibility", () => {
    test("pre-parsed SEV-SNP quote (with mrenclave field) still works", () => {
      const sandboxId = "sbx-sev-compat-1";
      const challenge = verifier.issueChallenge(sandboxId);
      const quote = quoteGen.generateSevSnpQuote(challenge.nonce);
      const result = verifier.verify(sandboxId, quote);

      expect(result.verified).toBe(true);
      expect(result.authority).toBe("sev-snp");
      expect(result.measurement).toBe(DEFAULT_EXPECTED_MRENCLAVE["sev-snp"]);
    });
  });
});

describe("Hardware Attestation — SGX DCAP Quote Parsing", () => {
  let quoteGen;
  let verifier;
  const expectedMeasurements = {
    "sev-snp": { mrenclave: DEFAULT_EXPECTED_MRENCLAVE["sev-snp"] },
    sgx: { mrenclave: DEFAULT_EXPECTED_MRENCLAVE["sgx"] },
  };

  beforeEach(() => {
    quoteGen = new MockTpmQuoteGenerator();
    verifier = new HardwareAttestationVerifier({ expectedMeasurements });
  });

  // ── SGX Quote Parser ───────────────────────────────────────────────

  describe("parseSgxQuote", () => {
    test("parses a valid SGX DCAP quote", () => {
      const quote = quoteGen.generateSgxRawQuote(
        crypto.randomBytes(32).toString("hex"),
      );
      const parsed = parseSgxQuote(quote.rawQuote);
      expect(parsed).not.toBeNull();
      expect(parsed.mrenclave).toBe(DEFAULT_EXPECTED_MRENCLAVE["sgx"]);
      expect(parsed.mrsigner).toBeDefined();
      expect(parsed.isvProdId).toBe(1);
      expect(parsed.isvSvn).toBe(1);
      expect(parsed.reportData).toBeDefined();
    });

    test("returns null for undersized buffer", () => {
      const shortBuf = Buffer.alloc(50, 0);
      expect(parseSgxQuote(shortBuf)).toBeNull();
    });

    test("returns null for invalid input", () => {
      expect(parseSgxQuote(null)).toBeNull();
      expect(parseSgxQuote("not-hex")).toBeNull();
      expect(parseSgxQuote(undefined)).toBeNull();
    });

    test("extracts REPORT_DATA with first 16 bytes of nonce", () => {
      const nonce = crypto.randomBytes(32).toString("hex");
      const quote = quoteGen.generateSgxRawQuote(nonce);
      const parsed = parseSgxQuote(quote.rawQuote);
      const expectedReportData = Buffer.from(nonce, "hex")
        .subarray(0, 16)
        .toString("hex");
      expect(parsed.reportData).toBe(expectedReportData);
    });

    test("accepts hex string input", () => {
      const quote = quoteGen.generateSgxRawQuote(
        crypto.randomBytes(32).toString("hex"),
      );
      const hexQuote = quote.rawQuote.toString("hex");
      const parsed = parseSgxQuote(hexQuote);
      expect(parsed).not.toBeNull();
      expect(parsed.mrenclave).toBe(DEFAULT_EXPECTED_MRENCLAVE["sgx"]);
    });
  });

  // ── SGX Verification with Raw Quote ────────────────────────────────

  describe("SGX raw quote verification", () => {
    test("valid SGX raw quote passes verification", () => {
      const sandboxId = "sbx-sgx-raw-1";
      const challenge = verifier.issueChallenge(sandboxId);
      const quote = quoteGen.generateSgxRawQuote(challenge.nonce);
      const result = verifier.verify(sandboxId, quote);

      expect(result.verified).toBe(true);
      expect(result.authority).toBe("sgx");
      expect(result.measurement).toBe(DEFAULT_EXPECTED_MRENCLAVE["sgx"]);
    });

    test("SGX raw quote with wrong MRENCLAVE is rejected", () => {
      const sandboxId = "sbx-sgx-raw-2";
      const challenge = verifier.issueChallenge(sandboxId);
      const quote = quoteGen.generateSgxWrongMeasurementQuote(challenge.nonce);

      try {
        verifier.verify(sandboxId, quote);
        fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe("ATTESTATION_UNTRUSTED_MEASUREMENT");
      }
    });

    test("SGX raw quote with MRSIGNER constraint passes when signer matches", () => {
      const signerVerifier = new HardwareAttestationVerifier({
        expectedMeasurements: {
          sgx: {
            mrenclave: DEFAULT_EXPECTED_MRENCLAVE["sgx"],
            mrsigner: crypto
              .createHash("sha256")
              .update("intel-signing-key")
              .digest("hex")
              .slice(0, 32),
          },
        },
      });
      const sandboxId = "sbx-sgx-signer-1";
      const challenge = signerVerifier.issueChallenge(sandboxId);
      const quote = quoteGen.generateSgxRawQuote(challenge.nonce);
      const result = signerVerifier.verify(sandboxId, quote);
      expect(result.verified).toBe(true);
    });

    test("SGX raw quote with wrong MRSIGNER is rejected", () => {
      const signerVerifier = new HardwareAttestationVerifier({
        expectedMeasurements: {
          sgx: {
            mrenclave: DEFAULT_EXPECTED_MRENCLAVE["sgx"],
            mrsigner: crypto
              .createHash("sha256")
              .update("wrong-signer")
              .digest("hex")
              .slice(0, 32),
          },
        },
      });
      const sandboxId = "sbx-sgx-signer-2";
      const challenge = signerVerifier.issueChallenge(sandboxId);
      const quote = quoteGen.generateSgxRawQuote(challenge.nonce);
      try {
        signerVerifier.verify(sandboxId, quote);
        fail("Should have thrown");
      } catch (e) {
        expect(e.code).toBe("ATTESTATION_UNTRUSTED_MEASUREMENT");
      }
    });

    test("SGX raw quote with ISVPRODID constraint passes when product ID matches", () => {
      const prodIdVerifier = new HardwareAttestationVerifier({
        expectedMeasurements: {
          sgx: {
            mrenclave: DEFAULT_EXPECTED_MRENCLAVE["sgx"],
            isvProdId: 1,
          },
        },
      });
      const sandboxId = "sbx-sgx-prodid-1";
      const challenge = prodIdVerifier.issueChallenge(sandboxId);
      const quote = quoteGen.generateSgxRawQuote(challenge.nonce, {
        isvProdId: 1,
      });
      const result = prodIdVerifier.verify(sandboxId, quote);
      expect(result.verified).toBe(true);
    });

    test("SGX raw quote with wrong ISVPRODID is rejected", () => {
      const prodIdVerifier = new HardwareAttestationVerifier({
        expectedMeasurements: {
          sgx: {
            mrenclave: DEFAULT_EXPECTED_MRENCLAVE["sgx"],
            isvProdId: 2,
          },
        },
      });
      const sandboxId = "sbx-sgx-prodid-2";
      const challenge = prodIdVerifier.issueChallenge(sandboxId);
      const quote = quoteGen.generateSgxRawQuote(challenge.nonce, {
        isvProdId: 1,
      });
      try {
        prodIdVerifier.verify(sandboxId, quote);
        fail("Should have thrown");
      } catch (e) {
        expect(e.code).toBe("ATTESTATION_UNTRUSTED_MEASUREMENT");
      }
    });
  });

  // ── Backward Compatibility ─────────────────────────────────────────

  describe("SGX backward compatibility", () => {
    test("pre-parsed SGX quote (with mrenclave field) still works", () => {
      const sandboxId = "sbx-sgx-compat-1";
      const challenge = verifier.issueChallenge(sandboxId);
      const quote = quoteGen.generateSgxQuote(challenge.nonce);
      const result = verifier.verify(sandboxId, quote);

      expect(result.verified).toBe(true);
      expect(result.authority).toBe("sgx");
      expect(result.measurement).toBe(DEFAULT_EXPECTED_MRENCLAVE["sgx"]);
    });
  });
});

// ── Cross-profile integration ──────────────────────────────────────────

describe("Hardware Attestation — cross-profile integration", () => {
  let quoteGen;

  beforeEach(() => {
    quoteGen = new MockTpmQuoteGenerator();
  });

  test("TPM2, SEV-SNP raw, and SGX raw can all be verified by the same verifier", () => {
    const expectedMeasurements = {
      tpm2: {
        pcrs: require("../../../lib/hsm-adapter/mock-tpm-quote-generator.cjs")
          .DEFAULT_EXPECTED_PCRS,
      },
      "sev-snp": { mrenclave: DEFAULT_EXPECTED_MRENCLAVE["sev-snp"] },
      sgx: { mrenclave: DEFAULT_EXPECTED_MRENCLAVE["sgx"] },
    };
    const v = new HardwareAttestationVerifier({ expectedMeasurements });

    // TPM2
    const c1 = v.issueChallenge("sbx-cross-1");
    const q1 = quoteGen.generateQuote(c1.nonce);
    const r1 = v.verify("sbx-cross-1", q1);
    expect(r1.authority).toBe("tpm2");

    // SEV-SNP raw
    const c2 = v.issueChallenge("sbx-cross-2");
    const q2 = quoteGen.generateSevSnpRawReport(c2.nonce);
    const r2 = v.verify("sbx-cross-2", q2);
    expect(r2.authority).toBe("sev-snp");

    // SGX raw
    const c3 = v.issueChallenge("sbx-cross-3");
    const q3 = quoteGen.generateSgxRawQuote(c3.nonce);
    const r3 = v.verify("sbx-cross-3", q3);
    expect(r3.authority).toBe("sgx");
  });

  test("SEV-SNP report size is exactly 4096 bytes", () => {
    expect(SEV_SNP_REPORT_SIZE).toBe(4096);
    const report = quoteGen.generateSevSnpRawReport(
      crypto.randomBytes(32).toString("hex"),
    );
    expect(report.rawReport.length).toBe(4096);
  });
});
