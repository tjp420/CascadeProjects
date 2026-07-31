# AI Slop Cop - Installation Guide

## Prerequisites

- VSCode version 1.85.0 or higher
- Node.js 18+ (for CLI scanning, optional)
- Git (for CLI scanning, optional)

## Installation from VSCode Marketplace

### Step 1: Open VSCode Extensions

1. Open VSCode
2. Press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (Mac)
3. Or go to View → Extensions

### Step 2: Search for AI Slop Cop

1. In the search bar, type "AI Slop Cop"
2. Find "AI Slop Cop Pro" by SimpleBeacon
3. Click Install

### Step 3: Restart VSCode

After installation, VSCode may prompt you to restart. Click "Restart Now".

## Installation from VSIX File

### Step 1: Download VSIX

Download the latest VSIX file from:

- GitHub Releases: https://github.com/tjp420/simplebeacon/releases
- Or direct download link

### Step 2: Install VSIX

1. Open VSCode
2. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
3. Type "Install from VSIX"
4. Select the downloaded .vsix file
5. Click "Install"

### Step 3: Restart VSCode

After installation, restart VSCode.

## CLI Installation (Optional)

For batch scanning and CI/CD integration:

### Step 1: Install via npm

```bash
npm install -g simplebeacon
```

### Step 2: Verify Installation

```bash
npx simplebeacon --version
```

### Step 3: Run First Scan

```bash
npx simplebeacon scan --gate
```

## Post-Installation Setup

### Step 1: Open AI Slop Cop Sidebar

1. Click the AI Slop Cop icon in the Activity Bar (shield icon)
2. Or press `Ctrl+Shift+A` to open the dashboard

### Step 2: Configure Settings (Optional)

Open VSCode Settings (`Ctrl+,`) and search for "simplebeacon":

- `simplebeacon.scanLocation`: Custom scan path (leave empty for workspace)
- `simplebeacon.fullScan`: Enable full directory scan (slower, more comprehensive)
- `simplebeacon.licenseToken`: Your Pro/Enterprise license key
- `simplebeacon.exclusions`: Glob patterns for files to exclude

### Step 3: Activate License (Pro/Enterprise)

1. Click "Set License Token" in the sidebar
2. Enter your license token
3. Click "Activate"
4. Verify tier in sidebar (should show Pro or Enterprise)

## Verification

### Test Extension

1. Open a JavaScript/TypeScript file
2. Add a `console.log` statement
3. Open AI Slop Cop sidebar
4. Click "Scan"
5. Verify the debug artifact is detected

### Test CLI (if installed)

```bash
npx simplebeacon scan --gate --format json
```

## Troubleshooting

### Extension Not Appearing

**Problem:** AI Slop Cop doesn't show in Activity Bar

**Solution:**

1. Check Extensions panel to verify installation
2. Disable other extensions that might conflict
3. Restart VSCode
4. Check VSCode version (requires 1.85.0+)

### Scan Not Working

**Problem:** Scan button doesn't trigger scan

**Solution:**

1. Check you have a workspace open
2. Verify file has supported extension (.js, .ts, .py, etc.)
3. Check VSCode Output panel for errors
4. Try restarting VSCode

### License Not Activating

**Problem:** License token shows as invalid

**Solution:**

1. Verify token is copied correctly (no extra spaces)
2. Check token hasn't expired
3. Contact support@simplebeacon.com if issue persists

### CLI Not Found

**Problem:** `npx simplebeacon` command not found

**Solution:**

1. Verify npm is installed: `npm --version`
2. Try installing globally: `npm install -g simplebeacon`
3. Check PATH includes npm global packages
4. Try using `npx` directly: `npx simplebeacon`

## Uninstallation

### Uninstall Extension

1. Open Extensions panel (`Ctrl+Shift+X`)
2. Search for "AI Slop Cop"
3. Click the gear icon
4. Select "Uninstall"

### Uninstall CLI

```bash
npm uninstall -g simplebeacon
```

## Next Steps

- Read the [Configuration Guide](configuration.md)
- Check the [User Guide](user-guide.md)
- Review the [Rule Catalog](rule-catalog.md)
- Set up CI/CD integration (Pro/Enterprise)

## Support

If you encounter issues not covered here:

- Email: support@simplebeacon.com
- GitHub Issues: https://github.com/tjp420/simplebeacon/issues
- Documentation: https://simplebeacon.com/docs
