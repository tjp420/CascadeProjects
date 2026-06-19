# VSCode Marketplace Publishing Guide

This guide walks through publishing the Simplebeacon extension to the VSCode Marketplace.

## Prerequisites

- [ ] Node.js and npm installed
- [ ] TypeScript compiled (already done)
- [ ] vsce installed (already done: @vscode/vsce@3.9.2)
- [ ] Icon scaled to 128x128px (already done)
- [ ] Screenshots captured (1280x800px)
- [ ] Extension README updated (already done)

## Step 1: Register Publisher Account

1. Go to https://marketplace.visualstudio.com/manage
2. Sign in with your Microsoft or GitHub account
3. Click "Create Publisher"
4. Fill in publisher details:
   - **Name:** `simplebeacon` (must match package.json)
   - **Display Name:** SimpleBeacon
   - **Description:** Professional AI code quality tools
   - **Website:** https://simplebeacon.com
   - **Privacy Policy:** https://simplebeacon.com/privacy
   - **Terms of Service:** https://simplebeacon.com/terms
5. Accept the publisher agreement
6. Complete verification (may require email or phone verification)

## Step 2: Create Personal Access Token (PAT)

1. In the Marketplace Manage page, click on your publisher name
2. Go to "Personal Access Tokens" tab
3. Click "Create New Token"
4. Fill in:
   - **Name:** VSCode Extension Publishing
   - **Organization:** All accessible accounts
   - **Scopes:** Marketplace → Manage
   - **Expiration:** Choose a reasonable date (e.g., 1 year)
5. Click "Create"
6. **Copy the token immediately** (you won't see it again)

## Step 3: Authenticate with vsce

```bash
cd vscode-extension
npx vsce login simplebeacon
```

When prompted, paste your Personal Access Token.

## Step 4: Prepare Screenshots

Before publishing, ensure you have the screenshots ready:

1. Capture 5 screenshots (1280x800px) following `sales/marketplace/screenshots/README.md`
2. Save them to `vscode-extension/resources/screenshots/`
3. Name them: `screenshot1.png`, `screenshot2.png`, etc.

Create the screenshots directory:

```bash
mkdir vscode-extension/resources/screenshots
```

Add screenshots reference to package.json (if not already present):

```json
"screenshots": [
  {
    "path": "resources/screenshots/screenshot1.png",
    "label": "AI Slop Cop sidebar with scan results and gate status"
  },
  {
    "path": "resources/screenshots/screenshot2.png",
    "label": "Detailed findings with file locations and fix suggestions"
  },
  {
    "path": "resources/screenshots/screenshot3.png",
    "label": "Configuration options in VSCode settings"
  },
  {
    "path": "resources/screenshots/screenshot4.png",
    "label": "Full scan mode for comprehensive coverage"
  },
  {
    "path": "resources/screenshots/screenshot5.png",
    "label": "Exported scan report in JSON format"
  }
]
```

## Step 5: Package the Extension

```bash
cd vscode-extension
npm run package
```

This creates a `.vsix` file (e.g., `ai-slop-cop-0.5.11.vsix`).

## Step 6: Test the Package Locally

Before publishing, test the package:

```bash
code --install-extension ai-slop-cop-0.5.11.vsix
```

1. Open VSCode
2. Test all features work
3. Verify the icon displays correctly
4. Check the extension loads without errors

## Step 7: Publish to Marketplace

```bash
cd vscode-extension
npm run publish
```

Or using vsce directly:

```bash
npx vsce publish
```

This will:
- Upload the extension to the marketplace
- Use the metadata from package.json
- Publish under the `simplebeacon` publisher
- Make it available at: https://marketplace.visualstudio.com/items?itemName=simplebeacon.ai-slop-cop

## Step 8: Verify Publication

1. Go to https://marketplace.visualstudio.com/items?itemName=simplebeacon.ai-slop-cop
2. Verify the extension appears
3. Check the description, icon, and metadata
4. Test installing from the marketplace

## Step 9: Add Screenshots (if not in package.json)

If screenshots weren't included in the package, you can add them via the web interface:

1. Go to https://marketplace.visualstudio.com/manage
2. Click on your extension
3. Go to "Assets" tab
4. Upload screenshots
5. Add captions for each screenshot
6. Save changes

## Step 10: Set Pricing and Categories

1. In the extension management page
2. Go to "Pricing" tab
3. Set pricing (Free for now, with in-app upgrade)
4. Go to "Categories" tab
5. Ensure categories are correct:
   - Linters
   - Programming Languages
   - Machine Learning

## Troubleshooting

### "Publisher not found" error

**Problem:** Publisher `simplebeacon` doesn't exist

**Solution:** Complete Step 1 to register the publisher account

### "Authentication failed" error

**Problem:** Invalid or expired PAT

**Solution:** Create a new PAT (Step 2) and authenticate again

### "Package validation failed" error

**Problem:** Extension fails marketplace validation

**Solution:**
- Check icon is 128x128px minimum
- Verify README is not empty
- Ensure all required fields in package.json are filled
- Check for any missing assets

### "Screenshots too large" error

**Problem:** Screenshots exceed size limit

**Solution:**
- Resize screenshots to exactly 1280x800px
- Compress images to under 1MB each
- Use PNG format

### "Extension already exists" error

**Problem:** Trying to publish over existing extension

**Solution:**
- Increment version number in package.json
- Re-run `npm run compile` and `npm run package`
- Publish with new version

## Post-Publishing Checklist

- [ ] Extension appears in marketplace search
- [ ] Extension installs correctly
- [ ] All features work as expected
- [ ] Icon displays correctly
- [ ] Screenshots appear in listing
- [ ] Description is accurate
- [ ] Links to documentation work
- [ ] Support email is correct
- [ ] Pricing is set correctly

## Updating the Extension

For future updates:

1. Update version in package.json
2. Update CHANGELOG.md
3. Run `npm run compile`
4. Run `npm run package`
5. Test locally
6. Run `npm run publish`

## Next Steps

After successful publication:
1. Share the marketplace link
2. Announce on social media
3. Monitor downloads and ratings
4. Respond to user feedback
5. Plan for version 0.6.0

## Marketplace URL

Once published, your extension will be available at:
https://marketplace.visualstudio.com/items?itemName=simplebeacon.ai-slop-cop

## Support

For marketplace publishing issues:
- VSCode Marketplace documentation: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- vsce documentation: https://github.com/microsoft/vscode-vsce
