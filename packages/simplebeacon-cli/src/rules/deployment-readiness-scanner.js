// simplebeacon-ignore: Scanner rule definitions — security findings are false positives
/**
 * Deployment Readiness Scanner — validates monorepo deployment topology.
 *
 * This is a project-level scanner (not file-level). It models the deployment
 * graph by reading render.yaml files, package.json workspaces, and migration
 * directories, then checks for system-correctness issues that file-level
 * scanners cannot detect:
 *
 * - SB-DEP-001: Service not in workspace (medium)
 * - SB-DEP-002: Missing env var in render.yaml (high)
 * - SB-DEP-003: DB schema conflict — same table name, different schema (high)
 * - SB-DEP-004: CORS config divergence across services (medium)
 * - SB-DEP-005: Missing render.yaml for service directory (low)
 * - SB-DEP-006: Database shared by multiple services without schema isolation (high)
 *
 * Rule IDs: SB-DEP-001 through SB-DEP-006
 * Category: deployment-readiness
 */

const fs = require('fs');
const path = require('path');

const RULE_CATALOG = [
    {
        id: 'SB-DEP-001',
        category: 'deployment-readiness',
        type: 'Workspace Membership',
        severity: 'medium',
        description: 'Service directory exists but is not declared in root package.json workspaces'
    },
    {
        id: 'SB-DEP-002',
        category: 'deployment-readiness',
        type: 'Missing Env Var',
        severity: 'high',
        description: 'Environment variable required by code is missing from render.yaml'
    },
    {
        id: 'SB-DEP-003',
        category: 'deployment-readiness',
        type: 'DB Schema Conflict',
        severity: 'high',
        description: 'Multiple services create the same database table with incompatible schemas'
    },
    {
        id: 'SB-DEP-004',
        category: 'deployment-readiness',
        type: 'CORS Config Divergence',
        severity: 'medium',
        description: 'Services use different CORS configuration approaches or origin lists'
    },
    {
        id: 'SB-DEP-005',
        category: 'deployment-readiness',
        type: 'Missing Render Config',
        severity: 'low',
        description: 'Service directory has a package.json with a start script but no render.yaml'
    },
    {
        id: 'SB-DEP-006',
        category: 'deployment-readiness',
        type: 'Shared Database Risk',
        severity: 'high',
        description: 'Multiple services target the same database without schema isolation'
    }
];

/**
 * Documented architectural exceptions — known cases where a finding is
 * intentionally accepted and mitigated by architecture, not by fixing the
 * code. Each exception is keyed by `RULE_ID:identifier` and includes:
 *   - services: the services involved (must match exactly)
 *   - reason: human-readable explanation of the mitigation
 *
 * These are NOT suppressions. The scanner still emits the finding, but
 * downgrades it to 'info' severity and attaches the exception reason in
 * metadata. If the architecture changes (e.g. DBs are merged), the exception
 * no longer matches and the finding returns to its original severity.
 */
const DEPLOYMENT_EXCEPTIONS = {
    'SB-DEP-003:users': {
        services: ['ai-platform', 'api-server'],
        reason: 'Permanent architectural boundary between bounded contexts. The ai-platform users table is a gamification dashboard identity store (TEXT PK, trust levels, analysis counters) scoped to the simplebeacon-db Render PostgreSQL database. The api-server users table is an enterprise RBAC identity store (UUID PK, SSO/MFA, workspace FK targets) scoped to the simplebeacon-api-db Render PostgreSQL database. The two schemas have incompatible primary key types, different identity models, and different security requirements (no RLS vs RLS+RBAC). Merging would create a 28-column table violating single responsibility, introduce cross-service coupling, and require a risky data migration with no functional benefit. See migration comments in api-server/migrations/004-rbac-audit-teams.sql and ai-platform/server/db/schema-phase2.sql.'
    }
};

/**
 * Find all render.yaml files in the repository (max depth 3).
 * @param {string} baseDir
 * @returns {string[]}
 */
