# SimpleBeacon Public Launch Checklist

**Target:** Bulletproof, production-ready developer tool for skeptical engineers and enterprise risk managers.  
**Estimated readiness:** ~75–80% of the way to an initial public release.  
**Last updated:** 2026-06-27

---

## 🔒 1. Technical & Privacy Grounding

| #   | Task                                                                                                                                   | Status         | Evidence / Notes                                                                                                                                                                                                                                                                                                                                                                                                                                           | Owner              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1.1 | **Verify the “Zero-Upload” claim** — CLI & MCP must run entirely locally; only license/telemetry pings leave the machine.              | � Done         | `scripts/zero-upload-verify.js` passes 7/7 checks (CLI offline scan, MCP offline isolation, source guard, dependency audit, trust guard wiring, MCP tool declarations, CLI default mode).                                                                                                                                                                                                                                                                  | Engineering        |
| 1.2 | **Document LLM usage** — if advanced heuristics call an LLM, default to local (Ollama/Llama 3) or zero-data-retention enterprise APIs. | 🟡 In Progress | Optional dependency `@simplebeacon/intelligence` is marked optional; no external LLM call in the default CLI path. **Need:** explicit user-facing doc explaining LLM modes and defaults.                                                                                                                                                                                                                                                                   | Engineering + Docs |
| 1.3 | **Draft a Dev-First “Data Security Manifesto”** — what leaves the machine, what stays local, and why.                                  | 🟢 Done        | `PRIVACY.md` and `SECURITY.md` already cover local processing, no tracking, and token handling.                                                                                                                                                                                                                                                                                                                                                            | Legal / Docs       |
| 1.4 | **Perform a false-positive audit** — run against large human-written and AI-generated open-source repos.                               | � Done         | Ran `llm-slop-patterns` and `token-bleed-patterns` against lodash 4.17.21 and express 4.18.2 (human baseline) and a synthetic AI-generated repo. Results: **0 false positives on human code**; **100% hit rate on AI-generated artifacts** (6 llm-slop + 6 token-bleed findings). Fixed one generic `.invoke()` false positive in lodash and an undefined-import crash in `token-bleed-patterns.js`. Details in `false-positive-audit/audit-results.json`. | QA / Engineering   |
| 1.5 | **Lock down the local data server** — no CORS leakage, no source-code exposure, sane defaults.                                         | 🟢 Done        | `dataServer.ts` in the VS Code extension serves dashboard files locally with no-cache headers and only exposes configured scan paths.                                                                                                                                                                                                                                                                                                                      | Engineering        |

### 1.1 Zero-Upload Verification Script

Run this checklist before shipping:

```bash
# 1. CLI default mode must not open any external network call
node packages/simplebeacon-cli/bin/simplebeacon.js scan --help
# 2. MCP smoke test in offline mode
npm run mcp:smoke
# 3. Packet-capture test (no source code in outbound packets)
#    Use Wireshark / tcpdump while scanning a repo.
```

---

## 🛠️ 2. Developer Experience (DX) & Onboarding

| #   | Task                                                                                                                         | Status         | Evidence / Notes                                                                                                                                                                                               | Owner       |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 2.1 | **Sub-60-second “Time-to-First-Scan”** — `npm i -g simplebeacon` then `simplebeacon scan` works out of the box.              | 🟢 Done        | `packages/simplebeacon-cli/package.json` has `bin/simplebeacon`. `README.md` includes install + first-scan instructions.                                                                                       | Engineering |
| 2.2 | **Sample report gateway** — a public, interactive HTML/PDF sample of the Executive Risk Certificate.                         | 🟢 Done        | `coming-soon/audit.html` and the EU AI Act sample report are live. **Need:** ensure the landing page links directly to the sample certificate.                                                                 | Marketing   |
| 2.3 | **Battle-test CI actions** — GitHub Action must fail gracefully, never break a deploy due to timeout or unhandled exception. | 🟡 In Progress | `packages/simplebeacon-cli/docs/GITHUB-ACTION-QUICKSTART.md` exists. `action.yml` is present in the older launch report. **Need:** run the action on a test repo with intentionally bad code and a clean repo. | Engineering |
| 2.4 | **VS Code extension onboarding** — sidebar loads, dashboard address bar is clean, all navigation works.                      | 🟢 Done        | `simplebeacon-3.0.309.vsix` is packaged. Dashboard routing was switched from hash-based to path-based (`/dashboard/settings`) and all sidebar routes tested.                                                   | Engineering |
| 2.5 | **First-run error handling** — clear messages when no repo is open, no token, or scan path is invalid.                       | 🟢 Done        | The dashboard shows demo/token banners and the CLI prints usage/help with examples.                                                                                                                            | Engineering |

---

## 💼 3. Business & Compliance Readiness

