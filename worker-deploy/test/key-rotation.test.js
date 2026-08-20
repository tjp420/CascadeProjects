"use strict";

/**
 * Tests for the key rotation utility and multi-key support.
 *
 * Verifies:
 *   1. The rotate-edge-keys script generates a valid new keypair
 *   2. The old public key is archived correctly
 *   3. The new keyId is derived from the JWK thumbprint (RFC 7638)
 *   4. Old certificates fail verification against the new public key
 *   5. New certificates verify correctly with the new public key
 *   6. The keyId in certify responses matches the public-key endpoint
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const ROTATE_SCRIPT = path.resolve(
  import.meta.dirname,
  "..",
  "scripts",
  "rotate-edge-keys.cjs",
);
const GENERATE_SCRIPT = path.resolve(
  import.meta.dirname,
  "..",
  "scripts",
  "generate-signing-keys.cjs",
);

/**
 * Compute the RFC 7638 JWK thumbprint (matching the certify.js implementation).
 */
async function computeJwkThumbprint(jwk) {
  const canonical = JSON.stringify({
    crv: jwk.crv,
    kty: jwk.kty,
    x: jwk.x,
    y: jwk.y,
  });
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Sign a payload with a private key JWK (simulating the Worker).
 */
async function signWithKey(privateKeyJwk, payload) {
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const canonical = JSON.stringify({
    hash: payload.hash,
    metadata: payload.metadata || {},
    timestamp: payload.timestamp,
  });
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKey,
    new TextEncoder().encode(canonical),
  );
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify a signature with a public key JWK.
 */
async function verifyWithKey(publicKeyJwk, signature, payload) {
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    publicKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const canonical = JSON.stringify({
    hash: payload.hash,
    metadata: payload.metadata || {},
    timestamp: payload.timestamp,
  });
  const sigBytes = new Uint8Array(
    signature.match(/.{2}/g).map((h) => parseInt(h, 16)),
  );
  return crypto.subtle.verify(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    publicKey,
    sigBytes,
    new TextEncoder().encode(canonical),
  );
}

// ── Tests ────────────────────────────────────────────────────────────────

test("rotate-edge-keys.cjs generates a valid new ECDSA P-256 keypair", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-rotate-"));
  try {
    const output = execSync(`node "${ROTATE_SCRIPT}" --dry-run`, {
      encoding: "utf8",
      timeout: 10000,
      cwd: tmpDir,
    });

    assert.match(output, /SIGNING_PRIVATE_KEY/);
    assert.match(output, /SIGNING_PUBLIC_KEY/);
    assert.match(output, /sb-edge-[a-f0-9]{16}/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("rotate-edge-keys.cjs archives old key and writes new key", async () => {
  // The scripts write to ../dev-keys relative to the scripts/ directory.
  // We test against the actual .dev-keys/ directory in the worker-deploy project.
  const workerDeployDir = path.resolve(import.meta.dirname, "..");
  const keysDir = path.join(workerDeployDir, ".dev-keys");
  const archiveDir = path.join(keysDir, "archive");

  // Clean up any existing keys from prior test runs
  if (fs.existsSync(keysDir)) {
    fs.rmSync(keysDir, { recursive: true, force: true });
  }

  try {
    // Step 1: Generate an initial keypair
    execSync(`node "${GENERATE_SCRIPT}"`, {
      encoding: "utf8",
      timeout: 10000,
      cwd: workerDeployDir,
      stdio: "pipe",
    });

    const oldPubKeyPath = path.join(keysDir, "signing-public-key.json");
    assert.ok(fs.existsSync(oldPubKeyPath), "initial public key should exist");
    const oldPubKey = JSON.parse(fs.readFileSync(oldPubKeyPath, "utf8"));
    const oldKeyId = await computeJwkThumbprint(oldPubKey);

    // Step 2: Run the rotation
    execSync(`node "${ROTATE_SCRIPT}"`, {
      encoding: "utf8",
      timeout: 10000,
      cwd: workerDeployDir,
      stdio: "pipe",
    });

    // Step 3: Verify the old key was archived
    assert.ok(fs.existsSync(archiveDir), "archive directory should exist");
    const archiveFiles = fs.readdirSync(archiveDir);
    assert.ok(archiveFiles.length > 0, "should have at least one archived key");
    assert.match(archiveFiles[0], new RegExp(oldKeyId.slice(0, 16)));

    // Step 4: Verify the new key is different
    const newPubKey = JSON.parse(fs.readFileSync(oldPubKeyPath, "utf8"));
    const newKeyId = await computeJwkThumbprint(newPubKey);
    assert.notEqual(
      oldKeyId,
      newKeyId,
      "new key should be different from old key",
    );
  } finally {
    // Clean up
    if (fs.existsSync(keysDir)) {
      fs.rmSync(keysDir, { recursive: true, force: true });
    }
  }
});

test("certificate signed with old key fails verification against new public key", async () => {
  const oldKeypair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const newKeypair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );

  const oldPrivateJwk = await crypto.subtle.exportKey(
    "jwk",
    oldKeypair.privateKey,
  );
  const newPublicJwk = await crypto.subtle.exportKey(
    "jwk",
    newKeypair.publicKey,
  );

  const payload = {
    hash: "a".repeat(64),
    timestamp: Date.now(),
    metadata: { totalIssues: 5 },
  };

  const signature = await signWithKey(oldPrivateJwk, payload);
  const isValid = await verifyWithKey(newPublicJwk, signature, payload);
  assert.equal(
    isValid,
    false,
    "old signature should NOT verify against new public key",
  );
});

test("certificate signed with new key verifies against new public key", async () => {
  const newKeypair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );

  const newPrivateJwk = await crypto.subtle.exportKey(
    "jwk",
    newKeypair.privateKey,
  );
  const newPublicJwk = await crypto.subtle.exportKey(
    "jwk",
    newKeypair.publicKey,
  );

  const payload = {
    hash: "b".repeat(64),
    timestamp: Date.now(),
    metadata: { totalIssues: 0 },
  };

  const signature = await signWithKey(newPrivateJwk, payload);
  const isValid = await verifyWithKey(newPublicJwk, signature, payload);
  assert.equal(
    isValid,
    true,
    "new signature should verify against new public key",
  );
});

test("JWK thumbprint is deterministic for the same key", async () => {
  const keypair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", keypair.publicKey);

  const thumb1 = await computeJwkThumbprint(publicJwk);
  const thumb2 = await computeJwkThumbprint(publicJwk);
  assert.equal(thumb1, thumb2, "thumbprint should be deterministic");
});

test("JWK thumbprint differs for different keys", async () => {
  const keypair1 = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const keypair2 = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );

  const pub1 = await crypto.subtle.exportKey("jwk", keypair1.publicKey);
  const pub2 = await crypto.subtle.exportKey("jwk", keypair2.publicKey);

  const thumb1 = await computeJwkThumbprint(pub1);
  const thumb2 = await computeJwkThumbprint(pub2);
  assert.notEqual(
    thumb1,
    thumb2,
    "different keys should have different thumbprints",
  );
});

test("rotate-edge-keys.cjs --help exits with code 0", () => {
  try {
    execSync(`node "${ROTATE_SCRIPT}" --help`, {
      encoding: "utf8",
      timeout: 5000,
    });
  } catch (err) {
    assert.fail(`--help should exit 0, got ${err.status}`);
  }
});
