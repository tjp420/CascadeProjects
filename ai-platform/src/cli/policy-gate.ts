import * as fs from 'fs';
import {
  verifyPolicySignature,
  extractSignatureBlock,
  TrustStore,
} from '../policy/SignatureVerifier';

// Pre-pinned organization public keys
const ORG_TRUST_STORE = new TrustStore({
  'sha256:e3b0c44298fc1c...':
    '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
});

export function runPolicyGate(policyFilePath: string): void {
  let rawFileContent: string;
  try {
    rawFileContent = fs.readFileSync(policyFilePath, 'utf8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[CRITICAL] Cannot read policy file: ${message}`);
    process.exit(78); // EX_CONFIG
  }

  // Extract and validate the signature block safely
  const { block: signatureBlock, error, exitCode } = extractSignatureBlock(rawFileContent);
  if (error || !signatureBlock) {
    console.error(`[CRITICAL] Fail-Closed: ${error}`);
    process.exit(exitCode);
  }

  // Step 1: Guard authenticity bounds before parsing the full schema
  const verification = verifyPolicySignature(rawFileContent, signatureBlock, ORG_TRUST_STORE);
  console.log(verification.auditMessage);

  if (!verification.isValid) {
    process.exit(verification.exitCode);
  }

  // Step 2: Safe to parse and push into the merge lattice engine
  try {
    const validatedPolicy = JSON.parse(rawFileContent) as Record<string, unknown>;
    const policyId = validatedPolicy.policy_id || 'unknown';
    console.log(`| Policy ${policyId} unlocked and loaded into security workspace.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[CRITICAL] Fail-Closed: Validated signature but failed to parse policy: ${message}`);
    process.exit(65); // EX_DATAERR
  }
}
