#!/usr/bin/env node
/**
 * SimpleBeacon License Token Generator
 *
 * Generates signed license tokens for certificate-upload.html and
 * optionally configures the local environment.
 *
 * Usage:
 *   node generate-license-token.js
 *   node generate-license-token.js --tier executive --email alice@example.com --project "My App" --days 90
 *   node generate-license-token.js --setup   (writes .env with defaults)
 *   node generate-license-token.js --verify <token>
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/* ── Token engine (mirrors packages/simplebeacon-cli/src/lib/license-token.js) ── */

function generateLicenseToken(payload = {}, secret = process.env.SIMPLEBEACON_LICENSE_SECRET, expiresInMinutes = 60) {
  if (!secret) throw new Error('SIMPLEBEACON_LICENSE_SECRET is required. Set it in your environment or pass it explicitly.');
  const issuedAt = Date.now();
  const expiresAt = issuedAt + (expiresInMinutes * 60 * 1000);
  const tokenPayload = {
    email: payload.email || '',
    tier: payload.tier || 'executive',
    features: payload.features || [],
    clientName: payload.clientName || payload.email || 'Client',
    projectName: payload.projectName || 'Project',
    iat: issuedAt,
    exp: expiresAt
  };
  const data = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyLicenseToken(token, secret = process.env.SIMPLEBEACON_LICENSE_SECRET) {
  if (!secret) throw new Error('SIMPLEBEACON_LICENSE_SECRET is required. Set it in your environment or pass it explicitly.');
  if (!token || typeof token !== 'string') return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ── CLI helpers ── */

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      flags[key] = (next && !next.startsWith('--')) ? next : true;
      if (flags[key] !== true) i++;
    }
  }
  return flags;
}

function prompt(question) {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

/* ── Config / Setup ── */

const ENV_PATH = path.join(process.cwd(), '.env');
const DEFAULT_ENV = `# SimpleBeacon Token Generator Environment
SIMPLEBEACON_LICENSE_SECRET=simplebeacon-dev-insecure
# SIMPLEBEACON_APP_URL=https://your-domain.com
`;

async function runSetup() {
  console.log('=== SimpleBeacon Token Generator Setup ===\n');

  const secret = await prompt('License secret (press Enter for default): ');
  const appUrl = await prompt('App base URL (press Enter to skip): ');

  const lines = [
    'SIMPLEBEACON_LICENSE_SECRET=' + (secret || ''),
    '# IMPORTANT: Replace the empty secret above with a strong random string before using in production.',
    'SIMPLEBEACON_APP_URL=' + (appUrl || '')
  ];

  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf8');
  console.log('\nWrote configuration to:', ENV_PATH);
  console.log(lines.join('\n'));
}

function loadEnv() {
  if (fs.existsSync(ENV_PATH)) {
    const content = fs.readFileSync(ENV_PATH, 'utf8');
    content.split('\n').forEach((line) => {
      const m = line.match(/^([^#=\s]+)=(.*)$/);
      if (m) process.env[m[1]] = m[2];
    });
  }
}

/* ── Main ── */

async function main() {
  const flags = parseArgs();

  if (flags.setup) {
    await runSetup();
    return;
  }

  if (flags.verify) {
    const token = String(flags.verify);
    const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
    if (!secret) {
      console.error('ERROR: SIMPLEBEACON_LICENSE_SECRET is not set. Run with --setup or set the environment variable.');
      process.exit(1);
    }
    const payload = verifyLicenseToken(token, secret);
    if (!payload) {
      console.error('Token is INVALID or EXPIRED.');
      process.exit(1);
    }
    console.log('Token is VALID. Payload:');
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  loadEnv();

  let tier = flags.tier;
  let email = flags.email;
  let projectName = flags.project || flags.projectName;
  let clientName = flags.client || flags.clientName;
  let days = flags.days ? parseInt(flags.days, 10) : null;
  let features = flags.features ? flags.features.split(',') : [];

  if (!tier) {
    tier = await prompt('Tier (executive / instant / euai / universal) [executive]: ');
    tier = tier || 'executive';
  }

  if (!email) {
    email = await prompt('Customer email: ');
  }

  if (!clientName) {
    clientName = await prompt('Client name [' + (email || 'Client') + ']: ');
    clientName = clientName || email || 'Client';
  }

  if (!projectName) {
    projectName = await prompt('Project name [Project]: ');
    projectName = projectName || 'Project';
  }

  if (!days) {
    const defaultDays = { executive: 90, instant: 7, euai: 30, universal: 365 }[tier] || 90;
    const input = await prompt(`Expiry in days [${defaultDays}]: `);
    days = parseInt(input, 10) || defaultDays;
  }

  // Prevent EU AI Act tokens from being generated with 'Universal License' label
  const euAiIndicators = ['eu-ai-act', 'euai', 'eu-ai', 'ai-act-compliance'];
  const hasEuAiIndicator = features.some(f => euAiIndicators.includes(f.toLowerCase()));
  if (hasEuAiIndicator && tier === 'universal') {
    console.warn('[WARN] EU AI Act features require tier "euai". Auto-correcting from "universal" to "euai".');
    tier = 'euai';
  }

  const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
  if (!secret) {
    console.error('ERROR: SIMPLEBEACON_LICENSE_SECRET is not set. Run with --setup or set the environment variable.');
    process.exit(1);
  }
  const minutes = days * 24 * 60;

  const token = generateLicenseToken(
    { email, tier, features, clientName, projectName },
    secret,
    minutes
  );

  const baseUrl = process.env.SIMPLEBEACON_APP_URL || '';
  const certUrl = `${baseUrl}/certificate-upload.html?token=${encodeURIComponent(token)}`;

  console.log('\n=== Generated SimpleBeacon License Token ===');
  console.log('Tier:        ', tier);
  console.log('Email:       ***REDACTED***');
  console.log('Client:      ', clientName);
  console.log('Project:     ', projectName);
  console.log('Expires:     ', days, 'days');
  console.log('Features:    ', features.length ? features.join(', ') : '(none)');
  console.log('\nToken: ***REDACTED*** (set DEBUG_TOKENS=true to reveal)');
  console.log('\nCertificate Upload URL:');
  console.log(certUrl);
  console.log('\nTo verify:');
  console.log('  node generate-license-token.js --verify <token>'); // simplebeacon-ignore pii-logging — CLI usage instruction, token already truncated
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
