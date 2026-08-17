/**
 * Master engineer problem solver — "yes you can" when everyone else says no.
 *
 * Takes a natural-language problem statement and returns a comprehensive,
 * multi-cylinder resolution plan with curated online resources.
 *
 * Deterministic pattern matching — no LLM inference, no code upload.
 */

const { GUIDE_PLAYBOOKS, collectActiveGuideIds } = require('../reporters/remediation-guides');
const { buildMasterEngineeringBrief } = require('./master-engineering-brief');

/**
 * Curated online resources — verified URLs for engineering problem solving.
 * Organized by domain so playbooks can reference them.
 */
const PROBLEM_RESOURCES = Object.freeze({
    // CI/CD
    githubActionsDebug: {
        title: 'Debugging GitHub Actions failures',
        url: 'https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/troubleshooting-workflows',
        note: 'Read logs, re-run failed steps, debug via SSH'
    },
    ciFlakyTests: {
        title: 'Flaky test patterns and quarantine strategies',
        url: 'https://docs.google.com/document/d/1z-i1kV-rKd2e8tu4bRPcRfTn3v8eQFM3KQdG9bI5I8',
        note: 'Identify, quarantine, and fix flaky tests systematically'
    },
    mergeQueues: {
        title: 'GitHub merge queues for green main',
        url: 'https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/managing-a-merge-queue',
        note: 'Batch PRs to keep main always green'
    },
    // Testing
    jestDebug: {
        title: 'Jest debugging guide',
        url: 'https://jestjs.io/docs/troubleshooting',
        note: '--verbose, --detectOpenHandles, --forceExit, snapshot drift'
    },
    testPyramid: {
        title: 'Test pyramid strategy',
        url: 'https://martinfowler.com/articles/practical-test-pyramid.html',
        note: 'Unit > integration > e2e — balance for fast feedback'
    },
    // Dependencies
    npmAuditFix: {
        title: 'npm audit fix strategies',
        url: 'https://docs.npmjs.com/cli/v10/commands/npm-audit',
        note: '--fix, --force, overrides, transitive CVE triage'
    },
    depMajors: {
        title: 'Major version upgrade patterns',
        url: 'https://docs.npmjs.com/cli/v10/commands/npm-update',
        note: 'Incremental upgrades, lockfile pinning, breaking change logs'
    },
    // Secrets/Security
    owaspTop10: {
        title: 'OWASP Top 10 — secure coding',
        url: 'https://owasp.org/www-project-top-ten/',
        note: 'Injection, broken auth, sensitive data exposure, XXE, broken access'
    },
    secretsRotation: {
        title: 'Secret rotation playbook (AWS/Stripe/Resend)',
        url: 'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
        note: 'Rotate, revoke, verify — never leave a rotated key in git'
    },
    // Performance
    lighthouseAudit: {
        title: 'Lighthouse CI auditing guide',
        url: 'https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md',
        note: 'LHCI config, assertions, SPA rendering, artifact upload'
    },
    webVitals: {
        title: 'Core Web Vitals thresholds',
        url: 'https://web.dev/articles/vitals',
        note: 'LCP < 2.5s, INP < 200ms, CLS < 0.1'
    },
    bundleAnalysis: {
        title: 'Bundle size analysis with vite/rollup',
        url: 'https://vitejs.dev/guide/build.html#chunking-strategy',
        note: 'Manual chunks, dynamic imports, tree shaking verification'
    },
    // Architecture
    monorepoTools: {
        title: 'Monorepo tooling comparison (npm/turbo/nx)',
        url: 'https://monorepo.tools/',
        note: 'Workspaces, task pipelines, caching, path filters'
    },
    circularDeps: {
        title: 'Detecting and breaking circular dependencies',
        url: 'https://github.com/sverweij/dependency-cruiser',
        note: 'dependency-cruiser rules, .dep.yml, reachability analysis'
    },
    // Deployment
    dockerDebug: {
        title: 'Docker build debugging',
        url: 'https://docs.docker.com/build/building/best-practices/',
        note: 'Layer caching, multi-stage, BuildKit, --no-cache diagnosis'
    },
    cloudflareWorkers: {
        title: 'Cloudflare Workers deployment guide',
        url: 'https://developers.cloudflare.com/workers/get-started/guide/',
        note: 'wrangler deploy, secrets, bindings, tail logs'
    },
    // Database
    sqliteMigration: {
        title: 'SQLite migration patterns',
        url: 'https://www.sqlite.org/lang_altertable.html',
        note: 'ADD COLUMN, table rebuild, backup before migrate'
    },
    redisRateLimit: {
        title: 'Redis-backed rate limiting',
        url: 'https://github.com/express-rate-limit/redis-store',
        note: 'Distributed counters, sliding window, fail-open'
    },
    // Frontend
    reactA11y: {
        title: 'React accessibility (WCAG, aria-label, contrast)',
        url: 'https://web.dev/articles/learn/accessibility',
        note: 'button-name, color-contrast, landmark, focus management'
    },
    tailwindCss: {
        title: 'Tailwind CSS theming and variables',
        url: 'https://tailwindcss.com/docs/theme',
        note: 'CSS variables, data-theme, dark mode, contrast ratios'
    },
    viteConfig: {
        title: 'Vite configuration guide',
        url: 'https://vitejs.dev/config/',
        note: 'base path, build options, static assets, module loading'
    },
    // Git
    gitRecovery: {
        title: 'Git recovery — reflog, reset, cherry-pick',
        url: 'https://git-scm.com/docs/git-reflog',
        note: 'Recover lost commits, undo bad merges, fix detached HEAD'
    },
    gitBranching: {
        title: 'Git branching strategy for teams',
        url: 'https://www.atlassian.com/git/tutorials/comparing-workflows',
        note: 'Feature branches, rebase vs merge, squash commits'
    },
    // Node.js
    nodeEsmCjs: {
        title: 'Node.js ESM/CJS interop guide',
        url: 'https://nodejs.org/api/esm.html',
        note: 'import(), require in ESM, package.json type field'
    },
    nodeMemory: {
        title: 'Node.js memory leak diagnosis',
        url: 'https://nodejs.org/en/docs/guides/diagnostics/memory-leak',
        note: 'Heap snapshots, --inspect, V8 profiler'
    },
    // TypeScript
    tsStrict: {
        title: 'TypeScript strict mode migration',
        url: 'https://www.typescriptlang.org/tsconfig#strict',
        note: 'noImplicitAny, strictNullChecks, incremental migration'
    },
    tsErrors: {
        title: 'TypeScript error reference (TS2xxx)',
        url: 'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html',
        note: 'Type narrowing, generics, declaration files'
    }
});

