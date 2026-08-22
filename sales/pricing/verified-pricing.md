# Verified Pricing (from canonical codebase sources)

## Source of truth

The codebase contains **two distinct pricing models** for two products:

| | AI Slop Cop | SimpleBeacon Enterprise SaaS |
|---|---|---|
| **File** | `sales/pricing/pricing.md` | `sales/pricing-model.md` |
| **Target** | Individual developers | Dev teams / enterprises |

---

## AI Slop Cop

| Tier | Price | Scans | Engines | Support |
|---|---|---|---|---|
| Free | $0 | 10 local scans/month (24 real-time IDE rules) | VSCode extension + CLI | Community |
| Pro | $9/mo or $90/yr (17% savings) | Unlimited (48 analyzer engines) | Batch CLI + CI/CD gate | Priority email |
| Compliance Suite | $399/mo or $3,999/yr (~16% savings) | Unlimited (48 analyzer engines) | EU AI Act + SOC 2 artifacts, 5 seats | Priority email + Slack |
| Enterprise Air-Gapped | Custom | Unlimited (48 analyzer engines) | On-premise/air-gapped, unlimited seats | Dedicated engineer + SLA |
| Audit Certificate | $149 one-time | 1 board-ready certificate | PDF + JSON + remediation roadmap | Email support |

**Payment:** Stripe (card/PayPal). Pro and Compliance Suite have 7-day money-back guarantee. Audit Certificate is non-refundable once generated.

---

## SimpleBeacon Enterprise SaaS

| Tier | Price | Repos | Compliance Export | License |
|---|---|---|---|---|
| Free / Community | $0 | 1 monorepo / machine | Plain JSON | None |
| Team | $149/mo | Up to 5 active repos | Signed Markdown audit | Local cryptographic token |
| Enterprise | Custom ($10K–$50K/yr typical) | Unlimited network monorepos | Signed PDF + crypto certificates | Local token + priority support |

**Discounts:** 5-10 seats = 10% off, 11-25 = 20%, 26-50 = 30%, 50+ = custom.

---

## What does NOT exist in the codebase

- **No "$19/mo Pro" tier** — Pro is $9/mo in `pricing.md`
- **No "$49/mo Team" tier** — Team is $149/mo in `pricing-model.md`
- **No 4-tier structure** — Both models use 3 tiers (Free/Pro/Enterprise or Free/Team/Enterprise)
- **No scan quotas** (100 / 2,500 / 10,000) — Not documented in either canonical source
