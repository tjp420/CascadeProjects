# Simplebeacon CLI (GitHub surface)

This repository contains **only** the Simplebeacon CLI and MCP server under `packages/simplebeacon-cli/`.

The full Simplebeacon platform (internal dashboard, server, outreach, billing, operator vault) is **not published to GitHub** — it is developed locally on the `platform` branch only.

## Install

```bash
cd packages/simplebeacon-cli
npm install
npm link
# or: npx simplebeacon scan --path . --gate
```

See [packages/simplebeacon-cli/README.md](packages/simplebeacon-cli/README.md) and [packages/simplebeacon-cli/docs/MCP-USER-SETUP.md](packages/simplebeacon-cli/docs/MCP-USER-SETUP.md).
