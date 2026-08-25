const path = require("path");
const {
  validateCryptoPolicyEngine,
  PolicyEngineValidationError,
} = require("../policy-validator.cjs");

function loadFixture(name) {
  return require(path.join(__dirname, "fixtures", name));
}

describe("Policy Validator - validateCryptoPolicyEngine", () => {
  test("valid policy passes validation", () => {
    const cfg = loadFixture("clinical_trial_alpha_policy.json");
    expect(validateCryptoPolicyEngine(cfg)).toBe(true);
  });

  test("malformed schema throws PolicyEngineValidationError with schemaErrors", () => {
    const cfg = loadFixture("malformed_schema.json");
    try {
      validateCryptoPolicyEngine(cfg);
      throw new Error("Expected validation to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyEngineValidationError);
      expect(err.context).toHaveProperty("schemaErrors");
    }
  });

  test("threshold > nShares throws", () => {
    const cfg = loadFixture("invalid_threshold.json");
    try {
      validateCryptoPolicyEngine(cfg);
      throw new Error("Expected validation to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyEngineValidationError);
      expect(String(err.message)).toMatch(/cannot exceed total shares/);
    }
  });

  test("threshold below BFT quorum throws", () => {
    const cfg = loadFixture("invalid_bft.json");
    try {
      validateCryptoPolicyEngine(cfg);
      throw new Error("Expected validation to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyEngineValidationError);
      expect(String(err.message)).toMatch(
        /BFT threshold|Cryptographic policy threshold drops below/,
      );
    }
  });

  test("participants length mismatch throws", () => {
    const cfg = loadFixture("invalid_participants_count.json");
    try {
      validateCryptoPolicyEngine(cfg);
      throw new Error("Expected validation to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyEngineValidationError);
      expect(String(err.message)).toMatch(/Topological registry mismatch/);
    }
  });

  test("invalid NTT modulus q throws", () => {
    const cfg = loadFixture("invalid_ntt_q.json");
    try {
      validateCryptoPolicyEngine(cfg);
      throw new Error("Expected validation to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyEngineValidationError);
      expect(String(err.message)).toMatch(/does not support NTT/);
    }
  });

  test("invalid sigma bound throws", () => {
    const cfg = loadFixture("invalid_sigma.json");
    try {
      validateCryptoPolicyEngine(cfg);
      throw new Error("Expected validation to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyEngineValidationError);
      expect(String(err.message)).toMatch(
        /Critical post-quantum vulnerability/,
      );
    }
  });
});
