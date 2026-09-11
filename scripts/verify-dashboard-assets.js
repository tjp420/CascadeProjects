#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Candidate asset output directories (check the common Vite output and legacy assets)
const candidates = [
  path.resolve(__dirname, '../ai-platform/web/simplebeacon-dashboard/dist/assets'),
  path.resolve(__dirname, '../ai-platform/web/simplebeacon-dashboard/assets'),
  path.resolve(__dirname, '../ai-platform/web/simplebeacon-dashboard/public/assets'),
];

const requiredAssets = ['scan-worker.js', 'scan-wasm-bridge.js'];

function print(msg) {
  process.stdout.write(msg + '\n');
}

print(`[*] Verifying dashboard worker assets (${requiredAssets.join(', ')})`);

let foundDir = null;
for (const dir of candidates) {
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    foundDir = dir;
    break;
  }
}

if (!foundDir) {
  print('[-] Build Integrity Failure: dashboard assets output folder not found. Expected one of:');
  for (const d of candidates) print(`   - ${d}`);
  process.exit(1);
}

print(`[+] Assets directory: ${foundDir}`);
const compiledFiles = fs.readdirSync(foundDir);
let integrityViolation = false;

for (const assetName of requiredAssets) {
  // accept exact file or hashed variations like scan-worker.[hash].js
  const regex = new RegExp(`^${assetName.replace('.', '\\.').replace(/\\\\/g, '\\.') .replace('\.', '\\.') .replace(/\./g, '\\.') .replace(/\-/g, '\\-')}|^${assetName.replace('.js', '')}(-[a-f0-9]{6,})?\\.js$`, 'i');
  const found = compiledFiles.some((f) => regex.test(f));
  if (found) {
    print(`[+] Asset Verified: ${assetName}`);
  } else {
    print(`[-] INTEGRITY CRASH: Missing asset -> ${assetName}`);
    integrityViolation = true;
  }
}

if (integrityViolation) {
  print('[-] RELEASE BLOCKED: Web worker compilation failures detected. Fix build configuration pipelines before deploying.');
  process.exit(1);
}

print('[+] Success: Build integrity checks passed.');
process.exit(0);
