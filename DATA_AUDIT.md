# Data Audit — C:\Users\Trevor\CascadeProjects

## Summary

| Location                            | Files    | Size       | Verdict                             |
| ----------------------------------- | -------- | ---------- | ----------------------------------- |
| `/.simplebeacon/`                   | 209      | ~21 MB     | 🔴 Bloat — many duplicates          |
| `/ai-platform/.simplebeacon/`       | 195      | ~5.4 MB    | 🟡 Stale — tier-specific test scans |
| `/coming-soon/.simplebeacon/`       | 27       | ~1.4 MB    | 🔴 Bloated — 3× 342 KB duplicates   |
| `/ai-platform/web/data/`            | 55       | ~50 KB     | 🟢 Needed — dashboard sample data   |
| `/ai-platform/data/`                | 4        | ~2 KB      | 🟡 Contains secrets file            |
| Root level (`report.json`, `tmp-*`) | ~10      | ~30 KB     | 🔴 Temp / stale                     |
| **Total**                           | **~500** | **~28 MB** | **Mostly generated artifacts**      |

---

## 1. Root `/.simplebeacon/` (~21 MB) — 🔴 BLOAT

**What it is:** Accumulated scan reports from running `simplebeacon` CLI across the monorepo.

| File Pattern                           | Count | Verdict                                     |
| -------------------------------------- | ----- | ------------------------------------------- |
| `*-report.json` / `*-scan.json`        | ~40   | 🟡 Keep latest, delete rest                 |
| `delivery_*.json`                      | ~25   | 🟡 Certificate delivery logs — keep last 10 |
| `gate-fix-verify*.json`                | ~6    | 🔴 Old verification snapshots               |
| `report-deliveries/`                   | ~80   | 🔄 Old report delivery records              |
| `*.simplebeacon-backup.*`              | ~5    | 🔴 Timestamped backups — safe to delete     |
| `website-scan.json` (88 KB)            | 1     | 🟡 Largest file — keep if referenced        |
| `complete-verify.json`, `final-*.json` | ~10   | 🔴 Stale verification runs                  |

**Action:** Keep the 3 newest reports. Delete everything older than 30 days.

---

## 2. `ai-platform/.simplebeacon/` (~5.4 MB) — 🟡 STALE

**What it is:** Test scan outputs for different pricing tiers and scenarios.

| File                                     | Size        | Verdict                  |
| ---------------------------------------- | ----------- | ------------------------ |
| `scan-warranty199.json`                  | 69 KB       | 🟡 Tier demo scan        |
| `scan-clearance499.json`                 | ~60 KB      | 🟡 Tier demo scan        |
| `scan-euai2499.json`                     | ~60 KB      | 🟡 Tier demo scan        |
| `scan-community.json`                    | ~60 KB      | 🟡 Tier demo scan        |
| `full-coverage-report.json`              | ~55 KB      | 🟡 Keep — baseline       |
| `full-coverage-report2.json`             | ~55 KB      | 🔴 Duplicate             |
| `gate-fix-verify*.json` (×4)             | ~60 KB each | 🔴 Old fix verifications |
| `root-fresh.json`, `latest-fix-all.json` | ~60 KB each | 🔴 Stale                 |
| `data-cleanup-report.json`               | ~62 KB      | 🔴 One-off run           |

