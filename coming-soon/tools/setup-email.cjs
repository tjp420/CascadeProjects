#!/usr/bin/env node
'use strict';

/**
 * Verify and test SimpleBeacon email delivery (Resend / SMTP).
 *
 * Usage:
 *   node tools/setup-email.cjs
 *   node tools/setup-email.cjs --to you@example.com
 *   node tools/setup-email.cjs --to you@example.com --send
 */

const path = require('path');

try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_err) {
    // dotenv optional when running from monorepo root
}

const { getEmailStatus, isEmailConfigured, getFromAddress } = require('../lib/email-config.cjs');
const { sendEmail } = require('../services/email.cjs');

function parseArgs(argv) {
    const args = { to: '', send: false };
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--to' && argv[i + 1]) {
            args.to = argv[++i].trim();
        } else if (argv[i] === '--send') {
            args.send = true;
        }
    }
    return args;
}

function printSetupGuide(status) {
    console.log('\n=== SimpleBeacon Email Setup ===\n');
    console.log('Configured:', status.configured ? 'YES' : 'NO');
    console.log('From address:', status.from);
    console.log('Resend API key:', status.providers.resendApi ? 'present' : 'missing');
    console.log('SMTP fallback:', status.providers.smtp ? `yes (${status.providers.smtpMode})` : 'no');
    if (status.pendingQueueCount != null) {
        console.log('Pending queue:', status.pendingQueueCount);
    }

    if (status.configured) {
        console.log('\nNext: verify your sending domain in Resend so', status.from, 'is allowed.');
        console.log('Dashboard:', status.setup.resendDashboard);
        return;
    }

    console.log('\nTo enable email on Render (production API):');
    console.log('1. Create a Resend account → https://resend.com');
    console.log('2. Add and verify domain simplebeacon.ai (DNS records in Cloudflare)');
    console.log('3. Create API key (starts with re_)');
    console.log('4. In Render → simplebeacon service → Environment:');
    console.log('     RESEND_API_KEY set to your Resend API key');
    console.log('     RESEND_FROM=admin@simplebeacon.ai');
    console.log('5. Redeploy the Render service');
    console.log('\nLocal dev: copy coming-soon/.env.example → .env and set the same vars.');
}

async function main() {
    const args = parseArgs(process.argv);
    const status = getEmailStatus();

    printSetupGuide(status);

    if (!args.send) {
        if (!args.to) {
            console.log('\nDry run only. Pass --to your@email.com --send to deliver a test message.');
            process.exit(status.configured ? 0 : 1);
        }
        console.log('\nAdd --send to deliver a test email to', args.to);
        process.exit(status.configured ? 0 : 1);
    }

    if (!isEmailConfigured()) {
        console.error('\nCannot send test email: RESEND_API_KEY (or SMTP) is not configured.');
        process.exit(1);
    }

    if (!args.to || !args.to.includes('@')) {
        console.error('\nProvide a valid recipient: --to you@example.com --send');
        process.exit(1);
    }

    console.log('\nSending test email to', args.to, 'from', getFromAddress(), '...');
    const result = await sendEmail({
        to: args.to,
        subject: 'SimpleBeacon email test',
        text: 'SimpleBeacon email delivery is working. Sandbox tokens and checkout emails will send from this address.',
        html: '<p><strong>SimpleBeacon email delivery is working.</strong></p><p>Sandbox tokens and checkout emails will send from this address.</p>'
    });

    if (result.sent) {
        console.log('Sent via', result.provider || 'unknown', result.providerMessageId ? `(id: ${result.providerMessageId})` : '');
        process.exit(0);
    }

    console.error('Send failed:', result.error || 'unknown error');
    if (result.queued) {
        console.error('Message was queued for retry. Check pending rows in email_queue or run scripts/email-retry-worker.cjs');
    }
    process.exit(1);
}

main().catch((err) => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
