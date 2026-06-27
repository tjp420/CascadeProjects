#!/usr/bin/env node

/**
 * Generate AI Slop Cop license tokens
 * Usage: node generate-license-token.cjs [pro|enterprise]
 */

const crypto = require('crypto');

const LICENSE_SECRET = process.env.LICENSE_SECRET || 'fb578fe0edf57520edd3b1b53477fbafb20a43ee3d0162feb02974ca990cca54';

function base64urlEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateToken(tier) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const expires = now + (365 * 24 * 60 * 60); // 1 year

  const payload = {
    tier: tier,
    iat: now,
    exp: expires
  };

  const headerEncoded = base64urlEncode(Buffer.from(JSON.stringify(header)));
  const payloadEncoded = base64urlEncode(Buffer.from(JSON.stringify(payload)));
  const signature = crypto
    .createHmac('sha256', LICENSE_SECRET)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

// Main
const tier = process.argv[2] || 'pro';

if (!['pro', 'enterprise'].includes(tier)) {
  console.error('Usage: node generate-license-token.cjs [pro|enterprise]'); // simplebeacon-ignore pii-logging — CLI usage string, no user data
  process.exit(1);
}

const token = generateToken(tier);
console.log(token); // simplebeacon-ignore pii-logging — CLI tool outputs generated JWT to stdout for piping
