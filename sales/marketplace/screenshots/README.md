# Screenshot Generation Guide

This directory will contain the 1280x800px screenshots for the VSCode Marketplace listing.

## Required Screenshots

Based on `screenshots.md`, we need 5 screenshots:

1. **Main Sidebar** - AI Slop Cop sidebar with scan results and gate status
2. **Findings List** - Detailed list of findings with file locations and rule IDs
3. **Settings Configuration** - VSCode settings showing AI Slop Cop configuration options
4. **Full Scan Mode** - Full scan checkbox enabled with increased file count
5. **Export Report** - Exported JSON or Markdown report

## Manual Capture Instructions

Since VSCode screenshots require actual UI interaction, follow these steps:

### Prerequisites
- Open VSCode with the Simplebeacon extension loaded
- Open a test project with some findings (use `CascadeProjects` itself)
- Use a light theme for better visibility
- Ensure no sensitive data is visible

### Screenshot 1: Main Sidebar
1. Open VSCode with a project
2. Open AI Slop Cop sidebar (Ctrl+Shift+P → "Simplebeacon: Show Sidebar")
3. Run a scan
4. Use Windows Snipping Tool (Win+Shift+S) or Mac (Cmd+Shift+4)
5. Crop to exactly 1280x800px
6. Save as `01-sidebar.png`

### Screenshot 2: Findings List
1. Click on an issue count in the sidebar
2. Expand the findings list
3. Capture the detailed view
4. Crop to 1280x800px
5. Save as `02-findings.png`

### Screenshot 3: Settings Configuration
1. Open Settings (Ctrl+,)
2. Search for "simplebeacon"
3. Capture the settings panel
4. Crop to 1280x800px
5. Save as `03-settings.png`

### Screenshot 4: Full Scan Mode
1. Enable full scan checkbox in sidebar
2. Run a scan
3. Capture the sidebar with results
4. Crop to 1280x800px
5. Save as `04-full-scan.png`

### Screenshot 5: Export Report
1. Run a scan
2. Click "Export Report"
3. Open the exported file
4. Capture the report content
5. Crop to 1280x800px
6. Save as `05-export.png`

## Quality Checklist

Before uploading:
- [ ] All screenshots are exactly 1280x800px
- [ ] All images are PNG format
- [ ] Consistent light theme across all screenshots
- [ ] No API keys or secrets visible
- [ ] File names follow the pattern above
- [ ] Each image is under 1MB
- [ ] Professional, clean appearance

## Automation Option

For future updates, consider using VSCode's extension API to automate screenshot capture. This would require:
- A test extension that opens specific files
- Runs scans programmatically
- Uses VSCode's screenshot API
- Saves to this directory

## Next Steps

Once screenshots are captured:
1. Review against checklist
2. Upload to VSCode Marketplace publisher portal
3. Add captions in the marketplace listing
