@echo off
cd /d C:\Users\Trevor\CascadeProjects\ai-platform
set SIMPLEBEACON_INTERNAL_DASHBOARD=true
set ALLOW_DEV_EPHEMERAL_SECRETS=true
set PORT=54355
set NODE_ENV=development
set OLLAMA_BASE_URL=http://127.0.0.1:11434

:: Email config loaded from .env.v1-internal (gitignored)
:: Create it from .env.example and set real values there
if exist .env.v1-internal (
    for /f "tokens=1,* delims==" %%a in (.env.v1-internal) do set "%%a=%%b"
) else if exist .env (
    for /f "tokens=1,* delims==" %%a in (.env) do set "%%a=%%b"
)

node server/index.cjs