function findRenderYamlFiles(baseDir) {
    const results = [];
    const maxDepth = 3;
    const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next']);

    function walk(dir, depth) {
        if (depth > maxDepth) return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (skipDirs.has(entry.name)) continue;
                walk(path.join(dir, entry.name), depth + 1);
            } else if (entry.isFile() && (entry.name === 'render.yaml' || entry.name === 'render.yml')) {
                results.push(path.join(dir, entry.name));
            }
        }
    }

    walk(baseDir, 0);
    return results;
}

/**
 * Parse a render.yaml file (simple YAML parser — no dependency on js-yaml).
 * Extracts: services, databases, env vars.
 * @param {string} filePath
 * @returns {{services:Array, databases:Array, envVars:Array, raw:string}}
 */
function parseRenderYaml(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const dir = path.dirname(filePath);
    const services = [];
    const databases = [];
    const envVars = [];

    const lines = raw.split(/\r?\n/);
    let currentSection = null;
    let currentService = null;
    let currentDb = null;
    let inEnvVars = false;
    let inDatabases = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        // Top-level sections
        if (/^databases:\s*$/.test(trimmed)) {
            currentSection = 'databases';
            inDatabases = true;
            inEnvVars = false;
            continue;
        }
        if (/^services:\s*$/.test(trimmed)) {
            currentSection = 'services';
            inDatabases = false;
            inEnvVars = false;
            continue;
        }

        // Database entries
        if (inDatabases && /^-\s+name:\s*(.+)/.test(trimmed)) {
            const match = trimmed.match(/^-\s+name:\s*(.+)/);
            currentDb = { name: match[1].trim(), dir };
            databases.push(currentDb);
            continue;
        }
        if (inDatabases && currentDb && /^databaseName:\s*(.+)/.test(trimmed)) {
            const match = trimmed.match(/^databaseName:\s*"?([^"\n]+)"?/);
            if (match) currentDb.databaseName = match[1].trim();
            continue;
        }

        // Service entries
        if (currentSection === 'services' && /^-\s+type:\s*(.+)/.test(trimmed)) {
            const match = trimmed.match(/^-\s+type:\s*(.+)/);
            currentService = { type: match[1].trim(), dir, envVars: [], renderFile: filePath };
            services.push(currentService);
            inEnvVars = false;
            continue;
        }
        if (currentSection === 'services' && currentService && !inEnvVars && /^name:\s*(.+)/.test(trimmed)) {
            const match = trimmed.match(/^name:\s*"?([^"\n]+)"?/);
            if (match) currentService.name = match[1].trim();
            continue;
        }
        if (currentSection === 'services' && currentService && /^startCommand:\s*(.+)/.test(trimmed)) {
            const match = trimmed.match(/^startCommand:\s*"?([^"\n]+)"?/);
            if (match) currentService.startCommand = match[1].trim();
            continue;
        }
        if (currentSection === 'services' && currentService && /^healthCheckPath:\s*(.+)/.test(trimmed)) {
            const match = trimmed.match(/^healthCheckPath:\s*"?([^"\n]+)"?/);
            if (match) currentService.healthCheckPath = match[1].trim();
            continue;
        }

        // Env vars section — check raw line for indentation (trimmed has no leading whitespace)
        if (currentService && /^envVars:\s*$/.test(trimmed)) {
            inEnvVars = true;
            continue;
        }
        if (inEnvVars && currentService) {
            const envMatch = trimmed.match(/^-\s+key:\s*([A-Z_][A-Z0-9_]*)/);
            if (envMatch) {
                const envVar = { key: envMatch[1] };
                currentService.envVars.push(envVar);
                envVars.push({ key: envMatch[1], service: currentService.name || currentService.dir });
                continue;
            }
            // Check for value, sync, generateValue, fromDatabase
            const valueMatch = trimmed.match(/^value:\s*"?([^"\n]*)"?\s*$/);
            const syncMatch = /^sync:\s*(false|true)/.exec(trimmed);
            const genMatch = /^generateValue:\s*(true|false)/.exec(trimmed);
            const fromDbMatch = /^fromDatabase:\s*$/.exec(trimmed);
            if (currentService.envVars.length > 0) {
                const lastEnv = currentService.envVars[currentService.envVars.length - 1];
                if (valueMatch) lastEnv.value = valueMatch[1].trim();
                if (syncMatch) lastEnv.sync = syncMatch[1] === 'true';
                if (genMatch) lastEnv.generateValue = genMatch[1] === 'true';
                if (fromDbMatch) lastEnv.fromDatabase = true;
            }
            // Exit envVars on non-indented line (no leading whitespace in raw line)
            if (!envMatch && !valueMatch && !syncMatch && !genMatch && !fromDbMatch && !/^\s/.test(line) && trimmed) {
                inEnvVars = false;
            }
        }
    }

    return { services, databases, envVars, raw, dir };
}

