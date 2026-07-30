import * as crypto from 'crypto';

export interface PolicySignatureBlock {
  algorithm: string;
  public_key_fingerprint: string;
  signature: string;
}

export interface VerificationResult {
  isValid: boolean;
  fingerprint: string;
  auditMessage: string;
  exitCode: number;
}

// POSIX exit codes (sysexits.h)
const EX_OK = 0;
const EX_DATAERR = 65;   // Malformed input, bad JSON, invalid Base64
const EX_CONFIG = 78;     // Untrusted key, missing configuration

/**
 * Validate that a value is a well-formed PolicySignatureBlock.
 * Returns an error string if invalid, null if valid.
 */
function validateSignatureBlock(value: unknown): string | null {
  if (value === null || value === undefined) {
    return 'Missing integrity_signatures block';
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return 'integrity_signatures must be an object';
  }
  const block = value as Record<string, unknown>;
  if (typeof block.algorithm !== 'string' || block.algorithm.length === 0) {
    return 'integrity_signatures.algorithm must be a non-empty string';
  }
  if (typeof block.public_key_fingerprint !== 'string' || block.public_key_fingerprint.length === 0) {
    return 'integrity_signatures.public_key_fingerprint must be a non-empty string';
  }
  if (typeof block.signature !== 'string' || block.signature.length === 0) {
    return 'integrity_signatures.signature must be a non-empty string';
  }
  return null;
}

/**
 * Validate that a string is well-formed Base64.
 * Returns true if the decoded length matches expectations.
 */
function isValidBase64(str: string): boolean {
  // Base64 alphabet (standard, no URL-safe chars)
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(str)) {
    return false;
  }
  if (str.length % 4 !== 0) {
    return false;
  }
  return true;
}

/**
 * Deep deterministic key sorting for canonical JSON.
 */
function sortKeysObject(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeysObject);
  }
  const obj = value as Record<string, unknown>;
  const sortedObj: Record<string, unknown> = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sortedObj[key] = sortKeysObject(obj[key]);
    });
  return sortedObj;
}

/**
 * Canonicalize policy JSON: stable key ordering, UTF-8, excludes signature field.
 * Throws on malformed JSON.
 */
export function canonicalizePolicy(rawJson: string): string {
  const obj = JSON.parse(rawJson) as Record<string, unknown>;

  // Strip the signature element to ensure we only verify the data payload
  if (obj.integrity_signatures) {
    delete obj.integrity_signatures;
  }

  return JSON.stringify(sortKeysObject(obj));
}

/**
 * Extract and validate the signature block from raw JSON.
 * Returns { block, error } — if error is non-null, block is null.
 */
export function extractSignatureBlock(
  rawJson: string
): { block: PolicySignatureBlock | null; error: string | null; exitCode: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { block: null, error: 'Policy file is not valid JSON', exitCode: EX_DATAERR };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { block: null, error: 'Policy root must be a JSON object', exitCode: EX_DATAERR };
  }

  const root = parsed as Record<string, unknown>;
  const validationError = validateSignatureBlock(root.integrity_signatures);
  if (validationError) {
    return { block: null, error: validationError, exitCode: EX_DATAERR };
  }

  return { block: root.integrity_signatures as PolicySignatureBlock, error: null, exitCode: EX_OK };
}

/**
 * Trust Store with fingerprint pinning and key revocation support.
 */
export class TrustStore {
  private pinnedKeys: Map<string, string> = new Map();
  private revokedFingerprints: Set<string> = new Set();

  constructor(initialKeys: Record<string, string> = {}) {
    for (const [fingerprint, pemKey] of Object.entries(initialKeys)) {
      this.pinnedKeys.set(fingerprint.toLowerCase(), pemKey);
    }
  }

  public addKey(fingerprint: string, pemKey: string): void {
    this.pinnedKeys.set(fingerprint.toLowerCase(), pemKey);
    this.revokedFingerprints.delete(fingerprint.toLowerCase());
  }

  public revokeKey(fingerprint: string): void {
    this.revokedFingerprints.add(fingerprint.toLowerCase());
  }

  public getPublicKey(fingerprint: string): string | null {
    const normalized = fingerprint.toLowerCase();
    if (this.revokedFingerprints.has(normalized)) {
      return null;
    }
    return this.pinnedKeys.get(normalized) || null;
  }

  public listFingerprints(): string[] {
    return Array.from(this.pinnedKeys.keys()).filter(
      (fp) => !this.revokedFingerprints.has(fp)
    );
  }
}

/**
 * Core RSASSA-PSS verification routine with fail-closed logic.
 */
export function verifyPolicySignature(
  rawJson: string,
  signatureBlock: PolicySignatureBlock | null | undefined,
  trustStore: TrustStore
): VerificationResult {
  // Guard against null/undefined signature block
  if (!signatureBlock) {
    return {
      isValid: false,
      fingerprint: '',
      auditMessage: '[AUDIT FAILURE] Missing signature block',
      exitCode: EX_DATAERR,
    };
  }

  const fingerprint = signatureBlock.public_key_fingerprint;
  const publicKeyPem = trustStore.getPublicKey(fingerprint);

  // Hard Fail-Closed: Unknown or revoked key fingerprint
  if (!publicKeyPem) {
    return {
      isValid: false,
      fingerprint,
      auditMessage: `[AUDIT FAILURE] Untrusted or revoked policy signature fingerprint: ${fingerprint}`,
      exitCode: EX_CONFIG,
    };
  }

  // Validate Base64 format of signature
  if (!isValidBase64(signatureBlock.signature)) {
    return {
      isValid: false,
      fingerprint,
      auditMessage: `[AUDIT FAILURE] Signature is not valid Base64 for fingerprint: ${fingerprint}`,
      exitCode: EX_DATAERR,
    };
  }

  try {
    const canonicalData = canonicalizePolicy(rawJson);

    // Verify using RSASSA-PSS with SHA-256
    // Node.js crypto.verify signature: (algorithm, data, key, signature)
    const isVerified = crypto.verify(
      'sha256',
      Buffer.from(canonicalData, 'utf8'),
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      },
      Buffer.from(signatureBlock.signature, 'base64')
    );

    if (!isVerified) {
      return {
        isValid: false,
        fingerprint,
        auditMessage: `[AUDIT FAILURE] Cryptographic signature mismatch for policy fingerprint: ${fingerprint}`,
        exitCode: EX_DATAERR,
      };
    }

    return {
      isValid: true,
      fingerprint,
      auditMessage: `[AUDIT SUCCESS] Policy successfully authenticated via fingerprint: ${fingerprint}`,
      exitCode: EX_OK,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      isValid: false,
      fingerprint,
      auditMessage: `[AUDIT CRITICAL] Execution failure during signature validation: ${message}`,
      exitCode: EX_CONFIG,
    };
  }
}
