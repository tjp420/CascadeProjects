@echo off
cd /d C:\Users\Trevor\CascadeProjects\ai-platform
set SIMPLEBEACON_INTERNAL_DASHBOARD=true
set ALLOW_DEV_EPHEMERAL_SECRETS=true
set PORT=54355
set NODE_ENV=development
set OLLAMA_BASE_URL=http://127.0.0.1:11434

:: SMTP config — required for automatic certificate email delivery
:: Resend.com REST API (user already has account)
:: Get your API key from: https://resend.com/api-keys
set RESEND_API_KEY=re_NsyhNcJC_PNncL4iSKPV7xS92FRxjm5zJ
set RESEND_FROM=onboarding@resend.dev
:: Fallback SMTP settings (only used if Resend API fails)
set SMTP_HOST=smtp.resend.com
set SMTP_PORT=465
set SMTP_USER=resend
set SMTP_PASS=re_NsyhNcJC_PNncL4iSKPV7xS92FRxjm5zJ
set SMTP_FROM=onboarding@resend.dev
set SMTP_SECURE=true

node server/index.cjs
