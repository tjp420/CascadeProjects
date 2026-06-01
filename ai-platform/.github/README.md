# GitHub Actions for ai-platform

GitHub **only runs workflows from the repository root** (`.github/workflows/` at `CascadeProjects/`), not from this folder.

Use these workflows on PRs that touch `ai-platform/**`:

- `../../.github/workflows/simplebeacon-enterprise-gate.yml` — SB-ENT leak/token-cap + credentials + structural intent
- `../../.github/workflows/simplebeacon-ai-hygiene-gate.yml` — opt-in AST/hygiene packs

Local gate before push:

```bash
cd ai-platform
npm run simplebeacon:hygiene-gate
```
