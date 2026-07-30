#!/usr/bin/env node
/**
 * Decode and verify a SimpleBeacon license JWT.
 *
 * Usage:
 *   node scripts/verify-license-token.mjs <jwt-token>
 *   node scripts/verify-license-token.mjs <jwt-token> --secret <secret>
 *
 * Without --secret: decodes the payload only (no signature verification).
 * With --secret: verifies the HS256 signature and reports valid/invalid.
 */
import crypto from 'node:crypto';

function base64UrlDecode(input) {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function decodeJwt(jwt) {
  const parts = String(jwt || '').split('.');
  if (parts.length < 2) {
    throw new Error('Invalid JWT format — expected 3 parts separated by dots');
  }
  const header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
  const payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));
  return { header, payload, parts };
}

function verifySignature(parts, secret) {
  const body = `${parts[0]}.${parts[1]}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return expected === parts[2];
}

function main() {
  const args = process.argv.slice(2);
  const token = args.find((a) => !a.startsWith('--'));
  const secretIdx = args.indexOf('--secret');
  const secret = secretIdx >= 0 ? args[secretIdx + 1] : null;

  if (!token) {
    console.error('Usage: node scripts/verify-license-token.mjs <jwt-token> [--secret <secret>]');
    process.exit(1);
  }

  const { header, payload, parts } = decodeJwt(token);

  console.log('=== JWT Header ===');
  console.log(JSON.stringify(header, null, 2));
  console.log('\n=== JWT Payload ===');
  console.log(JSON.stringify(payload, null, 2));

  // Validate expected fields
  console.log('\n=== Field Validation ===');
  const checks = [
    ['iss', payload.iss === 'simplebeacon.ai', 'Issuer should be simplebeacon.ai'],
    ['sub', typeof payload.sub === 'string' && payload.sub.length > 0, 'Subject (email) must be non-empty string'],
    ['sid', typeof payload.sid === 'string' && payload.sid.length > 0, 'Session ID must be non-empty string'],
    ['tier', ['free', 'agency', 'enterprise'].includes(payload.tier), `Tier must be free|agency|enterprise (got: ${payload.tier})`],
    ['capabilities', Array.isArray(payload.capabilities) && payload.capabilities.length > 0, 'Capabilities must be a non-empty array'],
    ['iat', typeof payload.iat === 'number' && payload.iat > 0, 'Issued-at must be a positive number'],
    ['exp', typeof payload.exp === 'number' && payload.exp > payload.iat, 'Expiry must be after issued-at'],
  ];

  let allPass = true;
  for (const [field, pass, desc] of checks) {
    const status = pass ? 'PASS' : 'FAIL';
    if (!pass) allPass = false;
    console.log(`  [${status}] ${field}: ${desc}`);
  }

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  const expired = payload.exp && now > payload.exp;
  console.log(`\n=== Expiry ===`);
  console.log(`  Current time: ${now} (${new Date().toISOString()})`);
  console.log(`  Expires at:  ${payload.exp} (${new Date(payload.exp * 1000).toISOString()})`);
  console.log(`  Status: ${expired ? 'EXPIRED' : 'VALID'}`);

  // Signature verification
  if (secret) {
    const valid = verifySignature(parts, secret);
    console.log(`\n=== Signature Verification ===`);
    console.log(`  Algorithm: ${header.alg}`);
    console.log(`  Result: ${valid ? 'VALID' : 'INVALID'}`);
  } else {
    console.log('\n=== Signature Verification ===');
    console.log('  Skipped (no --secret provided)');
  }

  console.log(`\n=== Overall: ${allPass && !expired ? 'PASS' : 'FAIL'} ===`);
  process.exit(allPass && !expired ? 0 : 1);
}

main();
