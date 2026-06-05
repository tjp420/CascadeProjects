# Simplebeacon — Thumb Drive Quick Start

> This file lives inside `ai-platform/` so it travels with the thumb drive.
> For the full guide, see `../ZORIN-LINUX-SETUP.md` (in the repo root).

## What to copy to your thumb drive

**Copy the ENTIRE `CascadeProjects` folder**, not just `ai-platform/`.

Required folders/files at the thumb-drive root:

```
CascadeProjects/
  setup-zorin.sh          ← installer
  start-dashboard.sh      ← dashboard launcher
  scan-website.sh         ← website analyzer
  instructions.txt        ← quick-reference card
  ZORIN-LINUX-SETUP.md    ← full setup guide
  packages/
    simplebeacon-cli/     ← CLI scanner (required)
  ai-platform/            ← dashboard & APIs (this folder)
```

## One-command start (Zorin Linux)

```bash
cd /media/$USER/YOUR_DRIVE_NAME/CascadeProjects
./start-dashboard.sh
```

The script auto-detects the thumb drive path, starts the server, and opens the browser.

## Website scanning (new)

```bash
# Terminal
cd /media/$USER/YOUR_DRIVE_NAME/CascadeProjects
./scan-website.sh https://example.com --gate

# Or use the dashboard:
# Open http://localhost:54355/simplebeacon-dashboard/#/analyze
# Click "Website URL" tab → enter URL → Run analysis
```

## If you get "Permission denied"

FAT32/exFAT thumb drives don't support Unix execute permissions. Run with `bash` instead:

```bash
bash setup-zorin.sh
bash start-dashboard.sh
bash scan-website.sh https://example.com --gate
```
