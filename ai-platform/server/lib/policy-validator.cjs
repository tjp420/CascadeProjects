const Ajv = require('ajv');

const ajv = new Ajv({ allErrors: true, useDefaults: true });

const CRYPTO_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["policyId", "latticeParams", "thresholdParams", "participants", "immutable"],
  "properties": {
    "policyId": { "type": "string", "pattern": "^[A-Za-z0-9_\\-]{16,128}$" },
    "latticeParams": {
      "type": "object",
      "required": ["scheme", "n", "q", "sigma"],
      "properties": {
        "scheme": { "type": "string", "enum": ["ModuleLWE", "RingLWE"] },
        "n": { "type": "integer", "enum": [512, 1024, 2048, 4096] },
        "q": { "type": "integer" },
        "sigma": { "type": "number" }
      }
    },
    "thresholdParams": {
      "type": "object",
      "required": ["nShares", "threshold"],
      "properties": {
        "nShares": { "type": "integer", "minimum": 3 },
        "threshold": { "type": "integer", "minimum": 2 }
      }
    },
    "participants": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "role"],
        "properties": {
          "id": { "type": "string" },
          "role": { "type": "string", "enum": ["signer", "auditor"] }
        }
      }
    },
    "immutable": { "type": "boolean" }
  }
};

const validateStructure = ajv.compile(CRYPTO_SCHEMA);

class PolicyEngineValidationError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'PolicyEngineValidationError';
    this.context = context;
  }
}

function validateCryptoPolicyEngine(policyConfig) {
  const isStructurallyValid = validateStructure(policyConfig);
  if (!isStructurallyValid) {
    throw new PolicyEngineValidationError('JSON Schema compilation rejected configuration layout.', {
      schemaErrors: validateStructure.errors
    });
  }

  const { latticeParams, thresholdParams, participants } = policyConfig;

  if (thresholdParams.threshold > thresholdParams.nShares) {
    throw new PolicyEngineValidationError(
      `Invalid threshold configuration. Requisite threshold (k=${thresholdParams.threshold}) cannot exceed total shares allocated (n=${thresholdParams.nShares}).`
    );
  }

  const minimumBftQuorum = Math.ceil(thresholdParams.nShares * (2 / 3));
  if (thresholdParams.threshold < minimumBftQuorum) {
    throw new PolicyEngineValidationError(
      `Cryptographic policy threshold drops below acceptable BFT threshold. Configured: ${thresholdParams.threshold}, Required Minimum Quorum: ${minimumBftQuorum} for nShares: ${thresholdParams.nShares}`
    );
  }

  if (participants.length !== thresholdParams.nShares) {
    throw new PolicyEngineValidationError(
      `Topological registry mismatch. The quantity of configured participants (${participants.length}) must strictly equal defined threshold params nShares (${thresholdParams.nShares}).`
    );
  }

  const ringDegreeN = latticeParams.n;
  const modulusQ = latticeParams.q;
  const nttCondition = 2 * ringDegreeN;

  if (modulusQ % nttCondition !== 1) {
    throw new PolicyEngineValidationError(
      `Lattice modulus parameter q (${modulusQ}) does not support NTT configurations over N=${ringDegreeN}. Requirements state: q ≡ 1 mod 2n.`
    );
  }

  const boundValue = modulusQ / (2 * latticeParams.sigma);
  if (boundValue < 10000) {
    throw new PolicyEngineValidationError(
      `Critical post-quantum vulnerability detected. Error distribution variance sigma (${latticeParams.sigma}) is excessively large relative to modulus q, exposing the configuration to LWE lattice reduction attacks.`
    );
  }

  return true;
}

module.exports = { validateCryptoPolicyEngine, PolicyEngineValidationError };
