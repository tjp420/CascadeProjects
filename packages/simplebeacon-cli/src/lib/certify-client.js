"use strict";

/**
 * CLI client for the edge compliance certificate signing endpoint.
 *
 * Workflow:
 *   1. Read a scan report JSON file
 *   2. Compute SHA-256 hash of the report
 *   3. Extract anonymized metadata (aggregate counts only — no source code)
 *   4. POST { hash, timestamp, metadata } to /api/v1/certify
 *   5. Receive the ECDSA signature
 *   6. Write a .sbcert proof token file alongside the report
 *
 * Privacy guarantee: Only the SHA-256 hash and aggregate metadata leave the
 * machine. The full scan report never leaves the client. The hash anchors
 * the report snapshot — any tampering with the report invalidates the
 * certificate.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_CERTIFY_URL = "https://simplebeacon.ai/api/v1/certify";
const DEFAULT_PUBLIC_KEY_URL =
  "https://simplebeacon.ai/api/v1/certify/public-key";

/**
 * Compute the SHA-256 hash of a file's contents.
 * @param {string} filePath - Absolute path to the file
 * @returns {string} Hex-encoded SHA-256 digest
 */
function computeFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Compute the SHA-256 hash of a string.
 * @param {string} content - String to hash
 * @returns {string} Hex-encoded SHA-256 digest
 */
function computeStringHash(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Extract anonymized metadata from a scan report.
 * Only aggregate counts and scores are extracted — no file paths, source
 * code snippets, or other identifying information.
 * @param {Object} report - Parsed scan report
 * @returns {Object} Anonymized metadata object
 */
function extractAnonymizedMetadata(report) {
  const metadata = {};

  // Aggregate issue counts by severity
  if (report.summary) {
    metadata.criticalCount = report.summary.critical || 0;
    metadata.highCount = report.summary.high || 0;
    metadata.mediumCount = report.summary.medium || 0;
    metadata.lowCount = report.summary.low || 0;
    metadata.totalIssues = report.summary.totalIssues || 0;
  }

  // Quality score (if present)
  if (typeof report.qualityScore === "number") {
    metadata.qualityScore = report.qualityScore;
  }

  // Gate status
  if (report.gate) {
    metadata.gatePassed = Boolean(report.gate.pass);
    metadata.gateBlockingIssues = (report.gate.blockingIssues || []).length;
    metadata.gateWarningIssues = (report.gate.warningIssues || []).length;
  }

  // File counts
  if (typeof report.totalFiles === "number") {
    metadata.totalFiles = report.totalFiles;
  }

  // Rule engine counts (anonymized — just the counts, not the paths)
  if (report.engines) {
    metadata.engineCount = Object.keys(report.engines).length;
    metadata.engineSummary = {};
    for (const [name, data] of Object.entries(report.engines)) {
      metadata.engineSummary[name] = {
        findings: Array.isArray(data.findings) ? data.findings.length : 0,
        status: data.status || "unknown",
      };
    }
  }

  return metadata;
}

/**
 * Build the certification request payload from a scan report.
 * @param {Object} report - Parsed scan report
 * @param {string} [reportHash] - Pre-computed hash (if not provided, computed from JSON)
 * @returns {{ hash: string, timestamp: number, metadata: Object }}
 */
function buildCertifyPayload(report, reportHash) {
  const hash = reportHash || computeStringHash(JSON.stringify(report));
  const timestamp = Date.now();
  const metadata = extractAnonymizedMetadata(report);
  return { hash, timestamp, metadata };
}

/**
 * Send the certification request to the edge endpoint.
 * Uses http/https modules in Node (to avoid conflicts with the trust-guard
 * network guard's fetch patching) and fetch in browser environments.
 * @param {Object} payload - { hash, timestamp, metadata }
 * @param {string} [certifyUrl] - Override the default endpoint URL
 * @returns {Promise<Object>} The signed certificate response
 */
async function requestCertificate(payload, certifyUrl) {
  const url = certifyUrl || DEFAULT_CERTIFY_URL;

  // In Node.js, use http/https modules directly to avoid conflicts with
  // the trust-guard network guard which patches globalThis.fetch in a way
  // that can hang Node's native undici-based fetch implementation.
  if (
    typeof process !== "undefined" &&
    process.versions &&
    process.versions.node
  ) {
    return requestCertificateViaHttp(payload, url);
  }

  // Browser environment — use fetch
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage;
    try {
      const parsed = JSON.parse(errorBody);
      errorMessage = parsed.error || `HTTP ${response.status}`;
    } catch {
      errorMessage = `HTTP ${response.status}: ${errorBody.slice(0, 200)}`;
    }
    throw new Error(`Certificate request failed: ${errorMessage}`);
  }

  return response.json();
}

/**
 * Node.js implementation using http/https modules.
 * @param {Object} payload - Request payload
 * @param {string} url - Endpoint URL
 * @returns {Promise<Object>}
 */
function requestCertificateViaHttp(payload, url) {
  const parsedUrl = new URL(url);
  const isHttps = parsedUrl.protocol === "https:";
  const transport = isHttps ? require("https") : require("http");

  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = transport.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let errorMessage;
          try {
            const parsed = JSON.parse(raw);
            errorMessage = parsed.error || `HTTP ${res.statusCode}`;
          } catch {
            errorMessage = `HTTP ${res.statusCode}: ${raw.slice(0, 200)}`;
          }
          reject(new Error(`Certificate request failed: ${errorMessage}`));
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          reject(new Error(`Certificate response parse error: ${err.message}`));
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`Certificate request network error: ${err.message}`));
    });

    req.write(body);
    req.end();
  });
}

