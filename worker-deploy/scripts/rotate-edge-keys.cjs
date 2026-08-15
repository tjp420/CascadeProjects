#!/usr/bin/env node
'use strict';

/**
 * Key rotation utility for the edge compliance certificate signing system.
 *
 * This script:
 *   1. Generates a new ECDSA P-256 keypair
 *   2. Archives the current public key (if it exists) to .dev-keys/archive/
 *   3. Outputs the wrangler secret commands to update both keys
 *   4. Optionally executes the wrangler commands directly
 *
 * Key rotation model:
 *   - The new key immediately becomes the active signing key
 *   - Old public keys are archived locally for backwards-compatible verification
 *   - Certificates signed with the old key can still be verified if the old
 *     public key is published at a versioned endpoint (future work)
 *   - For now, old public keys are archived to .dev-keys/archive/ with a timestamp
 *
 * Usage:
 *   node worker-deploy/scripts/rotate-edge-keys.cjs
 *   node worker-deploy/scripts/rotate-edge-keys.cjs --worker simplebeacon-dashboard-v2
 *   node worker-deploy/scripts/rotate-edge-keys.cjs --execute
 *   node worker-deploy/scripts/rotate-edge-keys.cjs --dry-run
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function parseArgs(argv) {
    const args = { worker: 'simplebeacon-dashboard-v2', dryRun: false, execute: false };
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--worker') {
            args.worker = argv[++i];
        } else if (arg === '--dry-run') {
            args.dryRun = true;
        } else if (arg === '--execute') {
            args.execute = true;
        } else if (arg === '--help' || arg === '-h') {
            console.log('Usage: node rotate-edge-keys.cjs [--worker <name>] [--execute] [--dry-run]');
            console.log('');
            console.log('Rotates the ECDSA P-256 signing keypair for compliance certificates.');
            console.log('');
            console.log('Options:');
            console.log('  --worker <name>  Cloudflare Worker name (default: simplebeacon-dashboard-v2)');
            console.log('  --execute        Run wrangler secret put commands automatically');
            console.log('  --dry-run        Print commands without executing or writing files');
            console.log('');
            console.log('Without --execute, the script prints the wrangler commands for you to run manually.');
            console.log('With --execute, it runs them directly (requires wrangler auth).');
            process.exit(0);
        }
    }
    return args;
}

/**
 * Compute the RFC 7638 JWK thumbprint of a public key.
 */
async function computeJwkThumbprint(jwk) {
    const canonical = JSON.stringify({
        crv: jwk.crv,
        kty: jwk.kty,
        x: jwk.x,
        y: jwk.y
    });
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');
}

