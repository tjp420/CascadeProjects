# V2 ground-truth corpus

**Purpose:** Expand labeled known vulnerabilities.  
**Rules:** Labels and fixture extracts only. **No verifier / gate / dashboard changes.**

Each label has:

- stable `id`
- `source` path under this corpus (or V1 fixture roots)
- `expectVerified: true`
- evidence chain sufficient to justify the label (for measurement via the existing promotion API)

V2 measures the **unchanged** production funnel against this corpus.

Misses are recorded as product limitations — not fixed in the same pass.
