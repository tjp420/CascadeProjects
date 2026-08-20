# SimpleBeacon Launch-Day Runbook

**Version:** 1.0.0
**Last Updated:** 2026-06-27
**Owner:** Engineering + Operations

---

## 1. Launch Sequence

| Time (T+minutes) | Action                                              | Owner            | Verification                                 |
| ---------------- | --------------------------------------------------- | ---------------- | -------------------------------------------- |
| T+0              | Confirm all blockers resolved (checklist at bottom) | Engineering Lead | LAUNCH-CHECKLIST.md 100%                     |
| T+5              | Publish `simplebeacon-cli` to npm registry          | Engineering      | `npm view simplebeacon-cli version` matches  |
| T+10             | Publish VS Code extension `.vsix` to Marketplace    | Marketing        | Publisher dashboard shows "Published"        |
| T+15             | Verify DNS `simplebeacon.ai` resolves to Render     | DevOps           | `dig simplebeacon.ai` shows correct A record |
| T+20             | Smoke test live Stripe checkout ($49 tier)          | Business         | Test payment succeeds, webhook received      |
| T+25             | Post Hacker News "Show HN" thread                   | Marketing        | URL live, comments enabled                   |
| T+30             | Post Product Hunt                                   | Marketing        | Product live, maker comment posted           |
| T+35             | Send launch email to waiting list                   | Marketing        | Resend dashboard shows delivered             |
| T+60             | Check Sentry for first-hour errors                  | Engineering      | Zero critical errors                         |

---

## 2. Rollback Plan

### Automated Triggers (Execute Without Waiting for Approval)

| Condition                                      | Action                                | Time Budget |
| ---------------------------------------------- | ------------------------------------- | ----------- |
| >5 GitHub issues with same error within 30 min | Deprecate npm + unpublish VSIX        | 5 min       |
| Stripe payment failure rate >5%                | Switch to test keys, pause checkout   | 2 min       |
| Render error rate >5% for 5 min                | One-click rollback to previous deploy | 3 min       |
| VS Code extension crash rate >0.5%             | Unpublish current VSIX immediately    | 5 min       |
| `simplebeacon.ai` DNS unresolvable             | CNAME fallback to Render default URL  | 1 min       |

### npm CLI

```bash
# One-liner deprecation + tag swap (run from any machine with npm auth)
BAD=v1.1.1; PREV=v1.1.0
npm deprecate simplebeacon@${BAD} "Critical bug — rolling back to ${PREV}"
npm dist-tag add simplebeacon@${PREV} latest
echo "Rollback complete. Verify: npm view simplebeacon version"
```

### VS Code Extension

```powershell
# Unpublish via VSCE CLI (faster than web portal)
npx @vscode/vsce unpublish simplebeacon.simplebeacon
# Re-publish previous .vsix if available
npx @vscode/vsce publish --packagePath simplebeacon-vscode-merged/simplebeacon-3.0.309.vsix
```

- Backup `.vsix` path: `simplebeacon-vscode-merged/simplebeacon-3.0.309.vsix`
- Previous version tag: `git tag | grep vscode | sort -V | tail -2 | head -1`

### Web / API (Render)

```bash
# CLI rollback (requires Render API key)
render rollback --service srv-ai-platform --version previous
# Fallback: manual via Render dashboard → Manual Deploy → Select previous commit
```

- Database: launch-day schema is read-only (no migrations), so rollback is stateless
- Stripe: `STRIPE_SECRET_KEY` env var swap to test mode in Render dashboard

### Rollback Verification Checklist

- [ ] `npm view simplebeacon version` shows previous version
- [ ] `curl https://simplebeacon.ai/api/health` returns 200
- [ ] Marketplace "Install" button resolves to previous VSIX
- [ ] Stripe test-mode checkout succeeds with test card `4242 4242 4242 4242`

---

## 3. Support Triage & Escalation

### Channel Matrix

