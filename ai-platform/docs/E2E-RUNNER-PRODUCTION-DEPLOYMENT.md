# E2E Runner Production Deployment Guide

## Overview

This guide covers production deployment and operations for the Python telemetry and notification track:

- `ai-platform/tests/test_simplebeacon_e2e_runner.py`
- `ai-platform/tests/generate_e2e_remediation_log.py`
- `.github/workflows/simplebeacon-e2e.yml`

The pipeline is split into three phases in CI:

1. Crawl and generate JSON/JUnit/security artifacts.
2. Validate report schema (smoke gate).
3. Dispatch Slack/Discord notifications from validated report.

## Runtime Requirements

- Python 3.11+
- Playwright Python package
- Chromium browser installed via Playwright

Install sequence:

```bash
python -m pip install --upgrade pip
pip install playwright
playwright install --with-deps chromium
```

## Secrets and Webhook Routing

Configure these GitHub Actions secrets:

- `MONITORING_SLACK_URL`
- `MONITORING_DISCORD_URL`
- `MONITORING_WEBHOOK_URL` (legacy fallback)

Routing behavior:

- If `--slack-webhook` and/or `--discord-webhook` are provided, they are used directly.
- If only legacy `--webhook` is provided, Discord URLs route to Discord and all others route to Slack.

## Report Schema Gate (Pre-Notification)

Notifications are gated by schema validation before dispatch.

Required top-level keys include:

- `startUrl`, `domain`, `startedAt`, `finishedAt`, `durationSec`
- `totals`
- `severityCounts`
- `highestActiveSeverity`
- `passedRoutes`, `failedRoutes`, `failedRoutesDetailed`
- `consoleErrors`

Required nested keys:

- `totals`: `visited`, `passed`, `failed`, `interactions`, `consoleErrors`, `payloadInjections`, `xssReflected`
- `severityCounts`: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`

If validation fails, notifications are not sent and the step exits non-zero.

## CI Flow

Workflow: `.github/workflows/simplebeacon-e2e.yml`

1. Validate payload-shape test:

```bash
python ai-platform/tests/test_notification_payload_schema.py
```

2. Execute runner in crawl mode without dispatch:

```bash
python ai-platform/tests/test_simplebeacon_e2e_runner.py \
  --json-out .simplebeacon/logs/simplebeacon-e2e-report.json \
  --junit-out .simplebeacon/logs/simplebeacon-e2e-report.xml \
  --screenshot \
  --skip-notifications
```

3. Smoke-check report schema:

```bash
python ai-platform/tests/test_simplebeacon_e2e_runner.py \
  --notify-from-report .simplebeacon/logs/simplebeacon-e2e-report.json \
  --skip-notifications
```

4. Dispatch notifications from validated report:

```bash
python ai-platform/tests/test_simplebeacon_e2e_runner.py \
  --notify-from-report .simplebeacon/logs/simplebeacon-e2e-report.json \
  --slack-webhook "$SLACK_CHANNEL_SECRET" \
  --discord-webhook "$DISCORD_CHANNEL_SECRET" \
  --webhook "$LEGACY_TRACKING_SECRET"
```

5. Generate remediation markdown and upload artifacts.

## Local Pre-Flight Checklist

1. Compile runner:

```bash
python -m py_compile ai-platform/tests/test_simplebeacon_e2e_runner.py
```

2. Compile remediation generator:

```bash
python -m py_compile ai-platform/tests/generate_e2e_remediation_log.py
```

3. Run payload schema test:

```bash
python ai-platform/tests/test_notification_payload_schema.py
```

4. Run crawler via compatibility loader:

```bash
python ai-platform/tests/test_simplebeacon.py --no-route-assertions
```

5. Generate remediation log:

```bash
python ai-platform/tests/generate_e2e_remediation_log.py \
  --report .simplebeacon/logs/simplebeacon-e2e-report.json \
  --output .simplebeacon/logs/final-audit-remediation.md \
  --manifest .simplebeacon/final-audit-manifest.md
```

## Troubleshooting

### Windows Python alias issue

If `python` launches the Windows Store alias or returns access denied:

1. Open Windows Settings.
2. Go to Manage app execution aliases.
3. Disable `python.exe` and `python3.exe` aliases.
4. Re-run the pre-flight checklist.

### Notification dispatch failures

- Webhook transport errors are warning-only and do not change crawl result classification.
- Schema validation failures are hard failures and block notification dispatch.

## Rollback

If notification changes need rollback:

1. Revert runner changes in `test_simplebeacon_e2e_runner.py`.
2. Revert workflow split steps in `.github/workflows/simplebeacon-e2e.yml`.
3. Keep the JSON report generation path intact so remediation and artifacts continue to work.
