# GZDoom mod — SimpleBeacon setup (mod authors)

One-page guide for **R3DLighting**, **R3DOptions**, and similar GZDoom/ZScript mod trees. Run scans from the **SimpleBeacon monorepo** (`CascadeProjects`); config lives **on the mod**.

## 0. Starter templates (fastest path)

Copy from the monorepo — no hand-editing required:

| Template | Copy to |
|----------|---------|
| `.simplebeacon/templates/gamedev/config.generic.json` | `{mod}/.simplebeacon/config.json` |
| `.simplebeacon/templates/gamedev/config.r3d-lighting.json` | R3DLighting |
| `.simplebeacon/templates/gamedev/config.r3d-options.json` | R3DOptions |
| `.simplebeacon/templates/gamedev/simplebeaconignore` | `{mod}/.simplebeaconignore` |

Copy commands: [.simplebeacon/templates/gamedev/README.md](../.simplebeacon/templates/gamedev/README.md)

## 1. Create mod config (manual)

Path: `{mod}/.simplebeacon/config.json`

**Do not use `eu-ai-act`** for game mods — use **`gamedev`**.

### R3DLighting (lighting handlers + companion options mod)

```json
{
  "profile": "gamedev",
  "projectName": "R3DLighting",
  "scanPaths": ["."],
  "productionPaths": ["."],
  "ignore": [
    "**/*.log",
    "**/__pycache__/**",
    "build_temp/**",
    "Backup/**",
    "**/*_DUPLICATE.zs",
    "**/*_OLD.zs",
    "**/*.corrupt",
    "**/*.clean",
    "**/*_backup.zs"
  ],
  "rules": {
    "gzdoom-integrity-patterns": {
      "enabled": true,
      "respectIncludes": true,
      "severity": "high"
    }
  },
  "gate": {
    "enabled": true,
    "failOn": ["high"]
  },
  "gzdoom": {
    "cvarPrefix": "r3d_",
    "companionMod": "R3DOptions"
  }
}
```

`companionMod` is the **sibling folder name** (e.g. `../R3DOptions`). Required for cross-mod CVAR checks, `-norun` `-file` loading, and handler/MODELDEF mapping.

### R3DOptions (monsters, MODELDEF, States)

```json
{
  "profile": "gamedev",
  "projectName": "R3DOptions",
  "scanPaths": ["."],
  "productionPaths": ["."],
  "ignore": [
    "**/*.log",
    "build_temp/**",
    "**/*_DUPLICATE.zs",
    "**/*_OLD.zs"
  ],
  "gzdoom": {
    "cvarPrefix": "r3d_"
  },
  "rules": {
    "gzdoom-integrity-patterns": {
      "enabled": true,
      "respectIncludes": true,
      "extraActors": ["Pure3DImpBase", "Pure3DDemonBase"]
    }
  },
  "gate": { "enabled": true, "failOn": ["high"] }
}
```

`extraActors` lists base classes defined outside the scanned tree so cross-reference checks do not flag them as unresolved.

Copy the full template from the monorepo: `.simplebeacon/templates/gamedev/`.

### `gzdoom-integrity-patterns` rule options

| Option | Type | Purpose |
|--------|------|---------|
| `respectIncludes` | boolean | Only scan ZScript files reachable from `ZSCRIPT` (default: `true`) |
| `extraActors` | string[] | Actor/base class names defined outside the scanned tree |
| `companionMod` | string | Sibling mod folder name (e.g. `R3DOptions`) |
| `companionModPaths` | string[] | Extra mod roots to include in cross-mod checks |
| `cvarPrefix` | string | Project CVAR prefix (default: `r3d_`) |
| `cvarAllowlist` | string[] | Exact CVAR names to skip in all CVAR checks |
| `cvarAllowlistPrefixes` | string[] | CVAR name prefixes to skip in all CVAR checks |
| `deadCvarSeverity` | string | Severity for defined-but-unreferenced CVARs (default: `low`) |
| `extendedLint` | boolean | Run the extended linters (ZScript, EventHandler, GLDEFS, manifest, handler map, PK3) — also available as `--gzdoom-extended-lint` |
| `skipLints` | string[] | Extended linters to skip (e.g. `["zscript"]`) |
| `requiredLumps` | string[] | Lumps the PK3 lint requires in a packaged build |

Options set in the mod's top-level `gzdoom` block apply too; rule options win when both set the same key.

## 2. Add `.simplebeaconignore`

Path: `{mod}/.simplebeaconignore`

```
*.log
**/__pycache__/**
build_temp/**
Backup/**
**/*_DUPLICATE.zs
**/*_OLD.zs
**/*.corrupt
**/*.clean
.simplebeacon/**
```

Mod repos often **gitignore `.simplebeacon/`** — that is fine. Agents should read **`Docs/`** exports instead (below).

## 3. Run scans (from monorepo root)

```bash
cd /path/to/CascadeProjects

# Agent-readable summary (preferred handoff)
npm run gzdoom:export-summary -- --path "E:/Ai/Games/Doom/TEst/results/R3DLighting"
npm run gzdoom:export-summary -- --path "E:/Ai/Games/Doom/TEst/results/R3DOptions"

# Authoritative ZScript syntax gate (may take several minutes; both mods loaded)
npm run gzdoom:norun-gate -- --path "E:/Ai/Games/Doom/TEst/results/R3DLighting" --timeout 600000

# Full integrity + optional log correlation
npm run gzdoom:scan -- --path "E:/Ai/Games/Doom/TEst/results/R3DLighting" --log "E:/.../gzdoom.log"
```

Set `GZDOOM_EXE` if GZDoom is not at a known path.

## 4. Read outputs (for humans and coding agents)

| File | Purpose |
|------|---------|
| `{mod}/Docs/gzdoom-gate-summary.json` | High-severity findings, CVAR xref, death-frame reuse counts |
| `{mod}/Docs/gzdoom-gate-summary.md` | Human-readable summary |
| `{mod}/Docs/gzdoom-norun-gate.json` | `gzdoom.exe -norun` exit code and parse errors |

**Do not rely on `{mod}/.simplebeacon/report.json`** when that folder is gitignored.

## 5. What `gamedev` checks (high level)

- ZScript cross-refs (includes, duplicate classes, MODELDEF/sprites)
- Death-frame reuse (Missile/Melee/Pain frames shared with Death)
- CVARINFO ↔ MENUDEF ↔ ZScript `FindCVar`
- EVENTHANDLERS vs compiled handler classes
- GLDEFS / TEXTURES.txt / VOXELDEF asset paths
- Stale `*_DUPLICATE`, `*.corrupt` packaging artifacts
- Optional: `gzdoom.exe -norun` gate

## 6. Monorepo note (for agents)

- **Engine/rules:** `packages/simplebeacon-cli/` (not the VSIX folder alone)
- **VSIX:** `simplebeacon-vscode-merged/` packages the CLI for VS Code
- Details: root `AGENTS.md` → **Monorepo vs VSIX**
