# Reply Monitor Setup Guide

**Purpose:** Get instant Slack/Discord notifications when prospects reply to outbound campaign emails, ensuring the <2-hour response SLA is met.

---

## Quick Start

### 1. Install imapflow (for IMAP inbox checking)

```bash
npm install -g imapflow
```

### 2. Set environment variables

```bash
# IMAP (Zoho Mail Canadian data center)
IMAP_HOST=imap.zohocloud.ca
IMAP_PORT=993
IMAP_USER=admin@simplebeacon.ai
IMAP_PASS=<zoho-app-specific-password>

# Webhook (Slack or Discord — pick one)
WEBHOOK_URL=https://hooks.slack.com/services/REPLACE_WITH_YOUR_SLACK_WEBHOOK
# OR
WEBHOOK_URL=https://discord.com/api/webhooks/REPLACE_WITH_YOUR_DISCORD_WEBHOOK

# Optional settings
REPLY_MONITOR_INTERVAL=60    # seconds between polls (default: 60)
REPLY_MONITOR_SINCE=24       # hours to look back (default: 24)
REPLY_MONITOR_LABEL=INBOX    # IMAP folder to check (default: INBOX)
```

### 3. Run the monitor

```bash
# One-time check
node marketing/outreach/reply-monitor.js

# Continuous monitoring (polls every 60 seconds)
node marketing/outreach/reply-monitor.js --watch

# Custom interval (every 30 seconds)
node marketing/outreach/reply-monitor.js --watch --interval 30
```

---

## Slack Webhook Setup

1. Go to https://api.slack.com/messaging/webhooks
2. Click "Create a Slack App" (or use an existing one)
3. Enable incoming webhooks
4. Create a webhook for the channel `#sales-alerts` (or your preferred channel)
5. Copy the webhook URL (starts with `https://hooks.slack.com/services/...`)
6. Set it as `WEBHOOK_URL` in your environment

**Recommended channel:** `#sales-alerts` or `#outbound-replies`
**Notification format:**
```
🚨 SimpleBeacon Reply Alert

From: John Smith <john@techcorp.com>
Subject: Re: EUR 35M or 7% of turnover — is TechCorp exposed?
Intent: DEMO REQUEST
Priority: HIGH
Time: 2026-08-25T14:32:00Z
Prospect: YES — in prospect list

⚡ Respond within 2 hours per SLA

Dashboard: https://simplebeacon.ai/app/
Calendly: https://calendly.com/simplebeacon/30min
```

---

## Discord Webhook Setup

1. Open your Discord server
2. Go to Server Settings → Integrations → Webhooks
3. Click "New Webhook"
4. Name it "SimpleBeacon Replies"
5. Choose the channel (e.g., `#sales-alerts`)
6. Copy the webhook URL
7. Set it as `WEBHOOK_URL` in your environment

---

## Zoho IMAP Setup

### Generate an app-specific password

1. Log in to Zoho Mail: https://mail.zoho.com
2. Go to Settings → Mail Accounts → SMTP/IMAP
3. Enable IMAP access
4. Generate an app-specific password (different from your login password)
5. Use this password as `IMAP_PASS`

### IMAP settings (Zoho Canada)

```
IMAP_HOST=imap.zohocloud.ca
IMAP_PORT=993
```

---

## Reply Classification

The monitor automatically classifies replies by intent:

| Intent | Trigger Keywords | Priority | SLA |
|--------|-----------------|----------|-----|
| demo-request | demo, call, meeting, schedule, interested, yes | HIGH | 2 hours |
| pricing-request | pricing, cost, quote, budget | HIGH | 2 hours |
| technical-question | question, how, what, why, technical | MEDIUM | 4 hours |
| prospect-reply | Any reply from a known prospect email | HIGH | 2 hours |
| unsubscribe | unsubscribe, remove, stop | LOW | Same day |
| auto-reply | out of office, OOO, auto-reply | LOW | Auto-skip |
| not-interested | not interested, no thanks, pass | LOW | Same day |
| unknown | Any other reply | MEDIUM | 4 hours |

---

## Running as a Background Service

### Option 1: PM2 (recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start the reply monitor
pm2 start marketing/outreach/reply-monitor.js --name reply-monitor -- --watch

# Save PM2 config (auto-restart on reboot)
pm2 save
pm2 startup
```

### Option 2: Windows Task Scheduler

1. Open Task Scheduler
2. Create a new task
3. Trigger: At log on
4. Action: Start a program
   - Program: `node`
   - Arguments: `C:\Users\user\CascadeProjects\marketing\outreach\reply-monitor.js --watch`
   - Start in: `C:\Users\user\CascadeProjects`

### Option 3: Screen/Tmux (Linux/Mac)

```bash
# Start in a detached screen session
screen -dmS reply-monitor node marketing/outreach/reply-monitor.js --watch

# Attach to check status
screen -r reply-monitor

# Detach: Ctrl+A, then D
```

---

## State Management

The monitor tracks seen message IDs in `.reply-monitor-state.json` to avoid duplicate notifications. This file:
- Is created automatically on first run
- Stores up to 1000 message IDs
- Is trimmed automatically when it exceeds 1000 entries
- Can be safely deleted to reset the monitor (will re-notify on all recent emails)

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| "imapflow not installed" | Run `npm install -g imapflow` |
| "Missing IMAP env vars" | Set IMAP_HOST, IMAP_USER, IMAP_PASS |
| "Webhook failed: 401" | Check your Slack/Discord webhook URL |
| No messages found | Check IMAP_LABEL (try "INBOX" or "All Mail") |
| Duplicate notifications | Delete `.reply-monitor-state.json` and restart |
| Zoho IMAP connection refused | Verify IMAP is enabled in Zoho Mail settings |

---

## Integration with Outreach Pipeline

The reply monitor works alongside the existing outreach pipeline:

```
[outreach-pipeline.js] → Sends campaign emails via SMTP
         │
         ▼
[Prospect receives email] → Replies
         │
         ▼
[reply-monitor.js] → Detects reply via IMAP
         │
         ▼
[Slack/Discord webhook] → Pings your phone
         │
         ▼
[You respond within 2 hours] → SLA met
```

The monitor cross-references incoming replies with `prospects.json` to flag messages from known prospects with higher priority.