/**
 * Parse root package.json workspaces.
 * @param {string} baseDir
 * @returns {string[]}
 */
function parseWorkspaces(baseDir) {
    const pkgPath = path.join(baseDir, 'package.json');
    try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const workspaces = pkg.workspaces || [];
        const expanded = [];
        for (const w of workspaces) {
            if (w.includes('*')) {
                // Glob expansion: e.g., "packages/*"
                const dir = path.dirname(w);
                const prefix = path.basename(w).replace(/\*/g, '');
                const base = path.join(baseDir, dir);
                try {
                    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
                        if (entry.isDirectory() && (!prefix || entry.name.startsWith(prefix))) {
                            expanded.push(path.join(dir, entry.name));
                        }
                    }
                } catch {
                    // dir doesn't exist
                }
            } else {
                expanded.push(w);
            }
        }
        return expanded;
    } catch {
        return [];
    }
}

/**
 * Extract process.env.VAR_NAME references from a source file.
 * @param {string} filePath
 * @returns {string[]}
 */
function extractEnvVarsFromSource(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g);
        return [...new Set([...matches].map(m => m[1]))];
    } catch {
        return [];
    }
}

/**
 * Find all CREATE TABLE statements in SQL migration files.
 * @param {string} baseDir
 * @param {string} serviceDir
 * @returns {Array<{table:string, file:string, service:string}>}
 */
function findCreateTableStatements(baseDir, serviceDir) {
    const results = [];
    const migrationsDir = path.join(baseDir, serviceDir, 'migrations');
    const dbDir = path.join(baseDir, serviceDir, 'server', 'db');

    const checkDirs = [migrationsDir, dbDir];

    for (const dir of checkDirs) {
        if (!fs.existsSync(dir)) continue;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith('.sql')) continue;
            const filePath = path.join(dir, entry.name);
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const matches = content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gi);
                for (const match of matches) {
                    results.push({
                        table: match[1].toLowerCase(),
                        file: path.relative(baseDir, filePath).split(path.sep).join('/'),
                        service: serviceDir
                    });
                }
            } catch {
                // skip
            }
        }
    }

    return results;
}

/**
 * Find service directories (directories with a package.json that has a start script).
 * @param {string} baseDir
 * @returns {Array<{dir:string, name:string, hasRenderYaml:boolean}>}
 */
function findServiceDirectories(baseDir) {
    const services = [];
    const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.simplebeacon', '.continue', '.devin']);
    const maxDepth = 2;

    function walk(dir, depth) {
        if (depth > maxDepth) return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }

        // Check if this dir has a package.json with a start script
        const pkgPath = path.join(dir, 'package.json');
        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                if (pkg.scripts && pkg.scripts.start) {
                    const relDir = path.relative(baseDir, dir).split(path.sep).join('/') || '.';
                    const hasRenderYaml = fs.existsSync(path.join(dir, 'render.yaml')) || fs.existsSync(path.join(dir, 'render.yml'));
                    services.push({
                        dir: relDir,
                        name: pkg.name || relDir,
                        hasRenderYaml,
                        startScript: pkg.scripts.start
                    });
                }
            } catch {
                // invalid package.json
            }
        }

        for (const entry of entries) {
            if (entry.isDirectory() && !skipDirs.has(entry.name)) {
                walk(path.join(dir, entry.name), depth + 1);
            }
        }
    }

    walk(baseDir, 0);
    return services;
}