**Action:** Keep `full-coverage-report.json` as baseline. Delete tier-specific scans (they're regenerated on demand). Delete old `gate-fix-verify*` files.

---

## 3. `coming-soon/.simplebeacon/` (~1.4 MB) — 🔴 BLOAT

**What it is:** Certificate generator's local data store + scan history.

| File                                                           | Size         | Verdict                           |
| -------------------------------------------------------------- | ------------ | --------------------------------- |
| `report-coming-soon.json`                                      | **342 KB**   | 🔴                                |
| `report-final-roadmap.json`                                    | **342 KB**   | 🔴 **Exact duplicate**            |
| `report-roadmap.json`                                          | **342 KB**   | 🔴 **Exact duplicate**            |
| `report-improved.json`                                         | 87 KB        | 🟡 Keep if current                |
| `report-fresh.json` / `report.json`                            | 19 KB each   | 🟡 Likely same file               |
| `app.db`                                                       | 32 KB        | 🟢 SQLite — production data       |
| `test-*.db` (×6)                                               | 32 KB each   | 🔴 **Test databases**             |
| `eu-ai-act-report.json`                                        | 18 KB        | 🟡 Keep latest only               |
| `eu-ai-act-assessment.json`                                    | 12 KB        | 🔴 May duplicate report           |
| `verify-scan.json` / `verify-scan2.json` / `verify-scan3.json` | 6–10 KB each | 🔴 Multiple verification attempts |
| `history.json`                                                 | 7 KB         | 🟡 Scan history log               |
| `baseline.json`                                                | 2 KB         | 🟢 Needed for comparisons         |
| `config.json`                                                  | 3 KB         | 🟢 Scanner config                 |

**Action:**

1. Delete the 3× 342 KB duplicates (`report-coming-soon`, `report-final-roadmap`, `report-roadmap`) — save **~684 KB**
2. Delete the 6 `test-*.db` files — save **~192 KB**
3. Merge `report-fresh.json` + `report.json` if identical
4. Keep `app.db`, `baseline.json`, `config.json`, `history.json`

---

## 4. `ai-platform/web/data/` (~50 KB) — 🟢 NEEDED

**What it is:** 55 small sample JSON files used by the dashboard UI for demo/demo mode.

| File                                 | Size               | Status             |
| ------------------------------------ | ------------------ | ------------------ |
| `*-sample.json` (×54)                | 100–600 bytes each | 🟢 Demo data       |
| `remediation-roadmap-sb-837864.json` | 3 KB               | 🟢 Specific sample |

All are referenced by the dashboard. **Keep all.** Total size is negligible.

---

## 5. `ai-platform/data/` (~2 KB) — 🟡 REVIEW

| File                                     | Size      | Verdict                                   |
| ---------------------------------------- | --------- | ----------------------------------------- |
| `.dev-jwt-secrets.json`                  | 434 bytes | 🔴 **Sensitive — gitignored but on disk** |
| `roadmap/ai-roadmap-report.json`         | ~1 KB     | 🟡 Roadmap data                           |
| `roadmap/dynamic-roadmap-last-scan.json` | ~1 KB     | 🟡 Generated                              |

**Action:**

- `.dev-jwt-secrets.json` — **Move to environment variables.** Delete the file. Even though it's gitignored, it's sitting on disk in the repo.

---

## 6. Root-Level Temp / Stale Files — 🔴 DELETE

| File                               | Size   | Verdict                   |
| ---------------------------------- | ------ | ------------------------- |
| `report.json` (root)               | 23 KB  | 🔴 Old scan output        |
| `report-gate-pass-2026-06-06.json` | 0.3 KB | 🔴 One-day-old gate check |
| `tmp-files.txt`                    | 0.5 KB | 🔴 Temp file              |
| `tmp-list.txt`                     | 3 KB   | 🔴 Temp file              |
| `universal-token.txt`              | 0.9 KB | 🔴 **Contains token?**    |

**Action:** Delete all of these. If `universal-token.txt` contains a real JWT, rotate it.

---

## 7. `github-cache/` and `.github-sync/` — 🟡 CACHED CLONES

These contain cached GitHub repo clones for the scanner. They're large (likely hundreds of MB). Since they're caches:

- **Needed for scanner** if repos are re-scanned frequently
- **Can be purged** and re-downloaded
- **Should be gitignored** (verify they are)

---

## Recommended Cleanup Commands

```bash
# 1. Delete old scan reports (keep 3 newest)
cd C:\Users\Trevor\CascadeProjects\.simplebeacon
# Keep: latest-scan.json, full-coverage-report.json, gate-fix-verify3.json
# Delete: gate-fix-verify.json, gate-fix-verify2.json, data-cleanup-report.json, etc.

# 2. Delete tier-specific demo scans
cd C:\Users\Trevor\CascadeProjects\ai-platform\.simplebeacon
# Delete: scan-warranty199.json, scan-clearance499.json, scan-euai2499.json, scan-community.json
# Delete: full-coverage-report2.json (duplicate)
# Delete: root-fresh.json, latest-fix-all.json, data-cleanup-report.json

# 3. Delete coming-soon duplicates
cd C:\Users\Trevor\CascadeProjects\coming-soon\.simplebeacon
# Delete: report-coming-soon.json, report-final-roadmap.json, report-roadmap.json (keep one)
# Delete: test-*.db (6 files)
# Delete: verify-scan.json, verify-scan2.json, verify-scan3.json (keep latest)

# 4. Delete root temp files
cd C:\Users\Trevor\CascadeProjects
rm report.json, report-gate-pass-*.json, tmp-files.txt, tmp-list.txt, universal-token.txt

# 5. Move secrets out of repo
cd C:\Users\Trevor\CascadeProjects\ai-platform\data
rm .dev-jwt-secrets.json
# Store in env var: SIMPLEBEACON_DEV_JWT_SECRET
```

---

## Potential Space Savings

| Action                               | Space Saved |
| ------------------------------------ | ----------- |
| Delete duplicate 342 KB reports (×2) | ~684 KB     |
| Delete test databases (×6)           | ~192 KB     |
| Delete old scan reports (root)       | ~15 MB      |
| Delete tier demo scans               | ~3 MB       |
| Delete old gate verifications        | ~2 MB       |
| Delete temp files                    | ~30 KB      |
| **Total**                            | **~21 MB**  |

---

## Security Note

- `.dev-jwt-secrets.json` — **Should not exist in repo**
- `universal-token.txt` — **May contain sensitive token**
- `report.json` and scan outputs — **May contain file paths/snippets from your code**

All of these are currently sitting in your repo directory. Even if gitignored, they're accessible to anyone with filesystem access.