/**
 * Master engineer playbooks — "yes you can" pattern matchers.
 * Each playbook fires when the problem statement matches its triggers.
 */
const SOLVE_PLAYBOOKS = [
    {
        id: 'ci-failing-tests',
        domain: 'ci',
        triggers: ['ci fail', 'ci failing', 'ci is failing', 'test failure', 'test fail', 'tests fail', 'tests failing', 'pipeline fail', 'pipeline failing', 'workflow fail', 'workflow failing', 'actions fail', 'github actions', 'ci broken', 'ci is broken'],
        othersSay: 'CI is broken and there are too many failures to fix.',
        youCan: 'CI failures are a queue, not a wall. Triage by suite, fix the first failing test, and the cascade often stops.',
        steps: [
            'Read the raw CI log — find the FIRST failing suite, not the last cascading error.',
            'Reproduce locally: run the exact test command from the workflow file.',
            'If it is a service dependency (Redis, Postgres, Docker), set SKIP_*_INTEGRATION=1 to isolate.',
            'Fix one test at a time — commit each fix so CI reruns incrementally.',
            'If tests are flaky (pass locally, fail CI), quarantine with .skip + TODO, not deletion.',
            'Use merge queues to batch fixes and keep main green while you work.'
        ],
        tools: ['scan_project', 'gate_status', 'handoff_check'],
        resources: ['githubActionsDebug', 'ciFlakyTests', 'jestDebug', 'mergeQueues']
    },
    {
        id: 'dependency-vulnerabilities',
        domain: 'deps',
        triggers: ['npm audit', 'vulnerability', 'vulnerable', 'cve', 'security advisory', 'supply chain', 'dependency fix'],
        othersSay: 'There are hundreds of vulnerabilities and fixing them will break everything.',
        youCan: 'Most CVEs are in transitive dev dependencies. Triage by severity, use overrides for transitives, and pin major versions.',
        steps: [
            'Run `npm audit --json` and filter for critical/high severity only.',
            'Try `npm audit fix` first — it resolves most transitive issues safely.',
            'For unfixable transitives, add to package.json "overrides" field (npm 8.3+).',
            'If a fix breaks your code, read the breaking change log and update call sites.',
            'Never use `npm audit fix --force` on a production branch — it upgrades majors.',
            'Run `npm ls <vulnerable-package>` to trace the dependency chain.'
        ],
        tools: ['scan_project', 'suggest_fixes'],
        resources: ['npmAuditFix', 'depMajors']
    },
    {
        id: 'secrets-exposed',
        domain: 'security',
        triggers: ['secret', 'credential', 'api key', 'token', 'password', 'stripe key', 'aws key', 'leaked', 'committed secret'],
        othersSay: 'A secret was committed to git — we need to rewrite all history.',
        youCan: 'Rotate the key immediately. History rewrite is optional if the key is dead. Most "secrets" in repos are test fixtures.',
        steps: [
            'Determine if the key is LIVE: check if it starts with sk_live_, AKIA*, re_*, etc.',
            'If live: rotate in the provider dashboard (Stripe/AWS/Resend) BEFORE doing anything else.',
            'Replace the literal with process.env.VAR_NAME and add to .env.example.',
            'Add the file pattern to .gitignore if it is a generated secret file.',
            'Run gitleaks on staged files to catch future leaks pre-commit.',
            'Only rewrite git history if the key was pushed to a PUBLIC repo and is still live.'
        ],
        tools: ['scan_snippet', 'scan_file', 'scan_staged', 'explain_finding'],
        resources: ['secretsRotation', 'owaspTop10']
    },
    {
        id: 'lighthouse-a11y-fail',
        domain: 'performance',
        triggers: ['lighthouse', 'a11y', 'accessibility', 'contrast', 'button-name', 'aria-label', 'wcag', 'audit fail', 'lighthouse score'],
        othersSay: 'Lighthouse accessibility score is stuck at 0.87 and we cannot get it higher.',
        youCan: 'Every Lighthouse a11y failure is a specific, fixable audit. Read the LHR JSON, fix each audit by name, and the score goes to 1.0.',
        steps: [
            'Download the LHR JSON from CI artifacts or the temporary-public-storage URL.',
            'Parse categories.accessibility.auditRefs — find audits with score < 1.',
            'For button-name: add aria-label to every icon-only button (no text content).',
            'For color-contrast: calculate contrast ratio of foreground/background; aim for 4.5:1+ (WCAG AA).',
            'For SPA: ensure CSS is loaded via static <link>, not dynamic createElement — Lighthouse may audit before CSS loads.',
            'Verify locally: `npx lighthouse http://localhost:PORT --only-categories=accessibility --output=json`.',
            'Upload .lighthouseci/ as a CI artifact for future debugging.'
        ],
        tools: ['scan_snippet', 'scan_file'],
        resources: ['lighthouseAudit', 'reactA11y', 'tailwindCss', 'webVitals']
    },
    {
        id: 'typescript-errors',
        domain: 'code',
        triggers: ['typescript error', 'ts error', 'ts23', 'type error', 'tsc fail', 'type check fail', 'strict mode'],
        othersSay: 'There are hundreds of TypeScript errors and enabling strict mode is impossible.',
        youCan: 'TypeScript errors are incremental. Fix by error code, not by file. Use tsconfig overrides per workspace.',
        steps: [
            'Run `tsc --noEmit` and group errors by code (TS2304, TS2339, TS2322, etc.).',
            'Fix the most common error code first — often a single type fix resolves hundreds of errors.',
            'For strict mode migration: enable one flag at a time (strictNullChecks first, then noImplicitAny).',
            'Use `// @ts-expect-error` sparingly — only for third-party type gaps with a TODO.',
            'For declaration files: create .d.ts shims for untyped packages in a types/ directory.',
            'Run `tsc --incremental` during development for faster feedback.'
        ],
        tools: ['scan_snippet', 'scan_file'],
        resources: ['tsStrict', 'tsErrors']
    },
    {
        id: 'circular-dependencies',
        domain: 'architecture',
        triggers: ['circular', 'import cycle', 'dependency cycle', 'circular dependency', 'import loop', 'module cycle'],
        othersSay: 'Circular dependencies are impossible to fix without rewriting everything.',
        youCan: 'Circular deps are usually a sign of a missing abstraction. Extract the shared logic into a third module.',
        steps: [
            'Run `npx depcruise --validate .dependency-cruiser.js src/` to identify cycles.',
            'For each cycle: identify the shared dependency (the thing both modules need).',
            'Extract the shared logic into a new module that both can import without a cycle.',
            'For type-only cycles: use `import type` to erase at compile time.',
            'For barrel file cycles (index.ts re-exports): import from the source file directly.',
            'Re-run dependency-cruiser after each fix to verify the cycle is broken.'
        ],
        tools: ['scan_project', 'code_suggestions'],
        resources: ['circularDeps', 'monorepoTools']
    },
    {
        id: 'docker-build-fail',
        domain: 'deployment',
        triggers: ['docker', 'dockerfile', 'container build', 'docker fail', 'image build', 'docker build'],
        othersSay: 'Docker builds are failing and the error messages are incomprehensible.',
        youCan: 'Docker failures are usually path mismatches, missing files, or wrong base images. Build stage by stage.',
        steps: [
            'Build with `--progress=plain` to see full output, not just the spinner.',
            'Add `--target <stage>` to build only up to a specific multi-stage step.',
            'Check COPY paths — they are relative to the build context, not the Dockerfile location.',
            'If a file is missing: verify .dockerignore is not excluding it.',
            'For layer cache issues: `docker build --no-cache` to force a clean build.',
            'For permission errors: run as non-root user, check file ownership in COPY.'
        ],
        tools: ['scan_file'],
        resources: ['dockerDebug']
    },
    {
        id: 'database-migration-stuck',
        domain: 'database',
        triggers: ['migration', 'sqlite', 'postgres', 'database schema', 'alter table', 'migration fail', 'schema change'],
        othersSay: 'Database migrations are stuck and we cannot change the schema without downtime.',
        youCan: 'Most schema changes are additive. ADD COLUMN is safe. For destructive changes, use a multi-step expand-contract pattern.',
        steps: [
            'For ADD COLUMN: use a default value or NULL — no downtime needed.',
            'For renaming: add the new column, dual-write, backfill, then drop the old column in a later deploy.',
            'For SQLite: remember it has limited ALTER TABLE — table rebuild pattern for complex changes.',
            'Always backup before migrating: `sqlite3 db.sqlite .dump > backup.sql`.',
            'Test migrations on a copy of production data first.',
            'Use a migration journal (numbered files) so migrations are ordered and idempotent.'
        ],
        tools: ['scan_snippet'],
        resources: ['sqliteMigration']
    },
    {
        id: 'git-disaster-recovery',
        domain: 'git',
        triggers: ['git recovery', 'lost commit', 'detached head', 'wrong branch', 'accidental commit', 'reset wrong', 'accidentally reset', 'lost work', 'reflog', 'cherry-pick', 'bad merge', 'wrong commit'],
        othersSay: 'I lost my work in git and it is gone forever.',
        youCan: 'Git almost never loses data. The reflog keeps every commit for 90 days. You can recover anything.',
        steps: [
            'Run `git reflog` to see every HEAD change — find the commit hash you lost.',
            '`git checkout <hash>` to verify it is the right state.',
            '`git branch recovery-branch <hash>` to create a branch from the lost commit.',
            'For accidental resets: `git reset --hard ORIG_HEAD` undoes the last reset.',
            'For bad merges: `git revert -m 1 <merge-commit>` to undo the merge.',
            'For deleted branches: `git branch <name> <hash-from-reflog>` to recreate them.'
        ],
        tools: [],
        resources: ['gitRecovery', 'gitBranching']
    },
    {
        id: 'node-esm-cjs-interop',
        domain: 'code',
        triggers: ['esm', 'cjs', 'require is not defined', 'import is not defined', 'module type', 'cannot use import', 'err_require_esm'],
        othersSay: 'ESM/CJS interop is a nightmare and nothing works.',
        youCan: 'ESM/CJS is solvable. Use .cjs/.mjs extensions, dynamic import() for CJS from ESM, and require() for ESM from CJS with createRequire.',
        steps: [
            'For "require is not defined in ESM": use `import { createRequire } from "module"; const require = createRequire(import.meta.url);`.',
            'For "Cannot use import outside a module": add `"type": "module"` to package.json or use .mjs extension.',
            'For CJS packages that need require: rename to .cjs or use dynamic `await import()`.',
            'For __dirname in ESM: `import { dirname } from "path"; import { fileURLToPath } from "url"; const __dirname = dirname(fileURLToPath(import.meta.url));`.',
            'Use .mjs/.cjs extensions for explicit module type — more reliable than package.json type field.'
        ],
        tools: ['scan_snippet', 'scan_file'],
        resources: ['nodeEsmCjs']
    },
    {
        id: 'performance-bundle-size',
        domain: 'performance',
        triggers: ['bundle size', 'chunk too large', 'lazy load', 'code splitting', 'tree shaking', 'performance score', 'lcp', 'inp', 'cls'],
        othersSay: 'The bundle is too big and we cannot make it smaller without removing features.',
        youCan: 'Bundle size is about loading strategy, not feature removal. Code-split, lazy-load, and tree-shake.',
        steps: [
            'Run `npx vite build --report` or `rollup-plugin-visualizer` to see what is in the bundle.',
            'Lazy-load routes: `const Page = lazy(() => import("./Page"))` with <Suspense>.',
            'Split vendor chunks: configure manualChunks in vite.config for react, lodash, etc.',
            'Tree-shake: use ES module imports (not require), avoid barrel files, use `import { x }` not `import * as`.',
            'For LCP: preload critical fonts/images, inline critical CSS.',
            'For CLS: set width/height on images, reserve space for ads/embeds.'
        ],
        tools: ['scan_project'],
        resources: ['bundleAnalysis', 'webVitals', 'viteConfig']
    },
    {
        id: 'monorepo-ci-overwhelm',
        domain: 'ci',
        triggers: ['monorepo', 'too many packages', 'ci slow', 'build all packages', 'workspace', 'npm workspaces', 'turbo', 'nx'],
        othersSay: 'The monorepo is too big — CI takes 40 minutes and scans 600k files.',
        youCan: 'Scope CI to changed workspaces only. Path filters + workspace-aware caching cuts CI from 40min to 5min.',
        steps: [
            'Add `paths:` filters to workflow triggers — only run when relevant files change.',
            'Use `npm run build --workspace=<changed-package>` instead of building everything.',
            'Cache node_modules per workspace: `actions/setup-node` with cache-dependency-path.',
            'Add a changeset or turbo cache to skip unchanged workspace builds entirely.',
            'Put github-cache/, node_modules/, coverage/ in .simplebeaconignore.',
            'Run gate scan on product code only (ai-platform/), not the repo root.'
        ],
        tools: ['scan_project', 'master_engineering_brief'],
        resources: ['monorepoTools', 'githubActionsDebug']
    },
    {
        id: 'redis-rate-limit-setup',
        domain: 'backend',
        triggers: ['rate limit', 'redis', 'rate limiter', 'throttle', '429', 'too many requests', 'ddos protection'],
        othersSay: 'Rate limiting with Redis is too complex for our setup.',
        youCan: 'Redis rate limiting is a distributed counter. Use express-rate-limit with a Redis store, fail-open on Redis outage.',
        steps: [
            'Install express-rate-limit and rate-limit-redis.',
            'Create a RedisStore adapter implementing increment() and resetKey().',
            'On Redis connection failure: fail OPEN (return counter=0) — never block all traffic.',
            'Set REDIS_URL env var to enable; fall back to in-memory when unset.',
            'Use sliding window for accuracy or fixed window for simplicity.',
            'Test with and without Redis: set ENABLE_REDIS_RATE_LIMIT=false to verify fallback.'
        ],
        tools: ['scan_snippet', 'scan_file'],
        resources: ['redisRateLimit']
    },
    {
        id: 'cloudflare-workers-deploy',
        domain: 'deployment',
        triggers: ['cloudflare', 'workers', 'wrangler', 'pages deploy', 'worker deploy', 'edge function'],
        othersSay: 'Cloudflare Workers deployment is confusing with all the bindings and secrets.',
        youCan: 'Wrangler deploy is one command. Secrets, bindings, and env vars each have a clear place.',
        steps: [
            'Run `npx wrangler deploy` — it reads wrangler.jsonc/wrangler.toml for config.',
            'Set secrets with `npx wrangler secret put SECRET_NAME` — never in the config file.',
            'Bindings (KV, R2, D1, Durable Objects) go in wrangler.jsonc under the binding key.',
            'For local dev: `npx wrangler dev` starts a local runtime with bindings simulated.',
            'Check logs: `npx wrangler tail` streams real-time logs from your deployed worker.',
            'For Pages: `npx wrangler pages deploy ./dist` — static assets + functions directory.'
        ],
        tools: ['scan_file'],
        resources: ['cloudflareWorkers']
    },
    {
        id: 'memory-leak-node',
        domain: 'backend',
        triggers: ['memory leak', 'heap out of memory', 'oom', 'javascript heap', 'node memory', 'rss growing', 'gc pause'],
        othersSay: 'There is a memory leak in production and we cannot find it.',
        youCan: 'Node memory leaks are traceable with heap snapshots. Compare two snapshots to find what is growing.',
        steps: [
            'Run with `node --inspect` and open chrome://inspect to take heap snapshots.',
            'Take snapshot A, run the leaking operation 100 times, take snapshot B.',
            'Compare A→B: filter by "Objects allocated between snapshots" — find what grows.',
            'Common culprits: event listeners not removed, closures capturing large objects, global caches without eviction.',
            'For production: use `--max-old-space-size=4096` as a temporary bandage while you fix the leak.',
            'Profile with `node --prof` and analyze with `node --prof-process`.'
        ],
        tools: ['scan_snippet'],
        resources: ['nodeMemory']
    },
    {
        id: 'react-spa-not-rendering',
        domain: 'frontend',
        triggers: ['spa not rendering', 'react not mounting', 'blank page', 'white screen', 'root empty', 'react not loading', 'vite not loading'],
        othersSay: 'The SPA shows a blank page and we cannot figure out why.',
        youCan: 'SPAs fail to render for 5 reasons: script path, module type, CORS, base path, or runtime error. Check each.',
        steps: [
            'Open DevTools Console — read the first error (not the cascade).',
            'Check the <script> tag: must be `type="module"` for ES modules, with the correct src path.',
            'For Vite: ensure `base` in vite.config matches your deployment path (e.g. "/dashboard/").',
            'For static serving: the script path must be absolute from the server root, not relative.',
            'Check Network tab — is the JS file loading with 200 status? If 404, the path is wrong.',
            'For SSR/hydration mismatches: check that server and client render the same initial HTML.'
        ],
        tools: ['scan_file'],
        resources: ['viteConfig', 'reactA11y']
    },
    {
        id: 'test-coverage-gap',
        domain: 'tests',
        triggers: ['test coverage', 'coverage gap', 'untested code', 'low coverage', 'coverage report', 'jest coverage'],
        othersSay: 'Test coverage is too low and we cannot write tests for everything.',
        youCan: 'Coverage is not about hitting every line — it is about testing every critical path. Prioritize by risk.',
        steps: [
            'Run `npm test -- --coverage` to get a coverage report.',
            'Focus on critical paths first: auth, payment, data mutation, API endpoints.',
            'For each untested function: write ONE happy-path test and ONE edge-case test.',
            'Use integration tests for API endpoints — they test the full stack.',
            'For legacy code: characterize tests (test current behavior) before refactoring.',
            'Aim for 80% on critical modules, 50% on utilities, 0% on generated code.'
        ],
        tools: ['scan_project', 'code_suggestions'],
        resources: ['testPyramid', 'jestDebug']
    },
    {
        id: 'env-config-chaos',
        domain: 'env',
        triggers: ['env', 'environment variable', 'dotenv', '.env', 'config missing', 'undefined env', 'process.env', 'secret not set'],
        othersSay: 'Environment variables are a mess — every developer has different settings.',
        youCan: 'Env chaos is solved by a single source of truth: .env.example + validation on startup.',
        steps: [
            'Create .env.example with every required var, a comment, and a fake value.',
            'Add a startup validation function that checks required vars and fails fast with a clear message.',
            'Never commit .env — add to .gitignore and use .env.example as the template.',
            'For production: set env vars in the hosting dashboard (Render, Vercel, Cloudflare), not in files.',
            'For local dev: use dotenv-flow or direnv to load different .env files per environment.',
            'Document each var in .env.example: what it does, where to get it, and if it is required.'
        ],
        tools: ['scan_snippet', 'scan_file', 'scan_project'],
        resources: ['nodeEsmCjs']
    },
    {
        id: 'api-design-struggle',
        domain: 'architecture',
        triggers: ['api design', 'rest api', 'endpoint design', 'api route', 'api schema', 'openapi', 'swagger'],
        othersSay: 'The API is inconsistent and nobody knows what the endpoints do.',
        youCan: 'Good APIs are consistent, documented, and versioned. Start with a schema, not with code.',
        steps: [
            'Define every endpoint in an OpenAPI/Swagger spec BEFORE writing handlers.',
            'Use consistent naming: /api/v1/resources, plural nouns, HTTP methods for actions.',
            'Every response: { data: ..., error: null, meta: { page, total } } — consistent envelope.',
            'Validate input with a schema library (zod, joi, express-validator) — never trust client data.',
            'Version from day one: /api/v1/ — so you can break v1 without killing existing clients.',
            'Document with examples: every endpoint has a curl example in the spec.'
        ],
        tools: ['scan_snippet'],
        resources: ['owaspTop10']
    },
    {
        id: 'auth-implementation',
        domain: 'security',
        triggers: ['auth', 'authentication', 'login', 'jwt', 'session', 'oauth', 'sso', 'saml', 'password', 'token'],
        othersSay: 'Auth is too complex and we keep getting it wrong.',
        youCan: 'Auth is a solved problem. Use established libraries, never roll your own. JWT for stateless, sessions for stateful.',
        steps: [
            'For stateless APIs: use JWT with short expiry (15min) + refresh token (7d).',
            'For server-rendered apps: use server sessions with httpOnly, secure, sameSite cookies.',
            'For SSO: use a library like passport.js or a provider like Auth0/Clerk — never implement SAML manually.',
            'Store passwords with bcrypt (cost factor 12+) or argon2 — never MD5/SHA.',
            'For OAuth: use the authorization code flow with PKCE — never implicit flow.',
            'Always verify JWT signatures server-side — never trust client claims without verification.'
        ],
        tools: ['scan_snippet', 'scan_file'],
        resources: ['owaspTop10', 'secretsRotation']
    }
];

