@echo off
rem Start Simplebeacon server with test Stripe env vars (local testing only)
set STRIPE_SECRET_KEY=sk_test_placeholder
set STRIPE_WEBHOOK_SECRET=whsec_test_local
cd /d %~dp0
node simplebeacon-server.cjs
