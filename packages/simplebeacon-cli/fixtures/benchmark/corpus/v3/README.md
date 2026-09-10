# V3 corpus — diversity + hard negatives

**Purpose:** Stress the unchanged verification funnel with more vulnerability classes/variants and deliberately adversarial negatives.

**Rules:** Labels and fixture extracts only. **No verifier / gate / dashboard changes.**

| Kind | Expect |
|------|--------|
| Positives under `v3/*.js` | May reach Verified when evidence corroborates |
| `hard-negatives/*` | Must stay unverified (unsupported Verified = 0) |

Misses on positives are recorded as product limitations — not fixed by loosening the gate.
