#!/usr/bin/env node
'use strict';

/**
 * Reply Monitor — Watches for replies to outbound campaign emails and
 * sends instant notifications via Slack/Discord webhook.
 *
 * Keeps the <2-hour response SLA by pinging your phone the moment a
 * prospect hits "Reply".
 *
 * Usage:
 *   node marketing/outreach/reply-monitor.js                    # one-time check
 *   node marketing/outreach/reply-monitor.js --watch            # poll every 60 seconds
 *   node marketing/outreach/reply-monitor.js --watch --interval 30  # custom interval
 *
 * Required env vars:
 *   IMAP_HOST=imap.zohocloud.ca
 *   IMAP_PORT=993
 *   IMAP_USER=<your-zoho-mailbox>@simplebeacon.ai
 *   IMAP_PASS=<zoho-app-specific-password>
 *   WEBHOOK_URL=https://hooks.slack.com/services/...  (or Discord webhook)
 *
 * Optional env vars:
 *   REPLY_MONITOR_INTERVAL=60    (seconds between polls, default 60)
 *   REPLY_MONITOR_SINCE=24h      (only check emails from last 24h)
 *   REPLY_MONITOR_LABEL=Replies  (IMAP label/folder to check, default INBOX)
 */

const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WATCH = process.argv.includes('--watch');
const INTERVAL_ARG = process.argv.indexOf('--interval');
const INTERVAL = (INTERVAL_ARG !== -1 ? parseInt(process.argv[INTERVAL_ARG + 1], 10) : null) ||
    parseInt(process.env.REPLY_MONITOR_INTERVAL || '60', 10);

const STATE_FILE = path.join(__dirname, '.reply-monitor-state.json');
const PROSPECTS_FILE = path.join(__dirname, 'prospects.json');

// ── State Management ─────────────────────────────────────────────────────────

function loadState() {
    try {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {
        return { lastChecked: null, seenMessageIds: [] };
    }
}

function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadProspectEmails() {
    try {
        const prospects = JSON.parse(fs.readFileSync(PROSPECTS_FILE, 'utf8'));
        const arr = Array.isArray(prospects) ? prospects : (prospects.prospects || prospects.leads || []);
        return new Set(arr.map(p => (p.email || '').toLowerCase()).filter(Boolean));
    } catch {
        return new Set();
    }
}

// ── IMAP Check (using imapflow if available, fallback to curl) ───────────────

async function checkInbox() {
    const host = process.env.IMAP_HOST;
    const user = process.env.IMAP_USER;
    const pass = process.env.IMAP_PASS;
    const label = process.env.REPLY_MONITOR_LABEL || 'INBOX';

    if (!host || !user || !pass) {
        console.error('[reply-monitor] Missing IMAP env vars (IMAP_HOST, IMAP_USER, IMAP_PASS)');
        return [];
    }

    // Try imapflow first
    try {
        const { ImapFlow } = require('imapflow');
        const client = new ImapFlow({
            host,
            port: parseInt(process.env.IMAP_PORT || '993', 10),
            secure: true,
            auth: { user, pass },
            logger: false,
        });

        await client.connect();
        const messages = [];

        try {
            const lock = await client.getMailboxLock(label);
            try {
                // Search for recent messages (last 24h by default)
                const sinceHours = parseInt(process.env.REPLY_MONITOR_SINCE || '24h'.replace('h', ''), 10);
                const since = new Date();
                since.setHours(since.getHours() - sinceHours);

                for await (const msg of client.fetch({ since }, { envelope: true, source: true })) {
                    const envelope = msg.envelope;
                    if (!envelope) continue;

                    const from = envelope.from?.[0]?.address || '';
                    const subject = envelope.subject || '(no subject)';
                    const date = envelope.date || new Date();
                    const messageId = envelope.messageId || `${from}-${date}`;

                    messages.push({
                        messageId,
                        from,
                        fromName: envelope.from?.[0]?.name || from,
                        subject,
                        date: new Date(date).toISOString(),
                        to: envelope.to?.[0]?.address || '',
                    });
                }
            } finally {
                lock.release();
            }
        } finally {
            await client.logout();
        }

        return messages;
    } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') {
            console.error('[reply-monitor] imapflow not installed. Install with: npm install -g imapflow');
            console.error('[reply-monitor] Falling back to manual mode — check your inbox manually.');
            return [];
        }
        throw err;
    }
}

// ── Webhook Notification ─────────────────────────────────────────────────────

function sendWebhook(message) {
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) {
        console.log('[reply-monitor] No WEBHOOK_URL set — printing notification only:');
        console.log(message);
        return;
    }

    return new Promise((resolve) => {
        const url = new URL(webhookUrl);
        const isSlack = url.hostname.includes('slack.com');
        const isDiscord = url.hostname.includes('discord.com') || url.hostname.includes('discordapp.com');

        let payload;
        if (isSlack) {
            payload = JSON.stringify({ text: message, mrkdwn: true });
        } else if (isDiscord) {
            payload = JSON.stringify({ content: message });
        } else {
            // Generic webhook
            payload = JSON.stringify({ message, timestamp: new Date().toISOString() });
        }

        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log(`[reply-monitor] Webhook sent (${res.statusCode})`);
                } else {
                    console.error(`[reply-monitor] Webhook failed: ${res.statusCode} ${body}`);
                }
                resolve();
            });
        });

        req.on('error', (e) => {
            console.error(`[reply-monitor] Webhook error: ${e.message}`);
            resolve();
        });

        req.write(payload);
        req.end();
    });
}

