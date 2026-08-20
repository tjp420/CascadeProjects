# VSCode Marketplace Screenshots

## Required Screenshots

VSCode Marketplace requires at least one screenshot (max 5). Recommended size: 1280x800px.

## Screenshot 1: Main Sidebar

**Description:** AI Slop Cop sidebar showing scan results and gate status

**Content to capture:**

- AI Slop Cop sidebar panel
- Scan results with severity breakdown
- Gate status badge (PASS/FAIL)
- Files scanned count
- Issues breakdown (Errors, Warnings, Infos)

**How to capture:**

1. Open VSCode with a project
2. Open AI Slop Cop sidebar
3. Run a scan
4. Use VSCode screenshot tool or system screenshot
5. Crop to 1280x800px

**Caption:** "AI Slop Cop sidebar with scan results and gate status"

## Screenshot 2: Findings List

**Description:** Detailed list of findings with file locations and rule IDs

**Content to capture:**

- Findings list expanded
- Individual finding details
- File path and line number
- Rule ID and severity
- Fix suggestion

**How to capture:**

1. Click on an issue count in sidebar
2. Expand findings list
3. Capture the detailed view
4. Crop to 1280x800px

**Caption:** "Detailed findings with file locations and fix suggestions"

## Screenshot 3: Settings Configuration

**Description:** VSCode settings showing AI Slop Cop configuration options

**Content to capture:**

- Settings editor
- AI Slop Cop settings section
- License token field
- Scan location field
- Exclusions configuration
- Severity overrides

**How to capture:**

1. Open Settings (Ctrl+,)
2. Search for "simplebeacon"
3. Capture the settings panel
4. Crop to 1280x800px

**Caption:** "Configuration options in VSCode settings"

## Screenshot 4: Full Scan Mode

**Description:** Full scan checkbox enabled with increased file count

**Content to capture:**

- AI Slop Cop sidebar
- Full scan checkbox checked
- Higher file count (vs normal scan)
- Progress indicator

**How to capture:**

1. Enable full scan checkbox
2. Run a scan
3. Capture the sidebar with results
4. Crop to 1280x800px

**Caption:** "Full scan mode for comprehensive coverage"

## Screenshot 5: Export Report

**Description:** Exported JSON or Markdown report

**Content to capture:**

- Exported report file open in editor
- JSON structure with findings
- Gate status summary
- Severity breakdown

**How to capture:**

1. Run a scan
2. Click "Export Report"
3. Open the exported file
4. Capture the report content
5. Crop to 1280x800px

**Caption:** "Exported scan report in JSON format"

## Icon Requirements

**Size:** 128x128px (SVG preferred)
**Format:** SVG, PNG, or WebP
**Style:** Clean, professional, recognizable

**Current Icon:** `vscode-extension/resources/icon.svg`

**Icon Description:**

- Shield or security symbol
- Clean lines
- Professional color scheme (blue/gray)
- Scalable SVG format

## Featured Image (Optional)

**Size:** 1280x720px
**Format:** PNG or WebP
**Use:** Featured in marketplace search results

**Content:**

- Extension name
- Tagline
- Key features
- Professional design

## Screenshot Tips

1. **Use a clean project** - Scan a well-structured project with some findings
2. **Good lighting** - Use light theme for better visibility
3. **Hide sensitive data** - Ensure no API keys or secrets visible
4. **Consistent styling** - Use same theme across all screenshots
5. **High resolution** - Capture at 2x or 3x scale for crisp images
6. **Crop carefully** - Maintain aspect ratio and remove UI clutter

## Tools for Screenshots

### VSCode Built-in

- Use VSCode's screenshot feature (Ctrl+Shift+P → "Screenshot")
- Export as PNG

### System Tools

- Windows: Snipping Tool, Win+Shift+S
- Mac: Cmd+Shift+4
- Linux: gnome-screenshot, flameshot

### Editing Tools

- GIMP (free)
- Photoshop
- Figma
- Canva

## Before Uploading

- [ ] All screenshots are 1280x800px
- [ ] Captions are descriptive
- [ ] No sensitive data visible
- [ ] Consistent theme across all screenshots
- [ ] Icon is 128x128px SVG
- [ ] Featured image (if used) is 1280x720px
- [ ] File names are descriptive
- [ ] Images are optimized (under 1MB each)

## Upload Process

1. Go to VSCode Marketplace publisher portal
2. Navigate to your extension
3. Go to "Assets" section
4. Upload icon
5. Upload screenshots (in order)
6. Upload featured image (optional)
7. Save and publish

## Alternative: Generate Screenshots Programmatically

For consistent screenshots, consider using a script:

```javascript
// screenshot-generator.js
const vscode = require("vscode");
const path = require("path");

async function generateScreenshots() {
  // Open specific files
  // Run scans
  // Capture screenshots
  // Save to output directory
}
```

This ensures consistent styling and can be automated for updates.