/**
 * Write a .sbcert proof token file.
 * Contains the signature, metadata echo, and verification info.
 * @param {string} outputPath - Path to write the .sbcert file
 * @param {Object} payload - The original request payload
 * @param {Object} certResponse - The response from the certify endpoint
 * @param {string} [reportPath] - Path to the original report file (for reference)
 */
function writeSbCertFile(outputPath, payload, certResponse, reportPath) {
  const certFile = {
    version: 1,
    algorithm: certResponse.algorithm,
    signature: certResponse.signature,
    issuedAt: certResponse.issuedAt,
    payload: {
      hash: payload.hash,
      timestamp: payload.timestamp,
      metadata: payload.metadata,
    },
    verification: {
      url: DEFAULT_PUBLIC_KEY_URL,
      keyId: certResponse.keyId || "unknown",
    },
    reportFile: reportPath ? path.basename(reportPath) : null,
  };

  fs.writeFileSync(outputPath, JSON.stringify(certFile, null, 2), "utf8");
  return outputPath;
}

/**
 * Full certification workflow: hash report, request signature, write .sbcert file.
 * @param {string} reportPath - Path to the scan report JSON file
 * @param {Object} [options] - Optional settings
 * @param {string} [options.certifyUrl] - Override the certify endpoint URL
 * @param {string} [options.outputPath] - Override the .sbcert output path
 * @returns {Promise<{ certPath: string, hash: string, signature: string }>}
 */
async function certifyReport(reportPath, options = {}) {
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Report file not found: ${reportPath}`);
  }

  const reportContent = fs.readFileSync(reportPath, "utf8");
  const report = JSON.parse(reportContent);
  const reportHash = computeStringHash(reportContent);

  const payload = buildCertifyPayload(report, reportHash);
  const certResponse = await requestCertificate(payload, options.certifyUrl);

  const certPath =
    options.outputPath || reportPath.replace(/\.json$/i, ".sbcert");
  writeSbCertFile(certPath, payload, certResponse, reportPath);

  return {
    certPath,
    hash: payload.hash,
    signature: certResponse.signature,
    issuedAt: certResponse.issuedAt,
  };
}

/**
 * Verify a .sbcert file against the original report.
 * Fetches the public key from the edge endpoint and checks the signature.
 * @param {string} certPath - Path to the .sbcert file
 * @param {string} reportPath - Path to the original report file
 * @param {string} [publicKeyUrl] - Override the public key endpoint URL
 * @returns {Promise<{ valid: boolean, reason?: string }>}
 */
async function verifyCertificate(certPath, reportPath, publicKeyUrl) {
  if (!fs.existsSync(certPath)) {
    return { valid: false, reason: "Certificate file not found" };
  }
  if (!fs.existsSync(reportPath)) {
    return { valid: false, reason: "Report file not found" };
  }

  const certFile = JSON.parse(fs.readFileSync(certPath, "utf8"));
  const reportContent = fs.readFileSync(reportPath, "utf8");
  const reportHash = computeStringHash(reportContent);

  // Check that the hash in the cert matches the current report
  if (certFile.payload.hash !== reportHash) {
    return {
      valid: false,
      reason:
        "Report hash mismatch — report has been modified since certification",
    };
  }

  // Fetch the public key (use http/https in Node, fetch in browser)
  const url = publicKeyUrl || DEFAULT_PUBLIC_KEY_URL;
  let keyData;
  if (
    typeof process !== "undefined" &&
    process.versions &&
    process.versions.node
  ) {
    keyData = await fetchPublicKeyViaHttp(url);
  } else {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        valid: false,
        reason: `Failed to fetch public key: HTTP ${response.status}`,
      };
    }
    keyData = await response.json();
  }
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    keyData.publicKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );

  // Reconstruct the canonical message (must match signing canonicalization)
  const canonical = JSON.stringify({
    hash: certFile.payload.hash,
    metadata: certFile.payload.metadata,
    timestamp: certFile.payload.timestamp,
  });
  const messageBuffer = new TextEncoder().encode(canonical);

  // Convert hex signature to bytes
  const sigBytes = new Uint8Array(
    certFile.signature.match(/.{2}/g).map((h) => parseInt(h, 16)),
  );

  const isValid = await crypto.subtle.verify(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    publicKey,
    sigBytes,
    messageBuffer,
  );

  return { valid: isValid };
}

/**
 * Node.js implementation for fetching the public key via http/https.
 * @param {string} url - Public key endpoint URL
 * @returns {Promise<Object>}
 */
function fetchPublicKeyViaHttp(url) {
  const parsedUrl = new URL(url);
  const isHttps = parsedUrl.protocol === "https:";
  const transport = isHttps ? require("https") : require("http");

  return new Promise((resolve, reject) => {
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      headers: { Accept: "application/json" },
    };

    const req = transport.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(
            new Error(`Failed to fetch public key: HTTP ${res.statusCode}`),
          );
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          reject(new Error(`Public key response parse error: ${err.message}`));
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`Public key fetch network error: ${err.message}`));
    });

    req.end();
  });
}

module.exports = {
  computeFileHash,
  computeStringHash,
  extractAnonymizedMetadata,
  buildCertifyPayload,
  requestCertificate,
  writeSbCertFile,
  certifyReport,
  verifyCertificate,
  DEFAULT_CERTIFY_URL,
  DEFAULT_PUBLIC_KEY_URL,
};
