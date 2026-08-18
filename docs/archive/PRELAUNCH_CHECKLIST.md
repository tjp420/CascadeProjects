# SimpleBeacon Pre-Launch Gate Checklist

## Phase 1: Security and Compliance (Days 1 to 4)
- [ ] Auth fail-closed: Confirmed [ai-platform/server/routes/auth-inline-routes.cjs](ai-platform/server/routes/auth-inline-routes.cjs) returns fail-closed responses when SIMPLEBEACON_LICENSE_SECRET is missing.
- [ ] Cookie blocking: Verified through automated browser tests that tracking scripts do not load before explicit consent.
- [ ] Privacy transparency: Footer links and policy pages reflect current GDPR and CCPA language.
- [ ] Input cleansing: All user input routes validate and sanitize payloads against XSS and injection risk.
- [ ] Idempotent webhooks: Duplicate Stripe and PayPal events do not create duplicate records.

## Phase 2: Integrations and Operations (Days 5 to 9)
- [ ] Graceful degradation: Third-party API outage tests confirm fallback UI behavior without app crash.
- [ ] Email deliverability: Test sends pass SPF, DKIM, and DMARC checks across major providers.
- [ ] Social preview quality: Open Graph and card metadata render correct title, description, and image.
- [ ] Cache invalidation: Backend updates are visible immediately after cache purge/invalidation.

## Phase 3: Final Deployment Readiness (Days 10 to 14)
- [ ] Console cleanliness: No browser console errors, warnings, or debug logs on critical flows.
- [ ] Dependency slimming: Unused plugins/packages removed and lockfile updated.
- [ ] Production runbook: Rollback, incident owners, webhook replay steps, and escalation path documented.
