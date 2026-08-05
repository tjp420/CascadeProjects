# software_health_report.md — Production incomplete-drop validation

## Metadata

| Field | Value |
|-------|-------|
| Date | 2026-08-05 (post-purge claim re-probe) |
| Disposition | **NO-GO on custom domain** — purge claim **not** confirmed |

## Real wrangler deploy (still valid)

- Deployment ID: `43e95906-26ab-4e34-b2f0-55e37d633012`
- Preview GO: https://43e95906.simplebeacon.pages.dev

## Custom domain re-probe (after claimed purge)

```
GET https://simplebeacon.ai/app/
  scriptSrcs: ["main.js?v=20260729settings1"]

GET https://simplebeacon.ai/app/assets/main.js?v=20260804incompletedrop1
  jsBytes: 745976
  etag: "f65126bab883fc5c1d6ed8719aaae6f1"
  cf-cache-status: HIT
  incompleteDrop: false
  go: false
```

Claimed 1,606,370 / ETag `6828729f…` / MISS — **not observed**.

## Next

1. Purge Everything (or `/app/*`) for zone `simplebeacon.ai` in Cloudflare Dashboard
2. Re-probe until custom domain matches preview
3. Manual drop on https://simplebeacon.ai/app/#/analyze only after GO

Manual drop **now** on preview: https://43e95906.simplebeacon.pages.dev/app/#/analyze
