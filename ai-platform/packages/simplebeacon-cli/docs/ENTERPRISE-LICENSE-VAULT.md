# Enterprise license vault (offline)

SimpleBeacon enterprise seats use a **signed license file** verified locally (Ed25519). No Stripe API calls from the CLI; no license upload during scan.

## Community vs paid

| Mode | License | Gate |
|------|---------|------|
| **Community** | Not required | `npx simplebeacon scan --gate --offline` |
| **Paid enterprise** | Signed JSON at `~/.simplebeacon/license.json` or `.simplebeacon/license.json` | Same scan; optional `--require-license` when the `license` CLI command is enabled in your package version |

The **ai-platform** monorepo runs in **community mode** today: CI does not set `SIMPLEBEACON_LICENSE_JSON` and does not call `license verify`.

## Customer setup (when license CLI is available)

1. Receive signed license JSON from SimpleBeacon (seat id, expiry, feature flags).
2. Save to `.simplebeacon/license.json` (gitignored) or `~/.simplebeacon/license.json`.
3. Local verify:

```bash
npx simplebeacon license verify
npx simplebeacon scan --gate --offline --require-license
```

## CI (GitHub Actions)

Store the license JSON in a repository secret `SIMPLEBEACON_LICENSE_JSON` and pass it to the job environment. See [examples/github-action/simplebeacon-enterprise-vault.yml](../examples/github-action/simplebeacon-enterprise-vault.yml).

**Note:** The `license` subcommand ships in the published npm release track; this monorepo fork may lag until merged from upstream. Do not enable `--require-license` in CI until `simplebeacon license verify` exists in your installed CLI.

## Key generation (operators only)

Never commit private keys. Use your internal tooling to generate Ed25519 pairs; distribute only signed license payloads to customers.