| Channel                         | Purpose                       | Response SLA            | On-Call Owner    |
| ------------------------------- | ----------------------------- | ----------------------- | ---------------- |
| GitHub Issues                   | Bug reports, feature requests | 4 hours                 | Engineering Lead |
| Hacker News thread              | Public Q&A, community         | Real-time during launch | Marketing        |
| Email `support@simplebeacon.ai` | Private enterprise inquiries  | 1 hour (launch day)     | Engineering Lead |
| Discord (future)                | Community chat                | N/A — post-launch       | —                |

### Severity Classification (Launch Day)

| Severity          | Criteria                                                                            | Triage Action                              | Response                |
| ----------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------- |
| **P0 — Critical** | Blocks all users (install fails, crash on open, payment down)                       | Engineering Lead takes immediate ownership | Patch release within 2h |
| **P1 — High**     | Affects subset of users (false-positive gate block, VSIX load error on specific OS) | Assign to nearest available engineer       | Patch within 12h        |
| **P2 — Medium**   | Degraded experience (slow scan, UI glitch, docs typo)                               | Tag `launch-feedback`                      | Next sprint             |
| **P3 — Low**      | Nice-to-have (feature request, color preference)                                    | Tag `enhancement`                          | Roadmap                 |

### Escalation Flow

```
Report received → Classify severity (2 min)
    │
    ├── P0 ──────────────────→ Engineering Lead + Marketing
    │                         └── Execute rollback if >3 P0s in 30 min
    │
    ├── P1 ──────────────────→ Assigned engineer
    │                         └── If reproducible, open PR with reproduction steps
    │
    └── P2/P3 ───────────────→ Tag and queue for next sprint
```

### Triage Decision Tree

1. **Can the user still use the product?**
   - No → P0
   - Yes, but degraded → P1
2. **Is it a false positive blocking CI/CD?**
   - Yes → P1 (add `.simplebeaconignore` workaround + fix rule)
3. **Is it a documentation gap?**
   - Yes → P2 (update docs + reply with link)
4. **Is it a feature request?**
   - Yes → P3

### Communication Templates

**P0 Response (GitHub Issue):**

> We are actively investigating this. Rolling back to `v1.1.0` is safe: `npm i -g simplebeacon@1.1.0`. ETA for fix: 2 hours.

**P1 Response (GitHub Issue):**

> Confirmed on our end. Workaround: add the file to `.simplebeaconignore` or pass `--min-confidence=0.85`. We will ship a fix in the next patch.

**False Positive Response:**

