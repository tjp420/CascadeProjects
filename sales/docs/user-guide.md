# AI Slop Cop - User Guide

## Getting Started

### First Scan

1. Open a project in VSCode
2. Open the AI Slop Cop sidebar (shield icon in Activity Bar)
3. Click "Scan" button
4. View results in the sidebar

### Understanding the Interface

#### Sidebar Components

- **Scan Location:** Optional custom path (leave empty for workspace)
- **Full Scan Checkbox:** Enable comprehensive scanning
- **Scan Button:** Trigger workspace scan
- **Results Section:** Shows findings and gate status
- **Issues Count:** Total number of findings
- **Files Count:** Number of files scanned
- **Export Button:** Export scan report

#### Gate Status

- **PASS:** No blocking issues found
- **REVIEW:** Issues found that need attention
- Color-coded: Green (pass), Red (review)

#### Severity Levels

- **Error:** Critical issues (credentials, security)
- **Warning:** Moderate issues (stubs, placeholders)
- **Info:** Minor issues (documentation, comments)

## Scanning Workflows

### Single File Scan

1. Open a file in VSCode
2. AI Slop Cop automatically scans on save
3. Diagnostics appear in Problems panel
4. Click on diagnostic to see details

### Workspace Scan

1. Open AI Slop Cop sidebar
2. Click "Scan" button
3. Wait for scan to complete
4. Review results in sidebar
5. Click on findings to navigate to code

### Full Directory Scan

1. Enable "Full scan" checkbox in sidebar
2. Click "Scan" button
3. Scan includes all text files (slower)
4. Review comprehensive results

### Custom Location Scan

1. Enter path in "Scan Location" field
2. Or click "Browse" to select folder
3. Click "Scan" button
4. Scan results from custom location

## Interpreting Findings

### Finding Details

Each finding shows:

- **File:** File name
- **Line:** Line number
- **Rule:** Rule ID (e.g., `debug-artifact`)
- **Message:** Description of the issue
- **Severity:** Error, Warning, or Info
- **Fix Suggestion:** Recommended action

### Common Rule Types

#### Debug Artifacts

- **Issue:** `console.log`, `debugger`, `TODO` markers
- **Severity:** Warning
- **Action:** Remove before production

#### Credential Leaks

- **Issue:** Hardcoded API keys, passwords
- **Severity:** Error
- **Action:** Move to environment variables

#### AI Residue Stubs

- **Issue:** TODO, FIXME, not implemented
- **Severity:** Warning
- **Action:** Complete implementation

#### Production Leaks

- **Issue:** Sample data in production code
- **Severity:** Error
- **Action:** Remove or replace with real data

#### Fiction KPIs

- **Issue:** Unrealistic metrics, hallucinated numbers
- **Severity:** Warning
- **Action:** Verify with real data

## Fixing Issues

### Quick Fixes

1. Click on a finding in the sidebar
2. VSCode navigates to the code location
3. Review the issue
4. Apply the suggested fix
5. Save the file

### Bulk Fixes

For similar issues across multiple files:

1. Use VSCode Find and Replace (`Ctrl+H`)
2. Search for the pattern
3. Replace with correct implementation
4. Re-scan to verify fixes

### Ignoring False Positives

If a finding is a false positive:

1. Add file to exclusions in settings
2. Or add inline comment to suppress
3. Or adjust rule severity

## Exporting Reports

### JSON Export

1. Click "Export Report" in sidebar
2. Select "Export as JSON"
3. Save to desired location
4. Use for automation or CI/CD

### Markdown Export

1. Click "Export Report" in sidebar
2. Select "Export as Markdown"
3. Save to desired location
4. Use for documentation or reviews

### Report Contents

- Summary statistics
- Gate status
- Findings by severity
- File breakdown
- Rule violations
- Fix suggestions

## Gate Integration

### Understanding Gates

Gates enforce quality standards:

- **Fail on:** Severities that block merge
- **Warn on:** Severities that show warnings
- **Thresholds:** Maximum allowed counts

### Configuring Gates

In `.simplebeacon/config.json`:

```json
{
  "gate": {
    "failOn": ["high"],
    "warnOn": ["medium", "low"]
  }
}
```

### CI/CD Integration

Add to your CI pipeline:

```bash
npx simplebeacon scan --gate --format json --output report.json
```

Exit code indicates gate status:

- 0: Pass
- 1: Fail

## CLI Usage

