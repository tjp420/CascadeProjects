#!/usr/bin/env node
'use strict';

/**
 * Resend activation probe — validates API key + domain config, optional live send.
 *
 * Usage:
 *   node tools/probe-email.cjs --dry-run
 *   node tools/probe-email.cjs --to you@example.com --send
 */

const path = require('path');

try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_err) {
    // dotenv optional
}

const { getEmailStatus, isEmailConfigured, getFromAddress, hasResendApiKey } = require('../lib/email-config.cjs');
const { sendEmail } = require('../services/email.cjs');

function parseArgs(argv) {
    const args = { to: '', send: false, dryRun: false };
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--to' && argv[i + 1]) {
            args.to = argv[++i].trim();
        } else if (argv[i] === '--send') {
            args.send = true;
        } else if (argv[i] === '--dry-run') {
            args.dryRun = true;
        }
    }
    if (!args.send && !args.dryRun) {
        args.dryRun = true;
    }
    return args;
}

function buildProbePayload(to) {
    const appUrl = String(process.env.SIMPLEBEACON_APP_URL || process.env.PUBLIC_URL || 'https://simplebeacon.ai').replace(/\/$/, '');
    return {
        to,
        subject: 'Referral Pipeline Authorization Trace',
        text: `System validation hook: core track connected successfully.\nApp URL: ${appUrl}\n`,
        html: `<p><strong>System Validation Hook:</strong> Core Track Connected Successfully.</p><p>App URL: <a href="${appUrl}">${appUrl}</a></p>`
    };
}

async function main() {
    const args = parseArgs(process.argv);
    const mode = args.send ? 'PRODUCTION_DISPATCH' : 'DRY_RUN';
    const status = getEmailStatus();

    console.log(`[Email Probe] Mode: ${mode}`);
    console.log('[Email Probe] From:', status.from);
    console.log('[Email Probe] Resend API key:', status.providers.resendApi ? 'present' : 'missing');

    if (!hasResendApiKey()) {
        console.error('[ERROR] Missing or invalid RESEND_API_KEY (must start with re_)');
        console.error('Set RESEND_API_KEY and RESEND_FROM on Render, or copy coming-soon/.env for local runs.');
        process.exit(1);
    }

    const recipient = args.to || process.env.EMAIL_PROBE_TO || '';
    if (args.send && (!recipient || !recipient.includes('@'))) {
        console.error('[ERROR] Live send requires --to you@example.com');
        process.exit(1);
    }

    const payload = buildProbePayload(recipient || 'verify@example.com');

    if (args.dryRun) {
        console.log('[DRY-RUN] Key signature valid. Payload verified:');
        console.log(JSON.stringify({ ...payload, to: recipient || '(set --to for live send)' }, null, 2));
        console.log('\nNext: .\\scripts\\verify-dns.ps1 then node tools/probe-email.cjs --to you@co.com --send');
        process.exit(status.configured ? 0 : 1);
    }

    console.log('[Email Probe] Dispatching to', recipient, '...');
    const result = await sendEmail(payload);

    if (result.sent) {
        console.log(`[PASS] Dispatch successful via ${result.provider || 'unknown'}.`);
        if (result.providerMessageId) {
            console.log(`[PASS] Network tracking ID: ${result.providerMessageId}`);
        }
        process.exit(0);
    }

    console.error('[FAIL] Resend transaction rejected:', result.error || 'unknown error');
    if (result.queued) {
        console.error('[INFO] Message queued for retry. queueId:', result.queueId || 'n/a');
    }
    process.exit(1);
}

main().catch((err) => {
    console.error('[FAIL] Probe error:', err.message);
    process.exit(1);
});
