# Test Plan: Email Destination for Alert Dispatcher

**Date:** 2026-07-31
**Branch:** main
**Feature:** Implement email destination for alert delivery using existing email-service.cjs.

## Context

The alert dispatcher (`alert-dispatcher.cjs`) currently supports webhook and Slack destinations. The codebase already has a complete email service (`server/lib/email-service.cjs`) with `sendEmail({ to, subject, text, html })` that supports Cloudflare Email → Resend → SMTP → disk queue fallback. We need to wire the alert dispatcher to use this service when `destinationType === 'email'`.

## Change

**Single file:** `server/lib/alert-dispatcher.cjs`

1. Add `formatEmailMessage(payload)` function that builds email subject, text body, and HTML body from the alert payload.
2. Modify `deliverAlert()` to call `sendEmail()` when `destinationType === 'email'`, using the recipient from `rule.destination?.email` or `rule.webhookUrl` (reusing the URL field as email recipient for simplicity).
3. Skip the HTTP fetch loop for email destinations — use the email service directly.

## Objective Check-Items

### Level 1 — Deterministic

| # | Item | Expected |
|---|------|----------|
| L1.1 | `node -c` on alert-dispatcher.cjs | exit 0 |
| L1.2 | `npx simplebeacon scan --gate` | PASS (exit 0) |
| L1.3 | WebSocket integration test | 16/16 pass |

### Level 2 — Behavioral

| # | Item | Expected |
|---|------|----------|
| L2.1 | Create email rule + trigger → dispatcher attempts email send | Incident recorded |
| L2.2 | Email format has subject, text, and html | All 3 fields populated |
| L2.3 | Webhook destination still works (no regression) | Raw JSON body preserved |
| L2.4 | Slack destination still works (no regression) | Slack-formatted body preserved |
| L2.5 | Email to invalid address records incident as failed | Status: failed |

### Level 3 — Self-review / drift

| # | Item | Expected |
|---|------|----------|
| L3.1 | Single file changed | Only alert-dispatcher.cjs |
| L3.2 | No new dependencies | Uses existing email-service.cjs |
| L3.3 | Webhook/Slack destinations unchanged | No regression in existing paths |
