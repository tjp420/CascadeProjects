# Simplebeacon pricing page copy

Use on **simplebeacon.ai** landing and **simplebeacon.ai/app#/pricing** (dashboard). Copy aligns with currently shipped product and service scope.

## Tiers

### Community — $0

- Local CLI: `npx simplebeacon scan --gate`
- JSON + text reports
- CI gate in GitHub Actions
- No hosted dashboard

### Cloud Teams — $49/month or $390/year

**Software (shipped today):**

- Hosted dashboard + scan history
- Compliance Audit dashboard (aggregates scan layers)
- Analyze dashboard (simplebeacon, consolidation, roadmap, optional AI)
- Assessment workflow UI + API
- JSON export from dashboard
- API quota on hosted scan/assess when billing enabled
- Self-serve config / allowlists in Settings

**Founding launch note:** 50 slots at launch pricing (if this promotion is active).

### Enterprise Perimeter — from $5,000 setup

**Software:** Everything in Cloud Teams

**Service (consulting / SOW — not separate automated modules):**

- Consultant-led allowlist + CI deploy
- Human triage of gate findings
- Executive memo for diligence / audits
- Reporting-first CI phase before `--gate`
- Optional retainer: **$2,500/month**

## Feature truth matrix

See **`docs/simplebeacon-feature-truth-matrix.md`** for software vs hosted vs service labels used on the pricing page.

## Stripe env (use **Price IDs** `price_...`, not Product IDs)

```bash
SIMPLEBEACON_MONETIZATION_ENABLED=true
STRIPE_SECRET_KEY=rk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_TEAMS_MONTHLY=price_...
STRIPE_PRICE_ID_TEAMS_ANNUAL=price_...
STRIPE_PRICE_ID_ENTERPRISE_SETUP=price_...
STRIPE_PRICE_ID_ENTERPRISE_RETAINER=price_...
SIMPLEBEACON_CALENDLY_URL=https://calendly.com/your-org/compliance-audit
SIMPLEBEACON_FOUNDING_SLOTS=50
```

## Which tier?

| Situation | Tier |
|-----------|------|
| Solo / OSS | Community |
| Team wants dashboard + assessments | Cloud Teams |
| Audit, vendor eval, PE diligence | Enterprise Perimeter |
| Ongoing allowlist curation | Enterprise retainer |

## FAQ

**Why strict defaults / many flags on Community CLI?**  
Rigidity catches vendor-questionnaire issues. Tune allowlists (Cloud Teams) or hire curation (Enterprise).

**Why $49/mo when CLI is free?**  
Hosted workflow, history, assessments, API — no consultant required.

**Why $5k+ if Cloud Teams exists?**  
Implementation, CI integration, false-positive triage, and exec deliverables for regulated buyers — **service**, not extra software modules.

**What's software vs service?**  
Dashboard, audit, analyze, and assessment UI are **software** today. Human triage, exec memos, and CI handoff are **Enterprise consulting** (SOW). See `docs/simplebeacon-feature-truth-matrix.md`.
