# Test Plan: PagerDuty Destination Implementation

**Date:** 2026-07-31
**Branch:** main
**Feature:** Implement PagerDuty Events API v2 destination for alert delivery.

## Context

The alert dispatcher supports webhook, Slack, and email destinations. PagerDuty is the last remaining destination type. The PagerDuty Events API v2 accepts POST requests to `https://events.pagerduty.com/v2/enqueue` with a specific payload format.

## PagerDuty Events API v2 Schema

**Endpoint:** `POST https://events.pagerduty.com/v2/enqueue`

**Required fields:**
- `routing_key` — 32-char integration key (from `rule.destination.routingKey` or `rule.webhookUrl`)
- `event_action` — `trigger` (for new alerts)
- `payload.summary` — brief text summary
- `payload.source` — affected system location
- `payload.severity` — `critical`, `error`, `warning`, or `info`

**Optional fields:**
- `dedup_key` — for correlating triggers and resolves (max 255 chars)
- `payload.timestamp` — ISO 8601
- `payload.custom_details` — additional details object
- `payload.component` — component of source machine
- `payload.group` — logical grouping

**Severity mapping:** SimpleBeacon → PagerDuty
- `critical` → `critical`
- `high` → `error`
- `medium` → `warning`
- `low` → `info`
- `info` → `info`

## Change

**Single file:** `server/lib/alert-dispatcher.cjs`

1. Add `PAGERDUTY_SEVERITY_MAP` constant for severity mapping.
2. Add `formatPagerDutyEvent(payload, rule)` function that builds the Events v2 payload.
3. Add `deliverPagerDutyAlert(rule, payload)` function that POSTs to the PagerDuty API.
4. Modify `deliverAlert()` to delegate to `deliverPagerDutyAlert()` when `destinationType === 'pagerduty'`.

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
| L2.1 | Create PagerDuty rule + trigger → dispatcher attempts delivery | Incident recorded |
| L2.2 | PagerDuty payload has correct schema | routing_key, event_action, payload with summary/source/severity |
| L2.3 | Severity mapping correct | critical→critical, high→error, medium→warning, info→info |
| L2.4 | Webhook destination still works (no regression) | Raw JSON body preserved |
| L2.5 | Slack destination still works (no regression) | Slack-formatted body preserved |
| L2.6 | Email destination still works (no regression) | Email queued via email-service |

### Level 3 — Self-review / drift

| # | Item | Expected |
|---|------|----------|
| L3.1 | Single file changed | Only alert-dispatcher.cjs |
| L3.2 | No new dependencies | Uses built-in fetch |
| L3.3 | Webhook/Slack/email destinations unchanged | No regression in existing paths |
