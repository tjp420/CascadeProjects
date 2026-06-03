@echo off
cd /d C:\Users\Trevor\CascadeProjects\ai-platform
set SIMPLEBEACON_INTERNAL_DASHBOARD=true
set ALLOW_DEV_EPHEMERAL_SECRETS=true
set PORT=54355
set NODE_ENV=development
set OLLAMA_BASE_URL=http://127.0.0.1:11434
node server/index.cjs