/**
 * Match a problem statement against playbooks.
 * @param {string} problem - Natural language problem statement
 * @returns {Array} Matching playbooks sorted by relevance
 */
function matchPlaybooks(problem) {
    const lower = String(problem || '').toLowerCase();
    const matches = [];

    for (const pb of SOLVE_PLAYBOOKS) {
        let score = 0;
        for (const trigger of pb.triggers) {
            if (lower.includes(trigger)) {
                score += trigger.length; // longer matches = more specific
            }
        }
        if (score > 0) {
            matches.push({ playbook: pb, score });
        }
    }

    matches.sort((a, b) => b.score - a.score);
    return matches.map((m) => m.playbook);
}

/**
 * Extract keywords from a problem statement for resource matching.
 * @param {string} problem
 * @returns {string[]}
 */
function extractKeywords(problem) {
    const lower = String(problem || '').toLowerCase();
    const keywords = [];

    // Technology keywords
    const techMap = {
        'react': ['react', 'jsx', 'tsx', 'component'],
        'vite': ['vite', 'rollup', 'esbuild'],
        'typescript': ['typescript', 'tsc', '.ts', 'ts error'],
        'docker': ['docker', 'dockerfile', 'container'],
        'redis': ['redis', 'ioredis', 'rate limit'],
        'sqlite': ['sqlite', 'better-sqlite3'],
        'cloudflare': ['cloudflare', 'wrangler', 'workers', 'pages'],
        'github actions': ['github actions', 'workflow', 'ci'],
        'jest': ['jest', 'test', 'spec'],
        'lighthouse': ['lighthouse', 'lhci', 'audit'],
        'tailwind': ['tailwind', 'css', 'theme'],
        'git': ['git', 'branch', 'merge', 'rebase', 'commit'],
        'node': ['node', 'npm', 'require', 'import'],
        'stripe': ['stripe', 'payment', 'checkout', 'webhook'],
        'express': ['express', 'middleware', 'route']
    };

    for (const [tech, triggers] of Object.entries(techMap)) {
        if (triggers.some((t) => lower.includes(t))) {
            keywords.push(tech);
        }
    }

    return keywords;
}

