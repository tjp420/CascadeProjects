"use strict";

/**
 * Unit tests for the edge compliance certificate signing module.
 *
 * These tests generate a real ECDSA P-256 keypair, mock the Cloudflare
 * Worker env with the private/public JWK, and verify that:
 *   1. Valid payloads are signed correctly
 *   2. Signatures can be verified with the public key
 *   3. Invalid payloads are rejected with appropriate errors
 *   4. The public key endpoint returns the JWK
 *   5. Missing keys produce 500/404 errors
 *   6. CORS headers are applied correctly
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  handleCertifyRequest,
  handlePublicKeyRequest,
} from "../src/certify.js";

// ── Generate a test ECDSA P-256 keypair once for all tests ───────────────

let testPrivateKeyJwk = null;
let testPublicKeyJwk = null;

before(async () => {
  const keypair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  testPrivateKeyJwk = await crypto.subtle.exportKey("jwk", keypair.privateKey);
  testPublicKeyJwk = await crypto.subtle.exportKey("jwk", keypair.publicKey);
});

// ── Helper: create a mock Request ────────────────────────────────────────

function mockRequest(method, body, origin) {
  const headers = { "Content-Type": "application/json" };
  if (origin) headers["Origin"] = origin;
  const init = { method, headers };
  if (body !== undefined && body !== null) {
    init.body = JSON.stringify(body);
  }
  return new Request("https://simplebeacon.ai/api/v1/certify", init);
}

function mockEnv(extra = {}) {
  return {
    SIGNING_PRIVATE_KEY: JSON.stringify(testPrivateKeyJwk),
    SIGNING_PUBLIC_KEY: JSON.stringify(testPublicKeyJwk),
    ...extra,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

test("POST /api/v1/certify signs a valid payload and returns a signature", async () => {
  const payload = {
    hash: "a".repeat(64),
    timestamp: Date.now(),
    metadata: { rule_violations: 5, ai_slop_metric: 0.82 },
  };
  const req = mockRequest("POST", payload);
  const env = mockEnv();
  const res = await handleCertifyRequest(req, env, "https://simplebeacon.ai");

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.algorithm, "ECDSA-P256-SHA256");
  assert.ok(body.signature, "should have a signature");
  assert.ok(body.signature.length > 0, "signature should not be empty");
  assert.equal(body.echo.hash, payload.hash);
  assert.equal(body.echo.timestamp, payload.timestamp);
  assert.ok(body.issuedAt, "should have an issuedAt timestamp");
});

test("signature can be verified with the public key", async () => {
  const payload = {
    hash: "b".repeat(64),
    timestamp: Date.now(),
    metadata: { rule_violations: 0 },
  };
  const req = mockRequest("POST", payload);
  const env = mockEnv();
  const res = await handleCertifyRequest(req, env, "https://simplebeacon.ai");
  const body = await res.json();

  // Verify the signature using the public key
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    testPublicKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );

  // Reconstruct the canonical message (must match the signing canonicalization)
  // Keys must be in sorted order: hash, metadata, timestamp
  const canonical = JSON.stringify({
    hash: payload.hash,
    metadata: payload.metadata,
    timestamp: payload.timestamp,
  });
  const messageBuffer = new TextEncoder().encode(canonical);

  // Convert hex signature back to ArrayBuffer
  const sigBytes = new Uint8Array(
    body.signature.match(/.{2}/g).map((h) => parseInt(h, 16)),
  );

  const isValid = await crypto.subtle.verify(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    publicKey,
    sigBytes,
    messageBuffer,
  );

  assert.equal(isValid, true, "signature should verify with the public key");
});

test("POST with missing hash returns 400", async () => {
  const payload = { timestamp: Date.now() };
  const req = mockRequest("POST", payload);
  const env = mockEnv();
  const res = await handleCertifyRequest(req, env, "https://simplebeacon.ai");

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /hash/);
});

test("POST with invalid hash format returns 400", async () => {
  const payload = { hash: "not-a-valid-hash", timestamp: Date.now() };
  const req = mockRequest("POST", payload);
  const env = mockEnv();
  const res = await handleCertifyRequest(req, env, "https://simplebeacon.ai");

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /hash/);
});

test("POST with missing timestamp returns 400", async () => {
  const payload = { hash: "c".repeat(64) };
  const req = mockRequest("POST", payload);
  const env = mockEnv();
  const res = await handleCertifyRequest(req, env, "https://simplebeacon.ai");

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /timestamp/);
});

test("POST with future timestamp beyond 5 min skew returns 400", async () => {
  const payload = {
    hash: "d".repeat(64),
    timestamp: Date.now() + 10 * 60 * 1000, // 10 min in the future
  };
  const req = mockRequest("POST", payload);
  const env = mockEnv();
  const res = await handleCertifyRequest(req, env, "https://simplebeacon.ai");

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /future/);
});

test("POST with stale timestamp beyond 1 hour returns 400", async () => {
  const payload = {
    hash: "e".repeat(64),
    timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
  };
  const req = mockRequest("POST", payload);
  const env = mockEnv();
  const res = await handleCertifyRequest(req, env, "https://simplebeacon.ai");

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /old|stale/);
});

test("POST with non-object metadata returns 400", async () => {
  const payload = {
    hash: "f".repeat(64),
    timestamp: Date.now(),
    metadata: "not-an-object",
  };
  const req = mockRequest("POST", payload);
  const env = mockEnv();
  const res = await handleCertifyRequest(req, env, "https://simplebeacon.ai");

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /metadata/);
});

test("GET request returns 405 Method Not Allowed", async () => {
  const req = mockRequest("GET", null);
  const env = mockEnv();
  const res = await handleCertifyRequest(req, env, "https://simplebeacon.ai");

  assert.equal(res.status, 405);
  const body = await res.json();
  assert.match(body.error, /Method/);
});

test("POST with invalid JSON body returns 400", async () => {
  const req = new Request("https://simplebeacon.ai/api/v1/certify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not valid json{",
  });
  const env = mockEnv();
  const res = await handleCertifyRequest(req, env, "https://simplebeacon.ai");

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /JSON/);
});

test("POST without SIGNING_PRIVATE_KEY returns 500", async () => {
  const payload = { hash: "1".repeat(64), timestamp: Date.now() };
  const req = mockRequest("POST", payload);
  const env = mockEnv({ SIGNING_PRIVATE_KEY: undefined });
  const res = await handleCertifyRequest(req, env, "https://simplebeacon.ai");

  assert.equal(res.status, 500);
  const body = await res.json();
  assert.match(body.error, /key/);
});

test("POST with malformed SIGNING_PRIVATE_KEY returns 500", async () => {
  const payload = { hash: "2".repeat(64), timestamp: Date.now() };
  const req = mockRequest("POST", payload);
  const env = mockEnv({ SIGNING_PRIVATE_KEY: "not-valid-jwk" });
  const res = await handleCertifyRequest(req, env, "https://simplebeacon.ai");

  assert.equal(res.status, 500);
});

test("CORS origin is applied to successful responses", async () => {
  const payload = { hash: "3".repeat(64), timestamp: Date.now() };
  const req = mockRequest("POST", payload, "https://simplebeacon.ai");
  const env = mockEnv();
  const res = await handleCertifyRequest(req, env, "https://simplebeacon.ai");

  assert.equal(
    res.headers.get("Access-Control-Allow-Origin"),
    "https://simplebeacon.ai",
  );
});

test("CORS origin is applied to error responses", async () => {
  const payload = { hash: "bad" };
  const req = mockRequest("POST", payload, "https://simplebeacon.ai");
  const env = mockEnv();
  const res = await handleCertifyRequest(req, env, "https://simplebeacon.ai");

  assert.equal(res.status, 400);
  assert.equal(
    res.headers.get("Access-Control-Allow-Origin"),
    "https://simplebeacon.ai",
  );
});

test("internal error details are not leaked to client", async () => {
  // Force an error by providing a JWK that will fail on importKey
  const payload = { hash: "4".repeat(64), timestamp: Date.now() };
  const req = mockRequest("POST", payload);
  const env = mockEnv({
    SIGNING_PRIVATE_KEY: JSON.stringify({
      kty: "EC",
      crv: "P-256",
      d: "invalid-base64url",
    }),
  });
  const res = await handleCertifyRequest(req, env, "https://simplebeacon.ai");

  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error, "Internal signing error");
  assert.equal(body.details, undefined, "should not leak error details");
});

// ── Public key endpoint tests ────────────────────────────────────────────

test("GET /api/v1/certify/public-key returns the JWK", async () => {
  const env = mockEnv();
  const res = await handlePublicKeyRequest(env, "https://simplebeacon.ai");

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.algorithm, "ECDSA-P256-SHA256");
  // keyId is now derived from the JWK thumbprint (RFC 7638), not hardcoded
  assert.ok(body.keyId, "should have a keyId");
  assert.match(
    body.keyId,
    /^sb-edge-[a-f0-9]{16}$/,
    "keyId should be sb-edge- + 16 hex chars",
  );
  assert.ok(body.publicKey, "should have a publicKey field");
  assert.equal(body.publicKey.kty, "EC");
  assert.equal(body.publicKey.crv, "P-256");
  assert.ok(body.publicKey.x, "should have x coordinate");
  assert.ok(body.publicKey.y, "should have y coordinate");
});

test("GET /api/v1/certify/public-key without key returns 404", async () => {
  const env = mockEnv({ SIGNING_PUBLIC_KEY: undefined });
  const res = await handlePublicKeyRequest(env, "https://simplebeacon.ai");

  assert.equal(res.status, 404);
  const body = await res.json();
  assert.match(body.error, /key/);
});

test("GET /api/v1/certify/public-key with malformed key returns 500", async () => {
  const env = mockEnv({ SIGNING_PUBLIC_KEY: "not-valid-json" });
  const res = await handlePublicKeyRequest(env, "https://simplebeacon.ai");

  assert.equal(res.status, 500);
  const body = await res.json();
  assert.match(body.error, /malformed/);
});

test("public key endpoint applies CORS headers", async () => {
  const env = mockEnv();
  const res = await handlePublicKeyRequest(env, "https://simplebeacon.ai");
  assert.equal(
    res.headers.get("Access-Control-Allow-Origin"),
    "https://simplebeacon.ai",
  );
});

// ── Tamper detection test ────────────────────────────────────────────────

test("signature fails verification if payload is tampered", async () => {
  const payload = {
    hash: "5".repeat(64),
    timestamp: Date.now(),
    metadata: { rule_violations: 3 },
  };
  const req = mockRequest("POST", payload);
  const env = mockEnv();
  const res = await handleCertifyRequest(req, env, "https://simplebeacon.ai");
  const body = await res.json();

  // Try to verify against a tampered payload
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    testPublicKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );

  // Tampered: changed metadata
  const tamperedCanonical = JSON.stringify({
    hash: payload.hash,
    metadata: { rule_violations: 999 },
    timestamp: payload.timestamp,
  });
  const tamperedBuffer = new TextEncoder().encode(tamperedCanonical);
  const sigBytes = new Uint8Array(
    body.signature.match(/.{2}/g).map((h) => parseInt(h, 16)),
  );

  const isValid = await crypto.subtle.verify(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    publicKey,
    sigBytes,
    tamperedBuffer,
  );

  assert.equal(isValid, false, "tampered payload should fail verification");
});
