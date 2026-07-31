# B2B Outreach Campaign Pipeline

Automated prospect scraping, email sequencing, and campaign tracking for SimpleBeacon.ai's enterprise compliance outreach targeting Chief Legal Officers, Chief Compliance Officers, and Chief Risk Officers.

## Quick Start

```bash
# 1. Ingest a prospect CSV into qualified JSON
node prospect-scraper.js --input sample-prospects.csv --output prospects.json

# 2. Preview the first email for each prospect (dry run)
node outreach-pipeline.js --prospects prospects.json --dry-run

# 3. Send emails (requires SMTP env vars)
node outreach-pipeline.js --prospects prospects.json --send

# 4. Check campaign analytics
node outreach-pipeline.js --status
```

## Architecture

```
[CSV/Apollo Export]
       |
       v
[prospect-scraper.js] — Parses, classifies persona, scores qualification
       |
       v
[prospects.json] — Qualified prospect list with scores
       |
       v
[outreach-pipeline.js] — Sequences emails, tracks state, sends via SMTP
       |
       v
[campaign-state.json] — Persistent campaign tracking state
       |
       v
[templates/*.txt] — 12 email templates (4 CLO, 3 CCO, 2 CRO, 3 reactivation)
```

## Email Sequences

### Sequence A: Chief Legal Officer (4 emails)

| Step | Day | Subject                                                    |
| ---- | --- | ---------------------------------------------------------- |
| 1    | 0   | EUR 35M or 7% of turnover — is [Company] exposed?          |
| 2    | 4   | The question your auditor will ask about AI-generated code |
| 3    | 8   | Board-ready AI risk report — 30-second demo                |
| 4    | 15  | Closing the loop on EU AI Act readiness                    |

### Sequence B: Chief Compliance Officer (3 emails)

| Step | Day | Subject                                                             |
| ---- | --- | ------------------------------------------------------------------- |
| 1    | 0   | AI-generated code audit trail — can you produce one in 24 hours?    |
| 2    | 5   | ISO 42001 (AI Management System) — your evidence gap                |
| 3    | 10  | How a fintech compliance team cut audit prep from 6 weeks to 2 days |

### Sequence C: Chief Risk Officer (2 emails)

| Step | Day | Subject                                                       |
| ---- | --- | ------------------------------------------------------------- |
| 1    | 0   | Quantifying AI-generated code risk in your production systems |
| 2    | 5   | AI code risk and your cyber insurance underwriting            |

### Reactivation Sequence (all personas, 3 emails)

| Step | Day | Subject                                              |
| ---- | --- | ---------------------------------------------------- |
| 1    | 30  | August 2026: Is your AI governance evidence ready?   |
| 2    | 60  | EU AI Act enforcement countdown — 5 months remaining |
| 3    | 90  | Final check-in: AI compliance readiness assessment   |

## Qualification Criteria

A prospect must score 60+ on the qualification scale:

- 50+ developers: +25 points
- $50M+ revenue: +25 points
- Uses AI coding tools: +20 points
- Has regulatory exposure: +15 points
- Target sector (fintech, banking, healthcare, etc.): +15 points

## SMTP Configuration

```bash
export SMTP_HOST="smtp.gmail.com"
export SMTP_PORT="587"
export SMTP_SECURE="false"
export SMTP_USER="outreach@simplebeacon.ai"
export SMTP_PASS="your-app-password"
export SMTP_FROM="SimpleBeacon <outreach@simplebeacon.ai>"
export SENDER_NAME="Your Name"
export SENDER_TITLE="Founder, SimpleBeacon"
export CALENDLY_URL="https://calendly.com/yourname/30min"
```

## Campaign State

The pipeline persists all campaign state in `campaign-state.json`, including:

- Per-prospect tracking: sequence, current step, email history, reply/meeting/pilot status
- Aggregate stats: total contacted, replies, meetings, pilots, closed deals
- Contract value tracking

## Compliance & Ethics

- All prospects are B2B contacts in professional roles
- Email sequences include clear opt-out mechanisms
- CAN-SPAM compliant: physical address in footer, unsubscribe links
- No scraping of personal email addresses — business emails only
- Rate-limited sending to respect recipient inboxes
