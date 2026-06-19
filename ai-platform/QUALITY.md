# Quality Process — Monorepo

Applies to: `ai-platform/` and `ai-agent/`.

## Monthly Quality Gate Review

### Schedule
- **Frequency**: First business day of each month
- **Duration**: 1 hour
- **Owner**: Project maintainer

### Checklist
- [ ] Run test suite: `npm test`
- [ ] Run syntax check on all `.js` and `.cjs` files: `node -c <file>`
- [ ] Review pre-commit hook effectiveness
- [ ] Verify no ghost files referenced in recent patches
- [ ] Update this document with any new patterns or learnings

## Pre-Commit Hooks
Installed at `ai-platform/.husky/pre-commit`. Runs automatically on every commit:
1. Syntax-checks all staged JS/CJS files
2. Runs `npm test`

## Test Coverage
Run tests with: `npm test`

## Escalation
If `npm test` fails or syntax errors are found, fix before committing.