/**
 * Build a "yes you can" master engineer response for a problem.
 * @param {string} problem - Natural language problem statement
 * @param {object} [options] - Optional context
 * @param {string} [options.projectRoot] - Project root for gate context
 * @returns {object}
 */
function solveProblem(problem, options = {}) {
    const playbooks = matchPlaybooks(problem);
    const keywords = extractKeywords(problem);
    const primary = playbooks[0] || null;
    const secondary = playbooks.slice(1, 3);

    // Try to get gate context if projectRoot is provided
    let gateContext = null;
    if (options.projectRoot) {
        try {
            const brief = buildMasterEngineeringBrief(options.projectRoot);
            gateContext = {
                gatePass: brief.context?.gatePass,
                blockingCount: brief.context?.blockingCount,
                overallScore: brief.overallScore,
                shipReady: brief.shipReady
            };
        } catch {
            // non-fatal — problem solver works without a scan
        }
    }

    // Build the master engineer response
    const response = {
        schemaVersion: '1.0',
        generatedAt: new Date().toISOString(),
        motto: 'Yes you can — one verified fix at a time.',
        problem: String(problem).slice(0, 500),
        detectedKeywords: keywords,
        gateContext,
        primaryPlaybook: primary ? {
            id: primary.id,
            domain: primary.domain,
            othersSay: primary.othersSay,
            youCan: primary.youCan,
            steps: primary.steps,
            tools: primary.tools || [],
            resources: (primary.resources || []).map((key) => PROBLEM_RESOURCES[key]).filter(Boolean)
        } : null,
        secondaryPlaybooks: secondary.map((pb) => ({
            id: pb.id,
            domain: pb.domain,
            youCan: pb.youCan,
            steps: pb.steps.slice(0, 3),
            resources: (pb.resources || []).slice(0, 2).map((key) => PROBLEM_RESOURCES[key]).filter(Boolean)
        })),
        allRelevantResources: playbooks
            .flatMap((pb) => pb.resources || [])
            .map((key) => PROBLEM_RESOURCES[key])
            .filter(Boolean)
            .filter((r, i, arr) => arr.findIndex((x) => x.url === r.url) === i), // dedupe by URL
        recommendedTools: playbooks
            .flatMap((pb) => pb.tools || [])
            .filter((t, i, arr) => arr.indexOf(t) === i), // dedupe
        agentPrompt: buildAgentPrompt(problem, primary, keywords, gateContext),
        fallback: !primary ? {
            message: 'No specific playbook matched. Use the master engineering brief for a full diagnostic.',
            suggestedAction: 'Call master_engineering_brief or scan_project to get a full codebase analysis.',
            generalResources: [
                PROBLEM_RESOURCES.githubActionsDebug,
                PROBLEM_RESOURCES.jestDebug,
                PROBLEM_RESOURCES.npmAuditFix
            ].filter(Boolean)
        } : null
    };

    return response;
}

