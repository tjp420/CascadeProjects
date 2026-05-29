# Benchmark Scan Allowlist (Public OSS Demos)

**Purpose:** Reduce false-positive **gate FAILs** when scanning cached mega-corp repos under `github-cache/` for marketing demos — without weakening scans on **client handoff** repos.

**Policy config:** [github-cache/.simplebeacon/config.json](../github-cache/.simplebeacon/config.json) (`profile: benchmark`)

---

## Rules

1. **Demos only** — Use `profile: benchmark` for `github-cache/*`, Microsoft PyRIT, Fortune-scale OSS walkthroughs.
2. **Client audits** — Use `standard` or `minimal`; do **not** copy benchmark ignore lists to paid engagements without review.
3. **Never claim** benchmark FAIL equals corporate security failure.

---

## What benchmark profile relaxes

| Pattern | Why excluded on benchmarks |
|---------|---------------------------|
| `**/*.d.ts` | Ambient TypeScript declarations (e.g. Vite `ImportMetaEnv`) |
| `**/tsconfig*.json` | JSONC comments valid for TypeScript, invalid for strict JSON.parse |
| `doc/**`, `docs/**` | Sphinx/notebook example code, `# type: ignore` density |
| `**/__tests__/**`, `**/e2e/**` | Test fixtures and fake API keys |
| `.github/instructions/**` | Copilot instruction files, TODO markers |

---

## How to run

```powershell
cd ai-platform
npx simplebeacon scan --path ./github-cache/microsoft-pyrit --config ./github-cache/.simplebeacon/config.json --gate
```

Or copy `github-cache/.simplebeacon/config.json` into any cached repo root before scanning.

---

## Codebase analyzer (dashboard / complete scan)

The analyzer **skips `github-cache/` and `deliverables/`** during filesystem walks (`REPO_SKIP_DIRS` in [codebase-analyzer.js](../server/lib/codebase-analyzer.js)).

If a report shows **10k+ findings** and **health score ~97** with top files under `github-cache/`, the export predates this fix or used a cached tree — re-run analyze on `ai-platform` only.

---

## Regression

When changing gate or syntax rules, re-scan three caches and note blocking count:

- `github-cache/microsoft-pyrit`
- `github-cache/google-guava` (or `google/*`)
- `github-cache/facebook-react`

Target: gate reflects **actionable** issues only; document known noise in scan notes, not in client PDF.

---

## Dashboard export trust (May 2026)

| Export artifact | Trust when |
|-----------------|------------|
| `simplebeacon-report` / fiction-digest | `scanPaths` → `web/data`, `repositoryFilesTotal` ~2,200, `reportHealth: platform-scoped` |
| `simplebeacon-assessment` | Matches scoped gate report |
| `fiction-digest-*.json` | `digestTrust: trustworthy`, embedded `sourceReport.sanitized: true` |
| `consolidation-*.json` | `repositoryFilesTotal` &lt; 10,000 — not 69k explorer inventory |
| `c-users-*-roadmap*.json` | `codeAnalysis.structure.totalFiles` &lt; 14,000 — not 41,500 |
| Complete scan bundle | Re-run after server restart; bundle sanitizers strip github-cache noise |

Archive exports with **69k** or **41k** file counts as pre-fix baselines only.

**Regenerate vendor bundle (CLI):**

```powershell
cd ai-platform
npm run pricing-proof:bundle
```

Copies land under `deliverables/vendor-handoff-2026-05-28/` and `.simplebeacon/archive/complete-scan-latest.json`.

---

## Approved public messaging

See [simplebeacon-million-dollar-operating-model.md](./simplebeacon-million-dollar-operating-model.md) § Approved marketing.
