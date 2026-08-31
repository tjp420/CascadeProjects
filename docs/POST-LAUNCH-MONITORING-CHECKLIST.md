# SimpleBeacon Post-Launch Monitoring Checklist

> **First 48 hours after launch.** Run through this checklist when traffic
> arrives from Hacker News, Reddit, or any launch channel.
>
> **Goal**: Catch issues before users report them.

---

## Pre-Launch: Set Up Alerting (5 minutes)

### 1. Configure the health alert webhook

Set one of these env vars on Render:

```
HEALTH_ALERT_WEBHOOK=https://hooks.slack.com/services/T000/B000/XXX
```

or reuse the purchase alert webhook:

```
PURCHASE_ALERT_WEBHOOK=https://hooks.slack.com/services/T000/B000/XXX
```

The health cron runs every 15 minutes. When the server transitions to
DEGRADED or DOWN, it sends a formatted alert to Slack/Discord with the
failing subsystem. When it recovers, it sends a recovery alert.

**Test it**: `curl https://simplebeacon.ai/api/v1/health/diagnostics`
should return `{"status":"UP",...}` with HTTP 200.

### 2. Verify Stripe webhook is live

```bash
curl -s -o /dev/null -w "%{http_code}" https://simplebeacon.ai/api/stripe-webhook
```

Expected: `400` (Stripe signature verification rejects empty requests).
A `404` or `401` means the route is misconfigured.

### 3. Verify email service is up

```bash
curl -s https://simplebeacon.ai/api/health/email
```

Expected: `{"ok":true,"providers":{"resendApi":true,"smtp":true}}`.

---

## Hour 0-1: Launch Traffic Hits

### 4. Monitor the health endpoint

```bash
# Run this in a terminal during launch
watch -n 60 'curl -s https://simplebeacon.ai/api/v1/health/diagnostics | jq .status'
```

Watch for:
- `UP` — all systems normal
- `DEGRADED` — memory above 400 MB or datastore issue
- `DOWN` — memory above 800 MB or encryption key missing

### 5. Check Render logs for errors

In the Render dashboard, filter logs for:
- `ERROR` — application errors
- `CRITICAL_SYS_ALERT` — health check failures
- `[StripeWebhook]` — payment processing issues
- `[HealthAlert]` — outbound alert delivery

### 6. Monitor Stripe dashboard

Open the Stripe Dashboard → Events:
- Watch for `checkout.session.completed` events
- Verify `customer.subscription.created` events are arriving
- Check for any `invoice.payment_failed` events

### 7. Watch for signup spikes

In the Render logs, grep for:
- `register` — new user signups
- `Subscription Activated` — paid conversions
- `License token` — license token minting

---

## Hour 1-6: Stability Check

### 8. Check memory usage trend

```bash
curl -s https://simplebeacon.ai/api/v1/health/diagnostics | jq '.checks.memory.detail'
```

Look at `heapUsedMB`:
- Under 200 MB — healthy
- 200-400 MB — normal for moderate traffic
- 400-800 MB — DEGRADED, investigate memory leaks
- Above 800 MB — DOWN, restart may be needed

### 9. Verify scan performance endpoint

```bash
curl -s https://simplebeacon.ai/api/analytics/performance \
  -H "Authorization: Bearer <admin-token>" | jq '.performance'
```

Check:
- `successRate` should be > 95%
- `durationMs.p99` should be under 30 seconds
- `gatePassRate` should be > 80%
- `errorRate` should be < 5%

If `errorRate` is high, check the Render logs for scan failures.

### 10. Check feedback dashboard

Open the admin dashboard → Feedback tab:
- Are users submitting feedback?
- Any `bug` category entries? Triage immediately.
- Any `pricing` complaints? Note for pricing page iteration.

### 11. Monitor onboarding drip

```bash
curl -s https://simplebeacon.ai/admin/onboarding-drip \
  -H "Authorization: Bearer <admin-token>" | jq '.total'
```

This shows how many users have been registered for the drip sequence.
Should grow as new subscribers activate.

### 12. Check email delivery

In the Render logs, grep for:
- `Confirmation email result: sent` — welcome emails working
- `Confirmation email result: queued` — fallback to disk queue (investigate)
- `[OnboardingDrip] Sent` — drip emails being delivered

---

## Hour 6-24: Sustained Traffic

### 13. Review scan performance trends

```bash
# Compare p99 duration over time
curl -s "https://simplebeacon.ai/api/analytics/performance?startDate=2026-01-01T00:00:00Z&endDate=2026-01-01T06:00:00Z" \
  -H "Authorization: Bearer <admin-token>" | jq '.performance.durationMs'
```

