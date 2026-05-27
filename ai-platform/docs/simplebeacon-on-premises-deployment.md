# Simplebeacon On-Premises Deployment

Enterprise option: **code and scan artifacts stay in the client's private cloud.** No requirement to use simplebeacon.ai SaaS.

---

## Deployment models

| Model | Code location | Best for |
|-------|---------------|----------|
| **CLI-only (CI)** | Client GitHub/GitLab runners | Fastest; gate in their pipeline |
| **CLI + dashboard (Docker)** | Client VPC (AWS ECS, GKE, Azure ACI) | Teams wanting hosted history inside firewall |
| **Consultant clone** | Ephemeral VM; deleted after report | Discovery scan before contract |

---

## What runs where

| Component | Writes to app source? | Network |
|-----------|----------------------|---------|
| `simplebeacon scan` | **No** — read-only on target tree | Optional (none for local scan) |
| Report output | Writes JSON/text to `.simplebeacon/` or `--output` | Stays on host |
| `simplebeacon baseline sync` | Writes **only** `.simplebeacon/baseline.json` after explicit command | Runs tests locally |
| Dashboard (Docker) | Serves UI; scan API triggers read-only CLI | Internal LB only |

**Verified:** `npm test -- tests/integration/scanner.test.js` (zero-mutation guarantee).

---

## CLI-only in client CI (recommended Week 1)

```yaml
# Reporting-only — Week 1 (no --gate)
- run: npx simplebeacon scan --format json --output .simplebeacon/report.json
  working-directory: ${{ github.workspace }}

# After allowlist sign-off — enable gate
- run: npx simplebeacon scan --gate --fail-on high
```

Client provides: read-only repo checkout (default for CI). No outbound code upload required.

---

## Docker dashboard in private cloud

From `ai-platform/` on a host with Docker:

```bash
cp .env.production.example .env.production
# Set JWT secrets, disable external URLs, bind to internal network only
docker compose -f docker-compose.simplebeacon.yml -f docker-compose.simplebeacon.full.yml --profile full up -d
```

**Hardening checklist:**

- [ ] Dashboard behind VPN or SSO reverse proxy
- [ ] `SEED_DEMO_USERS=false`
- [ ] No public ingress; internal DNS only
- [ ] Stripe/billing disabled if not using cloud checkout
- [ ] Assessment uploads stored on client volume with TTL

Reference: `scripts/deploy-simplebeacon.sh`, `docs/v1-internal-runbook.md`

---

## Data handling (consultant-led discovery)

| Data | Retention default |
|------|-------------------|
| Git clone | Delete within 24–168 hours (MSA) |
| Scan JSON | Delivered to client; consultant copy deleted |
| Credentials in reports | Redacted in executive summary |

---

## Sales one-liner

> Simplebeacon can be deployed locally in your private cloud (AWS/GCP/Azure). Your proprietary code never leaves your infrastructure; the scan engine is read-only on your source tree.

---

## Related

- `docs/simplebeacon-demo-framework.md`
- `docs/simplebeacon-enterprise-msa-template.md` (Exhibit C)
