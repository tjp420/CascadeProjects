# SimpleBeacon Launch-Day Triage & Runbook

## 1. Quick-Rollback Procedures

### Web Dashboard & API (Render)
- **Command:** `render rollback --service srv-ai-platform --version previous`
- **Fallback:** If Render edge routers degrade, change Cloudflare DNS CNAME to point to backup fallback instance.

### VS Code Extension & CLI (npm)
- If `v1.1.1` introduces an unexpected breaking change, run:
  ```bash
  npm deprecate simplebeacon@1.1.1 "Critical bug fix pending. Please use v1.1.0."
  ```

## 2. Technical Support Escalation Matrix

- **Level 1 (Billing/Stripe issues):** Triage using Stripe Dashboard logs; verify webhook signature match.
- **Level 2 (False Positives / Scan Blockers):** Request the local `.simplebeacon/report.json` and isolate pattern rules via `llm-slop-patterns.js`.

## 3. False-Positive Management Strategy

### Confidence Thresholds
Every detection rule carries a `confidence` score (0.0–1.0). The VS Code extension and CLI both support a configurable `minConfidence` threshold.

| Threshold | Behavior | Recommended For |
|-----------|----------|-----------------|
| `0.90` | Only explicit AI signatures (placeholders, boilerplate) | Production gate checks |
| `0.60` | Medium+ confidence (default) | Day-to-day development |
| `0.50` | All patterns including stylistic hints | Deep audit / pre-release |

- **VS Code:** Set `simplebeacon.minConfidence` in user settings.
- **CLI:** Pass `--min-confidence=0.75` (upcoming flag) or configure in `.simplebeacon/config.json`.

### Context Exclusions
Rules declare `contextExclusions` in `llm-slop-catalog.json` to skip known-safe contexts:
- **File extensions:** `.test.js`, `.spec.ts`, `.css`, `.md`, etc.
- **Line prefixes:** `// TODO`, `// NOTE`, `// FIXME`, `// simplebeacon-ignore`

### User Dismissal (VS Code Extension)
Individual findings can be dismissed via the Problems panel or command palette. Dismissed signatures are tracked per session and will not re-alert until `SimpleBeacon: Reset Dismissed Issues` is executed.

### Triage Workflow
1. Reproduce the finding locally with `npx simplebeacon scan --path <file>`.
2. Check the rule `confidence` and `contextExclusions` in `llm-slop-catalog.json`.
3. If the match is valid but noisy for your codebase, add the file pattern to `.simplebeaconignore` or raise the `minConfidence` threshold.
4. If the match is fundamentally wrong, file an issue with the rule ID, sample snippet, and expected behavior.
