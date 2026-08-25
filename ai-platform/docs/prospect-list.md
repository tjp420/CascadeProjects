# SimpleBeacon Curated Prospect List — First 50 Targets

## Target Criteria

- **Company size**: 50–500 employees
- **Stage**: Series A–C, or established private companies with compliance teams
- **Signal**: Recently raised funding, hiring for compliance/AI roles, or has EU operations
- **Pain**: Uses AI in customer-facing products, handles PII/financial/health data

---

## Industry 1: HR Tech (AI-Powered Hiring & Screening)

**Why**: Resume parsers, chatbot screeners, and AI assessment tools are Annex III high-risk under EU AI Act. These companies face immediate regulatory pressure and have no AI safety infrastructure.

**Target Titles** (LinkedIn Sales Navigator search):

- Chief Compliance Officer
- VP of Risk Management
- General Counsel
- VP of Legal / Head of Legal
- VP of People (secondary — owns hiring tool decisions)
- CTO (technical gatekeeper)

**Search Keywords**:

- `\"HR tech\" OR \"talent platform\" OR \"recruiting software\"`
- `\"AI hiring\" OR \"AI recruiting\" OR \"resume screening\"`
- `\"compliance\" AND \"HR\" AND \"Series A\"`

**Example Targets** (mid-market):

| Company          | Size | Why Target                                                    |
| ---------------- | ---- | ------------------------------------------------------------- |
| Greenhouse       | 300+ | Hiring platform with AI features; no public AI safety posture |
| Lever            | 200+ | ATS with AI screening; Series C; expanding to EU              |
| Workable         | 250+ | SMB hiring platform; AI-assisted candidate scoring            |
| Paradox (Olivia) | 200+ | AI recruiting chatbot; explicit AI component = high risk      |
| HireVue          | 400+ | AI video interviewing; already under FTC scrutiny             |
| Pymetrics        | 150+ | AI behavioral assessment; EU AI Act direct target             |
| Textio           | 100+ | AI writing assistant for job posts; high-risk for bias        |
| Eightfold AI     | 500+ | AI talent intelligence; massive AI surface area               |

---

## Industry 2: Medical Billing / Health Tech Software

**Why**: Health data + AI = highest possible regulatory exposure. GDPR + HIPAA + EU AI Act triple threat. Most billing platforms have zero AI governance documentation.

**Target Titles**:

- Chief Compliance Officer
- VP of Regulatory Affairs
- Chief Privacy Officer
- VP of Risk / Enterprise Risk Management
- General Counsel
- VP of Information Security (CISO)

**Search Keywords**:

- `\"medical billing software\" OR \"revenue cycle management\"`
- `\"health tech\" AND \"AI\" AND \"compliance\"`
- `\"HIPAA\" AND \"Series B\" AND \"software\"`

**Example Targets**:

| Company                        | Size | Why Target                                         |
| ------------------------------ | ---- | -------------------------------------------------- |
| R1 RCM                         | 500+ | Revenue cycle with AI claim denial prediction      |
| Experian Health                | 300+ | Credit data + health billing; dual regulated       |
| Change Healthcare (post-Optum) | 500+ | Massive AI in claims; rebuilding trust post-breach |
| Waystar                        | 400+ | Cloud RCM with AI-driven billing automation        |
| Cedar                          | 200+ | Patient billing platform; AI payment prediction    |
| Rivet Health                   | 100+ | Insurance verification AI; high-risk for errors    |
| Inbox Health                   | 50+  | AI patient billing communication                   |
| Saykara (Nuance)               | 100+ | AI medical scribing; voice-to-billing pipeline     |

---

## Industry 3: Automated Financial Services / FinTech

**Why**: Credit scoring, fraud detection, and algorithmic trading are explicitly listed in EU AI Act Annex III. These companies already have compliance teams but are scrambling to document their AI systems.

**Target Titles**:

- Chief Compliance Officer
- Chief Risk Officer (CRO)
- VP of Model Risk
- VP of Regulatory Affairs
- Head of AI Governance
- Head of Model Validation
- General Counsel

**Search Keywords**:

- `\"fintech\" AND \"compliance\" AND \"AI\"`
- `\"credit scoring\" OR \"fraud detection\" AND \"software\"`
- `\"algorithmic trading\" AND \"risk\" AND \"compliance\"`
- `\"open banking\" AND \"AI\" AND \"Series A\"`

**Example Targets**:

| Company        | Size | Why Target                                                                        |
| -------------- | ---- | --------------------------------------------------------------------------------- |
| Upstart        | 500+ | AI lending; under CFPB scrutiny; perfect case study                               |
| LendingClub    | 300+ | AI credit model; public company = board accountability                            |
| Kabbage (Amex) | 200+ | AI small business lending; post-acquisition compliance gap                        |
| Zest AI        | 150+ | AI credit underwriting; compliance is their pitch — but do they audit themselves? |
| Socure         | 400+ | AI identity verification; KYC/AML + AI = high risk                                |
| Alloy          | 200+ | Identity decisioning platform; AI in financial onboarding                         |
| Featurespace   | 300+ | AI fraud detection; UK-based = EU AI Act applies                                  |
| Quantexa       | 400+ | AI financial crime detection; enterprise scale                                    |

---

## EU AI Act Compliance Disclaimer

SimpleBeacon is a **deterministic code-scanning and audit tool** operated by human analysts. It does not make autonomous employment, credit, or healthcare decisions. All scan results are reviewed by qualified personnel before any compliance certification is issued. Clients retain full authority to override, challenge, or disregard any automated finding. Human-in-the-loop review is mandatory for every Executive Risk Certificate.

## Outreach Execution Sequence

### Week 1: Batch 1 (15 prospects)

- **Monday**: Send LinkedIn connection requests to 5 HR Tech CCOs with note from `outreach-cc-campaign.md`
- **Tuesday**: Send cold email to 5 Medical Billing VPs of Risk
- **Wednesday**: LinkedIn connections to 5 FinTech CROs
- **Thursday–Friday**: Follow up on any replies; book intro calls

### Week 2: Batch 2 (15 prospects)

- Repeat with next 15 from the list above
- Add new prospects discovered via LinkedIn "People also viewed"

### Week 3: Batch 3 (20 prospects)

- Mix of industries; begin referrals from Week 1 conversations

### Success Tracking

Log every interaction in `outreach-prospects.js`:

```bash
node docs/outreach-prospects.js add "Jane Doe" "Upstart" "FinTech" "Chief Risk Officer"
node docs/outreach-prospects.js stage <id> audit_requested
node docs/outreach-prospects.js report
```

### Conversion Target (Projected)

- 50 outreach attempts → 10 audit requests (projected 20%) → 3 paid conversions (projected 30% of audits) = $1,497–$7,497 estimated revenue
- These are business targets, not measured or guaranteed outcomes.
