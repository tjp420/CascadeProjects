# Known-vulnerable real-world fixture — OWASP NodeGoat (SSJS / eval)

**Milestone:** Known-vulnerable real-world fixtures under the Track 2 verification gate.

## Upstream

- Project: [OWASP NodeGoat](https://github.com/OWASP/NodeGoat)
- File: `app/routes/contributions.js`
- Issue class: A1 — Injection (server-side JavaScript via `eval(req.body.*)`)
- License: Apache License 2.0 (see `NOTICE`)

This directory contains a **minimal attributed extract** of the intentionally vulnerable contribution update handler for regression/E2E verification only.

## Expected gate outcome

`req.body.preTax` → `eval()` (and sibling fields) with the secure `parseInt` fix left commented out → **Verified** (RCE / SSJS injection) when evidence + independent audit + source corroboration succeed.

## Negative controls (must stay 0 Verified)

- Open WebUI evidence golden
- Gitea evidence golden
- Immich evidence golden

## Boundaries

- No category expansion in the engine
- No production redeploy
- **Maintainer outreach: OFF**
