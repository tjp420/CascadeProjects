# Onboarding Rate Limiting

This document describes the environment variables that control the enterprise onboarding rate limiter implemented in `ai-platform/src/api/enterprise-onboarding.cjs`.

Configuration

- `ONBOARD_RATE_WINDOW_MS` (optional)
  - Description: Time window in milliseconds used by the rate limiter.
  - Default: `60000` (1 minute)

- `ONBOARD_RATE_LIMIT_MAX` (optional)
  - Description: Maximum number of allowed requests per key (email or IP) within the window.
  - Default: `20`

Behavior

- The limiter keys requests by a normalized `adminEmail` from the request body when present, otherwise falls back to an IPv6-safe client IP key.
- On rate limit exceeded the endpoint returns `429 Too Many Requests` and sets a `Retry-After` header (seconds).

Recommended production values

- Authenticated onboarding flows (per-account): `ONBOARD_RATE_WINDOW_MS=60000`, `ONBOARD_RATE_LIMIT_MAX=60` (60 req/min).
- Unauthenticated or IP-keyed flows: consider stricter caps, e.g. `ONBOARD_RATE_WINDOW_MS=60000`, `ONBOARD_RATE_LIMIT_MAX=10`.

Notes

- For multi-instance deployments use the repository's `redis-rate-limiter.cjs` implementation to provide distributed throttling.
- Tests: see `ai-platform/src/api/__tests__/enterprise-onboard-rate-limit.test.cjs` for the unit test that validates blocking behavior.
