# Test Plan: Slack Destination for Alert Dispatcher

**Date:** 2026-07-31
**Branch:** main
**Feature:** Implement Slack Incoming Webhook message formatting for alert delivery.

## Context

The alert dispatcher (`alert-dispatcher.cjs`) currently sends raw JSON payloads to all destination types. Slack Incoming Webhooks expect a specific message format with `text` field and optional `blocks` for rich formatting. The current "Slack-specific formatting" code (line 62-64) only sets the Content-Type header — it doesn't format the body.

## Change

**Single file:** `server/lib/alert-dispatcher.cjs`

Add a `formatSlackMessage(payload)` function that converts the alert payload into a Slack message with:
- Severity-colored attachment (red=critical, orange=high, yellow=medium, blue=info)
- Event type as title
- Message as main text
- Data fields as attachment fields
- Timestamp

Modify `deliverAlert()` to use the formatted Slack message body when `destinationType === 'slack'`.

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
| L2.1 | Create Slack rule + trigger → dispatcher sends Slack-formatted body | Body contains `text` and `attachments` fields |
| L2.2 | Slack message has severity-colored attachment | Color matches severity |
| L2.3 | Webhook destination still sends raw JSON (no regression) | Body is raw JSON payload |
| L2.4 | Slack delivery to non-existent URL records incident as failed | Status: failed |

### Level 3 — Self-review / drift

| # | Item | Expected |
|---|------|----------|
| L3.1 | Single file changed | Only alert-dispatcher.cjs |
| L3.2 | No new dependencies | Uses built-in fetch |
| L3.3 | Webhook destination unchanged | Raw JSON body preserved for non-Slack |
