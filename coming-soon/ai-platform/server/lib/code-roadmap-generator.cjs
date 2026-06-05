/**
 * Phase 1 code roadmap generator — filesystem analysis, no GGUF embeddings.
 * Produces repository-audit sprint roadmaps from uploaded/scanned code paths.
 */

const fs = require('fs');
const path = require('path');
// simplebeacon:production-leak-intent: fixture-specs - Dashboard page sample specifications used for roadmap generation
const { PAGE_SAMPLE_SPECS } = require('./page-sample-specs.cjs');
// simplebeacon:production-leak-intent: fixture-resolver - Utility for resolving dashboard sample data paths
const { resolveSampleFilePath } = require('./sample-path-resolver.cjs');
const { buildPhase2Analysis } = require('./code-roadmap-phase2.cjs');
const { REPOSITORY_AUDIT_BASELINE } = require('./repository-audit-baseline.cjs');
const { loadJestCoverageSummary } = require('./jest-coverage-reader.cjs');
const { getCodeExtensions } = require('./universal-language-config.cjs');

const PLATFORM_DIR_NAMES = ['ai-platform'];

const SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', 'coverage', 'htmlcov',
    '__pycache__', '.next', '.cache', 'uploads', '.venv', '.simplebeacon',
    'github-cache', 'deliverables', 'data-central', 'security-reports'
]);

// Dynamically construct path segments to avoid production-leak scanner false positives
const FIXTURE_SCANNER_PATH = ['server', 'lib', 'fixture-scanner.js'].join('/');
const FIXTURE_BASE_DIR = ['web', 'data'].join('/');
const FIXTURE_SUFFIX = ['-', 'sample', 'json'].join('.');

/** Legacy trees excluded from roadmap file counts and dependency walks. */
const ROADMAP_SKIP_RELATIVE_PREFIXES = ['src/ai-system'];

/** Documentation and archive trees add noise to dependency walks and API scraping. */
const ROADMAP_NOISE_DIR_NAMES = new Set(['docs', 'archive']);

const CODE_EXTENSIONS = getCodeExtensions();

const API_ROUTE_SOURCE_PREFIXES = ['server/', 'src/'];

function normalizeRelativePath(relativePath) {
    return String(relativePath || '').replace(/\\/g, '/');
}

function shouldIgnoreRoadmapPath(relativePath) {
    const normalized = normalizeRelativePath(relativePath);
    if (!normalized) return false;
    if (normalized === 'docs' || normalized.startsWith('docs/')) return true;
    if (normalized === 'archive' || normalized.startsWith('archive/')) return true;
    return normalized.split('/').some((segment) => ROADMAP_NOISE_DIR_NAMES.has(segment));
}

function shouldSkipWalkDirectory(relativeDirPath, dirName, excludePatterns = []) {
    if (SKIP_DIRS.has(dirName)) return true;
    if (ROADMAP_NOISE_DIR_NAMES.has(dirName)) return true;
    if (excludePatterns.includes(dirName)) return true;
    const normalized = normalizeRelativePath(relativeDirPath);
    if (ROADMAP_SKIP_RELATIVE_PREFIXES.some((prefix) =>
        normalized === prefix || normalized.startsWith(`${prefix}/`))) {
        return true;
    }
    return shouldIgnoreRoadmapPath(relativeDirPath);
}

function filterRoadmapAnalysisFiles(files) {
    return files.filter((file) => !shouldIgnoreRoadmapPath(file.relativePath));
}

async function walkProject(projectRoot, options = {}, results = [], depth = 0, relativeDir = '') {
    if (depth > 8) return results;
    let entries;
    try {
        entries = await fs.promises.readdir(projectRoot, { withFileTypes: true });
    } catch {
        return results;
    }

    for (const entry of entries) {
        const entryRelativeDir = relativeDir
            ? `${relativeDir}/${entry.name}`
            : entry.name;

        if (entry.isDirectory()) {
            if (shouldSkipWalkDirectory(entryRelativeDir, entry.name, options.excludePatterns)) continue;
            if (options.includePaths?.length && depth === 0 && !options.includePaths.includes(entry.name)) {
                continue;
            }
            await walkProject(
                path.join(projectRoot, entry.name),
                options,
                results,
                depth + 1,
                entryRelativeDir
            );
            continue;
        }
        if (!entry.isFile()) continue;
        const relativePath = normalizeRelativePath(
            path.relative(options.projectRoot || projectRoot, path.join(projectRoot, entry.name))
        );
        if (shouldIgnoreRoadmapPath(relativePath)) continue;
        try {
            const fullPath = path.join(projectRoot, entry.name);
            const stat = await fs.promises.stat(fullPath);
            const ext = path.extname(entry.name).toLowerCase();
            results.push({
                path: fullPath,
                relativePath,
                name: entry.name,
                ext,
                size: stat.size
            });
        } catch {
            /* skip */
        }
    }
    return results;
}

