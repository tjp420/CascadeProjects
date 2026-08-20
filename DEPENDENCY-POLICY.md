# Dependency Update Policy — SimpleBeacon

**Effective Date:** 2026-06-07  
**Review Cycle:** Monthly  
**Owner:** Engineering Team

---

## 1. Scope

This policy applies to all Node.js packages within the SimpleBeacon ecosystem:

| Package                  | Path                                              | Status                            |
| ------------------------ | ------------------------------------------------- | --------------------------------- |
| coming-soon              | `/coming-soon`                                    | Active                            |
| ai-platform              | `/ai-platform`                                    | Active                            |
| ai-platform-cli          | `/ai-platform/packages/simplebeacon-cli`          | Active                            |
| ai-platform-intelligence | `/ai-platform/packages/simplebeacon-intelligence` | Active                            |
| ai-agent                 | `/ai-agent`                                       | Active (0 deps, lockfile present) |
| ai-tools                 | `/ai-tools`                                       | Active (0 deps, lockfile present) |
| root                     | `/`                                               | Active                            |
| simplebeacon-cli         | `/packages/simplebeacon-cli`                      | Active                            |
| vscode-extension         | `/vscode-extension`                               | Active                            |

---

## 2. Audit Results (2026-07-16)

| Directory                 | Vulnerabilities | Severity                      |
| ------------------------- | --------------- | ----------------------------- |
| coming-soon               | **0**           | None                          |
| ai-platform               | **0**           | None                          |
| simplebeacon-cli          | **0**           | None                          |
| simplebeacon-intelligence | **0**           | None                          |
| ai-agent                  | **0**           | None                          |
| ai-tools                  | **0**           | None                          |
| root                      | **0**           | None                          |
| vscode-extension          | **0**           | None                          |
| java-ai-vulnerable        | **Skipped**     | Intentionally vulnerable demo |

**Total audited dependencies with lockfiles:** ~1127  
**Total known vulnerabilities:** **0**

_Note:_ Resolved `mocha`/`serialize-javascript`/`diff` advisories by updating `simplebeacon-vscode-merged` `mocha` to `^12.0.0-rc.1`.

### Deprecated Packages (non-security)

| Package              | Reason                                | Action                | Status                                                                      |
| -------------------- | ------------------------------------- | --------------------- | --------------------------------------------------------------------------- |
| `inflight@1.0.6`     | Memory leaks, unsupported             | Update to `lru-cache` | Deferred — transitive dep of `glob@8`; will resolve when `glob` is upgraded |
| `glob@8.1.0`         | Known security issues in old versions | Update to `glob@11`   | Planned for next quarterly dev dependency update                            |
| `multer@1.4.5-lts.2` | Patched in 2.x                        | Upgrade to multer 2.x | Planned for next quarterly dev dependency update                            |

---

## 3. Update Cadence

| Dependency Type         | Frequency                                | Tool                    |
| ----------------------- | ---------------------------------------- | ----------------------- |
| Production dependencies | Monthly                                  | `npm update`            |
| Dev dependencies        | Quarterly                                | `npm update --save-dev` |
| Security patches        | Immediate (within 24h of CVE disclosure) | `npm audit fix`         |
| Major version upgrades  | Bi-annually (planned)                    | Manual review           |

---

## 4. Severity Response Matrix

| Severity | Response Time | Action                                     |
| -------- | ------------- | ------------------------------------------ |
| Critical | 4 hours       | Emergency patch; CI blocked until resolved |
| High     | 24 hours      | Patch or pin; require approval to defer    |
| Moderate | 7 days        | Patch in next sprint                       |
| Low      | 30 days       | Bundle with regular maintenance            |
| Info     | Next cycle    | Document and monitor                       |

---

## 5. Automation

- **CI Integration:** `npm audit` runs on every PR; builds fail on `high` or `critical`
- **Dependabot:** Enabled for weekly dependency update PRs
- **Lockfile verification:** `npm ci` enforces lockfile integrity in CI
- **Pre-commit hook:** Rejects direct `package.json` edits without lockfile update

---

## 6. Exceptions

- `ai-agent` and `ai-tools` maintain `package-lock.json` with zero dependencies (no audit surface)
- Root monorepo workspace lockfile regenerated 2026-06-11; `npm ci` verified
- Packages in `node_modules` are excluded from manual review (automated tooling only)
- Legacy packages with deprecation warnings but no security impact may be deferred with documented justification
- 0-dependency packages are excluded from per-package review tasks

---

## 7. Review Log

| Date           | Auditor                         | Result                                                                                                               | Notes                                                                                                                                                                                                                                                                                              |
| -------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-07     | SimpleBeacon Scan               | 0 vulnerabilities                                                                                                    | All active packages clean                                                                                                                                                                                                                                                                          |
| 2026-06-08     | npm Audit Phase                 | 0 vulnerabilities                                                                                                    | Missing lockfile generated; `npm ci` verified across all packages                                                                                                                                                                                                                                  |
| 2026-06-09     | npm Audit Phase                 | 1 moderate                                                                                                           | Root lockfile generated; esbuild CVE in ai-platform; deprecation warnings logged                                                                                                                                                                                                                   |
| 2026-06-10     | npm Audit Phase                 | 0 vulnerabilities                                                                                                    | vite bumped ^5.0.0 → ^8.0.16 (CVE GHSA-4w7w-66w2-5vf9 + GHSA-67mh-4wv8-2f99); all lockfiles regenerated and verified                                                                                                                                                                               |
| 2026-06-10     | npm Audit Phase                 | 0 vulnerabilities                                                                                                    | Generated missing lockfiles for `vscode-extension` and `ai-platform/packages/simplebeacon-intelligence`; `npm audit` clean across all 9 active packages                                                                                                                                            |
| 2026-06-11     | npm Audit Phase                 | 0 vulnerabilities                                                                                                    | Fixed root lockfile sync (express-rate-limit, stripe, ip-address); fixed ai-platform eslint peer dep conflict (`@eslint/js` ^10.0.1 → ^9.15.0); added `husky` to ai-platform devDependencies; `npm ci` verified across all active packages                                                         |
| 2026-07-16     | npm Audit Phase                 | 0 vulnerabilities                                                                                                    | `npm audit` clean across root and all active workspaces; resolved `mocha`/`serialize-javascript`/`diff` advisories by updating `simplebeacon-vscode-merged` `mocha` to `^12.0.0-rc.1`                                                                                                              |
| 2026-07-24     | SimpleBeacon Export / npm audit | 4 high vulnerabilities in `ai-platform` quality-security export; live `npm audit` reports 26 high-severity instances | Advisories: `archiver`, `brace-expansion`, `minimatch`, `readdir-glob`. `archiver@8.0.0` removes the vulnerable subtree but depends on ESM-only `is-stream@4`, which breaks `require('archiver')` in CommonJS server code. Requires an override or targeted patch before handoff.                  |
| 2026-07-24     | SimpleBeacon Browser-Local Scan | `Editor` 1 file/0 folders/0 findings PASS; `CascadeProjects` 1 file/0 folders/0 findings PASS                        | `Editor` is a Unity binary directory, so an empty scan is expected. `CascadeProjects` browser-local picker scan is not authoritative — it only discovered 1 file. Use CLI/server scan (`npx simplebeacon scan --full`) or the local agent for an authoritative `CascadeProjects` gate attestation. |
| **2026-08-03** | **Scheduled**                   | —                                                                                                                    | Next monthly quality gate review (first business day of August)                                                                                                                                                                                                                                    |

---

_Generated by SimpleBeacon Sovereign Engine dependency audit._
