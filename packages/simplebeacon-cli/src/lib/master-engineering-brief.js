/**
 * Master engineering brief — synthesizes gate, cleanup, code suggestions, and recovery playbooks.
 * Deterministic orchestration layer for agents: "yes you can" when scans look impossible.
 */

const fs = require('fs');
const path = require('path');
const { GUIDE_PLAYBOOKS, collectActiveGuideIds, issueKind } = require('../reporters/remediation-guides');
const { buildCodeSuggestions } = require('./code-suggestions');
const { readGateStatus } = require('./snippet-scanner');
const { buildCleanupAssistantBrief } = require('./cleanup-assistant-brief');

const BRIEF_JSON = 'master-engineering-brief.json';
const BRIEF_MD = 'master-engineering-brief.md';

/** Curated external references — verified URLs only. */
const ENGINEERING_RESOURCES = Object.freeze({
    gateHygiene: {
        title: 'SimpleBeacon gate workflow',
        url: 'https://github.com/simplebeacon/simplebeacon/blob/main/AGENTS.md',
        note: 'Pre-commit chain, staged scan, CI backstop'
    },
    owaspSecrets: {
        title: 'OWASP Secrets Management',
        url: 'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
        note: 'Rotate exposed keys; never commit live secrets'
    },
    nodeEnv: {
        title: 'Node.js environment variables',
        url: 'https://nodejs.org/api/process.html#processenv',
        note: 'Load secrets from env, not source'
    },
    npmAudit: {
        title: 'npm audit documentation',
        url: 'https://docs.npmjs.com/cli/v10/commands/npm-audit',
        note: 'Fix supply-chain CVEs before ship'
    },
    githubActionsCache: {
        title: 'GitHub Actions dependency caching',
        url: 'https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows',
        note: 'Speed up monorepo CI recovery loops'
    },
    monorepoCi: {
        title: 'Monorepo CI with path filters (2026 patterns)',
        url: 'https://www.devopsness.com/blog/github-actions-monorepo-fast-ci-2026-02-24',
        note: 'Run only affected workspaces — do not scan the universe every PR'
    },
    mergeQueues: {
        title: 'Keeping monorepo builds green',
        url: 'https://thenewstack.io/merge-strategies-to-keep-builds-green-in-large-monorepos/',
        note: 'Batch, bisect, fail-fast when main breaks'
    },
    esmCjs: {
        title: 'Node.js ESM/CJS interop',
        url: 'https://nodejs.org/api/esm.html',
        note: 'Fix import/require mismatches blocking tests'
    },
    lighthouseCi: {
        title: 'Lighthouse CI configuration and assertions',
        url: 'https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md',
        note: 'LHCI config, static serving, SPA rendering, artifact upload'
    },
    reactA11y: {
        title: 'React accessibility — WCAG, aria-label, contrast',
        url: 'https://web.dev/articles/learn/accessibility',
        note: 'button-name, color-contrast, landmark, focus management'
    },
    webVitals: {
        title: 'Core Web Vitals — LCP, INP, CLS thresholds',
        url: 'https://web.dev/articles/vitals',
        note: 'LCP < 2.5s, INP < 200ms, CLS < 0.1'
    },
    dockerBestPractices: {
        title: 'Docker build best practices',
        url: 'https://docs.docker.com/build/building/best-practices/',
        note: 'Layer caching, multi-stage, BuildKit, .dockerignore'
    },
    cloudflareWorkers: {
        title: 'Cloudflare Workers deployment guide',
        url: 'https://developers.cloudflare.com/workers/get-started/guide/',
        note: 'wrangler deploy, secrets, bindings, tail logs'
    },
    gitReflog: {
        title: 'Git reflog — recover lost commits',
        url: 'https://git-scm.com/docs/git-reflog',
        note: '90-day history of every HEAD change — nothing is truly lost'
    },
    tsStrict: {
        title: 'TypeScript strict mode migration',
        url: 'https://www.typescriptlang.org/tsconfig#strict',
        note: 'Enable one flag at a time, fix by error code not by file'
    },
    testPyramid: {
        title: 'Test pyramid — practical strategy',
        url: 'https://martinfowler.com/articles/practical-test-pyramid.html',
        note: 'Unit > integration > e2e — fast feedback over coverage vanity'
    },
    nodeMemory: {
        title: 'Node.js memory leak diagnosis',
        url: 'https://nodejs.org/en/docs/guides/diagnostics/memory-leak',
        note: 'Heap snapshots, --inspect, V8 profiler, --max-old-space-size'
    },
    circularDeps: {
        title: 'dependency-cruiser — detect circular dependencies',
        url: 'https://github.com/sverweij/dependency-cruiser',
        note: 'Rules, .dep.yml, reachability, cycle breaking patterns'
    }
});