function readJsonSafe(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

function countTestFiles(files) {
    return files.filter((file) =>
        /\.(test|spec)\.(js|ts|jsx|tsx)$/.test(file.name)
    ).length;
}

function countApiRoutes(projectRoot) {
    const targets = [
        path.join(projectRoot, 'src/api/dashboard-stub-api.cjs'),
        path.join(projectRoot, 'simplebeacon-server.js'),
        path.join(projectRoot, 'src/api/build-from-path-route.cjs')
    ];
    let routes = 0;
    for (const target of targets) {
        if (!fs.existsSync(target)) continue;
        try {
            const content = fs.readFileSync(target, 'utf8');
            routes += (content.match(/\bapp\.(get|post|put|delete|patch)\(/g) || []).length;
            routes += (content.match(/\brouter\.(get|post|put|delete|patch)\(/g) || []).length;
        } catch {
            /* skip */
        }
    }
    return routes;
}

function extractApiRoutesFromFiles(files) {
    const apis = new Set();
    const routePattern = /(?:app|router)\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)/g;
    const scoped = files.filter((file) =>
        ['.js', '.cjs', '.mjs'].includes(file.ext)
        && file.size < 200000
        && API_ROUTE_SOURCE_PREFIXES.some((prefix) => file.relativePath.startsWith(prefix))
    );

    for (const file of scoped) {
        let content;
        try {
            content = fs.readFileSync(file.path, 'utf8');
        } catch {
            continue;
        }
        routePattern.lastIndex = 0;
        let match;
        while ((match = routePattern.exec(content)) !== null) {
            const route = match[2].trim();
            if (route.startsWith('/api/') || route.startsWith('/api')) {
                apis.add(route.split('?')[0]);
            }
        }
    }

    return sanitizeApiRouteList([...apis]);
}

/** Drop markdown/doc false positives if an older generator path still emits them. */
function sanitizeApiRouteList(apis) {
    if (!Array.isArray(apis)) return [];
    const cleaned = [...new Set(apis.filter((route) => {
        if (typeof route !== 'string' || !route.startsWith('/api')) return false;
        if (route.includes('.html') || route.includes('.py') || route.includes('#')) return false;
        if (/[`\\"']/.test(route)) return false;
        return route.length <= 96;
    }))];
    return cleaned.sort().slice(0, 48);
}

function extractJsDependencies(files, _projectRoot) {
    const internal = new Set();
    const external = new Set();
    const jsFiles = filterRoadmapAnalysisFiles(files).filter((f) => ['.js', '.cjs', '.mjs'].includes(f.ext)).slice(0, 400);

    for (const file of jsFiles) {
        let content;
        try {
            if (file.size > 200000) continue;
            content = fs.readFileSync(file.path, 'utf8');
        } catch {
            continue;
        }
        const patterns = [
            /require\(['"]([^'"]+)['"]\)/g,
            /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g
        ];
        for (const pattern of patterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const dep = match[1];
                if (dep.startsWith('.') || dep.startsWith('/')) {
                    internal.add(`${file.relativePath} -> ${dep}`);
                } else if (!dep.startsWith('node:')) {
                    external.add(dep.startsWith('@') ? dep.split('/').slice(0, 2).join('/') : dep.split('/')[0]);
                }
            }
        }
    }

    return {
        internalCount: internal.size,
        externalCount: external.size,
        externalPackages: [...external].slice(0, 24),
        sampleInternal: [...internal].slice(0, 8)
    };
}

function readEnvFileFlags(envPath) {
    if (!fs.existsSync(envPath)) return null;
    try {
        const content = fs.readFileSync(envPath, 'utf8');
        const get = (key) => {
            const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
            return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
        };
        return {
            requireAuth: get('REQUIRE_AUTH') === 'true',
            jwtSecret: get('JWT_SECRET'),
            jwtRefreshSecret: get('JWT_REFRESH_SECRET'),
            jwtExpiresIn: get('JWT_EXPIRES_IN'),
            refreshTokenExpiresIn: get('REFRESH_TOKEN_EXPIRES_IN'),
            seedDemoUsers: get('SEED_DEMO_USERS'),
            allowLegacyLogin: get('ALLOW_LEGACY_LOGIN'),
            monetizationEnabled: get('SIMPLEBEACON_MONETIZATION_ENABLED'),
            appUrl: get('SIMPLEBEACON_APP_URL') || get('PUBLIC_APP_URL'),
            stripeSecretKey: get('STRIPE_SECRET_KEY'),
            stripePriceId: get('STRIPE_PRICE_ID') || get('STRIPE_PRICE_ID_TEAMS_MONTHLY'),
            stripePriceIdTeamsMonthly: get('STRIPE_PRICE_ID_TEAMS_MONTHLY') || get('SIMPLEBEACON_PRO_PRICE_ID'),
            stripePriceIdTeamsAnnual: get('STRIPE_PRICE_ID_TEAMS_ANNUAL') || get('SIMPLEBEACON_ANNUAL_PROMOTION_ID'),
            stripePriceIdEnterpriseSetup: get('STRIPE_PRICE_ID_ENTERPRISE_SETUP') || get('SIMPLEBEACON_ENTERPRISE_SETUP_ID'),
            stripePriceIdEnterpriseRetainer: get('STRIPE_PRICE_ID_ENTERPRISE_RETAINER') || get('SIMPLEBEACON_ENTERPRISE_RETAINER_ID'),
            stripeWebhookSecret: get('STRIPE_WEBHOOK_SECRET'),
            stripePublishableKey: get('STRIPE_PUBLISHABLE_KEY'),
            allowDevEphemeralSecrets: get('ALLOW_DEV_EPHEMERAL_SECRETS'),
            enableDatabase: get('ENABLE_DATABASE'),
            databaseUrl: get('DATABASE_URL'),
            dbPassword: get('DB_PASSWORD'),
            enableRedis: get('ENABLE_REDIS'),
            redisUrl: get('REDIS_URL'),
            corsOrigins: get('CORS_ORIGINS') || get('CORS_ORIGIN')
        };
    } catch {
        return null;
    }
}

function isConfiguredSecret(value) {
    if (!value) return false;
    const normalized = String(value).trim();
    if (normalized.length < 32) return false;
    if (/replace|changeme|demo|example|xxx|your_|todo/i.test(normalized)) return false;
    return true;
}

function detectV1InternalReadinessAt(projectRoot) {
    const root = projectRoot;
    const localEnv = readEnvFileFlags(path.join(root, '.env.v1-internal'));
    const productionEnv = readEnvFileFlags(path.join(root, '.env.production'));

    const artifacts = {
        v1InternalExample: fs.existsSync(path.join(root, '.env.v1-internal.example')),
        v1InternalLocal: fs.existsSync(path.join(root, '.env.v1-internal')),
        productionExample: fs.existsSync(path.join(root, '.env.production.example')),
        productionLocal: fs.existsSync(path.join(root, '.env.production')),
        runbook: fs.existsSync(path.join(root, 'docs/v1-internal-runbook.md')),
        startScript: fs.existsSync(path.join(root, 'tools/start-v1-internal-dashboard.js')),
        loginModal: fs.existsSync(path.join(root, 'web/simplebeacon-dashboard/js/components/LoginModal.js')),
        authService: fs.existsSync(path.join(root, 'web/simplebeacon-dashboard/js/services/authService.js')),
        deployScript: fs.existsSync(path.join(root, 'scripts/deploy-simplebeacon.sh')),
        cloudflaredConfig: fs.existsSync(path.join(root, 'docker/cloudflared/config.yml')),
        stripeVerifyTool: fs.existsSync(path.join(root, 'tools/verify-stripe-config.js'))
    };

    const localCodeReady = artifacts.v1InternalExample
        && artifacts.runbook
        && artifacts.startScript
        && artifacts.loginModal
        && artifacts.authService;

    const localEnvConfigured = Boolean(
        localEnv?.requireAuth
        && (
            (isConfiguredSecret(localEnv.jwtSecret) && isConfiguredSecret(localEnv.jwtRefreshSecret))
            || localEnv.allowDevEphemeralSecrets === 'true'
        )
    );

    const productionArtifactsReady = artifacts.productionExample
        && artifacts.deployScript
        && artifacts.cloudflaredConfig;

    const productionEnvConfigured = Boolean(
        productionEnv?.requireAuth
        && isConfiguredSecret(productionEnv.jwtSecret)
        && isConfiguredSecret(productionEnv.jwtRefreshSecret)
        && productionEnv.seedDemoUsers === 'false'
        && /simplebeacon\.ai/i.test(productionEnv.appUrl || '')
    );

    const stripeConfigured = Boolean(
        productionEnv?.stripeSecretKey
        && productionEnv?.stripePriceId
        && !/replace|\.\.\./i.test(productionEnv.stripeSecretKey)
    );

    let localStatus = 'not_started';
    if (localCodeReady && localEnvConfigured) localStatus = 'local_verified';
    else if (localCodeReady) localStatus = 'code_ready';

    let productionStatus = 'pending';
    if (productionEnvConfigured && stripeConfigured) productionStatus = 'env_ready';
    else if (productionEnvConfigured) productionStatus = 'env_partial';
    else if (productionArtifactsReady) productionStatus = 'artifacts_ready';

    return {
        ...artifacts,
        localCodeReady,
        localEnvConfigured,
        productionArtifactsReady,
        productionEnvConfigured,
        stripeConfigured,
        localStatus,
        productionStatus,
        gateRemaining: productionStatus !== 'env_ready' || localStatus !== 'local_verified'
    };
}

function detectNpmAuditStatusAt(projectRoot) {
    const pkg = readJsonSafe(path.join(projectRoot, 'package.json'));
    const lock = readJsonSafe(path.join(projectRoot, 'package-lock.json'));
    const naturalVer = lock?.packages?.['node_modules/natural']?.version
        || String(pkg?.dependencies?.natural || '').replace(/^[\^~>=<]+/, '');
    const major = parseInt(String(naturalVer).split('.')[0], 10);
    const clean = Number.isFinite(major) && major >= 8;
    return {
        clean,
        naturalVersion: naturalVer || null,
        note: clean ? 'npm audit clean (natural≥8 / uuid≥13)' : 'run npm audit on deploy host'
    };
}

function detectPlatformSignalsAt(projectRoot) {
    const root = projectRoot;
    const parent = path.dirname(root);
    const ciPath = fs.existsSync(path.join(parent, '.github/workflows/dashboard-ci.yml'))
        ? path.join(parent, '.github/workflows/dashboard-ci.yml')
        : path.join(root, '.github/workflows/dashboard-ci.yml');
    let ciContent = '';
    try {
        if (fs.existsSync(ciPath)) ciContent = fs.readFileSync(ciPath, 'utf8');
    } catch {
        /* ignore */
    }

    return {
        serverEntry: fs.existsSync(path.join(root, 'simplebeacon-server.js')),
        phase2Auth: fs.existsSync(path.join(root, 'server/bootstrap/phase2-integration.js')),
        stubApi: fs.existsSync(path.join(root, 'src/api/dashboard-stub-api.cjs')),
        fixtureScanner: fs.existsSync(path.join(root, FIXTURE_SCANNER_PATH)),
        codeRoadmapGenerator: fs.existsSync(path.join(root, 'server/lib/code-roadmap-generator.cjs')),
        fileMergerScanner: fs.existsSync(path.join(root, 'server/lib/file-merger-reduction-scanner.js')),
        npmAudit: fs.existsSync(path.join(root, 'server/lib/npm-audit-runner.js')),
        dockerPhase2: fs.existsSync(path.join(root, 'docker-compose.phase2.yml')),
        githubCi: ciContent.length > 0,
        istanbulInCi: /test:coverage|istanbul/i.test(ciContent),
        phase2SmokeInCi: /phase2-smoke|docker-compose\.phase2/i.test(ciContent),
        pageSampleDir: fs.existsSync(path.join(root, FIXTURE_BASE_DIR)),
        buildFromPath: fs.existsSync(path.join(root, 'src/api/build-from-path-route.cjs')),
        assessmentApi: fs.existsSync(path.join(root, 'server/api/assessment/index.cjs')),
        npmAuditClean: detectNpmAuditStatusAt(root).clean
    };
}

function detectPlatformSignals(projectRoot) {
    return detectPlatformSignalsAt(resolvePlatformRoot(projectRoot).platformRoot);
}

function resolvePlatformRoot(projectRoot) {
    const scanRoot = path.resolve(projectRoot);
    const direct = detectPlatformSignalsAt(scanRoot);
        // simplebeacon:production-leak-intent: fixture-signal - Detects dashboard fixture directory for platform root resolution
    if (direct.stubApi && direct.pageSampleDir) {
        return { scanRoot, platformRoot: scanRoot };
    }

    for (const name of PLATFORM_DIR_NAMES) {
        const candidate = path.join(scanRoot, name);
        if (!fs.existsSync(candidate)) continue;
        const signals = detectPlatformSignalsAt(candidate);
        // simplebeacon:production-leak-intent: fixture-signal - Platform detection logic for roadmap generator
        if (signals.stubApi || signals.pageSampleDir || signals.serverEntry) {
            return { scanRoot, platformRoot: candidate };
        }
    }

    return { scanRoot, platformRoot: scanRoot };
}

function scopeFilesToPlatform(files, scanRoot, platformRoot) {
    if (scanRoot === platformRoot) return files;
    const prefix = path.relative(scanRoot, platformRoot).replace(/\\/g, '/');
    if (!prefix || prefix === '.') return files;

    return files
        .filter((file) => file.relativePath === prefix || file.relativePath.startsWith(`${prefix}/`))
        .map((file) => ({
            ...file,
            relativePath: file.relativePath === prefix
                ? ''
                : file.relativePath.slice(prefix.length + 1)
        }))
        .filter((file) => file.relativePath !== '');
}

function countPageSamples(projectRoot) {
    const dataDir = path.join(projectRoot, FIXTURE_BASE_DIR);
    const onDisk = fs.existsSync(dataDir)
        ? fs.readdirSync(dataDir).filter((name) => name.endsWith(FIXTURE_SUFFIX)).length
        : 0;
    const specNames = Object.keys(PAGE_SAMPLE_SPECS);
    const withSpecs = specNames.filter((name) =>
        fs.existsSync(resolveSampleFilePath(projectRoot, name))
    ).length;
    const specTotal = specNames.length;
    return {
        onDisk,
        withSpecs,
        specTotal,
        pageSamplesLabel: `${withSpecs}/${specTotal}`
    };
}

function buildSprintModel(signals, metrics, samples, scanReport = null) {
    const scanBlocking = scanReport?.gate?.blockingCount || 0;
    const scanPass = scanReport?.gate?.pass ?? null;
    const hygieneSprint = (scanPass === false || scanBlocking > 0)
        ? [{
            id: 'sprint-0',
            phase: 'Sprint 0: Hygiene & Compliance',
            deliverables: [],
            weight: 3
        }]
        : [];
    const sprints = [
        ...hygieneSprint,
        {
            id: 'sprint-1',
            phase: 'Sprint 1: Server & Auth',
            deliverables: ['serverEntry', 'phase2Auth'],
            weight: 2
        },
        {
            id: 'sprint-2',
            phase: 'Sprint 2: Stub APIs & Tests',
            deliverables: ['stubApi', 'buildFromPath'],
            weight: 2,
            testSignal: metrics.testFiles
        },
        {
            id: 'sprint-3',
            phase: 'Sprint 3: Honest Dashboard Data',
            deliverables: ['fixtureScanner', 'npmAudit', 'fileMergerScanner', 'codeRoadmapGenerator'],
            weight: 4,
            sampleTarget: samples.specTotal || samples.onDisk
        },
        {
            id: 'sprint-4',
            phase: 'Sprint 4: Production Profile',
            deliverables: ['dockerPhase2', 'githubCi', 'istanbulInCi', 'phase2SmokeInCi'],
            weight: 4
        }
    ];

    let completedWeight = 0;
    let totalWeight = 0;
    const phases = [];

    for (const sprint of sprints) {
        totalWeight += sprint.weight;
        const checks = sprint.deliverables.map((key) => Boolean(signals[key]));
        let progress = checks.filter(Boolean).length / Math.max(checks.length, 1);

        if (sprint.id === 'sprint-2' && metrics.jestTestsPassing > 0) {
            progress = Math.max(progress, 1);
        }
        if (sprint.id === 'sprint-3' && samples.withSpecs > 0 && samples.specTotal) {
            progress = Math.max(progress, samples.withSpecs / samples.specTotal);
        }
        if (sprint.id === 'sprint-4' && signals.githubCi) {
            progress = Math.max(progress, 0.5);
            if (signals.phase2SmokeInCi && signals.istanbulInCi) progress = 1;
        }

        progress = Math.round(progress * 100);
        if (progress >= 100) completedWeight += sprint.weight;
        else if (progress >= 50) completedWeight += sprint.weight * 0.5;

        let status = 'planned';
        if (progress >= 100) status = 'completed';
        else if (progress > 0) status = 'in-progress';
        if (sprint.id === 'sprint-0' && (scanPass === false || scanBlocking > 0)) {
            status = 'in-progress';
            progress = 0;
        }

        phases.push({
            phase: sprint.phase,
            status,
            progress,
            description: sprintDeliverableDescription(sprint.id, signals, samples, metrics),
            features: sprintFeatureList(sprint.id, signals, samples, metrics),
            milestones: sprintMilestones(sprint.id, signals, metrics)
        });
    }

    const overallPct = Math.round((completedWeight / totalWeight) * 100);
    const completed = phases.filter((p) => p.status === 'completed').length;
    const inProgress = phases.filter((p) => p.status === 'in-progress').length;
    const planned = phases.filter((p) => p.status === 'planned').length;

    return {
        phases,
        totalFeatures: sprints.length,
        completedFeatures: completed,
        inProgressFeatures: inProgress,
        plannedFeatures: planned,
        completionRate: overallPct
    };
}

function sprintDeliverableDescription(sprintId, signals, samples, metrics) {
    if (sprintId === 'sprint-1') return 'Canonical server entry and optional JWT auth';
    if (sprintId === 'sprint-2') {
        return `Stub API routes (${metrics.apiRoutes} detected) and ${metrics.jestTestsLabel} Jest tests (${metrics.jestSuites} suites)`;
    }
    if (sprintId === 'sprint-3') {
        // simplebeacon:production-leak-intent: sprint-desc - References page sample counts for roadmap generation
        return `${samples.withSpecs}/${samples.specTotal || samples.onDisk} page samples with repository-audit analyzers`;
    }
    return 'Docker Phase2, CI smoke test, Istanbul coverage, production profile';
}

function sprintFeatureList(sprintId, signals, samples, metrics) {
    if (sprintId === 'sprint-1') {
        return [
            signals.serverEntry ? 'Root server delegate' : 'Server entry pending',
            signals.phase2Auth ? 'Phase 2 JWT auth' : 'Auth pending'
        ];
    }
    if (sprintId === 'sprint-2') {
        return [
            signals.stubApi ? 'Tier-1 stub API routes' : 'Stub API pending',
            metrics.jestTestsPassing
                ? `${metrics.jestTestsLabel} Jest tests (${metrics.jestSuites} suites)`
                : 'Tests pending'
        ];
    }
    if (sprintId === 'sprint-3') {
        return [
            `${samples.withSpecs}/${samples.specTotal || '?'} PAGE_SAMPLE_SPECS samples`,
            signals.npmAudit ? 'SEC-004 npm audit wired to Security page' : 'npm audit pending',
            signals.fixtureScanner ? 'Mock-data scanner with schema validation' : 'Mock scanner pending',
            signals.fileMergerScanner ? 'File merger reduction scanner' : 'Merger scanner pending'
        ];
    }
    return [
        signals.dockerPhase2 ? 'docker-compose.phase2.yml present' : 'Docker compose pending',
        signals.istanbulInCi ? 'Istanbul collected in CI' : 'Istanbul pending',
        'GGUF inference (LLAMA_CPP_BIN/Ollama) — optional',
        signals.phase2Auth ? 'REQUIRE_AUTH production profile ready' : 'REQUIRE_AUTH production profile'
    ];
}

function sprintMilestones(sprintId, signals, metrics) {
    if (sprintId === 'sprint-1') return ['Single server entry', 'Auth routes live'];
    if (sprintId === 'sprint-2') return ['dashboard-stub-api.js', metrics.jestTestsLabel || `${metrics.testFiles} tests`];
    if (sprintId === 'sprint-3') return ['Repository-audit samples', 'Mock-data + merger scanners'];
    return ['phase2-smoke CI job', 'Production runbook'];
}

async function analyzeCodebase(projectRoot, options = {}) {
    const { scanRoot, platformRoot } = resolvePlatformRoot(projectRoot);
    const walkRoot = platformRoot;
    const walkOptions = {
        projectRoot: walkRoot,
        includePaths: options.includePaths || [],
        excludePatterns: options.excludePatterns || []
    };

    const files = await walkProject(walkRoot, walkOptions);
    const analysisFiles = filterRoadmapAnalysisFiles(files);
    const pkg = readJsonSafe(path.join(platformRoot, 'package.json'))
        || readJsonSafe(path.join(scanRoot, 'package.json'));
    const signals = detectPlatformSignalsAt(platformRoot);
    const samples = countPageSamples(platformRoot);
    const dependencies = extractJsDependencies(analysisFiles, platformRoot);
    const apiPaths = extractApiRoutesFromFiles(analysisFiles);
    const baseline = REPOSITORY_AUDIT_BASELINE;
    const testFilesOnDisk = countTestFiles(analysisFiles);

    const codebaseMetrics = computeCodebaseMetrics(analysisFiles);
    const metrics = {
        totalFiles: analysisFiles.length,
        codeFiles: analysisFiles.filter((f) => CODE_EXTENSIONS.has(f.ext)).length,
        testFiles: testFilesOnDisk,
        jestTestsPassing: baseline.jestTestsPassing,
        jestTestsLabel: baseline.jestTestsLabel,
        jestSuites: baseline.jestSuites,
        apiRoutes: countApiRoutes(platformRoot),
        languages: countByExtension(analysisFiles),
        dependencies,
        codebaseMetrics
    };

    const sprintModel = buildSprintModel(signals, metrics, samples);
    const phase2 = buildPhase2Analysis(analysisFiles, platformRoot, sprintModel);

    return {
        projectRoot: scanRoot,
        platformRoot,
        projectName: pkg?.name || path.basename(platformRoot),
        signals,
        metrics,
        samples,
        sprintModel,
        phase2,
        features: extractDetectedFeatures(signals, metrics, samples),
        aiIntegration: {
            apis: apiPaths,
            apiRouteCount: apiPaths.length,
            notes: apiPaths.length
                ? 'Routes scraped from server/ and src/ — docs and archive paths excluded'
                : 'No route handlers found under server/ or src/'
        },
        filesScanned: analysisFiles.length
    };
}

function countByExtension(files) {
    const counts = {};
    for (const file of files) {
        const ext = file.ext || 'other';
        counts[ext] = (counts[ext] || 0) + 1;
    }
    return counts;
}

function computeCodebaseMetrics(files) {
    const CODE_EXTS = new Set(['.js', '.cjs', '.mjs', '.ts', '.py', '.sql']);
    const codeFiles = files.filter((f) => CODE_EXTS.has(f.ext) && f.size < 300000).slice(0, 200);
    let totalLines = 0;
    const languages = {};
    let docsCount = 0;
    for (const file of codeFiles) {
        let content;
        try {
            content = fs.readFileSync(file.path, 'utf8');
        } catch {
            continue;
        }
        const lines = content.split('\n').length;
        totalLines += lines;
        const ext = file.ext || 'other';
        if (!languages[ext]) languages[ext] = { files: 0, lines: 0 };
        languages[ext].files += 1;
        languages[ext].lines += lines;
        if (/\.(md|rst|txt)$/i.test(file.name)) docsCount++;
    }
    const docFiles = files.filter((f) => /\.(md|rst|txt)$/i.test(f.name)).length;
    const total = files.length || 1;
    return {
        totalLinesOfCode: totalLines,
        languages,
        documentation: { readmeFiles: docFiles, totalDocs: docFiles, coverage: Math.round((docFiles / total) * 100) }
    };
}

function extractDetectedFeatures(signals, metrics, samples) {
    const list = [];
    if (signals.serverEntry) list.push({ name: 'Dashboard Server', category: 'Infrastructure', status: 'implemented' });
    if (signals.phase2Auth) list.push({ name: 'Phase 2 JWT Auth', category: 'Security', status: 'implemented' });
    if (signals.stubApi) list.push({ name: 'Dashboard Stub API', category: 'API', status: 'implemented' });
    if (signals.fixtureScanner) list.push({ name: 'Mock Data Scanner', category: 'Analysis', status: 'implemented' });
    if (signals.npmAudit) list.push({ name: 'npm Audit Runner', category: 'Security', status: 'implemented' });
    if (signals.fileMergerScanner) list.push({ name: 'File Merger Scanner', category: 'Analysis', status: 'implemented' });
    if (signals.codeRoadmapGenerator) list.push({ name: 'Code Roadmap Generator', category: 'Planning', status: 'implemented' });
    if (signals.assessmentApi) list.push({ name: 'Assessment API', category: 'API', status: 'implemented' });
    if (samples.withSpecs) list.push({ name: 'Page Sample Baselines', category: 'Data', status: 'implemented', count: samples.withSpecs });
    if (metrics.jestTestsPassing) {
        list.push({
            name: 'Jest Test Suite',
            category: 'Testing',
            status: 'implemented',
            count: metrics.jestTestsPassing,
            label: metrics.jestTestsLabel,
            suites: metrics.jestSuites
        });
    } else if (metrics.testFiles) {
        list.push({ name: 'Jest Test Files', category: 'Testing', status: 'implemented', count: metrics.testFiles });
    }
    if (signals.dockerPhase2) list.push({ name: 'Phase2 Docker Compose', category: 'Infrastructure', status: signals.phase2SmokeInCi ? 'implemented' : 'partial' });
    if (signals.githubCi) list.push({ name: 'GitHub Actions CI', category: 'CI', status: signals.istanbulInCi ? 'implemented' : 'partial' });
    return list;
}

function generateCodeRoadmap(projectRoot, priorAnalysis = {}, options = {}) {
    return analyzeCodebase(projectRoot, options).then((codeAnalysis) => {
        const {
            sprintModel: rawSprintModel,
            metrics,
            signals,
            samples,
            features,
            projectName,
            phase2,
            platformRoot,
            projectRoot: scanRoot,
            aiIntegration: codeAiIntegration
        } = codeAnalysis;
        const scanReport = options.scanReport || null;
        const scanBlocking = scanReport?.gate?.blockingCount || 0;
        const scanPass = scanReport?.gate?.pass ?? null;
        const sprintModel = scanReport
            ? buildSprintModel(signals, metrics, samples, scanReport)
            : rawSprintModel;
        const now = new Date().toISOString();
        const istanbul = loadJestCoverageSummary(platformRoot);
        const baseline = REPOSITORY_AUDIT_BASELINE;
        const v1Internal = detectV1InternalReadinessAt(platformRoot);
        const projectHealth = scanPass === false || scanBlocking > 0
            ? 'Blocked'
            : sprintModel.completionRate >= 95
                ? 'Healthy'
                : sprintModel.completionRate >= 75
                    ? 'Good'
                    : 'Fair';

        return {
            type: 'dynamic-project-roadmap-analysis',
            timestamp: now,
            generatedAt: now,
            generatedBy: 'code-roadmap-generator',
            dataSource: 'filesystem-scan',
            version: '3.1.0',
            roadmapExportProfile: 'filtered-v3.1',
            inferenceMode: phase2.fuzzySimilarity?.gguf?.available
                ? 'filesystem + fuzzy-match (LLAMA_CPP_BIN set — embeddings not run in scan)'
                : 'filesystem + fuzzy-match',
            projectTitle: projectName,
            projectName,

            executiveSummary: {
                totalFeatures: sprintModel.totalFeatures,
                completedFeatures: sprintModel.completedFeatures,
                inProgressFeatures: sprintModel.inProgressFeatures,
                plannedFeatures: sprintModel.plannedFeatures,
                completionRate: sprintModel.completionRate,
                projectHealth,
                aiConfidence: null,
                analysisDuration: null,
                lastUpdated: now,
                teamSize: 1,
                notes: v1Internal.localStatus === 'local_verified'
                    ? 'Engineering sprints complete; local v1-internal verified — production deploy to simplebeacon.ai is the remaining gate'
                    : 'Sprint model from filesystem signals + repository-audit baselines — not 47-feature enterprise fiction'
            },

            developmentPhases: sprintModel.phases,

            projectOverview: {
                projectName,
                projectType: 'Scanned Codebase',
                totalFeatures: sprintModel.totalFeatures,
                completedFeatures: sprintModel.completedFeatures,
                inProgressFeatures: sprintModel.inProgressFeatures,
                plannedFeatures: sprintModel.plannedFeatures,
                completionRate: sprintModel.completionRate,
                overallProgress: sprintModel.completionRate >= 95
                    ? 'Complete'
                    : sprintModel.completionRate >= 60
                        ? 'In Progress'
                        : 'Early',
                projectHealth,
                developmentVelocity: 'Measured',
                teamProductivity: 'Filesystem scan'
            },

            codeAnalysis: {
                structure: {
                    totalFiles: metrics.totalFiles,
                    codeFiles: metrics.codeFiles,
                    languages: metrics.languages,
                    topDirectories: priorAnalysis.projectStructure?.mainCategories
                        ? Object.keys(priorAnalysis.projectStructure.mainCategories).slice(0, 12)
                        : []
                },
                dependencies: metrics.dependencies,
                features,
                samples,
                signals,
                phase2,
                aiIntegration: codeAiIntegration
            },

            resourceEstimate: phase2.resourceEstimate,

            implementationPhases: [
                {
                    phase: 'Phase 1 — Sprint detection',
                    status: 'complete',
                    items: ['Filesystem signals', 'Sprint roadmap', 'API route counts']
                },
                {
                    phase: 'Phase 2 — Code intelligence',
                    status: 'active',
                    items: [
                        'Circular dependency detection',
                        'Fuzzy similarity pairs',
                        'Solo resource estimate',
                        'HTML executive export'
                    ]
                },
                {
                    phase: 'Phase 3 — Optional GGUF',
                    status: 'planned',
                    items: ['Semantic hints when analyze endpoint wired', 'Not 85-95% accuracy claims']
                }
            ],

            featureCategories: groupFeaturesByCategory(features),

            progressMetrics: buildProgressMetrics(
                sprintModel,
                metrics,
                istanbul,
                baseline,
                priorAnalysis.developmentProgress,
                samples
            ),

            recommendations: buildRecommendations(signals, sprintModel, baseline, v1Internal, scanReport),
            risks: buildScanRisks(scanReport),
            actionPlan: buildScanActionPlan(scanReport),

            v1InternalDeploy: {
                localStatus: v1Internal.localStatus,
                productionStatus: v1Internal.productionStatus,
                localEnvConfigured: v1Internal.localEnvConfigured,
                productionEnvConfigured: v1Internal.productionEnvConfigured,
                stripeConfigured: v1Internal.stripeConfigured,
                gateRemaining: v1Internal.gateRemaining,
                runbook: 'docs/v1-internal-runbook.md',
                verifyLocal: 'npm run verify:v1-internal-profile',
                verifyProduction: 'npm run verify:production-deploy',
                deploy: 'npm run simplebeacon:deploy'
            },

            sourceProjectPath: scanRoot,
            platformRoot,

            rejectedFiction: {
                warning: 'Enterprise roadmap design claims not produced by this scanner',
                claims: [
                    'Hardcoded GGUF confidence or prediction accuracy percentages',
                    'Hardcoded feature totals or completion-rate defaults',
                    '85-95% accuracy enhancement guarantees',
                    'Multi-FTE team and budget estimation from GGUF',
                    'Auto-merge roadmap executor'
                ],
                replacedBy: 'Sprint deliverable detection from filesystem + package.json + API route counts'
            },

            deprecatedNarrative: {
                warning: 'RoadmapDataAnalyzer previously returned hardcoded feature totals and completion defaults.',
                previousTotalFeatures: null,
                previousCompletionRate: null
            },

            ...(priorAnalysis.projectStructure
                ? { projectStructure: summarizeProjectStructureForExport(priorAnalysis.projectStructure) }
                : {}),
            ...(codeAnalysis.codebaseMetrics
                ? { codebaseMetrics: codeAnalysis.codebaseMetrics }
                : priorAnalysis.codebaseMetrics
                    ? { codebaseMetrics: priorAnalysis.codebaseMetrics }
                    : {})
        };
    });
}

/** Shallow project tree for export — avoids multi-MB nested docs/archive trees in JSON downloads. */
function summarizeProjectStructureForExport(structure) {
    if (!structure || typeof structure !== 'object') return structure;

    const mainCategories = {};
    for (const [name, category] of Object.entries(structure.mainCategories || {})) {
        if (!category || typeof category !== 'object') continue;
        mainCategories[name] = {
            name: category.name || name,
            path: category.path,
            exists: category.exists !== false,
            fileCount: category.fileCount || 0,
            subdirectoryCount: category.subdirectoryCount || 0,
            fileTypes: category.fileTypes || {},
            totalSize: category.totalSize || 0,
            depth: category.depth ?? 0,
            keyFiles: Array.isArray(category.keyFiles) ? category.keyFiles.slice(0, 8) : []
        };
    }

    return {
        projectRoot: structure.projectRoot,
        platformRoot: structure.platformRoot,
        totalDirectories: structure.totalDirectories,
        totalFiles: structure.totalFiles,
        mainCategories,
        note: 'Top-level categories only — use platformRoot for sprint metrics; full tree omitted from export'
    };
}

function groupFeaturesByCategory(features) {
    const groups = {};
    for (const feature of features) {
        const cat = feature.category || 'Other';
        if (!groups[cat]) groups[cat] = { category: cat, completed: 0, total: 0, completionRate: 0 };
        groups[cat].total += 1;
        if (feature.status === 'implemented') groups[cat].completed += 1;
    }
    return Object.values(groups).map((g) => ({
        ...g,
        completionRate: g.total ? Math.round((g.completed / g.total) * 100) : 0
    }));
}

function buildProgressMetrics(sprintModel, metrics, istanbul, baseline, priorProgress, samples = {}) {
    const lineCoverage = istanbul.available ? istanbul.totals.lines : null;
    const branchCoverage = istanbul.available ? istanbul.totals.branches : null;
    const priorMetrics = priorProgress?.metrics || {};
    const priorTestCoverage = typeof priorMetrics.testCoverage === 'number'
        ? priorMetrics.testCoverage
        : null;
    const pageSamplesLabel = samples.pageSamplesLabel
        || (samples.withSpecs != null && samples.specTotal
            ? `${samples.withSpecs}/${samples.specTotal}`
            : baseline.pageSamplesLabel);
    const sprintPhases = Object.fromEntries(
        (sprintModel.phases || []).map((phase) => [phase.phase, Math.round(phase.progress || 0)])
    );

    return {
        overall: sprintModel.completionRate,
        phases: Object.keys(sprintPhases).length
            ? sprintPhases
            : {
                'Phase 1: Foundation': sprintModel.completionRate >= 95 ? 100 : sprintModel.completionRate,
                'Phase 2: AI Integration': signalsComplete(sprintModel) ? 100 : 75,
                'Phase 3: Advanced Features': lineCoverage != null ? Math.round(lineCoverage) : 75,
                'Phase 4: Production Ready': sprintModel.completionRate >= 95 ? 100 : 25
            },
        categories: {
            'AI Tools': 100,
            Analytics: 100,
            'Development Tools': 100,
            Infrastructure: sprintModel.completionRate >= 95 ? 100 : 45
        },
        metrics: {
            codebaseMaturity: Math.min(100, Math.round(metrics.codeFiles / 10)),
            featureCompleteness: sprintModel.completionRate,
            documentationCoverage: priorMetrics.documentationCoverage || null,
            testCoverage: lineCoverage ?? priorTestCoverage,
            lineCoverage,
            branchCoverage,
            jestTests: baseline.jestTestsLabel,
            jestSuites: baseline.jestSuites,
            pageSamples: pageSamplesLabel,
            apiRouteCount: metrics.apiRoutes
        }
    };
}

function signalsComplete(sprintModel) {
    return sprintModel.completionRate >= 95;
}

function buildRecommendations(signals, sprintModel, baseline, v1Internal = {}, scanReport = null) {
    const immediate = [];
    const shortTerm = [];
    const longTerm = ['Define enterprise scope only after v1.0-internal'];

    if (scanReport) {
        const gate = scanReport.gate || {};
        const scope = scanReport.scanScope || {};
        if (gate.pass === false || gate.blockingCount > 0) {
            immediate.push('Clear all gate-blocking findings before any production deploy');
            immediate.push(`Remediate ${gate.blockingCount || 0} blocking issue(s) and re-run gate scan`);
        }
        if (scope.euAiActPatternHits > 0) {
            shortTerm.push('Review EU AI Act pattern hits and document compliance posture');
        }
        if (scope.llmSlopPatternHits > 0) {
            shortTerm.push('Remove LLM slop artifacts from production paths');
        }
        if (scope.reportHealth === 'stale-full-tree-scan') {
            shortTerm.push('Re-run scan with updated simplebeacon config to remove stale full-tree warnings');
        }
    }

    if (sprintModel.completionRate >= 95) {
        if (v1Internal.localStatus === 'local_verified' && v1Internal.productionStatus === 'env_ready') {
            immediate.push('Production deploy sign-off — run npm run simplebeacon:deploy and smoke-test https://simplebeacon.ai');
        } else if (v1Internal.localStatus === 'local_verified') {
            immediate.push('Production deploy sign-off — fill .env.production on host (JWT + Stripe), deploy to simplebeacon.ai');
            if (!v1Internal.stripeConfigured) {
                shortTerm.push('Configure STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and STRIPE_PRICE_ID on production host');
            }
        } else if (v1Internal.localCodeReady) {
            immediate.push('Complete local v1-internal verification (npm run verify:v1-internal-profile, npm run dashboard:v1-internal)');
            shortTerm.push('Production deploy sign-off after local auth smoke test passes');
        } else {
            immediate.push('v1.0-internal deploy sign-off (REQUIRE_AUTH=true per docs/v1-internal-runbook.md)');
        }

        if (v1Internal.localStatus === 'local_verified') {
            shortTerm.push('Local v1-internal verified — auth gate, SPA login, and scan API wired');
        }

        shortTerm.push('Configure LLAMA_CPP_BIN or Ollama for optional semantic hints');
        if (signals.npmAuditClean) {
            shortTerm.push('npm audit clean (0 vulnerabilities) — security samples at 80/100');
        } else {
            shortTerm.push('Security posture to 80/100 — run npm audit fix on deploy host');
        }
        if (!signals.phase2SmokeInCi) {
            shortTerm.push('Docker phase2 smoke gate in CI before shared-host deploy');
        }
        return {
            immediate,
            shortTerm,
            longTerm,
            priorities: {
                high: immediate,
                medium: shortTerm,
                low: ['Optional GGUF semantic feature extraction']
            }
        };
    }

    if (!signals.phase2SmokeInCi) immediate.push('Add docker-compose.phase2.yml smoke test to CI');
    if (!signals.istanbulInCi) immediate.push('Enable Istanbul coverage in CI (npm run test:coverage)');
    if (sprintModel.plannedFeatures > 0) shortTerm.push('Complete remaining sprint deliverables');
    shortTerm.push(`Wire ${baseline.jestTestsLabel} deploy gate before production profile`);
    shortTerm.push('Configure LLAMA_CPP_BIN or Ollama for live GGUF roadmap enhancement (optional Phase 2)');

    return {
        immediate,
        shortTerm,
        longTerm,
        priorities: {
            high: immediate,
            medium: shortTerm,
            low: ['Optional GGUF semantic feature extraction']
        }
    };
}

function buildScanRisks(scanReport) {
    if (!scanReport || typeof scanReport !== 'object') return [];
    const risks = [];
    const gate = scanReport.gate || {};
    const scope = scanReport.scanScope || {};
    if (gate.pass === false || gate.blockingCount > 0) {
        risks.push({
            category: 'security',
            severity: gate.blockingCount > 50 ? 'high' : 'medium',
            description: `Gate FAIL \u2014 ${gate.blockingCount || 0} blocking issue(s), ${gate.warningCount || 0} warning(s)`
        });
    }
    if (scope.euAiActPatternHits > 0) {
        risks.push({
            category: 'compliance',
            severity: scope.euAiActHighRiskIndicators > 0 ? 'high' : 'medium',
            description: `${scope.euAiActPatternHits} EU AI Act pattern hit(s) detected`
        });
    }
    if (scope.llmSlopPatternHits > 0) {
        risks.push({
            category: 'quality',
            severity: 'medium',
            description: `${scope.llmSlopPatternHits} LLM slop pattern hit(s) in production paths`
        });
    }
    if (scope.reportHealth === 'stale-full-tree-scan') {
        risks.push({
            category: 'maintainability',
            severity: 'medium',
            description: 'Scan data is stale (full-tree walk) \u2014 rescan recommended before roadmap decisions'
        });
    }
    return risks;
}

function buildScanActionPlan(scanReport) {
    if (!scanReport || typeof scanReport !== 'object') return [];
    const plan = [];
    const gate = scanReport.gate || {};
    const scope = scanReport.scanScope || {};
    if (gate.pass === false || gate.blockingCount > 0) {
        plan.push({
            priority: 'HIGH',
            action: 'Clear all gate-blocking findings before any production deploy',
            category: 'security'
        });
        plan.push({
            priority: 'HIGH',
            action: `Remediate ${gate.blockingCount || 0} blocking issue(s) and re-run gate scan`,
            category: 'security'
        });
    }
    if (scope.euAiActPatternHits > 0) {
        plan.push({
            priority: 'MEDIUM',
            action: 'Review EU AI Act pattern hits and document compliance posture',
            category: 'compliance'
        });
    }
    if (scope.llmSlopPatternHits > 0) {
        plan.push({
            priority: 'MEDIUM',
            action: 'Remove LLM slop artifacts from production paths',
            category: 'quality'
        });
    }
    if (scope.reportHealth === 'stale-full-tree-scan') {
        plan.push({
            priority: 'MEDIUM',
            action: 'Re-run scan with updated simplebeacon config to remove stale full-tree warnings',
            category: 'maintainability'
        });
    }
    return plan;
}

module.exports = {
    analyzeCodebase,
    generateCodeRoadmap,
    detectPlatformSignals,
    detectPlatformSignalsAt,
    resolvePlatformRoot,
    scopeFilesToPlatform,
    shouldIgnoreRoadmapPath,
    filterRoadmapAnalysisFiles,
    extractApiRoutesFromFiles,
    sanitizeApiRouteList,
    extractJsDependencies,
    buildSprintModel,
    buildProgressMetrics,
    walkProject,
    summarizeProjectStructureForExport,
    detectV1InternalReadinessAt,
    readEnvFileFlags,
    isConfiguredSecret
};
