# GitHub Action templates

| File | Use when |
|------|----------|
| [simplebeacon-enterprise.yml](simplebeacon-enterprise.yml) | Single repo — `npx simplebeacon`, SB-ENT + credentials (no monorepo) |
| [simplebeacon-enterprise-monorepo.yml](simplebeacon-enterprise-monorepo.yml) | Monorepo subfolder (e.g. `ai-platform/`) with local CLI + `@simplebeacon/intelligence` |
| [simplebeacon-ai-hygiene-gate.yml](simplebeacon-ai-hygiene-gate.yml) | Opt-in AST/hygiene packs (token bleed, architecture drift) — pilot before `--gate` |
| [simplebeacon.yml](simplebeacon.yml) | Standard / cascade profile |

**Important:** GitHub only runs workflows from the **repository root** `.github/workflows/`. For a monorepo, copy `simplebeacon-enterprise-monorepo.yml` to `CascadeProjects/.github/workflows/` (see `ai-platform/.github/README.md`).

Config starting points:

- [../enterprise-config.json](../enterprise-config.json) — SB-ENT only
- [../ai-hygiene-enterprise-config.json](../ai-hygiene-enterprise-config.json) — SB-ENT + `intelligence.enabled`