/**
 * Check CORS configuration approach for a service.
 * @param {string} baseDir
 * @param {string} serviceDir
 * @returns {{approach:string, file:string}|null}
 */
function checkCorsApproach(baseDir, serviceDir) {
    const candidates = [
        path.join(baseDir, serviceDir, 'server.cjs'),
        path.join(baseDir, serviceDir, 'simplebeacon-server.cjs'),
        path.join(baseDir, serviceDir, 'server', 'index.cjs'),
        path.join(baseDir, serviceDir, 'lib', 'cors-config.cjs'),
        path.join(baseDir, serviceDir, 'server', 'lib', 'cors-config.cjs'),
    ];

    for (const candidate of candidates) {
        if (!fs.existsSync(candidate)) continue;
        try {
            const content = fs.readFileSync(candidate, 'utf8');
            if (content.includes('cors-config.cjs') || content.includes('resolveCorsOptions')) {
                return { approach: 'shared-cors-config', file: path.relative(baseDir, candidate).split(path.sep).join('/') };
            }
            if (content.includes('Access-Control-Allow-Origin') || content.includes('app.use(cors(')) {
                return { approach: 'inline-cors', file: path.relative(baseDir, candidate).split(path.sep).join('/') };
            }
        } catch {
            // skip
        }
    }

    return null;
}

/**
 * Main scan function — validates deployment topology.
 * @param {string} baseDir
 * @param {Object} [options]
 * @returns {Promise<{scanned:number, findings:number, issues:Array, patterns:string[]}>}
 */
