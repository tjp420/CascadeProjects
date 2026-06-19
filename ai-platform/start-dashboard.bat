@echo off
cd /d "C:\Users\Trevor\CascadeProjects\ai-platform"
set SIMPLEBEACON_INTERNAL_DASHBOARD=true
set ALLOW_DEV_EPHEMERAL_SECRETS=true
set NODE_ENV=development
set OLLAMA_BASE_URL=http://127.0.0.1:11434
set NODE_OPTIONS=--max-old-space-size=4096

:: Email config loaded from .env.v1-internal (gitignored)
:: Create it from .env.example and set real values there
if exist .env.v1-internal (
    for /f "usebackq tokens=1,* delims==" %%a in (".env.v1-internal") do set "%%a=%%b"
) else if exist .env (
    for /f "usebackq tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"
)

:: Force dashboard port — prevent .env override
set PORT=3002

node server\index.cjs
