const { sha256HexFromObject } = require('./utils.cjs');

// Deterministic fixture for cross-platform compliance testing
const FIXED_TIMESTAMP = '2026-08-02T00:00:00.000Z';
const VERSION = '1.0.0';
const POLICY_ID = 'fixture-policy-0001';
const PROOF_BUNDLE = Buffer.from('mock-proof:fixture:canonical').toString('base64');

const meta = {
  scheme: 'mock-scheme',
  version: VERSION,
  engineTimestamp: FIXED_TIMESTAMP
};

const provenanceHash = sha256HexFromObject({ policyId: POLICY_ID, proof_bundle: PROOF_BUNDLE, meta });

const FIXTURE = {
  policyId: POLICY_ID,
  proof_bundle: PROOF_BUNDLE,
  meta: Object.assign({}, meta, { provenanceHash })
};

module.exports = { FIXTURE };