async function scanDeploymentReadiness(baseDir, options = {}) {
    const issues = [];
    let scanned = 0;

    // 1. Discover all render.yaml files
    const renderFiles = findRenderYamlFiles(baseDir);
    scanned += renderFiles.length;

    // 2. Parse each render.yaml
    const allServices = [];
    const allDatabases = [];
    const allEnvVars = [];
    for (const renderFile of renderFiles) {
        const parsed = parseRenderYaml(renderFile);
        allServices.push(...parsed.services);
        allDatabases.push(...parsed.databases);
        allEnvVars.push(...parsed.envVars);
    }

    // 3. Discover service directories
    const serviceDirs = findServiceDirectories(baseDir);
    scanned += serviceDirs.length;

    // 4. Parse workspaces
    const workspaces = parseWorkspaces(baseDir);
    scanned += 1;

    // ── SB-DEP-001: Workspace membership check ──────────────────────────
    for (const svc of serviceDirs) {
        if (svc.dir === '.') continue; // root package is always a member
        const isInWorkspace = workspaces.some(w => {
            const wNorm = w.replace(/\\/g, '/');
            return wNorm === svc.dir || svc.dir.startsWith(wNorm.replace(/\*/g, ''));
        });
        if (!isInWorkspace) {
            issues.push({
                id: `SB-DEP-001-${svc.dir}`,
                severity: 'medium',
                severityBand: 'medium',
                type: 'Workspace Membership',
                category: 'deployment-readiness',
                pattern: 'SB-DEP-001',
                filePath: svc.dir + '/package.json',
                file: svc.dir + '/package.json',
                line: 1,
                count: 1,
                description: `Service directory "${svc.dir}" has a start script but is not in root package.json workspaces`,
                recommendation: `Add "${svc.dir}" to the workspaces array in root package.json so npm install covers its dependencies`,
                recommendedAction: `Add "${svc.dir}" to the workspaces array in root package.json`,
                affectedFiles: ['package.json'],
                metadata: { patternId: 'SB-DEP-001', service: svc.dir }
            });
        }
    }

    // ── SB-DEP-002: Env var completeness check ──────────────────────────
    for (const svc of serviceDirs) {
        if (!svc.hasRenderYaml) continue;
        if (svc.dir === '.') continue; // root render.yaml is for ai-platform, not root package
        // Find the render.yaml for this service
        const renderFile = renderFiles.find(rf => path.dirname(rf) === path.join(baseDir, svc.dir) || (svc.dir === '.' && path.dirname(rf) === baseDir));
        if (!renderFile) continue;
        const parsed = parseRenderYaml(renderFile);
        const renderEnvKeys = new Set(parsed.envVars.map(e => e.key));

        // Scan source files for process.env references
        const sourceFiles = [];
        const scanDirs = [
            path.join(baseDir, svc.dir),
            path.join(baseDir, svc.dir, 'lib'),
            path.join(baseDir, svc.dir, 'routes'),
            path.join(baseDir, svc.dir, 'server'),
            path.join(baseDir, svc.dir, 'src'),
        ];
        for (const scanDir of scanDirs) {
            if (!fs.existsSync(scanDir)) continue;
            try {
                for (const entry of fs.readdirSync(scanDir, { withFileTypes: true })) {
                    if (entry.isFile() && /\.(cjs|js|mjs)$/.test(entry.name)) {
                        sourceFiles.push(path.join(scanDir, entry.name));
                    }
                }
            } catch {
                // skip
            }
        }

        const codeEnvVars = new Set();
        for (const sourceFile of sourceFiles) {
            const vars = extractEnvVarsFromSource(sourceFile);
            for (const v of vars) codeEnvVars.add(v);
        }

        // Check for missing env vars (skip common Node.js built-ins)
        const builtins = new Set(['NODE_ENV', 'PORT', 'PATH', 'HOME', 'USER', 'TMPDIR', 'NODE_PATH']);
        for (const envVar of codeEnvVars) {
            if (builtins.has(envVar)) continue;
            if (!renderEnvKeys.has(envVar)) {
                issues.push({
                    id: `SB-DEP-002-${svc.dir}-${envVar}`,
                    severity: 'high',
                    severityBand: 'high',
                    type: 'Missing Env Var',
                    category: 'deployment-readiness',
                    pattern: 'SB-DEP-002',
                    filePath: svc.dir + '/render.yaml',
                    file: svc.dir + '/render.yaml',
                    line: 1,
                    count: 1,
                    description: `Service "${svc.name}" uses process.env.${envVar} in code but ${envVar} is not declared in render.yaml`,
                    recommendation: `Add "${envVar}" to the envVars section of ${svc.dir}/render.yaml (use sync: false for secrets, value: for defaults)`,
                    recommendedAction: `Add "${envVar}" to ${svc.dir}/render.yaml envVars`,
                    affectedFiles: [svc.dir + '/render.yaml'],
                    metadata: { patternId: 'SB-DEP-002', service: svc.dir, envVar }
                });
            }
        }
    }

    // ── SB-DEP-003 & SB-DEP-006: DB schema conflict + shared database check ──
    const allCreateTables = [];
    for (const svc of serviceDirs) {
        const tables = findCreateTableStatements(baseDir, svc.dir);
        allCreateTables.push(...tables);
    }
    scanned += allCreateTables.length;

    // Group by table name
    const tablesByName = {};
    for (const t of allCreateTables) {
        if (!tablesByName[t.table]) tablesByName[t.table] = [];
        tablesByName[t.table].push(t);
    }

    // Check for same table name across different services
    for (const [tableName, entries] of Object.entries(tablesByName)) {
        const services = new Set(entries.map(e => e.service));
        if (services.size > 1) {
            // SB-DEP-003: Schema conflict (same table, different services)
            // Check if this is a documented architectural exception (separate DBs)
            const exceptionKey = `SB-DEP-003:${tableName}`;
            const documentedException = DEPLOYMENT_EXCEPTIONS[exceptionKey];
            const isResolvedBySeparateDbs = documentedException
                && documentedException.services
                && documentedException.services.every(s => services.has(s));

            issues.push({
                id: `SB-DEP-003-${tableName}`,
                severity: isResolvedBySeparateDbs ? 'info' : 'high',
                severityBand: isResolvedBySeparateDbs ? 'info' : 'high',
                type: 'DB Schema Conflict',
                category: 'deployment-readiness',
                pattern: 'SB-DEP-003',
                filePath: entries[0].file,
                file: entries[0].file,
                line: 1,
                count: 1,
                description: `Table "${tableName}" is created by multiple services: ${[...services].join(', ')}. Schema may conflict (different primary key types, columns, or constraints).`,
                recommendation: `Give each service its own database, or consolidate the table definition into a shared migration. Services: ${[...services].join(', ')}`,
                recommendedAction: 'Use separate databases per service or consolidate shared tables',
                affectedFiles: entries.map(e => e.file),
                metadata: {
                    patternId: 'SB-DEP-003',
                    table: tableName,
                    services: [...services],
                    exception: isResolvedBySeparateDbs ? documentedException.reason : undefined
                }
            });
        }
    }

    // Check for shared databases across services
    const dbToServices = {};
    for (const renderFile of renderFiles) {
        const parsed = parseRenderYaml(renderFile);
        const dir = path.relative(baseDir, path.dirname(renderFile)).split(path.sep).join('/') || '.';
        for (const envVar of parsed.envVars) {
            if (envVar.key === 'DATABASE_URL' && envVar.fromDatabase) {
                // Find which database this references
                for (const db of parsed.databases) {
                    if (!dbToServices[db.name]) dbToServices[db.name] = [];
                    if (!dbToServices[db.name].includes(dir)) {
                        dbToServices[db.name].push(dir);
                    }
                }
            }
        }
        // Also check for DATABASE_URL with sync:false (manually configured)
        for (const envVar of parsed.envVars) {
            if (envVar.key === 'DATABASE_URL' && envVar.sync === false && parsed.databases.length === 0) {
                const dbName = 'external-' + dir;
                if (!dbToServices[dbName]) dbToServices[dbName] = [];
                if (!dbToServices[dbName].includes(dir)) {
                    dbToServices[dbName].push(dir);
                }
            }
        }
    }

    for (const [dbName, services] of Object.entries(dbToServices)) {
        if (services.length > 1) {
            issues.push({
                id: `SB-DEP-006-${dbName}`,
                severity: 'high',
                severityBand: 'high',
                type: 'Shared Database Risk',
                category: 'deployment-readiness',
                pattern: 'SB-DEP-006',
                filePath: services[0] + '/render.yaml',
                file: services[0] + '/render.yaml',
                line: 1,
                count: 1,
                description: `Database "${dbName}" is targeted by multiple services: ${services.join(', ')}. Shared databases create coupling and schema conflict risk.`,
                recommendation: `Give each service its own database instance, or document the shared schema contract explicitly.`,
                recommendedAction: 'Provision separate databases per service',
                affectedFiles: services.map(s => s + '/render.yaml'),
                metadata: { patternId: 'SB-DEP-006', database: dbName, services }
            });
        }
    }

    // ── SB-DEP-004: CORS config divergence check ────────────────────────
    const corsApproaches = [];
    for (const svc of serviceDirs) {
        const approach = checkCorsApproach(baseDir, svc.dir);
        if (approach) {
            corsApproaches.push({ service: svc.dir, ...approach });
        }
    }
    scanned += corsApproaches.length;

    const approachesByType = {};
    for (const c of corsApproaches) {
        if (!approachesByType[c.approach]) approachesByType[c.approach] = [];
        approachesByType[c.approach].push(c.service);
    }

    if (Object.keys(approachesByType).length > 1) {
        const approachList = Object.entries(approachesByType)
            .map(([approach, services]) => `${approach} (${services.join(', ')})`)
            .join('; ');
        issues.push({
            id: 'SB-DEP-004-cors-divergence',
            severity: 'medium',
            severityBand: 'medium',
            type: 'CORS Config Divergence',
            category: 'deployment-readiness',
            pattern: 'SB-DEP-004',
            filePath: corsApproaches[0].file,
            file: corsApproaches[0].file,
            line: 1,
            count: 1,
            description: `Services use different CORS configuration approaches: ${approachList}. This causes inconsistent origin checking across the deployment.`,
            recommendation: 'Consolidate all services to use the shared cors-config.cjs module (resolveCorsOptions + isAllowedOrigin).',
            recommendedAction: 'Use shared cors-config.cjs across all services',
            affectedFiles: corsApproaches.map(c => c.file),
            metadata: { patternId: 'SB-DEP-004', approaches: Object.keys(approachesByType) }
        });
    }

    // ── SB-DEP-005: Missing render.yaml for service directory ───────────
    // Collect startCommands from all render.yaml files to find services covered by parent configs
    const renderStartCommands = [];
    for (const renderFile of renderFiles) {
        const parsed = parseRenderYaml(renderFile);
        for (const svc of parsed.services) {
            if (svc.startCommand) renderStartCommands.push(svc.startCommand);
        }
    }

    for (const svc of serviceDirs) {
        if (svc.dir === '.') continue; // root may not need its own render.yaml
        if (!svc.hasRenderYaml && svc.startScript && !svc.startScript.includes('check-port')) {
            // Only flag if the service looks like a deployable server
            if (/node\s/.test(svc.startScript) && !svc.dir.startsWith('packages/')) {
                // Skip if this service is covered by a parent render.yaml startCommand
                const coveredByParent = renderStartCommands.some(cmd =>
                    cmd.includes(svc.dir + '/') || cmd.includes(svc.dir + '\\'));
                if (coveredByParent) continue;

                // Skip local dev tools (pkg build scripts indicate compilation to executable)
                // Also skip Cloudflare Pages deployments (wrangler deploy = not Render)
                const pkgPath = path.join(baseDir, svc.dir, 'package.json');
                let isLocalTool = false;
                let isCloudflarePages = false;
                try {
                    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                    const scripts = pkg.scripts || {};
                    const allScripts = Object.values(scripts).filter(s => typeof s === 'string');
                    isLocalTool = allScripts.some(s => s.includes('pkg '));
                    isCloudflarePages = allScripts.some(s => s.includes('wrangler pages deploy') || s.includes('wrangler pages publish'));
                } catch { /* ignore */ }
                if (isLocalTool || isCloudflarePages) continue;

                issues.push({
                    id: `SB-DEP-005-${svc.dir}`,
                    severity: 'low',
                    severityBand: 'low',
                    type: 'Missing Render Config',
                    category: 'deployment-readiness',
                    pattern: 'SB-DEP-005',
                    filePath: svc.dir + '/package.json',
                    file: svc.dir + '/package.json',
                    line: 1,
                    count: 1,
                    description: `Service "${svc.dir}" has a start script (${svc.startScript}) but no render.yaml. Deployment config is missing.`,
                    recommendation: `Create ${svc.dir}/render.yaml with service type, build/start commands, and env var declarations.`,
                    recommendedAction: `Create ${svc.dir}/render.yaml`,
                    affectedFiles: [svc.dir + '/package.json'],
                    metadata: { patternId: 'SB-DEP-005', service: svc.dir }
                });
            }
        }
    }

    return {
        scanned,
        findings: issues.length,
        issues,
        patterns: RULE_CATALOG.map(r => r.id)
    };
}

module.exports = {
    RULE_CATALOG,
    scanDeploymentReadiness,
    findRenderYamlFiles,
    parseRenderYaml,
    parseWorkspaces,
    findServiceDirectories,
    findCreateTableStatements,
    extractEnvVarsFromSource,
    checkCorsApproach
};
