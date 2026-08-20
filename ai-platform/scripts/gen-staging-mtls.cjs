"use strict";

/**
 * Staging mTLS orchestration key generator.
 *
 * Generates a dedicated staging root CA and per-node server/client
 * certificates with explicit EKU constraints (serverAuth / clientAuth).
 *
 * All output is written to ai-platform/staging/mtls/ which is blocked by
 * .gitignore and should never be committed.
 *
 * Usage:
 *   node scripts/gen-staging-mtls.cjs node-a node-b node-c
 *
 * Requirements:
 *   - OpenSSL 1.1.1+ in PATH
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const STAGING_DIR = path.join(__dirname, "..", "staging", "mtls");
const CA_DIR = path.join(STAGING_DIR, "ca");
const NODES_DIR = path.join(STAGING_DIR, "nodes");
const CONF = path.join(__dirname, "staging-mtls.cnf");

const DAYS = 30;
const KEY_SIZE = 4096;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function safeNodeId(nodeId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(nodeId)) {
    throw new Error(
      `Invalid nodeId "${nodeId}" — only a-z, A-Z, 0-9, _, - are allowed`,
    );
  }
}

function fileExists(file) {
  try {
    fs.accessSync(file);
    return true;
  } catch {
    return false;
  }
}

function genCA() {
  const key = path.join(CA_DIR, "ca.key");
  const cert = path.join(CA_DIR, "ca.crt");
  if (fileExists(cert) && fileExists(key)) {
    console.log(
      "Staging CA already exists; remove staging/mtls to regenerate.",
    );
    return;
  }
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      `rsa:${KEY_SIZE}`,
      "-keyout",
      key,
      "-out",
      cert,
      "-days",
      String(DAYS),
      "-nodes",
      "-config",
      CONF,
      "-extensions",
      "v3_ca",
    ],
    { stdio: "inherit", cwd: STAGING_DIR },
  );
}

function genNode(nodeId) {
  const nodeDir = path.join(NODES_DIR, nodeId);
  ensureDir(nodeDir);

  const base = path.join(nodeDir, nodeId);
  const serverKey = `${base}.key`;
  const serverCsr = `${base}.csr`;
  const serverCert = `${base}.crt`;
  const clientKey = `${base}-client.key`;
  const clientCsr = `${base}-client.csr`;
  const clientCert = `${base}-client.crt`;
  const bundle = `${base}.p12`;

  // Server certificate (EKU: serverAuth)
  execFileSync(
    "openssl",
    [
      "req",
      "-newkey",
      `rsa:${KEY_SIZE}`,
      "-keyout",
      serverKey,
      "-out",
      serverCsr,
      "-nodes",
      "-subj",
      `/O=SimpleBeacon Staging/OU=Cluster Keyring/CN=${nodeId}`,
      "-config",
      CONF,
      "-reqexts",
      "server_cert",
    ],
    { stdio: "inherit", cwd: STAGING_DIR },
  );

  execFileSync(
    "openssl",
    [
      "x509",
      "-req",
      "-in",
      serverCsr,
      "-CA",
      path.join(CA_DIR, "ca.crt"),
      "-CAkey",
      path.join(CA_DIR, "ca.key"),
      "-CAcreateserial",
      "-out",
      serverCert,
      "-days",
      String(DAYS),
      "-extfile",
      CONF,
      "-extensions",
      "server_cert",
    ],
    { stdio: "inherit", cwd: STAGING_DIR },
  );

  // Client certificate (EKU: clientAuth)
  execFileSync(
    "openssl",
    [
      "req",
      "-newkey",
      `rsa:${KEY_SIZE}`,
      "-keyout",
      clientKey,
      "-out",
      clientCsr,
      "-nodes",
      "-subj",
      `/O=SimpleBeacon Staging/OU=Cluster Keyring/CN=${nodeId}-client`,
      "-config",
      CONF,
      "-reqexts",
      "client_cert",
    ],
    { stdio: "inherit", cwd: STAGING_DIR },
  );

  execFileSync(
    "openssl",
    [
      "x509",
      "-req",
      "-in",
      clientCsr,
      "-CA",
      path.join(CA_DIR, "ca.crt"),
      "-CAkey",
      path.join(CA_DIR, "ca.key"),
      "-CAcreateserial",
      "-out",
      clientCert,
      "-days",
      String(DAYS),
      "-extfile",
      CONF,
      "-extensions",
      "client_cert",
    ],
    { stdio: "inherit", cwd: STAGING_DIR },
  );

  // PKCS#12 bundle (unencrypted private key, no passphrase)
  execFileSync(
    "openssl",
    [
      "pkcs12",
      "-export",
      "-inkey",
      serverKey,
      "-in",
      serverCert,
      "-certfile",
      path.join(CA_DIR, "ca.crt"),
      "-out",
      bundle,
      "-nodes",
      "-passout",
      "pass:",
    ],
    { stdio: "inherit", cwd: STAGING_DIR },
  );

  // Remove intermediate CSRs
  fs.unlinkSync(serverCsr);
  fs.unlinkSync(clientCsr);
}

function main() {
  const nodes = process.argv.slice(2);
  if (!nodes.length) {
    // eslint-disable-next-line no-console
    console.error(
      "Usage: node scripts/gen-staging-mtls.cjs <nodeId1> [nodeId2 ...]",
    );
    process.exit(1);
  }

  for (const nodeId of nodes) {
    safeNodeId(nodeId);
  }

  ensureDir(STAGING_DIR);
  ensureDir(CA_DIR);
  ensureDir(NODES_DIR);

  // eslint-disable-next-line no-console
  console.log("Generating staging root CA...");
  genCA();

  for (const nodeId of nodes) {
    // eslint-disable-next-line no-console
    console.log(`Generating node profile: ${nodeId}`);
    genNode(nodeId);
  }

  // eslint-disable-next-line no-console
  console.log(
    "Done. Assets written to ai-platform/staging/mtls/ (ignored by git).",
  );
}

main();