/**
 * Build a master agent prompt for the problem.
 */
function buildAgentPrompt(problem, primary, keywords, gateContext) {
    const lines = [
        'You are the master engineer. Others say it cannot be done — your job is to ship one verified fix at a time.',
        '',
        `Problem: ${String(problem).slice(0, 200)}`,
        ''
    ];

    if (keywords.length) {
        lines.push(`Detected technologies: ${keywords.join(', ')}`);
        lines.push('');
    }

    if (gateContext) {
        lines.push(`Gate: ${gateContext.gatePass ? 'PASS' : 'FAIL'} · Blocking: ${gateContext.blockingCount ?? '?'} · Score: ${gateContext.overallScore ?? '?'}/100`);
        lines.push('');
    }

    if (primary) {
        lines.push('## Primary playbook: yes you can');
        lines.push('');
        lines.push(`**They say:** ${primary.othersSay}`);
        lines.push('');
        lines.push(`**You can:** ${primary.youCan}`);
        lines.push('');
        lines.push('Steps:');
        for (const step of primary.steps) {
            lines.push(`1. ${step}`);
        }
        lines.push('');
        lines.push('## Rules');
        lines.push('- scan_snippet before every edit · scan_file after save · gate before merge');
        lines.push('- Use online docs for API correctness — do not invent SDK methods');
        lines.push('- Fix one thing at a time — commit each fix so you can bisect if something breaks');
        lines.push('- When stuck: read the error message literally, not what you think it means');
    } else {
        lines.push('## No specific playbook matched');
        lines.push('');
        lines.push('General approach:');
        lines.push('1. Reproduce the problem locally — never fix what you cannot reproduce');
        lines.push('2. Read the first error message, not the last — cascading errors hide the root cause');
        lines.push('3. Isolate: comment out code until the problem disappears, then re-add to find the trigger');
        lines.push('4. Search for the exact error message online — someone has seen it before');
        lines.push('5. Write a failing test that reproduces the bug, then fix until it passes');
    }

    return lines.join('\n');
}