If p99 is climbing, users may be scanning larger repos. Consider:
- Adding a file-count warning for repos over 10k files
- Documenting `--max-files` flag if it exists

### 14. Check subscription conversions

```bash
curl -s https://simplebeacon.ai/admin/billing/subscriptions \
  -H "Authorization: Bearer <admin-token>" | jq '.revenue'
```

Track:
- `monthlyRecurringCents` — should grow with conversions
- `activeCount` — active paid subscriptions
- `totalCount` — total including canceled

### 15. Monitor for rate limiting

In Render logs, grep for:
- `rate_limit` — users hitting API limits
- `429` — HTTP rate limit responses

If rate limiting is frequent, consider raising limits for paid tiers.

### 16. Check for webhook failures

In Render logs, grep for:
- `[StripeWebhook]` and `error`
- `signature verification failed` — possible webhook secret mismatch
- `duplicate` — idempotency guard working (expected for retries)

---

## Hour 24-48: Post-Launch Review

### 17. Run the full health check

```bash
curl -s https://simplebeacon.ai/api/v1/health/diagnostics | jq .
```

All three checks should be UP:
- `encryption` — key present and valid
- `datastore` — data files readable
- `memory` — heap under 400 MB

### 18. Review feedback categories

Admin dashboard → Feedback tab:
- How many total entries?
- Bug vs feature vs praise ratio
- Any patterns in bug reports (same issue reported multiple times)?
- Triage all `new` status entries to `triaged` or `in_progress`

### 19. Check onboarding drip delivery

```bash
curl -s https://simplebeacon.ai/admin/onboarding-drip \
  -H "Authorization: Bearer <admin-token>" | jq '.users[] | {email, sentSteps}'
```

Verify:
- Day 1 emails are being sent (sentSteps contains "step1")
- No users are stuck with empty sentSteps after 24+ hours
- Use `resetStep` if any user missed a step

### 20. Review revenue and conversion rate

```bash
curl -s https://simplebeacon.ai/admin/billing/subscriptions \
  -H "Authorization: Bearer <admin-token>" | jq .
```

Calculate:
- Conversion rate = activeCount / total signups
- MRR = monthlyRecurringCents / 100
- Churn = (totalCount - activeCount) / totalCount

### 21. Document any incidents

For any DEGRADED or DOWN events:
- Note the timestamp and duration
- Note which subsystem failed
- Note the root cause (if identified)
- Add to the incident log for post-mortem

---

## Emergency Procedures

### Server is DOWN

1. Check Render dashboard → is the service running?
2. Check memory usage → may need a restart
3. Check `.simplebeacon/` directory → data files intact?
4. Restart the service from Render dashboard
5. Verify `curl https://simplebeacon.ai/api/v1/health/diagnostics` returns UP

### Stripe webhooks not arriving

1. Check Stripe Dashboard → Developers → Webhooks
2. Verify endpoint URL: `https://simplebeacon.ai/api/stripe-webhook`
3. Verify the endpoint is enabled
4. Check for recent failed deliveries in Stripe
5. Verify `STRIPE_WEBHOOK_SECRET` is set on Render

### Email not sending

1. Check `curl https://simplebeacon.ai/api/health/email`
2. If Resend is down, SMTP fallback should activate
3. Check `.simplebeacon/email-queue/` for queued emails
4. Verify `RESEND_API_KEY` and `SMTP_*` env vars on Render

### High memory usage

1. Check `curl https://simplebeacon.ai/api/v1/health/diagnostics`
2. If `heapUsedMB` > 600, consider a restart
3. Check for memory-intensive operations in logs
4. Consider upgrading Render instance size if traffic is sustained

---

## Key URLs

| Resource | URL |
|----------|-----|
| Health diagnostics | `https://simplebeacon.ai/api/v1/health/diagnostics` |
| Email health | `https://simplebeacon.ai/api/health/email` |
| Stripe webhook | `https://simplebeacon.ai/api/stripe-webhook` |
| Scan performance | `https://simplebeacon.ai/api/analytics/performance` |
| Admin feedback | `https://simplebeacon.ai/admin/feedback` |
| Admin billing | `https://simplebeacon.ai/admin/billing/subscriptions` |
| Admin drip | `https://simplebeacon.ai/admin/onboarding-drip` |
| Render dashboard | `https://dashboard.render.com` |
| Stripe dashboard | `https://dashboard.stripe.com` |
