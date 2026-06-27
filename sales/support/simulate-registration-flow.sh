#!/usr/bin/env bash
set -euo pipefail

# SimpleBeacon End-to-End Registration Lifecycle Simulation
# Validates: doctor triage -> license signing -> local verification -> renewal tracking

echo "========================================"
echo " SimpleBeacon E2E Lifecycle Simulation"
echo "========================================"
echo ""

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

PASS=0
FAIL=0

run_step() {
    local name="$1"
    shift
    echo "[STEP] $name"
    if "$@"; then
        echo "  PASS"
        ((PASS++)) || true
    else
        echo "  FAIL"
        ((FAIL++)) || true
    fi
    echo ""
}

# ------------------------------------------------------------------
# 1. Doctor Triage
# ------------------------------------------------------------------
step_doctor() {
    node -e "
        const { runDoctor } = require('./packages/simplebeacon-cli/src/doctor.js');
        runDoctor();
    " 2>&1 | grep -q "System operational integrity looks solid"
}

# ------------------------------------------------------------------
# 2. License Signing + Local Verification (Crypto Loop)
# ------------------------------------------------------------------
step_crypto() {
    node -e "
        const crypto = require('crypto');
        const { signLicense } = require('./sales/license/generator.js');
        const { validateLicenseLocally } = require('./simplebeacon-vscode-merged/src/licenseManager.ts');

        const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
        const priv = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
        const pub  = keys.publicKey.export({ type: 'spki', format: 'pem' });

        const token = signLicense('sim-corp', 'enterprise', '2027-12-31', priv);
        const meta  = validateLicenseLocally(token, pub);

        if (meta && meta.companyId === 'sim-corp' && meta.tier === 'enterprise') {
            console.log('CRYPTO LOOP PASSED');
            process.exit(0);
        } else {
            console.log('CRYPTO LOOP FAILED');
            process.exit(1);
        }
    " 2>&1 | grep -q "CRYPTO LOOP PASSED"
}

# ------------------------------------------------------------------
# 3. Renewal Tracker
# ------------------------------------------------------------------
step_renewal() {
    node -e "
        const { checkExpiringLicenses } = require('./sales/license/renewal-tracker.js');
        const now = new Date();
        const future = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
        const expires = future.toISOString().split('T')[0];
        const alerts = checkExpiringLicenses([
            { companyId: 'test-corp', customerEmail: 'a@test.com', expiresAt: expires, tier: 'team' }
        ], 30);
        if (alerts.length === 1 && alerts[0].companyId === 'test-corp') {
            console.log('RENEWAL TRACKER PASSED');
            process.exit(0);
        } else {
            console.log('RENEWAL TRACKER FAILED');
            process.exit(1);
        }
    " 2>&1 | grep -q "RENEWAL TRACKER PASSED"
}

# ------------------------------------------------------------------
# 4. Funnel Trigger Evaluation
# ------------------------------------------------------------------
step_funnel() {
    node -e "
        const path = require('path');
        const { evaluateFunnelMetrics, getFunnelCopy } = require('./ai-platform/web/simplebeacon-dashboard/js/utils/funnelTrigger.js');
        const large = evaluateFunnelMetrics({ files_scanned: 6000, total_files: 16000, quality_score: 90, findings: [] });
        const small = evaluateFunnelMetrics({ files_scanned: 100, total_files: 200, quality_score: 90, findings: [] });
        if (large.shouldPromptUpgrade && large.targetTier === 'enterprise' && !small.shouldPromptUpgrade) {
            console.log('FUNNEL TRIGGER PASSED');
            process.exit(0);
        } else {
            console.log('FUNNEL TRIGGER FAILED');
            process.exit(1);
        }
    " 2>&1 | grep -q "FUNNEL TRIGGER PASSED"
}

# ------------------------------------------------------------------
# 5. Token Decryptor Round-Trip
# ------------------------------------------------------------------
step_decrypt() {
    node -e "
        const crypto = require('crypto');
        const { decryptSupportToken } = require('./sales/support/decrypt-token.js');

        const cipherKey = crypto.scryptSync('simplebeacon-public-triage-salt', 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', cipherKey, iv);
        let encrypted = cipher.update(JSON.stringify({ test: true }), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const token = iv.toString('hex') + '.' + encrypted;

        const result = decryptSupportToken(token);
        if (result.test === true) {
            console.log('DECRYPTOR PASSED');
            process.exit(0);
        } else {
            console.log('DECRYPTOR FAILED');
            process.exit(1);
        }
    " 2>&1 | grep -q "DECRYPTOR PASSED"
}

# ------------------------------------------------------------------
# Run all steps
# ------------------------------------------------------------------
run_step "Doctor Triage"       step_doctor
run_step "Crypto License Loop" step_crypto
run_step "Renewal Tracker"     step_renewal
run_step "Funnel Trigger"      step_funnel
run_step "Token Decryptor"     step_decrypt

echo "========================================"
echo " Results: $PASS passed, $FAIL failed"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
