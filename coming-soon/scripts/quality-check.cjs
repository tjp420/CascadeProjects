#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');

function hasValue(name) {
    const value = process.env[name];
    return typeof value === 'string' && value.trim().length > 0;
}

const hasFingerprint = hasValue('SIMPLEBEACON_POLICY_TRUST_FINGERPRINT');
const hasPublicKey = hasValue('SIMPLEBEACON_POLICY_PUBLIC_KEY') || hasValue('SIMPLEBEACON_POLICY_PUBLIC_KEY_PATH');

if (!hasFingerprint || !hasPublicKey) {
    const missing = [];
    if (!hasFingerprint) missing.push('SIMPLEBEACON_POLICY_TRUST_FINGERPRINT');
    if (!hasPublicKey) missing.push('SIMPLEBEACON_POLICY_PUBLIC_KEY or SIMPLEBEACON_POLICY_PUBLIC_KEY_PATH');

    console.error('[quality:check] Missing required policy environment variables.');
    console.error('[quality:check] Required:');
    for (const item of missing) {
        console.error(`  - ${item}`);
    }
    console.error('[quality:check] Gate scan not started. Set required variables and re-run.');
    process.exit(78);
}

const result = spawnSync('npx', ['simplebeacon', 'scan', '.', '--gate', '--offline'], {
    stdio: 'inherit',
    shell: process.platform === 'win32'
});

if (result.error) {
    console.error('[quality:check] Failed to launch scan:', result.error.message);
    process.exit(1);
}

process.exit(typeof result.status === 'number' ? result.status : 1);