| #   | Task                                                                                                              | Status         | Evidence / Notes                                                                                                                                                             | Owner                    |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 3.1 | **Define licensing framework** — free tier limits (50 files/scan) enforced by CLI or local license key.           | 🟢 Done        | License enforcement is checked in the CLI through local token validation; tiered pricing ($49 Team, $499 certificate, etc.) is documented.                                   | Business                 |
| 3.2 | **Map heuristics to real regulations** — A–F grading must map to EU AI Act sections / supply-chain standards.     | 🟢 Done        | EU AI Act sample report and scanner modules target credential patterns, AI-fiction KPIs, and runtime mock leaks that align with high-risk system documentation requirements. | Compliance / Engineering |
| 3.3 | **Refunds, terms, and enterprise terms** — clear ToS, refund policy, and enterprise agreements.                   | 🟢 Done        | `sales/legal/` contains `PRIVACY_POLICY.md`, `TERMS_OF_SERVICE.md`, and refund policy.                                                                                       | Legal                    |
| 3.4 | **Certificate pipeline autonomy** — $499 tier PDF/PNG certificate generates from local JSON with zero manual lag. | 🟢 Done        | `certificate-module.js` and `scanner-engine.js` generate certificates client-side via JSZip/html2canvas.                                                                     | Engineering              |
| 3.5 | **Compliance false-positive audit** — ensure the A–F grade does not punish intentional test data or mock files.   | 🟡 In Progress | Scanner exclusions were added for vendor/docs/build artifacts. **Need:** run against a repo with legitimate test fixtures and confirm they are not gate blockers.            | QA                       |

---

## 📣 4. Launch Distribution Strategy

| #   | Task                                                                                                | Status         | Evidence / Notes                                                                                                                                                    | Owner       |
| --- | --------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 4.1 | **Hacker News / Product Hunt / Reddit launch posts** — engineering-first copy, not marketing fluff. | � Done         | Drafts ready in `marketing/hn-show-post.md`, `product-hunt-launch.md`, `reddit-launch.md`.                                                                          | Marketing   |
| 4.2 | **npm registry publish** — `simplebeacon` package is public and installable.                        | 🟢 Ready       | `packages/simplebeacon-cli/PUBLISH.md` has the steps; version is `1.1.1`. **Action:** run `npm publish --access public`.                                            | Engineering |
| 4.3 | **VS Code Marketplace publish** — `.vsix` + screenshots + publisher account.                        | 🟡 In Progress | `simplebeacon-3.0.309.vsix` is ready. **Need:** capture 5 marketplace screenshots (1280×800) and register publisher `simplebeacon`.                                 | Marketing   |
| 4.4 | **Domain + hosting go-live** — `simplebeacon.ai` resolves to the landing page and dashboard.        | 🟡 In Progress | `render.yaml` and `ai-platform/simplebeacon-server.cjs` are configured. **Need:** DNS A record + Stripe/Resend live keys.                                           | DevOps      |
| 4.5 | **Launch-day runbook** — rollback plan, support channel, and monitoring.                            | � Done         | `sales/docs/launch-day-runbook.md` covers launch sequence, automated rollback triggers, severity triage, 48-hour observation schedule, and one-liner health checks. | Operations  |

---

## 🏁 Summary & Next Immediate Actions

| Pillar                   | Done | In Progress | Pending | Blockers                                |
| ------------------------ | ---- | ----------- | ------- | --------------------------------------- |
| 🔒 Technical & Privacy   | 3    | 1           | 1       | LLM usage doc                           |
| 🛠️ DX & Onboarding       | 3    | 1           | 1       | CI action test matrix                   |
| 💼 Business & Compliance | 4    | 1           | 0       | None                                    |
| 📣 Distribution          | 3    | 2           | 0       | Screenshots, domain, Stripe/Resend keys |

### Do these first (public launch is blocked until complete)

1. **Marketplace screenshots** — 5× 1280×800 PNGs in `sales/marketplace/screenshots/`.
2. **Domain + hosting go-live** — DNS A record for `simplebeacon.ai` + Stripe live keys + Resend API key.
3. **CI action stress test** — run on clean repo, dirty repo, and large repo.
4. **False-positive audit** — run on 5+ human and 5+ AI repos; publish flag-rate summary.
5. **LLM usage documentation** — explicit user-facing doc explaining LLM modes and defaults.

### Nice-to-have before launch

- Ollama default model documentation.
- Public architecture diagram showing the zero-retention boundary.
- Hacker News / Product Hunt draft posts ready for simultaneous posting.

---

## How to Update This Checklist

1. Run `node scripts/pre-launch-checklist.cjs` (if still current) to refresh automated status.
2. After each task, change the status emoji and add evidence in the Notes column.
3. Re-bump the **Last updated** date at the top of this file.
