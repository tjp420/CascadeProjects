# Gamedev / GZDoom starter templates

Copy these onto a **mod repo** (not the SimpleBeacon monorepo). Edit `projectName`, `cvarPrefix`, and `companionMod` as needed.

| File | Use when |
|------|----------|
| `config.generic.json` | New GZDoom mod (no companion) |
| `config.r3d-lighting.json` | R3DLighting + R3DOptions pair (primary mod) |
| `config.r3d-options.json` | R3DOptions (monsters / MODELDEF / States) |
| `simplebeaconignore` | All mods — stale backups, logs, build temp |

## Quick copy

**Windows (PowerShell)** — set `$MOD` to your mod folder:

```powershell
$MOD = "E:\Ai\Games\Doom\TEst\results\R3DLighting"
New-Item -ItemType Directory -Force -Path "$MOD\.simplebeacon" | Out-Null
Copy-Item ".simplebeacon\templates\gamedev\config.r3d-lighting.json" "$MOD\.simplebeacon\config.json"
Copy-Item ".simplebeacon\templates\gamedev\simplebeaconignore" "$MOD\.simplebeaconignore"
```

**macOS / Linux:**

```bash
MOD="/path/to/R3DLighting"
mkdir -p "$MOD/.simplebeacon"
cp .simplebeacon/templates/gamedev/config.r3d-lighting.json "$MOD/.simplebeacon/config.json"
cp .simplebeacon/templates/gamedev/simplebeaconignore "$MOD/.simplebeaconignore"
```

Then run scans from the monorepo root — see [docs/gzdoom-mod-author-setup.md](../../../docs/gzdoom-mod-author-setup.md).
