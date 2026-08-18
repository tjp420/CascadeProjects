# ai-agent Remediation Roadmap Report

Generated from: `j:/Downloads/roadmap-ai_agent-2026-07-07.json`

## Executive Summary

- **Project:** ai-agent
- **Health Score:** 40 / 100
- **Source Scan:** 2026-07-07T04:07:47.683Z
- **Exported:** 2026-07-07T04:08:26.764Z
- **Phase:** Quality Optimization (pending)
- **Severity:** low
- **Estimated Effort:** 1–3 days
- **Total Tasks:** 17 (completed: 0, remaining: 17)

## Task Breakdown by Type

- **debug:** 9
- **credential:** 8

## Prioritized Remediation Tasks

### Credential Issues (8)

- **coming-soon/build-public.js:42**
  - Snippet: `const minimalAuthJs = `(function(){'use strict';var TOKEN_KEYS=['cascadeAuthToke`
  - Description: Review && remediate: "const minimalAuthJs = `(function(){'use strict';var TOKEN_KEYS=['cascadeAuthToke" in coming-soon/build-public.js:42
- **coming-soon/js-es2018/terminal-simulation.js:72**
  - Snippet: `{ sev: 'medium', type: 'Placeholder Secret', file: 'src/auth/token.ts', line: 7,`
  - Description: Review && remediate: "{ sev: 'medium', type: 'Placeholder Secret', file: 'src/auth/token.ts', line: 7," in coming-soon/js-es2018/terminal-simulation.js:72
- **coming-soon/js/terminal-simulation.js:77**
  - Snippet: `{ sev: 'medium', type: 'Placeholder Secret', file: 'src/auth/token.ts', line: 7,`
  - Description: Review && remediate: "{ sev: 'medium', type: 'Placeholder Secret', file: 'src/auth/token.ts', line: 7," in coming-soon/js/terminal-simulation.js:77
- **packages/simplebeacon-cli/src/doctor.js:60**
  - Snippet: `const supportToken = `${iv.toString('hex')}.${encrypted}`;`
  - Description: Review && remediate: "const supportToken = `${iv.toString('hex')}.${encrypted}`;" in packages/simplebeacon-cli/src/doctor.js:60
- **coming-soon/public/js/terminal-simulation.js:77**
  - Snippet: `{ sev: 'medium', type: 'Placeholder Secret', file: 'src/auth/token.ts', line: 7,`
  - Description: Review && remediate: "{ sev: 'medium', type: 'Placeholder Secret', file: 'src/auth/token.ts', line: 7," in coming-soon/public/js/terminal-simulation.js:77
- **coming-soon/public/js-es2018/terminal-simulation.js:72**
  - Snippet: `{ sev: 'medium', type: 'Placeholder Secret', file: 'src/auth/token.ts', line: 7,`
  - Description: Review && remediate: "{ sev: 'medium', type: 'Placeholder Secret', file: 'src/auth/token.ts', line: 7," in coming-soon/public/js-es2018/terminal-simulation.js:72
- **test-jwt-rotation.cjs:41**
  - Snippet: `const r2 = await request('POST', '/api/v2/auth/refresh', {}, { refreshToken: 'fa`
  - Description: Review && remediate: "const r2 = await request('POST', '/api/v2/auth/refresh', {}, { refreshToken: 'fa" in test-jwt-rotation.cjs:41
- **scripts/ci-stress-test.cjs:82**
  - Snippet: ``// simplebeacon:production-leak-intent: test-negative-case\nconst apiKey = 'sk-`
  - Description: Review && remediate: "`// simplebeacon:production-leak-intent: test-negative-case\nconst apiKey = 'sk-" in scripts/ci-stress-test.cjs:82

### Debug Issues (9)

- **inspect_vsix.js:8**
  - Snippet: `console.log('VSIX not found:', vsixPath);`
  - Description: Review && remediate: "console.log('VSIX not found:', vsixPath);" in inspect_vsix.js:8
- **inspect_vsix2.js:24**
  - Snippet: `console.log('Total entries in VSIX:', entries.length);`
  - Description: Review && remediate: "console.log('Total entries in VSIX:', entries.length);" in inspect_vsix2.js:24
- **api-server/server.cjs:22**
  - Snippet: `console.error('[Env] FATAL: SIMPLEBEACON_LICENSE_SECRET not set. Server requires`
  - Description: Review && remediate: "console.error('[Env] FATAL: SIMPLEBEACON_LICENSE_SECRET not set. Server requires" in api-server/server.cjs:22
- **ai-tools/ai-math-audit.py:526**
  - Snippet: `print(f"Error: path not found: {source}", file=sys.stderr)`
  - Description: Review && remediate: "print(f"Error: path not found: {source}", file=sys.stderr)" in ai-tools/ai-math-audit.py:526
- **coming-soon/analyze-directory.js:166**
  - Snippet: `console.log('========================================');`
  - Description: Review && remediate: "console.log('========================================');" in coming-soon/analyze-directory.js:166
- **coming-soon/build-public.js:57**
  - Snippet: `console.warn('Source js/auth.js missing; wrote minimal fallback to public/js/aut`
  - Description: Review && remediate: "console.warn('Source js/auth.js missing; wrote minimal fallback to public/js/aut" in coming-soon/build-public.js:57
- **coming-soon/FilterAndRecalculate.js:140**
  - Snippet: `console.error('Usage: node FilterAndRecalculate.js <report.json> [output.json]')`
  - Description: Review && remediate: "console.error('Usage: node FilterAndRecalculate.js <report.json> [output.json]')" in coming-soon/FilterAndRecalculate.js:140
- **api-server/lib/db.cjs:18**
  - Snippet: `console.error('Unexpected PostgreSQL pool error:', err.message);`
  - Description: Review && remediate: "console.error('Unexpected PostgreSQL pool error:', err.message);" in api-server/lib/db.cjs:18
- **api-server/migrations/run-migrations.cjs:43**
  - Snippet: `console.log(`  SKIP ${file}`);`
  - Description: Review && remediate: "console.log(`  SKIP ${file}`);" in api-server/migrations/run-migrations.cjs:43

## Next Steps

1. Review each credential-related task to confirm whether it is a real secret or a false positive.
2. Remove or replace debug artifacts (console.log, console.error, print) in non-test production code.
3. Re-run the scan to update the health score.
