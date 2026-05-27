# Config directory

Legacy Docker/FastAPI layout. **New work should use env templates at the repository root** (`ai-platform/.env.example`).

## Canonical env files (ai-platform root)

| File | Purpose |
|------|---------|
| `.env.example` | Full local/dev template — copy to `.env` |
| `.env.production.example` | Production deploy overlay |
| `.env.v1-internal.example` | v1-internal dashboard (port 54355) |

## Legacy files (this folder)

| File | Status |
|------|--------|
| `.env.example` | Pointer only — do not extend |
| `.env.production.template` | Pointer only — do not extend |
| `.env`, `.env.production` | Legacy local overrides — migrate to root `.env` / `.env.production` |
| `docker-compose.yml` | FastAPI/Celery stack (optional) |
| `dashboard_config.json` | Dashboard settings |
