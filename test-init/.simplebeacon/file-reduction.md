# Data Cleanup Report

Project: `c:\Users\Trevor\CascadeProjects\test-init`
Generated: 2026-07-01T17:57:02.118Z
Mode: dry-run (no files deleted)

## Summary

- Files scanned: **0**
- Directories scanned: **1**
- Total findings: **0**
- Build artifact hits: **0**
- Duplicate asset groups: **0**
- Unused file candidates: **0**
- Config management findings: **0**
- Dependency health findings: **0**
- Environment variable findings: **0**
- Data freshness findings: **0**
- Data access pattern findings: **0**
- Data privacy findings: **0**
- Orphaned data files: **0**
- Data shape drift groups: **0**
- Severity breakdown: **0 high**, **0 medium**, **0 low**
- Estimated reclaimable space: **0 B**
- Rough finding density: **0%** of scanned files flagged

## Build Artifacts

_No build artifact directories or generated files detected._

## Asset Consolidation

_No duplicate asset groups detected._

## Unused File Candidates

_No unused file candidates detected._

## Configuration Management

_No configuration management findings._

## Dependency Health

_No dependency health findings._

## Environment Variables

_No environment variables findings._

## Data Freshness

_No data freshness findings._

## Data Access Patterns

_No data access patterns findings._

## Data Privacy

_No data privacy findings._

## Data Lineage (Orphaned Data)

_No data lineage (orphaned data) findings._

## Data Consistency

_No data consistency findings._

## Recommendations

1. Start with **build artifact** directories (`node_modules`, `dist`, `coverage`) — highest confidence.
2. Consolidate **duplicate assets** by keeping one canonical copy and updating references.
3. Review **unused file** candidates manually — static analysis cannot detect dynamic imports or runtime loaders.
4. Align **environment variables** and remove unused keys after verifying deployment docs.
5. Refresh **stale mock/sample data** flagged by freshness and lineage scans.
6. Fix **sync I/O in routes/loops** flagged by data access pattern analysis.
7. Remove **PII and secrets** from mock data files before sharing exports.
8. Resolve **dependency version drift** across workspace package.json files before removing unused deps.
9. Re-run `npx simplebeacon reduce` after cleanup to measure progress.

> This report is advisory. Nothing is deleted unless you act on findings manually.
