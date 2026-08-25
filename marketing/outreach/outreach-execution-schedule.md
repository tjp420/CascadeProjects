# B2B Cold Email Outreach — Execution Schedule

**Created:** August 22, 2026
**Launch window:** Late August – October 2026
**Pipeline:** `marketing/outreach/outreach-pipeline.js`
**Prospects:** 50 qualified leads (16 CLO, 16 CCO, 18 CRO)

---

## Campaign Architecture

### Sequences (already built)

| Sequence     | Persona                        | Emails | Cadence         | Total Days |
| ------------ | ------------------------------ | ------ | --------------- | ---------- |
| A            | CLO (Chief Legal Officer)      | 4      | Day 0, 4, 8, 15 | 15 days    |
| B            | CCO (Chief Compliance Officer) | 3      | Day 0, 5, 10    | 10 days    |
| C            | CRO (Chief Risk Officer)       | 2      | Day 0, 5        | 5 days     |
| Reactivation | All (no-reply)                 | 3      | Day 30, 60, 90  | 90 days    |

### Volume Plan

| Week | Start Date   | Prospects Emailed | Cumulative | Daily Cap |
| ---- | ------------ | ----------------- | ---------- | --------- |
| 1    | Aug 25 (Mon) | 10                | 10         | 2/day     |
| 2    | Sep 1 (Mon)  | 10                | 20         | 2/day     |
| 3    | Sep 8 (Mon)  | 10                | 30         | 2/day     |
| 4    | Sep 15 (Mon) | 10                | 40         | 2/day     |
| 5    | Sep 22 (Mon) | 10                | 50         | 2/day     |

**Daily cap: 2 emails/day** to warm up the sending domain and avoid spam filters.
**Sending window:** Tuesday–Thursday, 9:00–11:00 AM recipient local time.
**No Mondays** (highest inbox volume), **no Fridays** (lowest open rates).

---

## Execution Timeline

### Phase 1: Warmup (Aug 22–24)

- [ ] Verify SMTP credentials (Zoho `admin@simplebeacon.ai`)
- [ ] Set `SENDER_NAME`, `CALENDLY_URL` env vars
- [ ] Run `node outreach-pipeline.js --prospects prospects.json --dry-run` to preview all emails
- [ ] Verify each template renders correctly with prospect data
- [ ] Check spam score with mail-tester.com (send test to `mail-tester.com` address)
- [ ] Confirm SPF/DKIM/DMARC are set up for `simplebeacon.ai` domain
- [ ] Set up reply tracking (forward replies to `admin@simplebeacon.ai`)

### Phase 2: Batch 1 — First 10 Prospects (Aug 25–29)

- [ ] **Mon Aug 25**: Load batch 1 (2 CLO, 2 CCO, 2 CRO + 4 more spread across Tue–Thu)
- [ ] **Tue Aug 25**: Send 2 initial emails (1 CLO, 1 CRO)
- [ ] **Wed Aug 26**: Send 2 initial emails (1 CCO, 1 CRO)
- [ ] **Thu Aug 27**: Send 2 initial emails (1 CLO, 1 CCO)
- [ ] **Tue Sep 1**: Send follow-up step 2 for CLO batch (day 4)
- [ ] **Wed Sep 2**: Send follow-up step 2 for CRO batch (day 5)
- [ ] **Thu Sep 3**: Send follow-up step 2 for CCO batch (day 5)
- [ ] **Fri Sep 4**: Log all opens, clicks, replies from batch 1

### Phase 3: Batch 2 — Next 10 Prospects (Sep 1–5)

- Same cadence as batch 1, offset by 1 week
- Continue follow-ups for batch 1

### Phase 4: Batch 3–5 (Sep 8–26)

- 10 prospects per week
- Follow-ups from previous batches continue in parallel
- By Sep 26: all 50 prospects have received initial email

### Phase 5: Reactivation (Oct 24 onwards)

- Day 30 reactivation emails start Oct 24 for batch 1
- Day 60 reactivation emails start Nov 23
- Day 90 reactivation emails start Dec 23

---

