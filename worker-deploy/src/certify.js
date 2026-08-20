"use strict";

/**
 * Edge-native compliance certificate signing module.
 *
 * Handles POST /api/v1/certify — receives an anonymized scan metadata payload
 * + SHA-256 hash from a local CLI scan, signs it with an ECDSA P-256 private key
 * stored in Cloudflare Secrets, and returns a tamper-evident signature.
 *
 * Handles GET /api/v1/certify/public-key — returns the public key JWK for
 * third-party verification of issued certificates.
 *
 * Privacy guarantee: This module never receives or processes source code.
 * The client sends only aggregate counts and a hash. The private key never
 * leaves the Worker isolate — it is imported into WebCrypto, used to sign,
 * and discarded within a single request cycle.
 */

/**
 * JSON response helper with CORS support.
 * @param {*} data - Payload to serialize
 * @param {number} status - HTTP status code
 * @param {string} [corsOrigin] - Allowed origin for CORS
 * @returns {Response}
 */
function jsonResponse(data, status, corsOrigin) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  if (corsOrigin) {
    headers["Access-Control-Allow-Origin"] = corsOrigin;
    headers["Vary"] = "Origin";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

/**
 * Validate the incoming certification payload.
 * @param {Object} body - Parsed JSON body
 * @returns {{valid: boolean, error?: string, hash?: string, timestamp?: number, metadata?: Object}}
 */
function validatePayload(body) {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const { hash, timestamp, metadata } = body;

  if (!hash || typeof hash !== "string") {
    return {
      valid: false,
      error: 'Missing or invalid "hash" field — expected a SHA-256 hex string',
    };
  }

  // SHA-256 hex is 64 chars. Also allow 128-char SHA-512 for future compat.
  if (!/^[a-f0-9]{64}$/i.test(hash) && !/^[a-f0-9]{128}$/i.test(hash)) {
    return {
      valid: false,
      error:
        "Invalid hash format — expected 64-char SHA-256 or 128-char SHA-512 hex string",
    };
  }

  if (
    !timestamp ||
    typeof timestamp !== "number" ||
    !Number.isFinite(timestamp)
  ) {
    return {
      valid: false,
      error:
        'Missing or invalid "timestamp" field — expected a Unix epoch number',
    };
  }

  // Reject timestamps more than 5 minutes in the future or 1 hour in the past
  const now = Date.now();
  const skew = Math.abs(now - timestamp);
  if (timestamp > now + 5 * 60 * 1000) {
    return {
      valid: false,
      error: "Timestamp is too far in the future (max 5 min skew allowed)",
    };
  }
  if (timestamp < now - 60 * 60 * 1000) {
    return {
      valid: false,
      error: "Timestamp is too old (max 1 hour staleness allowed)",
    };
  }

  // Metadata is optional but must be an object if present
  if (
    metadata !== undefined &&
    (typeof metadata !== "object" ||
      metadata === null ||
      Array.isArray(metadata))
  ) {
    return {
      valid: false,
      error: 'Invalid "metadata" field — expected a JSON object',
    };
  }

  return { valid: true, hash, timestamp, metadata: metadata || {} };
}

/**
 * Convert a Uint8Array to a hex string.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Create a canonical, deterministic JSON string for signing.
 * Top-level keys are sorted alphabetically to ensure the same payload always
 * produces the same signature. Nested objects are serialized normally (the
 * replacer-array approach would strip nested keys not in the array).
 * @param {string} hash - SHA-256 hash from the client
 * @param {number} timestamp - Unix epoch from the client
 * @param {Object} metadata - Anonymized scan metadata
 * @returns {string}
 */
function canonicalizePayload(hash, timestamp, metadata) {
  // Build object with keys in sorted order: hash, metadata, timestamp
  const sorted = {};
  sorted.hash = hash;
  sorted.metadata = metadata;
  sorted.timestamp = timestamp;
  return JSON.stringify(sorted);
}

/**
 * Handle POST /api/v1/certify — sign an anonymized scan payload.
 *
 * @param {Request} request - Incoming HTTP request
 * @param {Object} env - Worker environment bindings (expects SIGNING_PRIVATE_KEY)
 * @param {string} [corsOrigin] - CORS origin from the parent router
 * @returns {Promise<Response>}
 */
export async function handleCertifyRequest(request, env, corsOrigin) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405, corsOrigin);
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400, corsOrigin);
    }

    const validation = validatePayload(body);
    if (!validation.valid) {
      return jsonResponse({ error: validation.error }, 400, corsOrigin);
    }

    const privateKeyJwkStr = env.SIGNING_PRIVATE_KEY;
    if (!privateKeyJwkStr) {
      return jsonResponse(
        { error: "Edge signing key not configured" },
        500,
        corsOrigin,
      );
    }

    // Parse the JWK private key string
    let privateKeyJwk;
    try {
      privateKeyJwk =
        typeof privateKeyJwkStr === "string"
          ? JSON.parse(privateKeyJwkStr)
          : privateKeyJwkStr;
    } catch {
      return jsonResponse(
        { error: "Edge signing key is malformed" },
        500,
        corsOrigin,
      );
    }

    // Import the key into WebCrypto for this request cycle only.
    // extractable=true so we can export the public components for key ID derivation.
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      privateKeyJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign"],
    );

    // Build the canonical message and sign it
    const canonicalMessage = canonicalizePayload(
      validation.hash,
      validation.timestamp,
      validation.metadata,
    );
    const messageBuffer = new TextEncoder().encode(canonicalMessage);

    const signatureBuffer = await crypto.subtle.sign(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      privateKey,
      messageBuffer,
    );

    const signatureHex = bytesToHex(new Uint8Array(signatureBuffer));

    // Derive the key ID from the public key counterpart for traceability.
    // ECDSA private keys in WebCrypto can be exported as JWK (which includes x, y, d).
    // We extract the public components (x, y) to compute the thumbprint.
    let keyId = "unknown";
    try {
      const exportedJwk = await crypto.subtle.exportKey("jwk", privateKey);
      const publicJwk = {
        kty: exportedJwk.kty,
        crv: exportedJwk.crv,
        x: exportedJwk.x,
        y: exportedJwk.y,
      };
      keyId = "sb-edge-" + (await computeJwkThumbprint(publicJwk)).slice(0, 16);
    } catch {
      // If key ID derivation fails, the signature is still valid
    }

    return jsonResponse(
      {
        success: true,
        signature: signatureHex,
        algorithm: "ECDSA-P256-SHA256",
        keyId,
        issuedAt: new Date().toISOString(),
        echo: {
          hash: validation.hash,
          timestamp: validation.timestamp,
        },
      },
      200,
      corsOrigin,
    );
  } catch (error) {
    // Never leak stack traces or internal details to the client
    return jsonResponse({ error: "Internal signing error" }, 500, corsOrigin);
  }
}

