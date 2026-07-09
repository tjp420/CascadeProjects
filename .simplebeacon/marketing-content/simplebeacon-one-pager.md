# Simplebeacon — One-Pager

## What it does

Simplebeacon is a CI hygiene gate that catches mock data leaks, credential patterns, JSON schema drift, and EU AI Act compliance gaps — in under a second for typical repos.

## How it works

1. Scan configured directories (`server/`, `src/`, sample paths)
2. Match against pattern rules (leaks, credentials, fiction KPIs, EU AI Act)
3. Fail the build if \"failOn\" severities are matched
4. Export normalized reports for dashboards and compliance

## Scan results (sample)

| Metric | Value |
|--------|-------|
| Files scanned | 3257 |
| Gate result | PASS |
| Quality score | 100/100 |
| Blocking issues | 0 |
| Credential findings | 0 |
| Production leaks | 0 |

## Quick start

```bash
npx simplebeacon init --profile standard
npx simplebeacon scan --gate
```

## Pricing

- **Open source** (self-hosted): Free
- **Managed SaaS**: Contact us
- **Enterprise**: On-premise, custom rules, SLAs

## Contact

- Website: simplebeacon.dev
- GitHub: github.com/simplebeacon
- Email: hello@simplebeacon.dev