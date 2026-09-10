# Local evidence click-through (no deploy)

Enriched reports with signal triage + semantic verification:

| File | Expected headline |
| --- | --- |
| `open-webui-evidence.json` | 182 → 177 dismissed → 4 review → **0 verified** |
| `gitea-evidence.json` | 712 → 689 dismissed → 22 review → **0 verified** |
| `immich-evidence.json` | 245 → 233 dismissed → 11 review → **0 verified** |

## Gate status

| Gate | Status |
| --- | --- |
| **1 — Local click-through / golden fixtures** | Automated: 8/8. Manual visual (2026-09-10): Audit → Paste JSON for all three fixtures — headlines, dismissals, clusters, privileges, **Verified=0** match. |
| **2 — Production-build smoke** | `npm run build` in `ai-platform/web/simplebeacon-dashboard` succeeded; `assets/main.js` includes Evidence state UI. **Not deployed.** |
| **3 — Deploy to simplebeacon.ai** | **DONE 2026-09-10** — Worker `simplebeacon-dashboard-v2` + Pages. Live `main.js` / `main-DFCoPisA.js` include Evidence state. **No maintainer outreach.** |

Invariant: **Critical/High detector severity never increases Verified count.**

## Track 2 — Verified Vulnerability Engine

- Module: `packages/simplebeacon-cli/src/lib/verified-vulnerability-engine.js`
- Hard rule: Investigate → Verified **only** with a complete auditable evidence chain.
- **Slice 1:** syntactic gate + golden adversarial (0 Verified) + positive XSS control.
- **Slice 2:** `syntacticallyComplete` ≠ `evidentiallyComplete` — plausible-but-invalid chains stay Investigate.
- **Slice 3:** convincing false narratives (hedges, sanitizer-without-bypass, fixture sources, templated mechanisms, cycles, trust-boundary laundering) fail closed to Investigate.
- **Slice 4:** Verified requires an independently reproducible `auditRecord` (`source → transformations → controls → sink → impact`); second-reviewer check without trusting the engine label.
- **Slice 5:** Verified also requires `corroborateFromSourceContext` — claimed source/sink must appear in real repo/source text; missing or contradictory source fails closed.
- **Slice 6:** Deliberately vulnerable XSS fixture on disk (`fixtures/deliberately-vulnerable-xss`) proves **real source → Verified**; goldens remain negative controls at **0 Verified**.
- **Known-vulnerable real-world fixture (authorized):** OWASP NodeGoat SSJS `eval(req.body.*)` extract under `fixtures/known-vulnerable-nodegoat` → **Verified** (RCE) under the same gate; goldens stay **0 Verified**. Test: `known-vulnerable-nodegoat.test.js`.
- Tests: `verified-vulnerability-engine.test.js` + `verified-slice6-repo-fixture.test.js` + `known-vulnerable-nodegoat.test.js`
- **Maintainer outreach: OFF** · **No redeploy for Track 2 yet**

## Release validation (2026-09-10) — authorized; **STOP after report**

| Step | Result |
| --- | --- |
| 1 Full regression | **PASS** — engine/adversarial/slice2–6/NodeGoat/semantic verifier/goldens/evidence-state: **65+8+3** green |
| 2 Production build smoke | **PASS** — `tsc -b && vite build && prepare-worker-assets`; live + local asset `main-DFCoPisA.js` |
| 3 Deploy diff vs live Evidence RC | Track 2 NodeGoat = **CLI/fixtures/tests only** → **nothing required to redeploy for that milestone**. Live already serves Evidence RC (`main-DFCoPisA.js`). Local tree still has unrelated dirty paths (`worker-deploy`, `coming-soon/public`, other CLI) — do **not** ship those without a separate scoped deploy review. |
| 4 Evidence/UI + severity gate | **PASS** — UI hierarchy Evidence→explanation→context→severity; `detector severity (unverified)`; severity-alone tests remain Investigate |
| 5 Outreach OFF + no category expansion | **PASS** — pipeline lists `maintainer-outreach` but note says not set; goldens `emailReady=false`; verifier categories still eval/xss/credentials/secretLogging only |
| 6 Stop | **DONE** — deploy **not** authorized |

**Production redeploy: 🔒 NOT AUTHORIZED** · **Further Track 2: 🔒 NOT AUTHORIZED** · **Outreach: 🔒 OFF**

## Manual Gate 1

1. `npm run dev` in `ai-platform/web/simplebeacon-dashboard`
2. **Audit → Import Existing Report** → each `*-evidence.json`
3. Confirm Evidence state above severity; Verified = 0; Redis Lua dismissed; Gitea XSS clustered; Immich CLI = `local-operator-cli`

```bash
node packages/simplebeacon-cli/scripts/enrich-evidence-reports.cjs
```