/**
 * Diagnose an error message or stack trace.
 * @param {string} errorText - Error message or stack trace
 * @param {object} [options]
 * @returns {object}
 */
function diagnoseError(errorText, options = {}) {
    const text = String(errorText || '');
    const lower = text.toLowerCase();

    const diagnoses = [];

    // Node.js errors
    if (lower.includes('err_require_esm') || lower.includes('cannot use require')) {
        diagnoses.push({
            rootCause: 'ESM/CJS module type mismatch',
            confidence: 'high',
            fix: 'Use dynamic import() or createRequire. Check package.json "type" field.',
            resources: [PROBLEM_RESOURCES.nodeEsmCjs]
        });
    }
    if (lower.includes('econnrefused') || lower.includes('econnreset')) {
        diagnoses.push({
            rootCause: 'Service not running or wrong port',
            confidence: 'high',
            fix: 'Check that the service (Redis, Postgres, etc.) is running and the port matches.',
            resources: []
        });
    }
    if (lower.includes('eacces') || lower.includes('permission denied')) {
        diagnoses.push({
            rootCause: 'File permission error',
            confidence: 'high',
            fix: 'Check file ownership and permissions. On Windows, check if the file is locked.',
            resources: []
        });
    }
    if (lower.includes('enoent') || lower.includes('no such file or directory')) {
        diagnoses.push({
            rootCause: 'File or directory not found',
            confidence: 'high',
            fix: 'Check the path — is it relative to the right directory? Use absolute paths in config.',
            resources: []
        });
    }
    if (lower.includes('heap out of memory') || lower.includes('javascript heap')) {
        diagnoses.push({
            rootCause: 'Node.js memory limit exceeded',
            confidence: 'high',
            fix: 'Increase with --max-old-space-size=4096, then investigate the memory leak.',
            resources: [PROBLEM_RESOURCES.nodeMemory]
        });
    }

    // TypeScript errors
    const tsMatch = text.match(/ts(\d{4})/i);
    if (tsMatch) {
        const code = `TS${tsMatch[1]}`;
        const tsFixes = {
            '2304': 'Cannot find name — add an import or install @types package.',
            '2339': 'Property does not exist — check the type definition or use a type guard.',
            '2322': 'Type not assignable — narrow the type or fix the source type.',
            '2345': 'Argument type mismatch — check the function signature and your call site.',
            '2307': 'Cannot find module — check the import path or install the package.',
            '2688': 'Cannot find type definition file — install @types/package or add to tsconfig types.'
        };
        diagnoses.push({
            rootCause: `TypeScript error ${code}`,
            confidence: 'high',
            fix: tsFixes[tsMatch[1]] || `Look up ${code} in the TypeScript error reference.`,
            resources: [PROBLEM_RESOURCES.tsErrors]
        });
    }

    // Test errors
    if (lower.includes('test timeout') || lower.includes('exceeded timeout')) {
        diagnoses.push({
            rootCause: 'Test timeout — async operation did not complete',
            confidence: 'high',
            fix: 'Increase jest.setTimeout, check for unresolving promises, or mock slow operations.',
            resources: [PROBLEM_RESOURCES.jestDebug]
        });
    }
    if (lower.includes('snapshot') && lower.includes('obsolete')) {
        diagnoses.push({
            rootCause: 'Jest snapshot is stale — the component output changed',
            confidence: 'high',
            fix: 'Run jest --updateSnapshot to update. Review the diff before committing.',
            resources: [PROBLEM_RESOURCES.jestDebug]
        });
    }
    if (lower.includes('opentelethandled') || lower.includes('open handles')) {
        diagnoses.push({
            rootCause: 'Jest detected open handles — async resource not cleaned up',
            confidence: 'high',
            fix: 'Run with --detectOpenHandles. Add afterEach cleanup. Close connections in afterAll.',
            resources: [PROBLEM_RESOURCES.jestDebug]
        });
    }

    // Docker errors
    if (lower.includes('docker') && lower.includes('no such file')) {
        diagnoses.push({
            rootCause: 'Docker COPY path mismatch',
            confidence: 'high',
            fix: 'COPY paths are relative to build context, not Dockerfile. Check .dockerignore.',
            resources: [PROBLEM_RESOURCES.dockerDebug]
        });
    }

    // Lighthouse errors
    if (lower.includes('lighthouse') && (lower.includes('timeout') || lower.includes('chrome'))) {
        diagnoses.push({
            rootCause: 'Lighthouse could not launch Chrome or page did not load',
            confidence: 'high',
            fix: 'Ensure Chrome is installed. For CI: use the LHCI Chrome launcher. Check if the page requires JS to render.',
            resources: [PROBLEM_RESOURCES.lighthouseAudit]
        });
    }
    if (lower.includes('button-name') || lower.includes('buttons do not have an accessible name')) {
        diagnoses.push({
            rootCause: 'Lighthouse button-name audit — icon-only buttons missing aria-label',
            confidence: 'high',
            fix: 'Add aria-label="Action description" to every <button> that has no text content.',
            resources: [PROBLEM_RESOURCES.reactA11y]
        });
    }
    if (lower.includes('color-contrast') || lower.includes('contrast ratio')) {
        diagnoses.push({
            rootCause: 'Lighthouse color-contrast audit — text contrast below WCAG AA (4.5:1)',
            confidence: 'high',
            fix: 'Darken (light theme) or lighten (dark theme) the text color until contrast ratio >= 4.5:1.',
            resources: [PROBLEM_RESOURCES.reactA11y, PROBLEM_RESOURCES.tailwindCss]
        });
    }

    // Git errors
    if (lower.includes('fatal: not a git repository')) {
        diagnoses.push({
            rootCause: 'Not in a git repository',
            confidence: 'high',
            fix: 'Run git init, or cd to the correct directory containing .git/',
            resources: []
        });
    }
    if (lower.includes('merge conflict') || lower.includes('conflict in')) {
        diagnoses.push({
            rootCause: 'Git merge conflict — both branches modified the same lines',
            confidence: 'high',
            fix: 'Open conflicted files, choose HEAD or branch version, remove conflict markers, then git add + commit.',
            resources: [PROBLEM_RESOURCES.gitRecovery]
        });
    }

    // npm errors
    if (lower.includes('eresolve') || lower.includes('peer dep')) {
        diagnoses.push({
            rootCause: 'npm peer dependency conflict',
            confidence: 'high',
            fix: 'Use --legacy-peer-deps temporarily, or update the conflicting package to a compatible version.',
            resources: [PROBLEM_RESOURCES.npmAuditFix]
        });
    }
    if (lower.includes('eacces') && lower.includes('npm')) {
        diagnoses.push({
            rootCause: 'npm permission error — global install without permissions',
            confidence: 'high',
            fix: 'Use npx instead of global install, or configure npm prefix to a user-writable directory.',
            resources: []
        });
    }

    // Fallback
    if (diagnoses.length === 0) {
        // Try to match playbooks
        const playbooks = matchPlaybooks(text);
        if (playbooks.length > 0) {
            diagnoses.push({
                rootCause: `Matched playbook: ${playbooks[0].id}`,
                confidence: 'medium',
                fix: playbooks[0].youCan,
                steps: playbooks[0].steps,
                resources: (playbooks[0].resources || []).map((k) => PROBLEM_RESOURCES[k]).filter(Boolean)
            });
        } else {
            diagnoses.push({
                rootCause: 'Unknown error — no pattern matched',
                confidence: 'low',
                fix: 'Search for the exact error message online. Check the first error in the log, not the last.',
                resources: [PROBLEM_RESOURCES.githubActionsDebug, PROBLEM_RESOURCES.jestDebug]
            });
        }
    }

    return {
        schemaVersion: '1.0',
        generatedAt: new Date().toISOString(),
        errorText: text.slice(0, 1000),
        diagnoses,
        topDiagnosis: diagnoses[0],
        motto: 'Yes you can — every error has a root cause and a fix.',
        agentPrompt: [
            'You are the master engineer diagnosing an error.',
            '',
            `Error: ${text.slice(0, 200)}`,
            '',
            `Root cause: ${diagnoses[0].rootCause}`,
            `Fix: ${diagnoses[0].fix}`,
            '',
            'Steps:',
            '1. Reproduce the error locally',
            '2. Apply the fix',
            '3. Verify with a test or manual check',
            '4. Run scan_snippet on the changed code before committing'
        ].join('\n')
    };
}

module.exports = {
    PROBLEM_RESOURCES,
    SOLVE_PLAYBOOKS,
    solveProblem,
    diagnoseError,
    matchPlaybooks,
    extractKeywords
};
