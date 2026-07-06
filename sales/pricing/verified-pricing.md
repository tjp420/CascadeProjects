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
| Free | $0 | Basic (24 real-time IDE rules) | VSCode extension only | Community |
| Pro | $9/mo or $90/yr (17% savings) | Full (38 analyzer engines) | Batch CLI + CI/CD gate | Priority email |
| Enterprise | Custom | All Pro features | SSO, custom rules, 5+ seats | Dedicated channel + SLA |

**Payment:** Stripe (card/PayPal). Pro has 7-day money-back guarantee.

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