### Basic Commands

```bash
# Scan current directory
npx simplebeacon scan

# Scan with gate evaluation
npx simplebeacon scan --gate

# Full directory scan
npx simplebeacon scan --full

# Custom output format
npx simplebeacon scan --format json --output report.json

# Custom configuration
npx simplebeacon scan --config .simplebeacon/config.json
```

### CLI Output

```
Scanning /path/to/project...
Files scanned: 984
Findings: 11
  Errors: 0
  Warnings: 3
  Infos: 8
Gate: PASS
```

## Advanced Features

### Custom Rules (Enterprise)

Create custom rule definitions:

```json
{
  "rules": {
    "custom-pattern": {
      "enabled": true,
      "pattern": "YOUR_REGEX_HERE",
      "severity": "high",
      "message": "Custom rule message"
    }
  }
}
```

### Severity Overrides

Adjust rule severity in settings:

```json
{
  "simplebeacon.severityOverrides": {
    "debug-artifact": "error",
    "roadmap-marker": "info"
  }
}
```

### File Exclusions

Exclude specific files or patterns:

```json
{
  "simplebeacon.exclusions": [
    "**/generated/**",
    "**/vendor/**",
    "**/test-fixtures/**"
  ]
}
```

## Best Practices

### Development Workflow

1. Write code as usual
2. AI Slop Cop scans on save
3. Review findings in real-time
4. Fix issues before committing
5. Run gate scan before merge

### Team Workflow

1. Commit `.simplebeacon/config.json` to repo
2. Use consistent settings across team
3. Run gate scan in CI/CD
4. Review gate status in PRs
5. Fix blocking issues before merge

### Code Review

1. Export scan report
2. Include in PR description
3. Review findings with team
4. Discuss false positives
5. Update exclusions if needed

## Troubleshooting

### Scan Not Running

**Problem:** Scan button doesn't work

**Solution:**

1. Check workspace is open
2. Verify file has supported extension
3. Check VSCode Output panel for errors
4. Restart VSCode

### Too Many False Positives

**Problem:** Scan shows many irrelevant findings

**Solution:**

1. Add files to exclusions
2. Adjust rule severity
3. Use appropriate profile
4. Check configuration

### Gate Failing Unexpectedly

**Problem:** Gate fails with no obvious issues

**Solution:**

1. Check gate thresholds
2. Review severity overrides
3. Export report for details
4. Check for hidden files

### Performance Issues

**Problem:** Scan is very slow

**Solution:**

1. Disable full scan
2. Add more exclusions
3. Use selective scan paths
4. Check for large files

## Tips and Tricks

### Keyboard Shortcuts

- `Ctrl+Shift+A`: Open dashboard
- `Ctrl+Shift+P`: Search commands
- Type "AI Slop Cop" to see all commands

### Quick Actions

- Right-click file → "Scan with AI Slop Cop"
- Right-click directory → "Scan directory"
- Click diagnostic to jump to code

### Productivity

- Use workspace settings for team consistency
- Commit config files to version control
- Set up pre-commit hooks
- Integrate with CI/CD pipeline

## FAQ

**Q: Does AI Slop Cop send my code to the cloud?**

A: No. All scanning happens locally on your machine. Your source code never leaves your computer.

**Q: Can I use AI Slop Cop for free?**

A: Yes, the Free tier includes basic scanning with 24 real-time rules. Pro and Enterprise tiers require a license.

**Q: How do I upgrade to Pro?**

A: Visit https://simplebeacon.com/pricing, purchase a subscription, and enter your license token in VSCode settings.

**Q: Can I exclude specific files?**

A: Yes, use the `simplebeacon.exclusions` setting in VSCode settings or the `ignore` array in CLI config.

**Q: What's the difference between scan and gate scan?**

A: Regular scan shows all findings. Gate scan evaluates findings against thresholds and returns pass/fail status.

**Q: Can I use AI Slop Cop in CI/CD?**

A: Yes, Pro and Enterprise tiers include CLI scanning with gate evaluation for CI/CD integration.

## Support

- **Email:** support@simplebeacon.com
- **Documentation:** https://simplebeacon.com/docs
- **GitHub Issues:** https://github.com/tjp420/simplebeacon/issues
- **Twitter:** @simplebeacon

## Next Steps

- Explore the [Rule Catalog](rule-catalog.md)
- Set up CI/CD integration
- Configure custom rules
- Review advanced configuration options