## Sending Commands

```bash
# Dry run — preview all emails without sending
node marketing/outreach/outreach-pipeline.js \
  --prospects marketing/outreach/prospects.json \
  --dry-run

# Send batch (first 10 prospects)
node marketing/outreach/outreach-pipeline.js \
  --prospects marketing/outreach/prospects.json \
  --send \
  --limit 10

# Check campaign status
node marketing/outreach/outreach-pipeline.js --status

# Send follow-ups (automatically detects which prospects are due)
node marketing/outreach/outreach-pipeline.js \
  --prospects marketing/outreach/prospects.json \
  --send \
  --followups-only
```

### Required Environment Variables

```bash
SENDER_NAME="Trevor"
SENDER_TITLE="Founder, SimpleBeacon"
CALENDLY_URL="https://calendly.com/simplebeacon/30min"
SMTP_HOST=smtp.zohocloud.ca
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=admin@simplebeacon.ai
SMTP_PASS=<zoho-app-specific-password>
SMTP_FROM=admin@simplebeacon.ai
```

---

## Response Handling

### Reply Routing

All replies to `admin@simplebeacon.ai` should be triaged within 4 hours during business days.

### Reply Categories

| Reply Type         | Action                                              | Response Time |
| ------------------ | --------------------------------------------------- | ------------- |
| Demo request       | Send Calendly link + enterprise one-pager           | < 2 hours     |
| Technical question | Answer directly or schedule call                    | < 4 hours     |
| Pricing request    | Send `sales/pricing/verified-pricing.md` + DPA link | < 4 hours     |
| Not interested     | Remove from sequence, log reason                    | Same day      |
| Out of office      | Reschedule sequence for their return date           | Auto          |
| Unsubscribe        | Remove immediately, log in suppression list         | Immediately   |

### Escalation Path

1. **Positive reply** → Founder responds personally within 2 hours
2. **Technical deep-dive requested** → Schedule 30-min demo (see technical demo prep doc)
3. **Procurement process started** → Send DPA, security whitepaper, enterprise one-pager
4. **Enterprise deal (> $5K ARR)** → Founder + technical co-founder join call

---

## Tracking Metrics

### Per-Batch Metrics (review every Friday)

| Metric              | Target | Action if Below                           |
| ------------------- | ------ | ----------------------------------------- |
| Open rate           | > 40%  | Check subject lines, verify SPF/DKIM      |
| Reply rate          | > 8%   | A/B test body copy, check targeting       |
| Demo booking rate   | > 3%   | Review CTA clarity, test alternative CTAs |
| Unsubscribe rate    | < 2%   | Normal. If > 5%, review targeting         |
| Spam complaint rate | < 0.1% | Stop campaign, verify domain reputation   |

### Campaign-Level Metrics (review at end of each phase)

| Metric                             | Target              |
| ---------------------------------- | ------------------- |
| Total prospects contacted          | 50                  |
| Total demos booked                 | 5+ (10% conversion) |
| Total enterprise deals in pipeline | 2+                  |
| Revenue in pipeline                | $10K+ ARR           |

---

## Compliance Notes

- **CAN-SPAM**: Include unsubscribe link in every email (already in templates)
- **GDPR**: Prospects are B2B contacts at EU/UK companies — legitimate interest applies
- **Reply tracking**: All replies logged in campaign state file for audit trail
- **Suppression list**: Maintained automatically by pipeline — never email someone who unsubscribed
- **Data retention**: Prospect data deleted 180 days after last contact unless deal is active

---

## Risk Mitigation

| Risk                   | Mitigation                                                     |
| ---------------------- | -------------------------------------------------------------- |
| Domain reputation drop | Daily cap of 2 emails, warmup period, monitor bounce rate      |
| Spam filter triggers   | Verified SPF/DKIM/DMARC, plain text emails, no images          |
| Low reply rate         | A/B test subject lines after batch 2, adjust persona targeting |
| Calendly no-shows      | Send reminder 1 hour before, offer alternative time            |
| Enterprise deal stalls | Send DPA + security whitepaper proactively at day 10           |
