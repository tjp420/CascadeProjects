#!/usr/bin/env node
'use strict';

/**
 * Publish the current Simplebeacon trust verification snapshot.
 * Writes public/trust-verification.json and appends to .simplebeacon/trust-history.json.
 */

const path = require('path');
const { publishTrustVerification } = require('../server/lib/trust-verification-payload.cjs');

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    platformRoot: process.cwd(),
    monorepoRoot: process.env.MONOREPO_ROOT || path.resolve(process.cwd(), '..'),
    publicDir: process.env.TRUST_PUBLIC_DIR || undefined,
    source: 'trust:publish',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--platform-root' && args[i + 1]) {
      options.platformRoot = path.resolve(args[i + 1]);
      i++;
    } else if (arg === '--monorepo-root' && args[i + 1]) {
      options.monorepoRoot = path.resolve(args[i + 1]);
      i++;
    } else if (arg === '--public-dir' && args[i + 1]) {
      options.publicDir = path.resolve(args[i + 1]);
      i++;
    }
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv);

  try {
    const result = publishTrustVerification(options);
    // simplebeacon-ignore console-log — CLI tool output
    console.log(`[trust:publish] Wrote ${result.publishPath}`);
    // simplebeacon-ignore console-log — CLI tool output
    console.log(`[trust:publish] verificationId ${result.payload.verificationId}`);
    // simplebeacon-ignore console-log — CLI tool output
    console.log(`[trust:publish] gate ${result.payload.headline?.gatePass ? 'PASS' : 'REVIEW'}`);
    // simplebeacon-ignore console-log — CLI tool output
    console.log(`[trust:publish] publishedAt ${result.generatedAt}`);
    // simplebeacon-ignore console-log — CLI tool output
    console.log(
      `[trust:publish] history ${result.history.historyPath} (${result.history.count} entries)`
    );
  } catch (error) {
    // simplebeacon-ignore console-log — CLI tool error output
    console.error('[trust:publish] Failed:', error.message);
    process.exit(1);
  }
}

main();
