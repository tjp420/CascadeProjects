# Simplebeacon Discovery Demo Framework (Trust-First)

Use on **15-minute discovery calls** and **live demos** after a complimentary scan. Pair with the toxic honey-pot (`tests/fixtures/simplebeacon-toxic-fixtures`) for proof-of-gate behavior.

---

## 0. Open with trust (60–90 seconds)

**Script:**

> Before I show you the tool, let me address the security concerns enterprise teams usually raise first.
>
> **Simplebeacon is a 100% read-only static analysis engine.** The scan command reads files and writes reports only under `.simplebeacon/` (or your chosen `--output` path). It does not modify, delete, or auto-fix your application source code.
>
> **We start in reporting-only mode** — CI runs without `--gate` until your Engineering Lead and I sign off on allowlists. No surprise merge blocks.
>
> **Your code can stay in your infrastructure.** We support on-premises deployment in your private cloud (AWS/GCP/Azure) or a consultant-run read-only clone that is deleted after delivery. See `docs/simplebeacon-on-premises-deployment.md`.
>
> **This is compliance evidence**, not another CVE scanner. It helps you answer vendor diligence about mock data, sample paths, and unverifiable KPIs — alongside Snyk, GHAS, and SonarQube.

**Proof points (if challenged):**

| Claim | Evidence |
|-------|----------|
| Read-only on source | `tests/integration/scanner.test.js` — zero-mutation test |
| No blocking until sign-off | MSA Exhibit C + Week 1 CI without `--gate` |
| On-premises feasible | Docker stack + CLI-only mode in on-prem doc |

---

## 1. Agenda (15 minutes)

| Min | Topic |
|-----|--------|
| 0–2 | Trust statement (above) |
| 2–5 | Their stack + compliance context (SOC 2, HIPAA, enterprise buyers) |
| 5–10 | Walk top 3 findings from exec summary (confirmed vs allowlist vs noise) |
| 10–13 | Live or recorded scan on honey-pot OR their repo (read-only) |
| 13–15 | Pilot scope, on-prem preference, next step |

---

## 2. Live demo flow (optional)

### A. Honey-pot (no client repo needed)

```bash
cd tests/fixtures/simplebeacon-toxic-fixtures
npx simplebeacon scan --gate --format text
# Expect Gate: FAIL — credential, fiction KPI, production leak

npx simplebeacon scan --config .simplebeacon/docs-gate.config.json --gate
# Expect Gate: PASS — docs allowlist scope
```

Say: *"Same engine, different config — that's how we tune false positives before enabling `--gate` on your main branch."*

### B. Client repo (if they provided access)

```bash
npx simplebeacon scan --path /path/to/clone --format json --output .simplebeacon/report.json
# Do NOT pass --gate on first pass
```

Say: *"This run is reporting-only. Nothing blocked, nothing changed in your source tree."*

---

## 3. Compliance framing (SOC 2 / HIPAA)

**Say:**

- Simplebeacon produces **audit-friendly evidence** about mock/sample hygiene — not certification.
- Useful for **CC6/CC7-style** discussions: "How do you know dashboard metrics in repo files match measured CI?"
- For HIPAA: scoped pattern matching on repo files — **not** PHI discovery or a BAA substitute.

**Do not say:** "SOC 2 compliant tool," "HIPAA certified," or unsourced Gartner "80%" stats.

**Do say:** Gartner TRiSM framing — governance for AI-assisted development and unauthorized AI transactions / policy violations (use precise wording from `packages/simplebeacon-cli/docs/MARKETING.md`).

---

## 4. On-premises offer

> If you prefer, we deploy the CLI and optional dashboard entirely in your VPC. Your code never transits our SaaS. I can also conduct the initial assessment on-site at your Toronto office if that helps your security review.

Hand off: `docs/simplebeacon-on-premises-deployment.md`

---

## 5. Close

| Outcome | Next step |
|---------|-----------|
| Interested | Pilot SOW ($2,500) or Gold setup — Week 1 read-only per Exhibit A |
| Needs security review | Send MSA Exhibit C + on-prem doc + link to zero-mutation tests |
| Not now | Leave complimentary scan summary; 14-day follow-up per cold email kit |

---

## Related docs

- `docs/simplebeacon-cold-email-kit.md`
- `docs/simplebeacon-exec-summary-template.md`
- `docs/simplebeacon-enterprise-msa-template.md`
- `docs/simplebeacon-on-premises-deployment.md`