> Thanks for the report. This is a known false positive in rule `SB-XXXX`. You can suppress it with `// simplebeacon-ignore` or raise the issue on our [false-positive tracker](https://github.com/tjp420/simplebeacon/issues/new?template=false-positive.md).

---

## 4. Telemetry, Metrics & Alert Thresholds

### Dashboards & Data Sources

| System | URL / Tool                       | Key Metrics                                    | Refresh     |
| ------ | -------------------------------- | ---------------------------------------------- | ----------- |
| Render | `dashboard.render.com`           | Uptime, latency, error rate                    | Real-time   |
| Stripe | `dashboard.stripe.com`           | Payment success, webhook delivery, refund rate | 1 min       |
| Sentry | `sentry.io`                      | VS Code: extension exceptions, CLI crashes     | Real-time   |
| npm    | `npmjs.com/package/simplebeacon` | Downloads, version adoption                    | ~10 min lag |
| GitHub | `github.com/tjp420/simplebeacon` | Issue velocity, PR count                       | Real-time   |

### Alert Thresholds (Automated Paging)

| Metric                        | Yellow          | Red (Page On-Call)   | Action                                   |
| ----------------------------- | --------------- | -------------------- | ---------------------------------------- |
| Render error rate             | >0.5% for 2 min | >2% for 5 min        | Rollback to previous deploy              |
| Render latency p95            | >500 ms         | >2 s                 | Check DB connection pool                 |
| Stripe payment success        | <95%            | <90%                 | Switch to test keys; pause checkout      |
| Stripe webhook failure        | >1%             | >5%                  | Verify endpoint signature; retry queue   |
| VS Code: extension crash rate | >0.05%          | >0.5%                | Unpublish current VSIX                   |
| npm download spike            | —               | >10k/hr (suspicious) | Check for bot traffic                    |
| GitHub issues / hour          | —               | >10 new issues       | Classify; trigger rollback if P0 cluster |
| Sentry unique events / hour   | —               | >50                  | Investigate top exception immediately    |

### One-Liner Health Checks

```bash
# Web API
watch -n 30 'curl -s https://simplebeacon.ai/api/health | jq .'

# Stripe checkout (test mode)
curl -X POST https://simplebeacon.ai/api/simplebeacon/billing/checkout \
  -H "Content-Type: application/json" \
  -d '{"tier":"instant","email":"test@example.com"}'

# CLI installability (simulate new user)
npm install -g simplebeacon@latest --dry-run

# MCP smoke test
node packages/simplebeacon-cli/bin/simplebeacon-mcp.js --smoke-test
```

### 48-Hour Observation Schedule

| Window         | Task                                                         | Owner                   | Success Criteria               |
| -------------- | ------------------------------------------------------------ | ----------------------- | ------------------------------ |
| **Hour 0–2**   | Monitor all channels; respond to every HN/PH comment         | Marketing + Engineering | Zero unanswered P0s            |
| **Hour 2–4**   | Deep-dive first 20 GitHub issues; tag severity               | Engineering Lead        | All issues classified          |
| **Hour 4–12**  | Patch any P0/P1; ship emergency release if needed            | Engineering             | CI green, npm publish succeeds |
| **Hour 12–24** | Compile feedback; create `launch-feedback` label; update FAQ | Marketing + Docs        | FAQ published                  |
| **Hour 24–48** | Write retrospective; update runbook with lessons             | Engineering Lead        | Runbook v1.1.0 drafted         |

---

## 5. Quick-Reference Commands

```bash
# Verify CLI install works for new users
npm install -g simplebeacon-cli
simplebeacon scan --help
simplebeacon scan --gate --offline

# Verify MCP server starts
npx simplebeacon-mcp --offline

# Verify VS Code extension loads
# (Install from Marketplace, open command palette, run "SimpleBeacon: Scan Workspace")

# Verify web dashboard
curl -s https://simplebeacon.ai/api/health
```

---

## 6. Pre-Launch Blocker Checklist

| #   | Item                                                    | Status     | Evidence                                                              |
| --- | ------------------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| 1   | **Zero-upload audit complete**                          | ✅ Done    | `node scripts/zero-upload-verify.js` exits 0 (7/7 checks pass)        |
| 2   | CI action stress-tested on clean/dirty/large repos      | ✅ Done    | `.github/workflows/simplebeacon-action-stress-test.yml` deployed      |
| 3   | VS Code: Marketplace screenshots uploaded (5× 1280×800) | � Pending  | `sales/marketplace/screenshots/`                                      |
| 4   | DNS A record live for `simplebeacon.ai`                 | 🔴 Pending | `dig simplebeacon.ai`                                                 |
| 5   | Stripe live keys in production env                      | 🔴 Pending | Render dashboard env vars                                             |
| 6   | Resend API key configured for transactional email       | 🔴 Pending | Render dashboard env vars                                             |
| 7   | MCP smoke test passes                                   | ✅ Done    | `node packages/simplebeacon-cli/bin/simplebeacon-mcp.js --smoke-test` |
| 8   | Launch-day runbook printed / bookmarked by on-call      | ✅ Done    | This file (`sales/docs/launch-day-runbook.md`)                        |
| 9   | Rollback plan tested on staging                         | 🟡 Pending | Run `scripts/pre-launch-checklist.cjs`                                |
| 10  | npm package `simplebeacon` publish-ready                | ✅ Done    | `npm run pack:check` passes                                           |
| 11  | VSIX packages cleanly                                   | ✅ Done    | `npm run package:vsix` in `simplebeacon-vscode-merged/`               |

---

## 7. Post-Launch (First 48 Hours)

| Hour  | Task                                                       |
| ----- | ---------------------------------------------------------- |
| 0–4   | Monitor all channels, respond to every comment             |
| 4–12  | Fix any P0 bugs immediately; patch release if needed       |
| 12–24 | Compile feedback into GitHub issues; tag `launch-feedback` |
| 24–48 | Write retrospective; update runbook with lessons learned   |

---

_This runbook is a living document. Update after every release._
