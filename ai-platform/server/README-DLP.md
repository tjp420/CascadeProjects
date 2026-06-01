# Enterprise AI Data Leak Prevention

HTTP forward proxy + dashboard that screens outbound AI API request bodies using Simplebeacon credential and privacy pattern engines.

## Quick start

From the `ai-platform` directory:

```bash
npm run dlp:start
```

- Proxy: `http://localhost:8080`
- Dashboard: `http://localhost:3000`

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PROXY_PORT` | `8080` | Proxy listen port |
| `DASHBOARD_PORT` | `3000` | Dashboard listen port |
| `BLOCK_ON_MATCH` | `true` | Block (`true`) or monitor-only (`false`) |
| `VIOLATION_LOG_PATH` | `./ai-violations.log` | JSONL violation log |
| `ALERT_WEBHOOK` | — | Slack/Teams webhook URL |
| `ORG_NAME` | `Enterprise` | Label in startup logs |

## Client configuration

This is an **application-layer HTTP forward proxy**, not TLS interception.

Clients must send traffic to `http://localhost:8080` with the `Host` header set to the upstream AI API host (for example `api.openai.com`). Typical setups:

- SDK `baseURL` pointed at the proxy
- `HTTP_PROXY=http://localhost:8080` with explicit host routing
- Sidecar container in Kubernetes

Direct HTTPS calls to `api.openai.com` bypass this proxy unless the enterprise terminates TLS elsewhere.

## Test

Unit tests (no running server):

```bash
npm run dlp:test
```

Manual block test (requires running gateway):

```bash
npm run dlp:start
node server/test-gateway.js --manual
```

Live integration test:

```bash
RUN_LIVE_GATEWAY_TEST=1 node server/test-gateway.js
```

## Architecture

```
Client → AIProxyGateway (scan body) → allow/block → upstream AI HTTPS API
              ↓
        ai-violations.log + optional webhook
              ↓
        DLPDashboard (/api/violations, /api/stats, /api/compliance)
```

Pattern sources:

- `packages/simplebeacon-cli/src/lib/credential-pattern-scanner.js`
- `server/enterprise-patterns.js`

## Files

| File | Purpose |
|------|---------|
| `server/ai-proxy-gateway.js` | Proxy server and scan pipeline |
| `server/enterprise-patterns.js` | PII / HIPAA / PCI-style patterns |
| `server/dlp-dashboard.js` | Compliance dashboard |
| `server/enterprise-dlp.js` | Starts proxy + dashboard |
| `server/test-gateway.js` | Unit + manual tests |
