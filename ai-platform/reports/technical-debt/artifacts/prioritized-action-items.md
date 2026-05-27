# Prioritized Technical Debt Action Items

## P0 - Critical (Fix Immediately)
- [ ] Reduce ESLint errors in production paths (`server/`, `src/api/`, `src/server/`) by at least 70%
- [ ] Break up highest-risk large files (top 10 over 1200 lines)
- [ ] Triage unresolved imports and broken module references (knip/unimported)

## P1 - High (Fix This Sprint)
- [ ] Remove top duplicate code clusters from jscpd report (`duplicatedLines` > 86k baseline)
- [ ] Replace synchronous fs operations in hot server paths
- [ ] Eliminate excess debug logging from runtime code

## P2 - Medium (Fix Next Sprint)
- [ ] Upgrade outdated dependencies with staged major-version validation
- [ ] Resolve depcheck missing dependency declarations
- [ ] Clean TODO/FIXME/HACK backlog and assign owners

## P3 - Low (Fix When Time Permits)
- [ ] Standardize documentation comments for core modules
- [ ] Consolidate legacy scripts and archived adapters
- [ ] Add periodic automated debt scan workflow in CI