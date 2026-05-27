# Simplebeacon analyze path configuration

Analysis endpoints that accept a `projectPath` (roadmap, codebase, inventory, Simplebeacon scan, consolidation) validate the path against an **allowed roots** list before reading the filesystem.

## Where validation runs

| Module | Endpoints |
|--------|-----------|
| `server/lib/path-safety.js` | Shared `assertSafeProjectPath`, `resolveDefaultAllowedRoots` |
| `server/routes/flexible-analyze-api.js` | `POST /api/analyze/flexible`, `GET /api/analyze/codebase`, `GET /api/analyze/inventory` |
| `server/api/assessment/AssessmentController.js` | Authenticated assessment `projectPath` |
| `src/api/simplebeacon-api.js` | `POST /api/simplebeacon/scan`, `GET /api/simplebeacon/report`, `POST /api/ai-validation/scan` |
| `src/api/dashboard-stub-api.js` | `GET /api/merger-tool/reduction-scan` |

Servers that mount the analyze API:

- `gguf-dashboard-server.js` (default port **54355**; internal preview may use other ports via proxy)
- `server/index.js` (default port **3000**, or `PORT` from `.env`)

## Default allowed roots

When `ANALYZE_ALLOWED_ROOTS` is unset, roots are built automatically:

1. **Platform root** — directory containing `gguf-dashboard-server.js` (typically `ai-platform/`)
2. **Monorepo parent** — parent of `ai-platform/` (e.g. `CascadeProjects/`) when detected
3. **Config entries** — `allowedAnalysisRoots` in `.simplebeacon/config.json` (relative paths resolved against platform root)
4. **Current working directory** — only if it already lies inside one of the roots above
5. **Environment override** — paths from `ANALYZE_ALLOWED_ROOTS` (semicolon- or comma-separated absolute paths)

The stock `.simplebeacon/config.json` includes:

```json
"allowedAnalysisRoots": [".", ".."]
```

which resolves to `ai-platform/` and its parent workspace root.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `ANALYZE_ALLOWED_ROOTS` | Extra or replacement roots (semicolon-separated absolute paths). Merged with defaults unless you set only explicit paths here. |
| `LOG_ANALYZE_PATH_ACCESS` | When `true`, log allow/deny decisions for `projectPath` (also enabled when `LOG_RUNTIME_INFO` or `RUNTIME_DEBUG` is `true`). |

Example (Windows):

```env
ANALYZE_ALLOWED_ROOTS=C:\Users\Trevor\CascadeProjects;C:\Users\Trevor\CascadeProjects\ai-platform
LOG_ANALYZE_PATH_ACCESS=true
```

## Security behavior

- Paths are normalized with `path.resolve()`; `..` traversal that escapes allowed roots is rejected.
- Paths outside allowed roots return **400** with `projectPath is outside allowed analysis roots`.
- Arbitrary system paths (e.g. `C:\Windows`) remain blocked unless explicitly listed in `ANALYZE_ALLOWED_ROOTS`.

## Troubleshooting

### Complete scan fails on steps 4 (Roadmap) or 5 (Codebase)

**Symptom:** `projectPath is outside allowed analysis roots` for a monorepo path like `C:\Users\Trevor\CascadeProjects`.

**Fix:**

1. Ensure the server was restarted after config changes.
2. Confirm the path exists on disk.
3. Add the workspace root to `ANALYZE_ALLOWED_ROOTS` or `.simplebeacon/config.json` `allowedAnalysisRoots`.
4. Use `ai-platform/` as `projectPath` if you only need platform-scoped analysis.

### curl smoke tests

Replace `BASE` with your server URL (e.g. `http://localhost:54355` or `http://localhost:3000`).

```bash
# Roadmap (step 4)
curl -s -X POST "%BASE%/api/analyze/flexible" ^
  -H "Content-Type: application/json" ^
  -d "{\"projectPath\":\"C:\\\\Users\\\\Trevor\\\\CascadeProjects\",\"analysisType\":\"roadmap\"}"

# Codebase (step 5)
curl -s "%BASE%/api/analyze/codebase?projectPath=C%%3A%%5CUsers%%5CTrevor%%5CCascadeProjects"
```

PowerShell:

```powershell
$body = @{ projectPath = 'C:\Users\Trevor\CascadeProjects'; analysisType = 'roadmap' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:54355/api/analyze/flexible' -ContentType 'application/json' -Body $body
```

### CLI gate (unaffected by analyze API roots)

Local gate scans use the CLI directly and are not subject to HTTP path allowlists:

```bash
npm run simplebeacon:path-check
npm run simplebeacon:full
npm run simplebeacon:report
```

`simplebeacon:path-check` verifies that the monorepo root and `ai-platform/` are allowed while system paths (e.g. `C:\Windows`) and traversal escapes remain blocked.
