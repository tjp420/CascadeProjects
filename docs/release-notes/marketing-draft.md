Release: SimpleBeacon — 2026-08-26 Fixes & Rule Updates

TL;DR

This release includes targeted fixes to our scanning rules, an important observability fix to avoid silent failures, and the packaged VS Code extension (VSIX attached to the GitHub Release). The release is published as a GitHub release; we are holding off on VS Code Marketplace publishing until staging validation and legal review are complete.

Blog draft (700–900 words)

Headline
SimpleBeacon 2026-08-26 — Safer scans, quieter failures fixed, and improved VS Code tooling

Intro (50–100 words)
Today’s release focuses on reliability and developer experience. We shipped updates to our scanning rule set, fixed a high-value issue where certain errors could be silently swallowed by empty catch blocks, and prepared the VS Code extension package (VSIX attached to the GitHub Release). This release reduces hidden failure modes and makes it easier to audit and act on scan findings.

What’s changed (3–4 bullets)
- Rule updates: tuned compliance, OWASP LLM, and security pattern rule sets to reduce false positives and improve detection accuracy.
- Observability fix: converted several empty catch blocks into minimal diagnostic logging so unexpected runtime errors are visible in logs (addresses SB-AI-004 class of findings).
- Vendor asset for CSP: vendored dompurify source map so the dashboard no longer triggers CSP connect-src blocks when source maps are requested.
- VS Code extension: packaged the extension (VSIX attached to the GitHub Release). Marketplace publishing is pending staging and legal sign-off.

Deep-dive (2–3 paragraphs)
The rule updates reduce noise for common patterns and refine token/quarantine heuristics. This helps teams focus on true positives and reduces cognitive load during triage. The change was driven by both internal telemetry and community feedback.

A key reliability improvement in this release replaces silent catch blocks in a few server-side modules with unobtrusive diagnostic logging. While swallowing exceptions is occasionally intentional (for test fixtures or best-effort non-critical paths), we found several runtime contexts where silent failures made post-mortem debugging difficult. The new approach logs an informative message including context and error message so operators can quickly surface and remediate underlying causes without changing high-level behavior.

Security & compatibility notes
- No backwards-incompatible API changes.
- No production secrets were added to the repo. Pre-commit hooks and gitleaks checks ran successfully during commits.
- The db schema scan flagged a potential "users" table ownership conflict across services. This is an informational finding and has been tracked in issue #820 for architecture alignment. No schema changes were made in this release.

How to get it / upgrade notes
- Download the VSIX from the GitHub Release: https://github.com/tjp420/CascadeProjects/releases/tag/release-2026-08-26-fixes
- Recommend staging deploy and smoke tests before rolling to production.

Call-to-action
Please review the release notes, test the VSIX in a staging environment, and confirm legal/privacy copy before we publish the extension to the Marketplace.

Suggested screenshots (3)
1. Dashboard overview showing a passing scan and the new vendor asset served from /vendor (file: assets/screenshot-dashboard-overview.png)
2. Scan result highlighting the fixed empty-catch finding (SB-AI-004) and pointing to the code link (file: assets/screenshot-scan-fix.png)
3. VS Code extension panel with the SimpleBeacon sidebar and a sample scan result (file: assets/screenshot-vscode-panel.png)

Demo GIF plan (~15-25s)
- Start in terminal: run a quick repo scan (npm run scan:gate) — show the command and the run beginning.
- Switch to dashboard: open the scan result, scroll to the fixed finding area, click to view code.
- Open VS Code: show the extension sidebar and a simple flow (open a file, run quick local scan via the extension).
- Export GIF using 15–25s capture at 720p, 10–15 fps, optimized size.

Social copy
- Twitter (short): "SimpleBeacon — August release: rule tuning, observability fixes, and a packaged VS Code extension. VSIX attached to release. Staging checks before Marketplace publish. https://github.com/tjp420/CascadeProjects/releases/tag/release-2026-08-26-fixes #SimpleBeacon #DevSecOps"
- LinkedIn (longer): "Today we shipped SimpleBeacon 2026-08-26 with improved scanning rules, an important observability fix that surfaces previously-silent errors, and a packaged VS Code extension (VSIX attached). We recommend testing the VSIX in staging and confirming legal/privacy copy before Marketplace publish. Read the release notes and download: https://github.com/tjp420/CascadeProjects/releases/tag/release-2026-08-26-fixes"
- Email subject + snippet: "SimpleBeacon: Reliability & Rule Updates — Aug 26" / "This release refines scanning rules and fixes silent errors. VSIX attached to the release — please smoke-test in staging."

UTM links (examples)
- Release page: https://github.com/tjp420/CascadeProjects/releases/tag/release-2026-08-26-fixes?utm_source=blog&utm_medium=social&utm_campaign=release-2026-08-26
- Docs: https://github.com/tjp420/CascadeProjects/blob/main/docs/release-notes/release-2026-08-26.md?utm_source=blog&utm_medium=social&utm_campaign=release-2026-08-26

Pre-publish checklist (legal & staging)
- [ ] Legal/privacy review completed and copy approved
- [ ] DB schema owner confirms or accepts the users table architecture note (issue #820) or schedules migration plan
- [ ] Staging deploy completed and smoke tests passing
- [ ] Confirm telemetry/monitoring accepts additional small log volume from the new diagnostic messages
- [ ] Sign-off to publish to VS Code Marketplace

Files created by this draft
- docs/release-notes/marketing-draft.md (this file)
- docs/release-notes/assets/ (placeholders for screenshots and GIF)

Notes
- The GitHub Release is published and includes the VSIX; Marketplace publishing is pending. If you want the Marketplace publish automated, provide publisher credentials or confirm when to run the marketplace publish step.

--
Generated by the release automation workflow; please review and update messaging to match your public brand tone.
