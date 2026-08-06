# Test Plan: Pricing Page Three-Tier Redesign

**Date:** 2026-01-15
**Branch:** fix/audit-token-flow
**Scope:** `coming-soon/public/pricing.html`, `coming-soon/pricing.html`

## Objective

Replace the existing 3-tier pricing grid (Free $0, Pro $9/mo, Compliance $399/mo) with a new 3-tier structure (Developer $49, Team Pro $149, Enterprise Custom). Add a "Zero Data Custody" compliance banner below the grid. Wire self-serve tiers to immediate Stripe checkout; wire Enterprise to demo booking.

## Check-Items

### Level 1 — Deterministic

| ID | Check | Method |
|----|-------|--------|
| L1.1 | Inline `<script>` blocks parse without syntax errors | `node -e` Function constructor on all `<script>` blocks |
| L1.2 | No stale `price_startup_monthly` / `price_compliance_monthly` references in tier buttons (one-time passes keep their IDs) | grep |
| L1.3 | Meta description / og / twitter tags updated to reflect new tiers | grep |
| L1.4 | `data-tier` attributes on new buttons match `openCheckoutModal` tierNames map | manual review |

### Level 2 — Behavioral

| ID | Check | Method |
|----|-------|--------|
| L2.1 | Billing toggle swaps Developer $49→$490/yr and Team Pro $149→$1,490/yr (Save 17%) | manual click in browser |
| L2.2 | "Subscribe" buttons on Developer and Team Pro open checkout modal with correct tier name | manual click |
| L2.3 | "Book Demo" button on Enterprise navigates to `/contact?topic=enterprise` (no checkout modal) | manual click |
| L2.4 | "Zero Data Custody" banner is visible below the pricing grid, before the one-time passes section | visual inspection |
| L2.5 | Sticky CTA text updated to reflect new pricing | visual inspection |

### Level 3 — Drift

| ID | Check | Method |
|----|-------|--------|
| L3.1 | One-time compliance passes section preserved unchanged | diff |
| L3.2 | Compare table / FAQ / Enterprise Trust sections preserved | diff |
| L3.3 | No ghost files or hallucinated API paths | review |

## Files

- `coming-soon/public/pricing.html` — primary
- `coming-soon/pricing.html` — mirror
