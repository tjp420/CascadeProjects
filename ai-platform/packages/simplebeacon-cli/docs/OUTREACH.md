# Simplebeacon — sales & delivery (CLI-first)

> **Product:** Deterministic local scan engine. Clients run it; you optionally deliver executive PDF from their JSON report.

**Public proof:**

- Site: https://simplebeacon.ai  
- CLI: https://github.com/tjp420/simplebeacon  
- Sample deliverable: https://simplebeacon.ai/sample-report  
- Business inbox: **audit@simplebeacon.ai**

---

## How scanning works

**Code never leaves the client's infrastructure by default.**

| Model | Who scans | Client sends you |
|-------|-----------|------------------|
| **CLI in CI / Docker** (default) | Client on their runner or VPC | Optional: sanitized JSON report for PDF |
| **On-prem dashboard** | Client Docker stack | Nothing — see `docs/simplebeacon-on-premises-deployment.md` |
| ~~ZIP to founder~~ | ~~Deprecated~~ | ~~Do not offer as primary~~ |

**Workflow (recommended):**

1. Client runs `npx simplebeacon scan --gate --offline` or Docker equivalent  
2. Client tunes `.simplebeacon/config.json` allowlists for false positives  
3. Optional: client shares `.simplebeacon/report.json` (secrets redacted) for executive PDF  
4. You never need their source tree

---

## One-line pitch

> Local CLI that catches AI-placeholder KPIs and mock-data paths before merge — runs in CI or Docker on your infra, no repo upload.

---

## Paid PDF email (when client already ran CLI)

**Subject:** Executive summary from your Simplebeacon scan

Hi [Name],

If you've already run `simplebeacon scan --format json`, reply with your `.simplebeacon/report.json` (or attach the executive summary export). I'll deliver a branded PDF within 48 hours.

If you haven't run it yet:

```bash
npx --yes simplebeacon init --starter
npx --yes simplebeacon scan --gate --format json --output .simplebeacon/report.json
```

Your source stays on your machine. I only need the JSON artifact unless you want hands-on allowlist tuning on a call.

— Trevor  
https://simplebeacon.ai

---

## Objection: "I won't send you my IP"

Response: You don't have to. Run the CLI locally or in Docker (`docker/Dockerfile.cli`). Share JSON only if you want the PDF service. On-prem MSA: `docs/simplebeacon-enterprise-msa-template.md`.

---

## Objection: "4,000 findings on a public repo isn't impressive"

Response: Raw counts without triage are noise. Simplebeacon is strict by design — you tune allowlists in `.simplebeacon/config.json`. We report **gate-blocking** issues, not vanity totals.

---

## Do not

- Link paid prospects to "send us a zip" as the primary path  
- Copy-paste Reddit/HN scripts from old templates  
- Claim SOC 2, zero false positives, or "AI Safety platform"  
- Hide the open-source CLI from paying customers
