# VSCode Marketplace Listing

## Extension Description

### Short Description (128 characters max)
Professional AI code debt detection — 38 analyzer engines, gate enforcement, fix suggestions, and exportable reports.

### Full Description

Simplebeacon is a professional-grade AI code quality assurance tool for VSCode. It scans your codebase for AI-generated slop, hallucinated metrics, filler content, and other artifacts that can degrade code quality and security.

## Features

### Real-Time Scanning (24 Regex Engines)
- **AI Residue Detection:** Identifies TODO/FIXME stubs, dead comment blocks, and incomplete implementations
- **Credential Leaks:** Detects hardcoded API keys, passwords, and tokens
- **Sensitive Data:** Flags PII, email addresses, and personal information
- **Debug Artifacts:** Finds console.log statements, debugger breakpoints, and test markers
- **Production Leaks:** Identifies sample data references, mock endpoints, and test URLs in production code
- **Architecture Drift:** Detects hybrid model calls without schema validation
- **Fiction KPIs:** Flags unrealistic metrics and hallucinated performance claims
- **Agency Handoff:** Identifies incomplete deliverables and missing documentation

### Batch CLI Scanning (14 Additional Engines)
- Full repository scanning with CI/CD integration
- JSON schema validation
- Sample consistency checking
- Roadmap marker detection
- EU AI Act compliance patterns
- Token bleed analysis
- Architecture drift patterns
- File reduction analysis

### Tier System
- **Free Tier:** Basic real-time scanning, gate evaluation
- **Pro Tier:** All 38 engines, CLI scanning, CI/CD integration, export reports
- **Enterprise Tier:** Team management, custom rules, dedicated support

### Privacy-First Design
- All scanning happens locally on your machine
- Your source code never leaves your computer
- No cloud processing or code transmission
- License tokens used only for validation

### CI/CD Gate Integration
- Enforce quality gates in your pipeline
- Block merges with AI slop
- Configurable severity thresholds
- Export reports for audit trails

### Export Options
- JSON reports for automation
- Markdown reports for documentation
- Gate status summaries
- Fix suggestions and remediation steps

## Use Cases

### For Individual Developers
- Clean up AI-generated code before committing
- Ensure code quality standards
- Learn best practices for AI-assisted development
- Maintain professional code hygiene

### For Teams
- Enforce consistent code quality across the team
- Prevent AI slop from entering production
- Automate quality gates in CI/CD
- Track code debt over time

### For Enterprises
- Ensure AI code governance
- Meet compliance requirements (EU AI Act)
- Reduce technical debt
- Improve code maintainability

## Installation

1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Simplebeacon"
4. Click Install
5. Open the Simplebeacon sidebar to start scanning

## Configuration

### Basic Settings
- `simplebeacon.scanLocation`: Custom scan path (optional)
- `simplebeacon.fullScan`: Enable full directory scan (slower, more comprehensive)
- `simplebeacon.licenseToken`: Your Pro/Enterprise license key
- `simplebeacon.exclusions`: Glob patterns for files to exclude

### Severity Overrides
Customize rule severity:
```json
{
  "simplebeacon.severityOverrides": {
    "debug-artifact": "info",
    "credential-leak": "error"
  }
}
```

## Commands

- `Simplebeacon: Scan`: Scan current document
- `Simplebeacon: Scan Entire Workspace`: Scan all files in workspace
- `Simplebeacon: Open Dashboard`: View detailed scan results
- `Simplebeacon: Export Report as JSON`: Export scan results
- `Simplebeacon: Export Report as Markdown`: Export formatted report
- `Simplebeacon: Show Gate Status`: View gate pass/fail status
- `Simplebeacon: Set License Token`: Enter your license key

## Pricing

- **Free:** Basic real-time scanning (24 engines)
- **Pro:** $9/month or $90/year - All 38 engines, CLI scanning, CI/CD integration
- **Enterprise:** Custom pricing - Team management, custom rules, dedicated support

Visit https://simplebeacon.com/pricing for details.

## Privacy Policy

Simplebeacon processes all code locally on your machine. Your source code is never transmitted to our servers. Only license validation involves minimal data transfer. See our full privacy policy at https://simplebeacon.com/privacy.

## Support

- **Email:** support@simplebeacon.com
- **Documentation:** https://simplebeacon.com/docs
- **Issues:** https://github.com/tjp420/simplebeacon/issues

## License

This extension is licensed under the MIT License. See LICENSE file for details.

## Changelog

### Version 0.5.9
- Added full scan option for comprehensive directory scanning
- Improved false positive exclusions for scanner source code
- Fixed CLI scanner exclusions for test reports

### Version 0.5.8
- Enhanced full scan mode to include markdown files
- Added directory exclusions for full scan mode
- Improved file collection logic

### Version 0.5.7
- Added full scan configuration option
- Added UI toggle for full scan in sidebar
- Modified scanning logic to respect full scan setting

### Version 0.5.6
- Added exclusions for test fixtures and reports
- Improved scan accuracy by skipping non-production files
- Enhanced exclusion logic for test artifacts

### Version 0.5.5
- Fixed browse location display in sidebar
- Added webview message handling for scan location
- Improved UI responsiveness

### Version 0.5.4
- Initial release with 24 real-time scanning engines
- Gate evaluation and severity thresholds
- Export reports (JSON/Markdown)
- Tier system (Free/Pro/Enterprise)

## Roadmap

- [ ] Additional rule engines for specific frameworks
- [ ] Custom rule editor for Enterprise tier
- [ ] Team dashboard and analytics
- [ ] Integration with popular CI/CD platforms
- [ ] Mobile app for monitoring
- [ ] AI-powered fix suggestions

## Credits

Developed by SimpleBeacon - Professional AI code quality tools.

## Links

- Website: https://simplebeacon.com
- Documentation: https://simplebeacon.com/docs
- GitHub: https://github.com/tjp420/simplebeacon
- Twitter: @simplebeacon