async function main() {
    const args = parseArgs(process.argv);

    console.log('Rotating ECDSA P-256 signing keypair for edge compliance certificates...\n');

    const keysDir = path.join(__dirname, '..', '.dev-keys');
    const archiveDir = path.join(keysDir, 'archive');

    // Step 1: Archive the current public key if it exists
    const currentPubKeyPath = path.join(keysDir, 'signing-public-key.json');
    if (fs.existsSync(currentPubKeyPath) && !args.dryRun) {
        fs.mkdirSync(archiveDir, { recursive: true });
        const currentPubKey = JSON.parse(fs.readFileSync(currentPubKeyPath, 'utf8'));
        const oldKeyId = await computeJwkThumbprint(currentPubKey);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archivePath = path.join(archiveDir, `public-key-${oldKeyId.slice(0, 16)}-${timestamp}.json`);
        fs.writeFileSync(archivePath, JSON.stringify(currentPubKey, null, 2), 'utf8');
        console.log(`✓ Archived current public key to ${path.relative(process.cwd(), archivePath)}`);
        console.log(`  Old key ID: sb-edge-${oldKeyId.slice(0, 16)}\n`);
    } else if (fs.existsSync(currentPubKeyPath) && args.dryRun) {
        const currentPubKey = JSON.parse(fs.readFileSync(currentPubKeyPath, 'utf8'));
        const oldKeyId = await computeJwkThumbprint(currentPubKey);
        console.log(`[dry-run] Would archive current public key (key ID: sb-edge-${oldKeyId.slice(0, 16)})\n`);
    } else {
        console.log('No existing public key found — this is the first rotation.\n');
    }

    // Step 2: Generate the new keypair
    const keypair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
    );

    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keypair.privateKey);
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keypair.publicKey);

    const privateKeyJson = JSON.stringify(privateKeyJwk);
    const publicKeyJson = JSON.stringify(publicKeyJwk);
    const newKeyId = await computeJwkThumbprint(publicKeyJwk);
    const newKeyIdShort = 'sb-edge-' + newKeyId.slice(0, 16);

    // Step 3: Write the new keys to .dev-keys/
    if (!args.dryRun) {
        fs.mkdirSync(keysDir, { recursive: true });
        fs.writeFileSync(path.join(keysDir, 'signing-private-key.json'), privateKeyJson, 'utf8');
        fs.writeFileSync(path.join(keysDir, 'signing-public-key.json'), publicKeyJson, 'utf8');

        const gitignorePath = path.join(keysDir, '.gitignore');
        if (!fs.existsSync(gitignorePath)) {
            fs.writeFileSync(gitignorePath, '*\n!.gitignore\n', 'utf8');
        }

        console.log(`✓ New keys written to ${path.relative(process.cwd(), keysDir)}/`);
    }

    console.log(`✓ New key ID: ${newKeyIdShort}\n`);

    // Step 4: Output or execute the wrangler secret commands
    const privateCmd = `echo '${privateKeyJson}' | npx wrangler secret put SIGNING_PRIVATE_KEY --name ${args.worker}`;
    const publicCmd = `echo '${publicKeyJson}' | npx wrangler secret put SIGNING_PUBLIC_KEY --name ${args.worker}`;

    if (args.execute && !args.dryRun) {
        console.log('── Executing Wrangler Secret Updates ──────────────────────────\n');
        console.log('Updating SIGNING_PRIVATE_KEY...');
        try {
            execSync(privateCmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
            console.log('✓ Private key updated.\n');
        } catch (err) {
            console.error('✗ Failed to update private key:', err.message);
            console.error('  Run this command manually:');
            console.error(`  ${privateCmd}`);
        }

        console.log('Updating SIGNING_PUBLIC_KEY...');
        try {
            execSync(publicCmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
            console.log('✓ Public key updated.\n');
        } catch (err) {
            console.error('✗ Failed to update public key:', err.message);
            console.error('  Run this command manually:');
            console.error(`  ${publicCmd}`);
        }
    } else {
        console.log('── Wrangler Secret Update Commands ────────────────────────────');
        console.log('');
        console.log('Run these commands to activate the new keypair:');
        console.log('');
        console.log(`# Update the private signing key`);
        console.log(`${privateCmd}`);
        console.log('');
        console.log(`# Update the public verification key`);
        console.log(`${publicCmd}`);
        console.log('');
    }

    // Step 5: Summary
    console.log('── Rotation Summary ───────────────────────────────────────────');
    console.log(`  Worker:     ${args.worker}`);
    console.log(`  New key ID: ${newKeyIdShort}`);
    console.log(`  Algorithm:  ECDSA P-256`);
    console.log(`  Archived:   ${args.dryRun ? '(dry-run)' : fs.existsSync(archiveDir) ? 'Yes — in .dev-keys/archive/' : 'No previous key'}`);
    console.log('');
    console.log('⚠  IMPORTANT:');
    console.log('   • After updating secrets, deploy the Worker to pick up the new keys:');
    console.log(`     npx wrangler deploy --config worker-deploy/wrangler.jsonc`);
    console.log('   • Old certificates signed with the previous key will fail verification');
    console.log('     against the new public key. Archive old public keys for auditors who');
    console.log('     need to verify historical certificates.');
    console.log('   • The .dev-keys/ directory is gitignored — never commit these keys.');
}

main().catch(err => {
    console.error('Key rotation failed:', err.message);
    process.exit(1);
});
