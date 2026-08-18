# Simplebeacon on Zorin Linux

This guide gets the Simplebeacon CLI (and optional dashboard) running on [Zorin OS](https://zorinos.com/) and other Ubuntu/Debian-based distributions.

## What you get

- **Simplebeacon CLI** — scan any codebase for AI-generated fiction, credential leaks, and mock data shipped to production
- **MCP server** — integrates with Cursor, Claude Desktop, or any stdio MCP host
- **Optional dashboard** — the `ai-platform` web dashboard for viewing scan results

## Prerequisites

- Zorin OS 16+ (or Ubuntu 22.04+/Debian 12+)
- Internet connection (for first-time Node.js install)
- ~500 MB free disk space

## Running from a thumb drive

**Copy the ENTIRE `CascadeProjects` folder to your thumb drive.**
Do NOT copy only `ai-platform/` — the CLI scanner lives in `packages/simplebeacon-cli/` at the repo root.

Zorin auto-mounts USB drives under `/media/$USER/DRIVELABEL`. To find your drive after plugging it in:

```bash
ls /media/$USER/
```

Your repo will be at a path like:

```
/media/$USER/SANDISK/CascadeProjects
```

The setup script auto-detects its location, so it works from any path — thumb drive, home folder, or external disk.

## One-command setup

### From a thumb drive

```bash
cd /media/$USER/YOUR_DRIVE_NAME/CascadeProjects
chmod +x setup-zorin.sh
./setup-zorin.sh
```

### From your home folder

```bash
cd ~/simplebeacon        # or wherever you copied the repo
chmod +x setup-zorin.sh
./setup-zorin.sh
```

The script will:

1. Install Node.js 20.x if missing
2. Install Git if missing
3. Install CLI dependencies
4. Link `simplebeacon` and `simplebeacon-mcp` to `/usr/local/bin`
5. Initialize `.simplebeacon/config.json`
6. Optionally install the ai-platform dashboard
7. Optionally create a Zorin desktop launcher

## Manual setup (if you prefer)

### 1. Install Node.js

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt update
sudo apt install -y nodejs
```

Verify:

```bash
node -v   # v20.x.x
npm -v    # 10.x.x
```

### 2. Install the CLI

From the repo root:

```bash
cd packages/simplebeacon-cli
npm install
sudo ln -sf "$(pwd)/bin/simplebeacon.js" /usr/local/bin/simplebeacon
sudo ln -sf "$(pwd)/bin/simplebeacon-mcp.js" /usr/local/bin/simplebeacon-mcp
```

### 3. Initialize config

```bash
cd ~/simplebeacon
simplebeacon init --starter
```

This creates:

| File | Purpose |
|------|---------|
| `.simplebeacon/config.json` | Scan rules + allowlists |
| `.simplebeacon/baseline.json` | Fiction KPI baseline |

## Daily usage

### Scan a website

Simplebeacon normally scans local files. You have two ways to analyze a remote website:

**Option A: CLI (`scan-website.sh`)**

```bash
# Basic scan
./scan-website.sh https://your-domain.com --gate

# With JSON report
./scan-website.sh https://your-domain.com --gate --output report.json

# Keep downloaded files for inspection
./scan-website.sh https://your-domain.com --keep
```

**Option B: Dashboard (`#/analyze`)**

Open the dashboard → go to **Analyze** → click the **Website URL** tab → enter `https://your-domain.com` → click **Run analysis**. The dashboard downloads the site and runs the same rule engines automatically.

What it does:
1. Downloads the page source with `curl` (CLI) or Node.js `https` (dashboard)
2. Extracts linked CSS and JS assets
3. Runs Simplebeacon rules (fiction KPIs, credential patterns, token leaks) against the downloaded files
4. Cleans up temp files afterward (CLI uses `--keep` to retain them)

### Scan a project

```bash
# Scan current directory
simplebeacon scan --gate --offline

# Scan a specific repo
simplebeacon scan --path /home/user/my-project --gate --offline

# Full coverage (every file, not just src/)
simplebeacon scan --path /home/user/my-project --full --gate --offline

# JSON output for CI
simplebeacon scan --gate --format json --output .simplebeacon/report.json
```

### Check gate status

```bash
simplebeacon gate status
```

### MCP server (for Cursor/Claude)

```bash
simplebeacon-mcp --offline
```

Wire it into Cursor: **Settings → MCP → Add** → command: `simplebeacon-mcp --offline`

## Optional: ai-platform dashboard

### One-command launch (recommended)

From the repo root:

```bash
./start-dashboard.sh
```

This starts the server in the background, waits for it to be ready, and opens your default browser automatically.

### Manual start

```bash
cd ai-platform
npm install
npm start
```

Then open http://localhost:54355/simplebeacon-dashboard/

## EU AI Act full-coverage scan

Some rule engines are disabled by default. For maximum coverage:

```bash
simplebeacon scan --config .simplebeacon/config-full-coverage.json --full --gate
```

## Uninstall

```bash
sudo rm /usr/local/bin/simplebeacon
sudo rm /usr/local/bin/simplebeacon-mcp
rm -rf ~/.local/share/applications/simplebeacon-dashboard.desktop
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `command not found: simplebeacon` | Re-run setup or symlink manually |
| `Permission denied` on script | FAT32/exFAT thumb drives don't support `chmod +x`. Use `bash setup-zorin.sh` instead of `./setup-zorin.sh` |
| `setup-zorin.sh not found` | You are probably inside `ai-platform/`. Run from the repo root (`cd ..` first) |
| Node version too old | The setup script auto-installs Node 20; run it again |
| Scan finds false positives | Edit `.simplebeacon/config.json` and add paths to `exclude` |
| Desktop launcher missing | Re-run setup and answer "Y" to desktop entry prompt |

## Files created by this setup

- `setup-zorin.sh` — automated installer (repo root)
- `start-dashboard.sh` — dashboard launcher (repo root)
- `scan-website.sh` — website analyzer (repo root)
- `ZORIN-LINUX-SETUP.md` — this guide
- `instructions.txt` — quick-reference card
- `setup-zorin.log` — install log (created on first run)
