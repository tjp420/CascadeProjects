# VSCode Marketplace Listing

## Extension Description

### Short Description (128 characters max)
Offline AI code audit — 38 analyzer engines, zero source-code upload, board-ready compliance reports.

### Full Description

**Simplebeacon is an offline, zero-upload AI code audit tool for VS Code.** It runs 100% on your machine so your source code never leaves your infrastructure. It scans for AI-generated slop, credential leaks, hallucinated dependencies, and EU AI Act / SOC 2 compliance gaps — then generates a board-ready Executive Risk Certificate when your team needs to show auditors, investors, or a board exactly what is in the codebase.

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
- **Free:** 10 local scans/month, 24 real-time IDE rules, CLI + VS Code extension
- **Pro:** $9/month — unlimited scans, all 38 engines, CLI scanning, CI/CD integration, export reports
- **Compliance Suite:** $399/month — unlimited scans, 60+ engines, EU AI Act + SOC 2 artifacts, 5 team seats, board-ready certificate ZIP
- **Audit Certificate:** $149 one-time — single cryptographic board-ready certificate for investors/auditors, valid 12 months
- **Enterprise Air-Gapped:** Custom pricing — on-premise deployment, SSO, unlimited seats, dedicated SLA

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

### For Engineering Teams (VP of Engineering)
- Stop shadow AI and copy-pasted LLM code from entering production
- Enforce a local, zero-upload quality gate before code review
- Catch hardcoded API keys, hallucinated dependencies, and placeholder KPIs in CI/CD
- Show leadership exactly what AI-generated risks exist in the codebase

### For Compliance & Risk Officers
- Generate board-ready Executive Risk Certificates for SOC 2 and EU AI Act audits
- Produce PDF + JSON + remediation roadmaps in minutes, not weeks
- Prove that code artifacts were audited without ever uploading source code
- Reduce reliance on expensive external compliance consulting

### For Individual Developers
- Clean up AI-generated code before committing
- Learn best practices for AI-assisted development
- Maintain professional code hygiene with a free local scanner
- Upgrade to Pro for unlimited scans and CI integration

### For Startups and Scaleups
- Prepare for investor due diligence with a $149 one-time Audit Certificate
- Move to Compliance Suite as the team grows and regulatory pressure increases
- Keep all scanning local so IP never leaves the machine

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

- **Free:** 10 local scans/month (24 IDE rules)
- **Pro:** $9/month or $90/year — unlimited scans, 38 engines, CI/CD integration
- **Compliance Suite:** $399/month or $3,999/year — unlimited scans, 60+ engines, EU AI Act + SOC 2 artifacts, 5 seats, certificate ZIP
- **Audit Certificate:** $149 one-time — single board-ready certificate, valid 12 months
- **Enterprise Air-Gapped:** Custom pricing — on-premise, SSO, unlimited seats, dedicated SLA

Visit https://simplebeacon.ai/pricing for details.

## Privacy Policy

Simplebeacon processes all code locally on your machine. Your source code is never transmitted to our servers. Only license validation involves minimal data transfer. See our full privacy policy at https://simplebeacon.ai/privacy.

## Support

- **Email:** support@simplebeacon.com
- **Documentation:** https://simplebeacon.com/docs
- **Issues:** https://github.com/tjp420/simplebeacon/issues

## License

This extension is licensed under the MIT License. See LICENSE file for details.

## Changelog

### Version 3.0.438
- Expanded false positive exclusions for 2,500+ scan report findings
- Excluded package-lock.json, generated reports, knip output from secret scanning
- Excluded dashboard views, scanner pattern files, and test fixtures from false positives
- Added credential-specific ignoreGlobs for test files with test secrets

### Version 3.0.437
- 38 analyzer engines: 24 real-time IDE rules + 14 batch CLI engines
- Enhanced AI analysis with progressive multi-layer scanning
- Real-time monitoring with AI session detection
- WebSocket streaming analysis support
- Dashboard 4.0 with compliance, repo health, and analytics panes
- SB-FICTION catalog for LLM placeholder/markdown fence detection
- Improved false positive filtering for scanner source files
- Binary file extension coverage expanded (.gguf, .rlib, .rmeta, .safetensors, etc.)
- Desktop/external project exclusions for Render deployments
- CLI scanner binary extensions synced with browser-sandbox engine

### Version 3.0.400
- Dashboard 3.0 with enhanced compliance and quality panes
- Model health monitoring with circuit breaker pattern
- Analysis profiles: Quick, Balanced, Comprehensive, Real-time
- Pattern detection using statistical analysis (no ML dependencies)

### Version 1.1.0
- Enhanced AI analysis with intelligent model selection
- Real-time analysis streaming via WebSocket
- ML-inspired pattern detection
- New sidebar views for AI panel and model health
- Configuration options for analysis profiles

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

- Website: https://simplebeacon.ai
- Documentation: https://simplebeacon.ai/community
- GitHub: https://github.com/tjp420/simplebeacon
- Twitter: @simplebeacon
