# VS Code Marketplace Screenshot Capture Checklist

**Resolution:** 1280×800 (Marketplace requirement)
**Format:** PNG
**Output Directory:** `sales/marketplace/screenshots/`

---

## 1. Dashboard Overview
**File:** `01-dashboard-overview.png`
**How to capture:**
1. Open VS Code: with SimpleBeacon extension installed
2. Click the SimpleBeacon icon in the Activity Bar (left sidebar)
3. Ensure the Dashboard tab is selected (default view)
4. Capture the full KPI cards row (Quality Score, Gate Status, Total Issues, Repository Files)
5. Include the severity breakdown bar below the cards
6. Show at least 2–3 quick action buttons

**Key elements to verify:**
- [ ] KPI cards are fully visible and not cropped
- [ ] Quality Score shows a realistic value (not 0 or loading)
- [ ] Gate Status color is visible (green for pass / red for fail)
- [ ] Severity bar shows all four tiers (critical/high/medium/low)
- [ ] VS Code: theme is active (dark or light — pick one, be consistent)

---

## 2. Upload & Validate Panel
**File:** `02-upload-validate.png`
**How to capture:**
1. In the SimpleBeacon sidebar, click "Upload & Validate"
2. Drag a sample `.simplebeacon/report.json` into the drop zone
3. Wait for validation to complete (show both valid checks and errors)
4. If no errors available, use the template download button first

**Key elements to verify:**
- [ ] Three-stage wizard header is visible (Drop → Validate → Results)
- [ ] Split counters show (e.g., "Valid Checks: 12 / Errors Found: 3")
- [ ] At least one inline error cell is visible
- [ ] Metrics grid is populated
- [ ] Raw preview toggle is visible

---

## 3. Remediation Roadmap
**File:** `03-remediation-roadmap.png`
**How to capture:**
1. In the SimpleBeacon sidebar, click "Remediation Roadmap"
2. Ensure at least one phase has progress > 0%
3. Scroll to show the remediation card grid (2–3 cards)

**Key elements to verify:**
- [ ] Risk reduction header visible (Open Vulnerabilities, Risk Score, Completion Date)
- [ ] Three phase swimlanes visible (Triage / Short-Term / Long-Term)
- [ ] Progress bars show color and percentage
- [ ] At least one remediation card with priority border (critical=red, high=orange, medium=blue)
- [ ] Effort/status/assignee tags visible on cards

---

## 4. Gate Report Detail
**File:** `04-gate-report.png`
**How to capture:**
1. Run a scan that produces at least one medium-severity finding
2. In the sidebar, click "Gate Report" or view the scan results panel
3. Expand one finding to show full detail

**Key elements to verify:**
- [ ] Gate pass/fail banner is visible at top
- [ ] Issue list shows severity icons
- [ ] At least one expanded finding shows file path + line number
- [ ] Recommended action / fix suggestion is visible
- [ ] Code snippet preview is syntax-highlighted

---

## 5. Settings / Configuration
**File:** `05-settings-configuration.png`
**How to capture:**
1. Open VS Code: Settings (File → Preferences → Settings)
2. Search "simplebeacon" in the settings search box
3. Show the SimpleBeacon configuration section

**Key elements to verify:**
- [ ] Settings search bar shows "simplebeacon"
- [ ] At least 5–6 settings are visible (scan mode, max files, exclusions, etc.)
- [ ] Descriptions are readable
- [ ] Default values are shown

---

## Capture Tools

**Recommended:**
- Windows: `Win + Shift + S` (Snipping Tool) → select exact 1280×800 region
- macOS: `Cmd + Shift + 4` + hold `Space` for window capture
- Browser extension: GoFullPage or similar for web dashboard captures

**Naming convention:** `01-` through `05-` prefix ensures correct upload order in Marketplace.

---

## Post-Capture Verification

```bash
# Verify all 5 files exist and are correct size
ls -la sales/marketplace/screenshots/
# Each should be ~100–400KB PNG, exactly 1280×800

# Quick dimension check (if ImageMagick installed)
for f in sales/marketplace/screenshots/*.png; do identify "$f"; done
```

---

## Upload Steps

1. Go to https://marketplace.visualstudio.com/manage/publishers/simplebeacon
2. Select the SimpleBeacon extension
3. Click "Update" → "Media" tab
4. Upload screenshots in order (01 first, 05 last)
5. Add caption for each:
   - 01: "Dashboard overview with quality score, gate status, and issue breakdown"
   - 02: "Upload and validate scan reports with inline error detection"
   - 03: "Remediation roadmap with prioritized fix phases"
   - 04: "Detailed gate report with file-level findings and fixes"
   - 05: "VS Code: settings for scan mode, exclusions, and thresholds"