const YES_YOU_CAN_PLAYBOOKS = [
    {
        id: 'gate-wont-pass',
        trigger: (ctx) => ctx.gatePass === false && ctx.blockingCount > 0,
        othersSay: 'The gate will never pass — too many findings.',
        youCan: 'Gate failures are finite and ordered. Fix critical/high blockers first; use scoped scans and allowlists only for confirmed false positives.',
        steps: [
            'Run `code_suggestions` or read `.simplebeacon/code-suggestions.md` for the top 5 concrete edits.',
            'Fix one file at a time: `scan_snippet` → edit → `scan_file` → repeat.',
            'Use `propose_fix` when autoFixable is true (AST remediator patterns).',
            'Re-run `npx simplebeacon scan --gate` on the product path only (e.g. `ai-platform/`), not the whole monorepo root.',
            'Add allowlist entries in `.simplebeacon/config.json` only after proving a finding is a test fixture or doc example.'
        ],
        resources: ['gateHygiene', 'owaspSecrets']
    },
    {
        id: 'monorepo-overwhelm',
        trigger: (ctx) => ctx.staleFullTree || (ctx.inventoryFiles != null && ctx.inventoryFiles > 10000),
        othersSay: 'This repo is too big to scan or clean.',
        youCan: 'Scope the scan to the product subtree. Inventory drops from 69k to ~4k files when you exclude github-cache and scan `ai-platform/` only.',
        steps: [
            'Set dashboard path to the workspace package (e.g. `ai-platform/`), not repo root.',
            'Ensure `github-cache/` is in `.simplebeaconignore`.',
            'Run file reduction with profile `file-reduction` on the scoped path.',
            'Use pre-commit staged scan (`.simplebeacon/qa/pre-commit-gate.cjs`) — ~5s, not 600s.',
            'Split work: gate on product code, cleanup on artifacts, deps per workspace.'
        ],
        resources: ['monorepoCi', 'githubActionsCache']
    },
    {
        id: 'ci-passes-locally-fails',
        trigger: (ctx) => ctx.hasTestBaseline === false || ctx.envFindings > 0,
        othersSay: 'CI is broken and we cannot merge.',
        youCan: 'Most CI-only failures are missing services (Redis, Docker), env keys, or flaky integration suites — not your feature code.',
        steps: [
            'Read the raw CI log — identify the first failing suite, not the last cascading error.',
            'Set `SKIP_REDIS_INTEGRATION=1` locally to mirror advisory pre-push behavior.',
            'Align `.env.example` with missing env keys flagged by data-quality scan.',
            'Run workspace-scoped tests: `npm test --workspace=ai-platform`.',
            'Fix gate blockers separately from integration tests — CI enforces both but you can triage in parallel.'
        ],
        resources: ['nodeEnv', 'githubActionsCache']
    },
    {
        id: 'too-many-unused-files',
        trigger: (ctx) => ctx.unusedCandidates > 100,
        othersSay: 'Delete half the repo — everything is dead code.',
        youCan: 'Unused-file findings are investigation candidates, not a delete list. Static analysis misses dynamic imports, HTML script tags, and config loaders.',
        steps: [
            'Use trim suggestions phase 4 (investigate) — never bulk delete.',
            'Start with dead **exports** (symbol-level), not whole files.',
            'Grep for dynamic import(`...`) and require.resolve before deleting.',
            'Delete only build artifacts (node_modules, coverage) in phase 1 — highest confidence.',
            'Re-run unused-file scan after entry-point config updates.'
        ],
        resources: ['gateHygiene']
    },
    {
        id: 'secrets-found-panic',
        trigger: (ctx) => ctx.credentialFindings > 0,
        othersSay: 'We have to rewrite the entire codebase — secrets everywhere.',
        youCan: 'Most credential hits are test fixtures, example strings, or redacted docs. Triage first; rotate only if a live key was committed.',
        steps: [
            'Check severity and path — `web/data`, `__tests__`, and `.example` files are often intentional.',
            'Run gitleaks on staged files only to catch new leaks before commit.',
            'Rotate any key that was ever pushed to a remote (Stripe, AWS, Resend).',
            'Replace literals with `process.env.VAR` and document in `.env.example`.',
            'Never log secret values — gate scans filename and line only.'
        ],
        resources: ['owaspSecrets', 'nodeEnv']
    },
    {
        id: 'zero-progress-paralysis',
        trigger: (ctx) => ctx.totalFindings > 50 && ctx.gatePass === false,
        othersSay: 'There is no path forward.',
        youCan: 'Pick one cylinder, ship one fix today. Master engineers reduce entropy — they do not boil the ocean.',
        steps: [
            'Open `.simplebeacon/master-engineering-brief.md` — execute Phase 1 only.',
            'Choose the smallest auto-fixable code suggestion and apply it.',
            'Commit one fix, run gate, repeat tomorrow.',
            'Track open findings in agent session — `agent_status` shows what is left.',
            'Celebrate gate pass on a **scoped path** even if monorepo root is noisy.'
        ],
        resources: ['gateHygiene', 'mergeQueues']
    },
    {
        id: 'lighthouse-a11y-stuck',
        trigger: (ctx) => ctx.totalFindings > 0 && ctx.rawIssues.some((i) => String(i.type || i.pattern || '').toLowerCase().includes('a11y') || String(i.type || i.pattern || '').toLowerCase().includes('lighthouse')),
        othersSay: 'Lighthouse accessibility score is stuck and we cannot get it higher.',
        youCan: 'Every Lighthouse a11y failure is a specific, named audit. Read the LHR JSON, fix each audit by name, and the score goes to 1.0.',
        steps: [
            'Download the LHR JSON from CI artifacts or the temporary-public-storage URL.',
            'Parse categories.accessibility.auditRefs — find audits with score < 1.',
            'For button-name: add aria-label to every icon-only button.',
            'For color-contrast: darken/lighten text to achieve 4.5:1+ ratio (WCAG AA).',
            'For SPA: ensure CSS is loaded via static <link>, not dynamic createElement.',
            'Verify locally with `npx lighthouse --only-categories=accessibility --output=json`.'
        ],
        resources: ['lighthouseCi', 'reactA11y', 'webVitals']
    },
    {
        id: 'typescript-error-flood',
        trigger: (ctx) => ctx.rawIssues.some((i) => String(i.type || i.pattern || '').toLowerCase().includes('typescript') || String(i.type || i.pattern || '').toLowerCase().includes('ts-error')),
        othersSay: 'There are hundreds of TypeScript errors and strict mode is impossible.',
        youCan: 'TypeScript errors are incremental. Fix by error code, not by file. One type fix can resolve hundreds of errors.',
        steps: [
            'Run `tsc --noEmit` and group errors by code (TS2304, TS2339, TS2322).',
            'Fix the most common error code first — often a single type fix resolves hundreds.',
            'For strict mode: enable one flag at a time (strictNullChecks first).',
            'Use @ts-expect-error sparingly — only for third-party type gaps with a TODO.',
            'Run tsc --incremental during development for faster feedback.'
        ],
        resources: ['tsStrict']
    },
    {
        id: 'docker-build-broken',
        trigger: (ctx) => ctx.rawIssues.some((i) => String(i.type || i.pattern || '').toLowerCase().includes('docker') || String(i.type || i.pattern || '').toLowerCase().includes('container')),
        othersSay: 'Docker builds are failing with incomprehensible errors.',
        youCan: 'Docker failures are path mismatches, missing files, or wrong base images. Build stage by stage with --progress=plain.',
        steps: [
            'Build with --progress=plain to see full output.',
            'Add --target <stage> to build only up to a specific multi-stage step.',
            'Check COPY paths — relative to build context, not Dockerfile location.',
            'Verify .dockerignore is not excluding needed files.',
            'Use --no-cache for a clean build when layer cache is corrupt.'
        ],
        resources: ['dockerBestPractices']
    },
    {
        id: 'git-disaster',
        trigger: (ctx) => ctx.rawIssues.some((i) => String(i.type || i.pattern || '').toLowerCase().includes('git') || String(i.type || i.pattern || '').toLowerCase().includes('branch')),
        othersSay: 'Git is broken and we lost work.',
        youCan: 'Git almost never loses data. The reflog keeps every commit for 90 days. You can recover anything.',
        steps: [
            'Run `git reflog` to see every HEAD change.',
            'Find the commit hash you lost and `git branch recovery <hash>`.',
            'For accidental resets: `git reset --hard ORIG_HEAD`.',
            'For bad merges: `git revert -m 1 <merge-commit>`.',
            'For deleted branches: `git branch <name> <hash-from-reflog>`.'
        ],
        resources: ['gitReflog']
    },
    {
        id: 'memory-leak-suspected',
        trigger: (ctx) => ctx.rawIssues.some((i) => String(i.type || i.pattern || '').toLowerCase().includes('memory') || String(i.type || i.pattern || '').toLowerCase().includes('heap')),
        othersSay: 'There is a memory leak in production and we cannot find it.',
        youCan: 'Node memory leaks are traceable with heap snapshots. Compare two snapshots to find what is growing.',
        steps: [
            'Run with `node --inspect` and open chrome://inspect.',
            'Take snapshot A, run the leaking operation 100 times, take snapshot B.',
            'Compare A→B: filter by "Objects allocated between snapshots".',
            'Common culprits: event listeners, closures, global caches without eviction.',
            'Use --max-old-space-size=4096 as a temporary bandage.'
        ],
        resources: ['nodeMemory']
    },
    {
        id: 'circular-dependency-web',
        trigger: (ctx) => ctx.rawIssues.some((i) => String(i.type || i.pattern || '').toLowerCase().includes('circular') || String(i.type || i.pattern || '').toLowerCase().includes('cycle')),
        othersSay: 'Circular dependencies are impossible to fix without rewriting everything.',
        youCan: 'Circular deps are a missing abstraction. Extract the shared logic into a third module and the cycle breaks.',
        steps: [
            'Run `npx depcruise --validate .dependency-cruiser.js src/` to identify cycles.',
            'For each cycle: identify the shared dependency both modules need.',
            'Extract the shared logic into a new module that both can import.',
            'For type-only cycles: use `import type` to erase at compile time.',
            'For barrel file cycles: import from the source file, not index.ts.'
        ],
        resources: ['circularDeps']
    }
];

