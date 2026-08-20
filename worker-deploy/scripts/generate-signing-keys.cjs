#!/usr/bin/env node
"use strict";

/**
 * Key-generation utility for the edge compliance certificate signing system.
 *
 * Generates an ECDSA P-256 keypair and outputs:
 *   1. The private key JWK as a wrangler secret command
 *   2. The public key JWK as a wrangler secret command
 *   3. A local .dev-keys/ directory with both keys for testing
 *
 * Usage:
 *   node worker-deploy/scripts/generate-signing-keys.js
 *   node worker-deploy/scripts/generate-signing-keys.js --worker simplebeacon-dashboard-v2
 *   node worker-deploy/scripts/generate-signing-keys.js --dry-run
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = { worker: "simplebeacon-dashboard-v2", dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--worker") {
      args.worker = argv[++i];
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node generate-signing-keys.js [--worker <name>] [--dry-run]",
      );
      console.log("");
      console.log(
        "Generates an ECDSA P-256 keypair for compliance certificate signing.",
      );
      console.log("");
      console.log("Options:");
      console.log(
        "  --worker <name>  Cloudflare Worker name (default: simplebeacon-dashboard-v2)",
      );
      console.log("  --dry-run        Print commands without executing");
      process.exit(0);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  console.log(
    "Generating ECDSA P-256 keypair for edge compliance signing...\n",
  );

  // Generate the keypair
  const keypair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );

  const privateKeyJwk = await crypto.subtle.exportKey(
    "jwk",
    keypair.privateKey,
  );
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", keypair.publicKey);

  const privateKeyJson = JSON.stringify(privateKeyJwk);
  const publicKeyJson = JSON.stringify(publicKeyJwk);

  // Write to .dev-keys/ for local testing (gitignored)
  if (!args.dryRun) {
    const keysDir = path.join(__dirname, "..", ".dev-keys");
    fs.mkdirSync(keysDir, { recursive: true });
    fs.writeFileSync(
      path.join(keysDir, "signing-private-key.json"),
      privateKeyJson,
      "utf8",
    );
    fs.writeFileSync(
      path.join(keysDir, "signing-public-key.json"),
      publicKeyJson,
      "utf8",
    );

    // Write .gitignore to ensure keys are never committed
    const gitignorePath = path.join(keysDir, ".gitignore");
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, "*\n!.gitignore\n", "utf8");
    }

    console.log(`✓ Keys written to ${path.relative(process.cwd(), keysDir)}/`);
    console.log("  (This directory is gitignored — never commit these keys)\n");
  }

  // Output the wrangler secret commands
  console.log(
    "── Cloudflare Secrets Setup Commands ──────────────────────────",
  );
  console.log("");
  console.log(
    "Run these commands to inject the keys into your Cloudflare Worker:",
  );
  console.log("");
  console.log(`# Set the private signing key (used by /api/v1/certify)`);
  console.log(
    `echo '${privateKeyJson}' | npx wrangler secret put SIGNING_PRIVATE_KEY --name ${args.worker}`,
  );
  console.log("");
  console.log(
    `# Set the public verification key (used by /api/v1/certify/public-key)`,
  );
  console.log(
    `echo '${publicKeyJson}' | npx wrangler secret put SIGNING_PUBLIC_KEY --name ${args.worker}`,
  );
  console.log("");
  console.log("── Key Details ───────────────────────────────────────────────");
  console.log(`  Algorithm:  ECDSA P-256`);
  // Compute the JWK thumbprint for the key ID
  const thumbprintCanonical = JSON.stringify({
    crv: publicKeyJwk.crv,
    kty: publicKeyJwk.kty,
    x: publicKeyJwk.x,
    y: publicKeyJwk.y,
  });
  const thumbprintHash = crypto
    .createHash("sha256")
    .update(thumbprintCanonical, "utf8")
    .digest("hex");
  console.log(`  Key ID:     sb-edge-${thumbprintHash.slice(0, 16)}`);
  console.log(
    `  Private key: ${privateKeyJwk.d.slice(0, 8)}...${privateKeyJwk.d.slice(-8)} (${privateKeyJwk.d.length} chars)`,
  );
  console.log(
    `  Public key:  x=${publicKeyJwk.x.slice(0, 8)}... y=${publicKeyJwk.y.slice(0, 8)}...`,
  );
  console.log("");
  console.log("⚠  IMPORTANT: Never commit the private key to your repository.");
  console.log(
    "   The .dev-keys/ directory is gitignored. Use wrangler secret put",
  );
  console.log(
    "   to inject keys directly into the Worker runtime environment.",
  );
}

main().catch((err) => {
  console.error("Key generation failed:", err.message);
  process.exit(1);
});