// ── Reply Classification ─────────────────────────────────────────────────────

function classifyReply(subject, from, prospectEmails) {
    const subj = subject.toLowerCase();
    const isProspect = prospectEmails.has(from.toLowerCase());

    // Check if it's a reply to our campaign
    const isReply = subj.startsWith('re:') || subj.includes('reply') || isProspect;

    if (!isReply) return null;

    // Classify intent
    let intent = 'unknown';
    let priority = 'medium';

    if (subj.match(/demo|call|meeting|schedule|book/i) || subj.match(/interested|yes|sure|let.s do it/i)) {
        intent = 'demo-request';
        priority = 'high';
    } else if (subj.match(/pricing|cost|quote|budget/i)) {
        intent = 'pricing-request';
        priority = 'high';
    } else if (subj.match(/question|how|what|why|technical/i)) {
        intent = 'technical-question';
        priority = 'medium';
    } else if (subj.match(/unsubscribe|remove|stop/i)) {
        intent = 'unsubscribe';
        priority = 'low';
    } else if (subj.match(/out of office|ooo|auto.?reply/i)) {
        intent = 'auto-reply';
        priority = 'low';
    } else if (subj.match(/not interested|no thanks|pass/i)) {
        intent = 'not-interested';
        priority = 'low';
    } else if (isProspect) {
        intent = 'prospect-reply';
        priority = 'high';
    }

    return { intent, priority, isProspect };
}

function formatNotification(msg, classification) {
    const priorityEmoji = classification.priority === 'high' ? '🚨' : classification.priority === 'medium' ? '📧' : '📋';
    const intentLabel = classification.intent.replace(/-/g, ' ').toUpperCase();

    return `${priorityEmoji} *SimpleBeacon Reply Alert*

*From:* ${msg.fromName} <${msg.from}>
*Subject:* ${msg.subject}
*Intent:* ${intentLabel}
*Priority:* ${classification.priority.toUpperCase()}
*Time:* ${msg.date}
*Prospect:* ${classification.isProspect ? 'YES — in prospect list' : 'No — unknown sender'}

${classification.priority === 'high' ? '⚡ *Respond within 2 hours per SLA*' : 'Response within 4 hours'}

Dashboard: https://simplebeacon.ai/app/
Calendly: https://calendly.com/simplebeacon/30min`;
}

// ── Main Loop ────────────────────────────────────────────────────────────────

async function checkOnce() {
    const state = loadState();
    const prospectEmails = loadProspectEmails();

    console.log(`[reply-monitor] Checking inbox... (${new Date().toISOString()})`);

    let messages;
    try {
        messages = await checkInbox();
    } catch (e) {
        console.error(`[reply-monitor] Inbox check failed: ${e.message}`);
        return;
    }

    const newMessages = messages.filter(m => !state.seenMessageIds.includes(m.messageId));

    if (newMessages.length === 0) {
        console.log('[reply-monitor] No new messages.');
        state.lastChecked = new Date().toISOString();
        saveState(state);
        return;
    }

    console.log(`[reply-monitor] Found ${newMessages.length} new message(s).`);

    let notified = 0;
    for (const msg of newMessages) {
        const classification = classifyReply(msg.subject, msg.from, prospectEmails);
        if (!classification) {
            // Not a reply — skip
            state.seenMessageIds.push(msg.messageId);
            continue;
        }

        console.log(`[reply-monitor] Reply detected: ${msg.from} — ${msg.subject} [${classification.intent}]`);

        const notification = formatNotification(msg, classification);
        await sendWebhook(notification);
        notified++;

        state.seenMessageIds.push(msg.messageId);
    }

    // Trim seen IDs to last 1000 to prevent unbounded growth
    if (state.seenMessageIds.length > 1000) {
        state.seenMessageIds = state.seenMessageIds.slice(-1000);
    }

    state.lastChecked = new Date().toISOString();
    saveState(state);

    console.log(`[reply-monitor] Done. ${notified} notification(s) sent.`);
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  SimpleBeacon Reply Monitor                                  ║');
    console.log(`║  Mode: ${WATCH ? 'WATCH (polling every ' + INTERVAL + 's)' : 'ONE-TIME CHECK'}${' '.repeat(Math.max(0, 28 - (WATCH ? 'WATCH (polling every ' + INTERVAL + 's)' : 'ONE-TIME CHECK').length))}║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');

    if (!process.env.WEBHOOK_URL) {
        console.log('[reply-monitor] No WEBHOOK_URL set — notifications will be printed only.');
        console.log('[reply-monitor] Set WEBHOOK_URL to enable Slack/Discord alerts.');
    }

    if (WATCH) {
        console.log(`[reply-monitor] Watching... (Ctrl+C to stop)`);
        await checkOnce();
        setInterval(async () => {
            try {
                await checkOnce();
            } catch (e) {
                console.error(`[reply-monitor] Error: ${e.message}`);
            }
        }, INTERVAL * 1000);
    } else {
        await checkOnce();
    }
}

main().catch((e) => {
    console.error('[reply-monitor] Fatal error:', e);
    process.exit(1);
});