const CYLINDER_DEFS = [
    { id: 'gate', label: 'Gate & security', scoreKey: 'gateScore' },
    { id: 'code', label: 'Code quality', scoreKey: 'codeScore' },
    { id: 'cleanup', label: 'File reduction', scoreKey: 'cleanupScore' },
    { id: 'deps', label: 'Dependencies', scoreKey: 'depsScore' },
    { id: 'env', label: 'Environment', scoreKey: 'envScore' },
    { id: 'ci', label: 'CI/CD readiness', scoreKey: 'ciScore' },
    { id: 'tests', label: 'Test baseline', scoreKey: 'testsScore' },
    { id: 'data', label: 'Data hygiene', scoreKey: 'dataScore' },
    { id: 'agent', label: 'Agent automation', scoreKey: 'agentScore' },
    { id: 'ship', label: 'Ship readiness', scoreKey: 'shipScore' }
];

function readJsonSafe(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

function scoreGate(ctx) {
    if (ctx.gatePass === true) return 100;
    if (ctx.blockingCount === 0) return 85;
    if (ctx.blockingCount <= 3) return 50;
    if (ctx.blockingCount <= 10) return 30;
    return 10;
}

function scoreFromCount(count, thresholds) {
    const n = Number(count) || 0;
    if (n === 0) return 100;
    if (n <= thresholds.low) return 70;
    if (n <= thresholds.mid) return 40;
    return 15;
}

function buildCylinderScores(ctx) {
    return {
        gateScore: scoreGate(ctx),
        codeScore: scoreFromCount(ctx.deadExports + ctx.codeSuggestionCount, { low: 5, mid: 20 }),
        cleanupScore: ctx.safeDeleteBytes > 0 ? 75 : (ctx.reclaimableBytes > 0 ? 60 : 90),
        depsScore: scoreFromCount(ctx.unusedDeps, { low: 3, mid: 10 }),
        envScore: scoreFromCount(ctx.envFindings + ctx.missingEnvKeys, { low: 2, mid: 8 }),
        ciScore: ctx.hasCiWorkflow ? 80 : 40,
        testsScore: ctx.jestBaselinePassed === true ? 90 : (ctx.jestBaselinePassed === false ? 35 : 60),
        dataScore: scoreFromCount(ctx.piiNeedingReview + ctx.orphanedData, { low: 2, mid: 10 }),
        agentScore: ctx.hasAgentArtifacts ? 95 : 55,
        shipScore: ctx.gatePass === true && ctx.blockingCount === 0 ? 95 : Math.max(10, scoreGate(ctx) - 10)
    };
}

function buildContextFromSources({ gateReport, fileReduction, codeSuggestions, projectRoot }) {
    const gate = gateReport?.gate || {};
    const frSummary = fileReduction?.summary || {};
    const frPlan = fileReduction?.fileReductionPlan || {};
    const dqExec = fileReduction?.executiveSummary || {};
    const codePayload = codeSuggestions || gateReport?.codeSuggestions || null;

    return {
        projectRoot,
        gatePass: gate.pass ?? gateReport?.scan_summary?.status === 'PASSED',
        blockingCount: gate.blockingCount ?? 0,
        qualityScore: gateReport?.qualityScore ?? null,
        totalFindings: gateReport?.issueCount ?? frSummary.totalFindings ?? 0,
        inventoryFiles: gateReport?.repositoryFilesTotal ?? fileReduction?.inventory?.totalFiles ?? null,
        staleFullTree: fileReduction?.scanScope?.reportHealth === 'stale-full-tree-scan'
            || gateReport?.scanScope?.reportHealth === 'stale-full-tree-scan',
        reclaimableBytes: frSummary.reclaimableBytes ?? frPlan.totals?.reclaimableBytes ?? 0,
        safeDeleteBytes: frPlan.totals?.safeToDeleteBytes ?? 0,
        unusedCandidates: frPlan.unusedFiles?.candidates ?? frSummary.unusedFileCandidates ?? 0,
        deadExports: frPlan.deadCode?.deadExports ?? frSummary.deadCodeFindings ?? 0,
        codeSuggestionCount: (codePayload?.suggestions || []).length,
        credentialFindings: gateReport?.credentialFindings ?? 0,
        unusedDeps: dqExec.workspace?.unusedDependencies ?? fileReduction?.scanners?.['dependency-health']?.unusedDependencies ?? 0,
        envFindings: dqExec.workspace?.envInconsistencies ?? 0,
        missingEnvKeys: dqExec.workspace?.missingEnvKeys ?? 0,
        piiNeedingReview: dqExec.security?.piiNeedingReview ?? 0,
        orphanedData: dqExec.data?.orphanedDataFiles ?? 0,
        jestBaselinePassed: gateReport?.jestBaselinePassed ?? null,
        hasCiWorkflow: fs.existsSync(path.join(projectRoot, '.github', 'workflows')),
        hasAgentArtifacts: fs.existsSync(path.join(projectRoot, '.simplebeacon', 'agent-brief.md')),
        rawIssues: gateReport?.rawIssues || gateReport?.detectedIssues || []
    };
}

function buildPhasedMasterPlan(ctx, cylinders, codePayload, cleanupBrief) {
    const phases = [];

    if (ctx.blockingCount > 0) {
        phases.push({
            phase: 1,
            name: 'Unblock the gate',
            goal: `Clear ${ctx.blockingCount} blocking issue(s) — nothing else until gate passes on scoped path`,
            actions: (codePayload?.quickWins || codePayload?.suggestions || []).slice(0, 5).map((s) => ({
                type: 'code-fix',
                title: s.title,
                path: s.filePath,
                autoFixable: s.autoFixable
            })),
            verify: 'npx simplebeacon scan --gate --offline'
        });
    }

    if (ctx.safeDeleteBytes > 0 || ctx.reclaimableBytes > 0) {
        phases.push({
            phase: phases.length + 1,
            name: 'Reclaim disk (safe artifacts)',
            goal: 'Delete regenerable directories — node_modules, coverage, logs (review audit logs first)',
            actions: (cleanupBrief?.tiers?.safeNow?.directories || []).slice(0, 6).map((d) => ({
                type: 'delete-directory',
                path: d.path,
                bytes: d.bytes
            })),
            verify: 'npm install && npx simplebeacon reduce'
        });
    }

    if (ctx.deadExports > 0 || (codePayload?.suggestions || []).some((s) => s.category === 'dead-code')) {
        phases.push({
            phase: phases.length + 1,
            name: 'Trim dead exports',
            goal: 'Symbol-level cleanup — not bulk file delete',
            actions: (codePayload?.suggestions || []).filter((s) => s.category === 'dead-code').slice(0, 8),
            verify: 'npm test --workspace=<your-package>'
        });
    }

    if (ctx.unusedDeps > 0 || ctx.envFindings > 0) {
        phases.push({
            phase: phases.length + 1,
            name: 'Stabilize workspace',
            goal: 'Align env keys and prune verified-unused dependencies',
            actions: [
                ...(ctx.missingEnvKeys > 0 ? [{ type: 'env', detail: `${ctx.missingEnvKeys} missing env key(s)` }] : []),
                ...(ctx.unusedDeps > 0 ? [{ type: 'deps', detail: `${ctx.unusedDeps} potentially unused dependency(ies)` }] : [])
            ],
            verify: 'npm test && npx simplebeacon scan --gate'
        });
    }

    phases.push({
        phase: phases.length + 1,
        name: 'Ship',
        goal: 'Gate pass + CI green + handoff artifacts committed',
        actions: [
            { type: 'handoff', detail: 'Commit .simplebeacon/agent-brief.md refresh after final gate' },
            { type: 'ci', detail: 'Open PR — let pr-hygiene.yml backstop local --no-verify bypasses' }
        ],
        verify: 'gate_status && handoff_check'
    });

    return phases;
}

function resolvePlaybooks(ctx) {
    return YES_YOU_CAN_PLAYBOOKS
        .filter((pb) => pb.trigger(ctx))
        .map((pb) => ({
            id: pb.id,
            othersSay: pb.othersSay,
            youCan: pb.youCan,
            steps: pb.steps,
            resources: (pb.resources || []).map((key) => ENGINEERING_RESOURCES[key]).filter(Boolean)
        }));
}

function buildGuideQueue(issues) {
    const ids = collectActiveGuideIds(issues, {});
    return ids.map((id) => {
        const guide = GUIDE_PLAYBOOKS[id];
        if (!guide) return null;
        return {
            id,
            title: guide.title,
            timeRequired: guide.timeRequired,
            difficulty: guide.difficulty,
            verify: guide.verify,
            steps: guide.steps.slice(0, 5)
        };
    }).filter(Boolean);
}

function buildMasterAgentPrompt(ctx, phases, playbooks, cylinders) {
    const weak = CYLINDER_DEFS
        .map((c) => ({ ...c, score: cylinders[c.scoreKey] ?? 0 }))
        .filter((c) => c.score < 70)
        .sort((a, b) => a.score - b.score);

    const lines = [
        'You are the master engineer on this codebase. Others may say it is impossible — your job is to ship one verified fix at a time.',
        '',
        `Gate: ${ctx.gatePass ? 'PASS' : 'FAIL'} · Blocking: ${ctx.blockingCount} · Quality: ${ctx.qualityScore ?? '—'}`,
        '',
        '## Ten cylinders (weakest first)',
        ...weak.map((c) => `- **${c.label}:** ${c.score}/100`),
        '',
        '## Execute phases in order — do not skip Phase 1 while gate fails',
        ...phases.map((p) => `- Phase ${p.phase}: ${p.name} — ${p.goal}`),
        ''
    ];

    if (playbooks.length) {
        lines.push('## Yes you can (active recovery playbooks)');
        for (const pb of playbooks.slice(0, 3)) {
            lines.push(`- When they say: "${pb.othersSay}"`);
            lines.push(`  You can: ${pb.youCan}`);
        }
        lines.push('');
    }

    lines.push('## Rules');
    lines.push('- scan_snippet before every edit · scan_file after save · gate before merge');
    lines.push('- Use online docs for API correctness — do not invent SDK methods');
    lines.push('- Scoped paths beat full-monorepo panic');
    lines.push('- Mention @.simplebeacon/master-engineering-brief.md in chat');

    return lines.join('\n');
}

/**
 * Build the master engineering brief from on-disk and in-memory scan artifacts.
 * @param {string} projectRoot
 * @param {object} [options]
 * @returns {object}
 */
function buildMasterEngineeringBrief(projectRoot, options = {}) {
    const root = path.resolve(projectRoot || process.cwd());
    const sbDir = path.join(root, '.simplebeacon');

    const gateReport = options.gateReport
        || readJsonSafe(path.join(sbDir, 'report.json'))
        || options.report
        || null;
    const fileReduction = options.fileReduction
        || readJsonSafe(path.join(sbDir, 'file-reduction-report.json'));
    const codeFromDisk = readJsonSafe(path.join(sbDir, 'code-suggestions.json'));

    const codePayload = codeFromDisk
        || gateReport?.codeSuggestions
        || fileReduction?.codeSuggestions
        || buildCodeSuggestions(gateReport || fileReduction || {}, options);

    const ctx = buildContextFromSources({
        gateReport,
        fileReduction,
        codeSuggestions: codePayload,
        projectRoot: root
    });

    if (!gateReport && !fileReduction) {
        const gateStatus = readGateStatus(root);
        ctx.gatePass = gateStatus.gatePass;
        ctx.blockingCount = gateStatus.blockingCount ?? 0;
    }

    const cylinders = buildCylinderScores(ctx);
    const cylinderRows = CYLINDER_DEFS.map((def) => ({
        id: def.id,
        label: def.label,
        score: cylinders[def.scoreKey] ?? 0,
        status: (cylinders[def.scoreKey] ?? 0) >= 80 ? 'strong' : (cylinders[def.scoreKey] ?? 0) >= 50 ? 'attention' : 'critical'
    }));

    let cleanupBrief = null;
    try {
        if (fileReduction) {
            cleanupBrief = buildCleanupAssistantBrief({
                projectPath: root,
                fileReduction,
                dataQuality: fileReduction.executiveSummary ? { executiveSummary: fileReduction.executiveSummary } : null,
                repositoryInventory: fileReduction.inventory
            });
        }
    } catch {
        /* optional */
    }

    const phases = buildPhasedMasterPlan(ctx, cylinders, codePayload, cleanupBrief);
    const yesYouCan = resolvePlaybooks(ctx);
    const guideQueue = buildGuideQueue(ctx.rawIssues);

    const overallScore = Math.round(
        cylinderRows.reduce((sum, row) => sum + row.score, 0) / Math.max(cylinderRows.length, 1)
    );

    return {
        schemaVersion: '1.0',
        generatedAt: new Date().toISOString(),
        projectRoot: root,
        motto: 'Yes you can — one verified fix at a time.',
        overallScore,
        shipReady: ctx.gatePass === true && ctx.blockingCount === 0 && overallScore >= 70,
        context: {
            gatePass: ctx.gatePass,
            blockingCount: ctx.blockingCount,
            qualityScore: ctx.qualityScore,
            totalFindings: ctx.totalFindings,
            inventoryFiles: ctx.inventoryFiles,
            staleFullTree: ctx.staleFullTree
        },
        tenCylinders: cylinderRows,
        phasedPlan: phases,
        yesYouCan,
        remediationGuides: guideQueue,
        codeSuggestions: {
            quickWinCount: codePayload?.quickWinCount ?? 0,
            autoFixCount: codePayload?.autoFixCount ?? 0,
            top: (codePayload?.quickWins || codePayload?.suggestions || []).slice(0, 8)
        },
        cleanup: cleanupBrief ? {
            estimatedReduction: cleanupBrief.estimatedReduction,
            tiers: {
                safeNow: cleanupBrief.tiers?.safeNow?.directories?.slice(0, 6) || [],
                reviewFirst: cleanupBrief.tiers?.reviewFirst?.items?.slice(0, 5) || []
            }
        } : null,
        onlineResources: Object.values(ENGINEERING_RESOURCES),
        agentPrompt: buildMasterAgentPrompt(ctx, phases, yesYouCan, cylinders),
        artifacts: [
            '.simplebeacon/master-engineering-brief.md',
            '.simplebeacon/code-suggestions.md',
            '.simplebeacon/agent-brief.md',
            '.simplebeacon/file-reduction-ai-notes.md'
        ]
    };
}

function formatMasterEngineeringMarkdown(brief) {
    if (!brief || typeof brief !== 'object') return '';
    const lines = [
        '# Master engineering brief',
        '',
        `> ${brief.motto}`,
        '',
        `- **Overall score:** ${brief.overallScore}/100`,
        `- **Ship ready:** ${brief.shipReady ? 'yes' : 'not yet'}`,
        `- **Gate:** ${brief.context?.gatePass ? 'PASS' : 'FAIL'} (${brief.context?.blockingCount ?? 0} blocking)`,
        `- **Updated:** ${brief.generatedAt}`,
        ''
    ];

    if (brief.context?.staleFullTree) {
        lines.push('> ⚠ Stale full-tree scan detected — scope to product path and re-run with refresh=1.');
        lines.push('');
    }

    lines.push('## Ten cylinders');
    lines.push('');
    for (const row of brief.tenCylinders || []) {
        const bar = row.score >= 80 ? '███' : row.score >= 50 ? '██░' : '█░░';
        lines.push(`- **${row.label}** ${bar} ${row.score}/100 (${row.status})`);
    }
    lines.push('');

    lines.push('## Phased master plan');
    lines.push('');
    for (const phase of brief.phasedPlan || []) {
        lines.push(`### Phase ${phase.phase}: ${phase.name}`);
        lines.push('');
        lines.push(phase.goal);
        lines.push('');
        lines.push(`Verify: \`${phase.verify}\``);
        lines.push('');
    }

    if ((brief.yesYouCan || []).length) {
        lines.push('## Yes you can');
        lines.push('');
        for (const pb of brief.yesYouCan) {
            lines.push(`### ${pb.id}`);
            lines.push('');
            lines.push(`**They say:** ${pb.othersSay}`);
            lines.push('');
            lines.push(`**You can:** ${pb.youCan}`);
            lines.push('');
            lines.push('Steps:');
            for (const step of pb.steps) lines.push(`1. ${step}`);
            if ((pb.resources || []).length) {
                lines.push('');
                lines.push('Resources:');
                for (const r of pb.resources) lines.push(`- [${r.title}](${r.url}) — ${r.note}`);
            }
            lines.push('');
        }
    }

    if ((brief.codeSuggestions?.top || []).length) {
        lines.push('## Top code suggestions');
        lines.push('');
        for (const item of brief.codeSuggestions.top) {
            const loc = item.filePath ? `\`${item.filePath}\`` : '—';
            lines.push(`- **${item.title}** @ ${loc} — ${item.suggestion}`);
        }
        lines.push('');
    }

    if ((brief.onlineResources || []).length) {
        lines.push('## Curated online resources');
        lines.push('');
        for (const r of brief.onlineResources) {
            lines.push(`- [${r.title}](${r.url}) — ${r.note}`);
        }
        lines.push('');
    }

    if (brief.agentPrompt) {
        lines.push('## Master agent prompt');
        lines.push('');
        lines.push(brief.agentPrompt);
        lines.push('');
    }

    lines.push('---');
    lines.push('Fire all ten cylinders: gate · code · cleanup · deps · env · ci · tests · data · agent · ship.');
    return lines.join('\n');
}

function writeMasterEngineeringArtifacts(projectRoot, options = {}) {
    const root = path.resolve(projectRoot);
    const brief = buildMasterEngineeringBrief(root, options);
    const dir = path.join(root, '.simplebeacon');
    try {
        fs.mkdirSync(dir, { recursive: true });
    } catch {
        return null;
    }
    const jsonPath = path.join(dir, BRIEF_JSON);
    const mdPath = path.join(dir, BRIEF_MD);
    fs.writeFileSync(jsonPath, JSON.stringify(brief, null, 2), 'utf8');
    fs.writeFileSync(mdPath, formatMasterEngineeringMarkdown(brief), 'utf8');
    return { jsonPath, mdPath, brief };
}

function attachMasterBrief(report, projectRoot) {
    if (!report || typeof report !== 'object') return report;
    try {
        report.masterEngineeringBrief = buildMasterEngineeringBrief(
            projectRoot || report.projectRoot || process.cwd(),
            { gateReport: report.type === 'simplebeacon-report' ? report : null, fileReduction: report.type === 'data-cleanup-report' ? report : null }
        );
    } catch {
        /* non-fatal */
    }
    return report;
}

module.exports = {
    BRIEF_JSON,
    BRIEF_MD,
    ENGINEERING_RESOURCES,
    YES_YOU_CAN_PLAYBOOKS,
    buildMasterEngineeringBrief,
    formatMasterEngineeringMarkdown,
    writeMasterEngineeringArtifacts,
    attachMasterBrief
};