/**
 * Compute the RFC 7638 JWK thumbprint of a public key.
 * This provides a deterministic, unique key ID derived from the key material itself.
 * @param {Object} jwk - The public JWK (must have kty, crv, x, y)
 * @returns {Promise<string>} Hex-encoded SHA-256 thumbprint
 */
async function computeJwkThumbprint(jwk) {
  // RFC 7638: canonical JSON with keys in lexicographic order
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
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Handle GET /api/v1/certify/public-key — return the public key for verification.
 *
 * @param {Object} env - Worker environment bindings (expects SIGNING_PUBLIC_KEY)
 * @param {string} [corsOrigin] - CORS origin from the parent router
 * @returns {Promise<Response>}
 */
export async function handlePublicKeyRequest(env, corsOrigin) {
  const publicKeyJwkStr = env.SIGNING_PUBLIC_KEY;
  if (!publicKeyJwkStr) {
    return jsonResponse(
      { error: "Public key not configured" },
      404,
      corsOrigin,
    );
  }

  try {
    // Return the JWK as-is (it's already a JSON object/string)
    const jwk =
      typeof publicKeyJwkStr === "string"
        ? JSON.parse(publicKeyJwkStr)
        : publicKeyJwkStr;

    // Derive a deterministic key ID from the JWK thumbprint (RFC 7638)
    const keyId = await computeJwkThumbprint(jwk);

    return jsonResponse(
      {
        keyId: "sb-edge-" + keyId.slice(0, 16),
        algorithm: "ECDSA-P256-SHA256",
        publicKey: jwk,
      },
      200,
      corsOrigin,
    );
  } catch {
    return jsonResponse({ error: "Public key is malformed" }, 500, corsOrigin);
  }
}
