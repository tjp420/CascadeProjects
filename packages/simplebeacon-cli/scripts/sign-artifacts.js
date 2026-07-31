#!/usr/bin/env node
'use strict';

/**
 * GPG Detached Signature Generator for SimpleBeacon Release Artifacts
 *
 * Signs package tarballs (.tgz), VSIX files (.vsix), and zip archives (.zip)
 * with a detached GPG signature. Designed for CI/CD pipeline integration.
 *
 * Usage:
 *   node scripts/sign-artifacts.js <file1> [file2] [file3] ...
 *
 * Environment variables:
 *   GPG_PRIVATE_KEY      — Base64-encoded GPG private key (ASCII armored)
 *   GPG_PASSPHRASE       — Passphrase for the GPG private key
 *   GPG_KEY_ID           — Key ID or fingerprint (optional, auto-detected)
 *
 * Output:
 *   For each input file, produces <file>.sig (detached binary signature)
 *   and prints a JSON summary to stdout.
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const GNUPGHOME = path.join(os.tmpdir(), `simplebeacon-gnupg-${Date.now()}`);

function ensureGpgHome() {
  fs.mkdirSync(GNUPGHOME, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') {
    execSync(`chmod 700 ${GNUPGHOME}`);
  }
  return GNUPGHOME;
}

function importPrivateKey(gpgHome) {
  const keyEnv = process.env.GPG_PRIVATE_KEY;
  if (!keyEnv) {
    throw new Error('GPG_PRIVATE_KEY environment variable is not set');
  }

  let keyData;
  try {
    keyData = Buffer.from(keyEnv, 'base64').toString('utf8');
  } catch {
    keyData = keyEnv;
  }

  if (!keyData.includes('-----BEGIN PGP PRIVATE KEY BLOCK-----')) {
    throw new Error('GPG_PRIVATE_KEY does not contain a valid PGP private key block');
  }

  const keyFile = path.join(gpgHome, 'private-key.asc');
  fs.writeFileSync(keyFile, keyData, { mode: 0o600 });

  const passphrase = process.env.GPG_PASSPHRASE || '';
  const importResult = spawnSync(
    'gpg',
    [
      '--homedir',
      gpgHome,
      '--batch',
      '--pinentry-mode',
      'loopback',
      '--passphrase',
      passphrase,
      '--import',
      keyFile,
    ],
    { encoding: 'utf8' }
  );

  fs.unlinkSync(keyFile);

  if (importResult.status !== 0) {
    throw new Error(`GPG key import failed: ${importResult.stderr || importResult.stdout}`);
  }

  const listResult = spawnSync(
    'gpg',
    ['--homedir', gpgHome, '--batch', '--list-secret-keys', '--keyid-format', 'long'],
    { encoding: 'utf8' }
  );

  if (listResult.status !== 0 || !listResult.stdout.trim()) {
    throw new Error('No secret keys found after import');
  }

  const keyMatch = listResult.stdout.match(/sec\s+\w+\/([A-F0-9]{16,})/i);
  const keyId = process.env.GPG_KEY_ID || (keyMatch ? keyMatch[1] : null);

  if (!keyId) {
    throw new Error('Could not determine GPG key ID from imported keys');
  }

  return keyId;
}

function signFile(gpgHome, keyId, passphrase, filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const sigPath = `${filePath}.sig`;
  const args = [
    '--homedir',
    gpgHome,
    '--batch',
    '--yes',
    '--pinentry-mode',
    'loopback',
    '--passphrase',
    passphrase,
    '--local-user',
    keyId,
    '--detach-sign',
    '--output',
    sigPath,
    filePath,
  ];

  const result = spawnSync('gpg', args, { encoding: 'utf8' });

  if (result.status !== 0) {
    throw new Error(`GPG signing failed for ${filePath}: ${result.stderr || result.stdout}`);
  }

  if (!fs.existsSync(sigPath)) {
    throw new Error(`Signature file was not created: ${sigPath}`);
  }

  const fileStat = fs.statSync(filePath);
  const sigStat = fs.statSync(sigPath);
  const fileHash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  const sigHash = crypto.createHash('sha256').update(fs.readFileSync(sigPath)).digest('hex');

  return {
    file: path.basename(filePath),
    fileAbsolutePath: filePath,
    fileSize: fileStat.size,
    fileSha256: fileHash,
    signature: path.basename(sigPath),
    signatureAbsolutePath: sigPath,
    signatureSize: sigStat.size,
    signatureSha256: sigHash,
    keyId,
    signedAt: new Date().toISOString(),
  };
}

function verifySignature(gpgHome, filePath, sigPath) {
  const result = spawnSync(
    'gpg',
    ['--homedir', gpgHome, '--batch', '--verify', sigPath, filePath],
    { encoding: 'utf8' }
  );

  return result.status === 0;
}

function cleanupGpgHome(gpgHome) {
  try {
    fs.rmSync(gpgHome, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

function main() {
  const files = process.argv.slice(2);

  if (files.length === 0) {
    console.error('Usage: node scripts/sign-artifacts.js <file1> [file2] ...');
    process.exit(1);
  }

  if (!process.env.GPG_PRIVATE_KEY) {
    console.error('ERROR: GPG_PRIVATE_KEY environment variable is required');
    console.error('');
    console.error('To generate a GPG key for CI/CD:');
    console.error('  gpg --batch --gen-key <<EOF');
    console.error('  Key-Type: RSA');
    console.error('  Key-Length: 4096');
    console.error('  Name-Real: SimpleBeacon Release');
    console.error('  Name-Email: releases@simplebeacon.ai');
    console.error('  Expire-Date: 0');
    console.error('  Passphrase: <your-passphrase>');
    console.error('  %commit');
    console.error('  EOF');
    console.error('');
    console.error('  gpg --export-secret-keys --armor <key-id> | base64 -w0');
    process.exit(1);
  }

  let gpgHome;
  let keyId;

  try {
    gpgHome = ensureGpgHome();
    keyId = importPrivateKey(gpgHome);
    console.log(`GPG key imported successfully: ${keyId}`);
  } catch (err) {
    console.error(`GPG setup failed: ${err.message}`);
    cleanupGpgHome(gpgHome || GNUPGHOME);
    process.exit(2);
  }

  const results = [];
  const errors = [];

  for (const file of files) {
    const absPath = path.resolve(file);
    try {
      console.log(`Signing: ${absPath}`);
      const result = signFile(gpgHome, keyId, process.env.GPG_PASSPHRASE || '', absPath);

      const verified = verifySignature(gpgHome, absPath, result.signatureAbsolutePath);
      result.verified = verified;

      if (!verified) {
        console.error(`WARNING: Signature verification failed for ${absPath}`);
        errors.push({ file: absPath, error: 'Verification failed' });
      } else {
        console.log(
          `Signed + verified: ${result.file} -> ${result.signature} (${result.signatureSize} bytes)`
        );
      }

      results.push(result);
    } catch (err) {
      console.error(`Failed to sign ${absPath}: ${err.message}`);
      errors.push({ file: absPath, error: err.message });
    }
  }

  cleanupGpgHome(gpgHome);

  const summary = {
    success: errors.length === 0,
    signedCount: results.length,
    errorCount: errors.length,
    keyId,
    signedAt: new Date().toISOString(),
    artifacts: results,
    errors,
  };

  const summaryPath = path.resolve('generated', 'signatures-summary.json');
  try {
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`\nSignature summary written to: ${summaryPath}`);
  } catch (err) {
    console.error(`Failed to write summary: ${err.message}`);
  }

  console.log(`\n${results.length} artifact(s) signed, ${errors.length} error(s)`);

  if (errors.length > 0) {
    process.exit(3);
  }
}

main();
