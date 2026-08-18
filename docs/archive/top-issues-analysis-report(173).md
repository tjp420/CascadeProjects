# Top Issues Analysis — report(173).json

**Scan overview**
- **Project:** `ai-agent`
- **Files scanned:** 114,610
- **Quality score:** 67 / 100
- **Total findings:** 3,537
- **Severity:** 0 critical, **163 high**, 622 medium, 2,752 low

## Severity breakdown by category

| Severity | Top Categories | Count |
|----------|----------------|-------|
| **High** | Security Vulnerability | 150 |
| **High** | Sensitive Data Exposure | 13 |
| **Medium** | Code Quality Issue | 338 |
| **Medium** | Credential Pattern | 143 |
| **Medium** | Accessibility Gap | 45 |
| **Medium** | Configuration Drift | 40 |
| **Medium** | Token Bleed | 33 |
| **Low** | Debug Artifact | 1,702 |
| **Low** | License/Governance Marker | 458 |
| **Low** | Maintainability Issue | 321 |

## Detailed high-severity findings

### Security Vulnerability (150)
These are almost entirely in throwaway/test files, not production code.

| File | Matches | Concern |
|------|---------|---------|
| `test-jwt-rotation.cjs` | 3 | JWT auth test script (not production) |
| `tmp_bisect.js` | 1 | `content.innerHTML = html` in temporary bisect helper |
| `_check_delimiters.js` | 1 | `new Function(test)` in syntax checker |
| `_check_html_integrity.js` | 1 | `new Function(mainScriptContent)` in syntax checker |
| `_check_syntax.js` | 1 | `new Function(m[1])` in syntax checker |

**Recommendation:** Exclude these from scans via `.simplebeaconignore`:

```gitignore
# Temporary / throwaway helpers
tmp_*.js
_check_*.js

# Test scripts
test-*.cjs
*.test.cjs
```

### Sensitive Data Exposure (13)
Most findings are sample/demo emails in `simplebeacon-vscode-merged/dashboard-web/`.

| File | Snippet / Concern |
|------|-------------------|
| `dashboard-web/serve.cjs:116` | Demo account seed including `trevor.punt@live.com` and hashed password `demo123` |
| `dashboard-web/js/controllers/billingLanding.js:133` | `mailto:support@simplebeacon.ai` |
| `dashboard-web/js/views/AnalyzeTargetConfig.js:21` | Example paths string with fake repo URLs |
| `dashboard-web/js/views/ProfileView.js:826` | Default fallback email `user@simplebeacon.ai` |

**Recommendation:** Replace the real personal email in the dev seed with a generic `@example.com` address.

## Medium-severity breakdown

- **Code Quality Issue (338):** Unhandled promises, missing strict mode, uninitialized reads. Many appear in `serve-codemap*.js` temp files.
- **Credential Pattern (143):** Likely test fixtures and `terminal-simulation.js` demo strings.
- **Accessibility Gap (45):** Missing ARIA labels or low-contrast elements.
- **Configuration Drift (40):** Hardcoded localhost/ports/defaults.
- **Token Bleed (33):** Potential token-like strings in vendor/build files.

## Recommended remediation order

1. **High priority:** Add ignore patterns for temp/test files driving the 150 high-severity security findings.
2. **Medium priority:** Clean the dev seed in `simplebeacon-vscode-merged/dashboard-web/serve.cjs` to remove the real personal email.
3. **Lower priority:** Reduce scan noise by ignoring license headers, governance markers, and debug artifacts in known vendor/test directories.

---
*Generated from `j:\Downloads\report(173).json`*
