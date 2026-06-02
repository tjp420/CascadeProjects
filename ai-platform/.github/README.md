# GitHub Actions for ai-platform

GitHub **only runs workflows from the repository root** (`.github/workflows/` at `CascadeProjects/`), not from this folder.

Use these workflows from the **CascadeProjects** repo root (`.github/workflows/`):

| Workflow | Purpose |
|----------|---------|
| `simplebeacon-enterprise-gate.yml` | SB-ENT leak/token-cap + credentials + structural intent |
| `simplebeacon-ai-hygiene-gate.yml` | Opt-in AST/hygiene packs |
| `simplebeacon-npm-publish.yml` | Publish `simplebeacon` npm package on release tag `simplebeacon-v*` |

The copy under `packages/simplebeacon-cli/.github/workflows/` runs only when that folder is the **git repo root** (standalone `tjp420/simplebeacon`). In this monorepo, use the root workflow above.

Local gate before push:

```bash
cd ai-platform
npm run simplebeacon:hygiene-gate
```
