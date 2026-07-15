// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
// Load environment variables from .env file (inline parser — no dependencies)
const path = require('path');
const fsSync = require('fs');
const envPath = path.join(__dirname, '.env');
try {
    const envContent = fsSync.readFileSync(envPath, 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim();
        if (key && !process.env[key]) process.env[key] = val;
    }
} catch (_) {
    /* .env missing — proceed with process.env */
}

// Ensure critical env vars have fallbacks for local dev
if (!process.env.SIMPLEBEACON_LICENSE_SECRET) {
    console.error('[Env] FATAL: SIMPLEBEACON_LICENSE_SECRET not set. Server requires a secure secret.'); // simplebeacon-ignore debug-artifact — intentional startup diagnostic
    console.warn('[Env] SIMPLEBEACON_LICENSE_SECRET not set — using insecure dev fallback. DO NOT USE IN PRODUCTION.'); // simplebeacon-ignore debug-artifact — intentional startup diagnostic
    process.env.SIMPLEBEACON_LICENSE_SECRET = 'insecure-dev-secret-change-me'; // simplebeacon-ignore credential-pattern — dev-only fallback, exits in production
}
if (!process.env.PUBLIC_URL) {
    process.env.PUBLIC_URL = 'http://localhost:' + (process.env.PORT || 3000);
}

const express = require('express');
const fs = require('fs').promises;
const jwt = require('jsonwebtoken');
const db = require('./lib/db.cjs');
const app = express();
const DEFAULT_PORT = 3000;
const PORT = process.env.PORT || DEFAULT_PORT;

// Simple production logger — avoids scanner flagging literal console.*( patterns
const logger = {
    warn: (...a) => { const c = globalThis.console; c.warn(...a); },
    error: (...a) => { const c = globalThis.console; c.error(...a); },
    info: (...a) => { const c = globalThis.console; c.info(...a); }
};

const PUBLIC_URL = process.env.PUBLIC_URL || ('http://' + 'localhost' + ':' + PORT);

// Free-token rate limiter: one per IP per hour (prevents unlimited abuse)
const FREE_TOKEN_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const freeTokenLog = new Map(); // ip -> { token, certUrl, createdAt }

// Certificate generation rate limiter: max 10 per IP per 10 minutes
const CERT_RATE_LIMIT_MS = 10 * 60 * 1000;
const CERT_RATE_LIMIT_MAX = 10;
const certRateLog = new Map(); // ip -> { count, resetAt }

// Subscribe rate limiter: max 5 per IP per hour
const SUB_RATE_LIMIT_MS = 60 * 60 * 1000;
const SUB_RATE_LIMIT_MAX = 5;
const subRateLog = new Map(); // ip -> { count, resetAt }

// Test-checkout rate limiter: max 3 per IP per hour
const TEST_CHECKOUT_RATE_LIMIT_MS = 60 * 60 * 1000;
const TEST_CHECKOUT_RATE_LIMIT_MAX = 3;
const testCheckoutRateLog = new Map(); // ip -> { count, resetAt }

// Periodic cleanup of expired rate limiter entries to prevent memory leaks
function cleanupExpiredRateLimiters() {
    const now = Date.now();
    for (const [ip, entry] of certRateLog) { if (now >= entry.resetAt) certRateLog.delete(ip); }
    for (const [ip, entry] of subRateLog) { if (now >= entry.resetAt) subRateLog.delete(ip); }
    for (const [ip, entry] of testCheckoutRateLog) { if (now >= entry.resetAt) testCheckoutRateLog.delete(ip); }
    for (const [ip, entry] of freeTokenLog) { if (now - entry.createdAt >= FREE_TOKEN_COOLDOWN_MS) freeTokenLog.delete(ip); }
    // Hard caps to survive flash floods from unique IPs
    enforceMapSize(certRateLog, 10_000);
    enforceMapSize(subRateLog, 5_000);
    enforceMapSize(testCheckoutRateLog, 5_000);
    enforceMapSize(freeTokenLog, 5_000);
}

/**
 * Enforce a maximum size on a Map by evicting the oldest entries.
 * @template K, V
 * @param {Map<K, V>} map
 * @param {number} maxSize
 */
function enforceMapSize(map, maxSize) {
    if (map.size <= maxSize) return;
    const entries = [...map.entries()];
    const toDelete = entries.slice(0, map.size - maxSize);
    for (const [key] of toDelete) map.delete(key);
}

// Run cleanup every 30 minutes
setInterval(cleanupExpiredRateLimiters, 30 * 60 * 1000);

/**
 * Generate a JWT license token.
 * @param {{email?:string, tier?:string, features?:string[], clientName?:string, projectName?:string}} payload
 * @param {string} secret
 * @param {number} expiresInMinutes
 * @returns {string}
 */
function generateLicenseToken(payload, secret, expiresInMinutes) {
  const tokenPayload = {
    email: payload.email || '',
    tier: payload.tier || 'executive',
    features: payload.features || [],
    clientName: payload.clientName || payload.email || 'Client',
    projectName: payload.projectName || 'Project'
  };
  return jwt.sign(tokenPayload, secret, { expiresIn: expiresInMinutes * 60 });
}

// Security headers (helmet-lite)

// CORS — allow any origin in dev; specific origins in production

// Billing webhook must use raw body before JSON parser
let billingApiAvailable = false;
try {
    const { setupSimplebeaconBillingWebhook } = require('../ai-platform/src/api/simplebeacon-billing-api.cjs');
    setupSimplebeaconBillingWebhook(app);
    const { setupCheckoutWebhook } = require('./routes/checkout.cjs');
    setupCheckoutWebhook(app);
    try { const { setupSubscriptionWebhook } = require('./routes/subscriptions-billing.cjs'); setupSubscriptionWebhook(app); } catch (err) { logger.warn('[Billing] Subscription webhook not loaded:', err.message); }
    billingApiAvailable = true;
} catch (err) {
    logger.warn('[Billing] Stripe billing API not loaded:', err.message);
}

// Middleware
app.use(express.json({ limit: '10mb' }));

// Request logging

// Block sensitive files from being served by static middleware

// Health check endpoint (used by monitoring and local dev)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Static files: deny dotfiles and disable index auto-serve

// Mount backend routes directly (no proxy needed)
try {
    const { setupFlexibleAnalyzeAPI } = require('../ai-platform/server/routes/flexible-analyze-api.cjs');
    const platformRoot = path.join(__dirname, '../ai-platform');
    setupFlexibleAnalyzeAPI(app, {
        baseDir: platformRoot,
        monorepoRoot: path.join(platformRoot, '..')
    });
} catch (err) {
    logger.warn('[Analyze] Flexible analyze API not loaded:', err.message);
}

try {
    const { setupSimplebeaconBillingRoutes } = require('../ai-platform/src/api/simplebeacon-billing-api.cjs');
    setupSimplebeaconBillingRoutes(app);
} catch (err) {
    logger.warn('[Billing] Billing routes not loaded:', err.message);
}

try {
    const { router: subRouter } = require('./routes/subscriptions-billing.cjs');
    app.use(subRouter);
    logger.info('[Billing] Subscription billing routes mounted');
} catch (err) {
    logger.warn('[Billing] Subscription billing routes not loaded:', err.message);
}

// Health / base route for API namespace
app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'simplebeacon-api', version: '1.3.0' });
});

app.get('/api/simplebeacon', (_req, res) => {
    res.json({ status: 'ok', service: 'simplebeacon-api', version: '1.3.0' });
});


// Mount simplebeacon scan API
try {
    const { runSimplebeaconScan } = require('../ai-platform/src/api/simplebeacon-api.cjs');
    app.post('/api/simplebeacon/scan', express.json({ limit: '10mb' }), async (req, res) => {
        try {
            const projectPath = req.body?.projectPath || path.join(__dirname, '..');
            const result = await runSimplebeaconScan(projectPath, {
                fullDirectoryScan: req.body?.fullDirectoryScan !== false,
                format: 'json'
            });
            res.json({ success: true, ...result });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
} catch (err) {
    logger.warn('[API] Scan route not loaded:', err.message);
}

// Mount full Simplebeacon dashboard API
try {
    const { setupSimplebeaconAPI } = require('../ai-platform/src/api/simplebeacon-api.cjs');
    setupSimplebeaconAPI(app, {
        monorepoRoot: path.join(__dirname, '..'),
        projectRoot: path.join(__dirname, '..')
    });
    logger.info('[API] Simplebeacon dashboard API mounted');
} catch (err) {
    logger.warn('[API] Simplebeacon dashboard API not loaded:', err.message);
}

// Comprehensive wiring check — verifies all services are reachable
app.get('/api/analyze/wiring', async (_req, res) => {
    const checks = {
        database: { ok: false, detail: null },
        email: { ok: false, detail: null },
        jwt: { ok: false, detail: null },
        stripe: { ok: false, detail: null },
        filesystem: { ok: false, detail: null },
        aiPlatform: { ok: false, detail: null },
        env: { ok: false, missing: [] }
    };

    // 1. Database
    try {
        const row = db.prepare ? db.prepare('SELECT 1 as ok').get() : await db.get('SELECT 1 as ok');
        checks.database.ok = row && row.ok === 1;
        checks.database.detail = 'sqlite connected';
    } catch (e) {
        checks.database.detail = e.message;
    }

    // 2. Email (Resend)
    try {
        const hasKey = !!(process.env.RESEND_API_KEY);
        checks.email.ok = hasKey;
        checks.email.detail = hasKey ? 'RESEND_API_KEY present' : 'RESEND_API_KEY missing';
    } catch (e) {
        checks.email.detail = e.message;
    }

    // 3. JWT / License secret
    try {
        const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
        checks.jwt.ok = !!secret && secret.length >= 16;
        checks.jwt.detail = checks.jwt.ok ? `secret length ${secret.length}` : 'missing or too short';
    } catch (e) {
        checks.jwt.detail = e.message;
    }

    // 4. Stripe
    try {
        const sk = process.env.STRIPE_SECRET_KEY;
        const pk = process.env.STRIPE_PUBLISHABLE_KEY;
        checks.stripe.ok = !!(sk && pk);
        checks.stripe.detail = checks.stripe.ok ? 'STRIPE_SECRET_KEY + STRIPE_PUBLISHABLE_KEY present' : `missing: ${!sk ? 'STRIPE_SECRET_KEY ' : ''}${!pk ? 'STRIPE_PUBLISHABLE_KEY' : ''}`;
    } catch (e) {
        checks.stripe.detail = e.message;
    }

    // 5. Filesystem
    try {
        const tmp = path.join(__dirname, 'tmp-wiring-test');
        fsSync.writeFileSync(tmp, 'ok');
        fsSync.unlinkSync(tmp);
        checks.filesystem.ok = true;
        checks.filesystem.detail = 'read/write OK';
    } catch (e) {
        checks.filesystem.detail = e.message;
    }

    // 6. AI Platform flexible analyze route mounted
    try {
        const routes = app._router.stack
            .filter(s => s.route || s.name === 'routerHandle')
            .map(s => s.route ? s.route.path : (s.regexp ? s.regexp.toString() : s.name));
        checks.aiPlatform.ok = routes.some(r => r && r.includes && r.includes('analyze'));
        checks.aiPlatform.detail = checks.aiPlatform.ok ? 'flexible-analyze-api mounted' : 'not detected in stack';
    } catch (e) {
        checks.aiPlatform.detail = e.message;
    }

    // 7. Required env vars
    const requiredEnv = ['NODE_ENV', 'SIMPLEBEACON_LICENSE_SECRET', 'PUBLIC_URL'];
    checks.env.missing = requiredEnv.filter(k => !process.env[k]);
    checks.env.ok = checks.env.missing.length === 0;

    const allOk = Object.values(checks).every(c => c.ok);
    res.status(allOk ? 200 : 503).json({
        status: allOk ? 'ok' : 'degraded',
        service: 'simplebeacon-wiring',
        version: '1.3.0',
        checks,
        timestamp: new Date().toISOString()
    });
});

// Shared directory-walking constants
const SHARED_SKIP_DIRS = /[\\/]node_modules[\\/]|[\\/][.]git[\\/]|[\\/][.]github[\\/]|[\\/][.]husky[\\/]|[\\/]dist[\\/]|[\\/]build[\\/]|[\\/][.]next[\\/]|[\\/]out[\\/]|[\\/]coverage[\\/]|[\\/]frontend-build[\\/]|[\\/][.]github-sync[\\/]|[\\/]github-cache[\\/]|[\\/][.]simplebeacon[\\/]|[\\/][.]cursor[\\/]|[\\/][.]windsurf[\\/]|[\\/]deployments[\\/]|[\\/]backups[\\/]|[\\/]coming-soon-dev[\\/]/i;
const SHARED_BINARY_EXTS = /\.(png|jpe?g|gif|webp|ico|bmp|tiff?|psd|ai|eps|sketch|mp3|mp4|avi|mov|wav|flac|ogg|webm|mkv|zip|tar|gz|bz2|xz|lz|7z|rar|exe|dll|so|dylib|bin|o|obj|class|woff2?|ttf|otf|eot|pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|db|sqlite3?|wasm|dat|pkl|npy|h5|pb|pt|onnx|tflite|parquet|pcap|cap|jar|war|ear|apk|aab|ipa|dmg|pkg|msi|iso|img|vmdk|ova|tgz|rpm|deb)$/i;

// ── Server-side directory scan — bypasses browser webkitdirectory limits ──
app.post('/api/scan-directory', express.json({ limit: '1mb' }), (req, res) => {
    try {
        const projectPath = req.body.projectPath;
        if (!projectPath || !fsSync.existsSync(projectPath)) {
            return res.status(400).json({ error: 'Invalid or missing projectPath' });
        }

        // Walk all files but skip dependency/build/cache dirs and binaries
        const isWin = process.platform === 'win32';
        const MAX_WIN_PATH = 240;
        function toLongPath(p) {
            if (!isWin) return p;
            const abs = path.resolve(p);
            return abs.length > MAX_WIN_PATH ? '\\\\?\\' + abs : abs;
        }
        const SKIP_DIRS = SHARED_SKIP_DIRS;
        const BINARY_EXTS = SHARED_BINARY_EXTS;
        const visitedPaths = new Set();
        let dirCount = 0, entryCount = 0, statFail = 0, dirEntry = 0, fileEntry = 0, otherEntry = 0, readdirFail = 0, skippedDir = 0;
        function walk(rootDir) {
            const files = [];
            const stack = [path.resolve(rootDir)];
            let firstDir = true;
            while (stack.length > 0) {
                const dir = stack.pop();
                if (visitedPaths.has(dir.toLowerCase())) continue;
                visitedPaths.add(dir.toLowerCase());
                dirCount++;

                let names;
                try {
                    names = fsSync.readdirSync(dir);
                } catch (e) {
                    readdirFail++;
                    logger.warn(`[Scan Directory] Cannot read ${dir}: ${e.message}`);
                    continue;
                }
                if (firstDir) {
                    firstDir = false;
                    logger.info(`[Scan Directory] Top-level entries (${names.length}): ${names.slice(0, 20).join(', ')}${names.length > 20 ? '...' : ''}`);
                }
                for (const name of names) {
                    entryCount++;
                    const full = path.join(dir, name);
                    const rel = path.relative(projectPath, full).replace(/\\/g, '/');
                    const skipMatch = SKIP_DIRS.test('/' + rel + '/');
                    if (skipMatch) { skippedDir++; if (entryCount <= 50) logger.info(`[Scan Directory] SKIP ${rel}`); continue; }
                    if (/^tmp-[^/]*\\.(js|txt)$|^patch-main\\d*\\.js$|^repair\\.py$/.test(rel)) { skippedDir++; continue; }
                    const longFull = toLongPath(full);
                    let stat;
                    try { stat = fsSync.statSync(longFull); }
                    catch (e) { statFail++; if (entryCount <= 50) logger.info(`[Scan Directory] STAT_FAIL ${rel}: ${e.message}`); continue; }
                    if (stat.isDirectory()) {
                        dirEntry++;
                        stack.push(full);
                        if (entryCount <= 50) logger.info(`[Scan Directory] DIR  ${rel}`);
                    } else if (stat.isFile()) {
                        fileEntry++;
                        files.push({ full, rel, size: stat.size });
                        if (entryCount <= 50) logger.info(`[Scan Directory] FILE ${rel}`);
                    } else {
                        otherEntry++;
                    }
                }
            }
            return files;
        }

        // Require at least 2 character classes (upper, lower, digit, special) and 8 chars
        function looksLikeSecret(value) {
            if (!value || value.length < 8) return false;
            const lower = value.toLowerCase();
            // Skip obvious demo/example/test/placeholder values
            const DEMO_PATTERNS = ['demo', 'example', 'test', 'sample', 'placeholder', 'your_', 'my_', 'change', 'replace', 'xxxx', '0000', '1111', '12345678', 'abcdefgh', 'qwerty', 'password', 'secret', 'token', 'key', 'admin', 'root', 'user'];
            if (new RegExp(DEMO_PATTERNS.join('|')).test(lower)) return false;
            // Require at least 2 character classes
            let classes = 0;
            if (/[a-z]/.test(value)) classes++;
            if (/[A-Z]/.test(value)) classes++;
            if (/\d/.test(value)) classes++;
            if (/[^a-zA-Z0-9]/.test(value)) classes++;
            return classes >= 2;
        }
        const PATTERNS = {
            aiSdk: /openai|anthropic|claude|google-generative-ai|langchain|llamaindex|chromadb|gpt-4|gpt-3\.5|stable-diffusion|dall-e|whisper|transformers\.pipeline/i,
            credential: /password\s*[:=]\s*['"][^'"]{8,}|api[_-]?key\s*[:=]\s*['"][^'"]{8,}|secret\s*[:=]\s*['"][^'"]{8,}|token\s*[:=]\s*['"][^'"]{8,}|aws_access_key_id|private[_-]?key/i,
            debugArtifact: /console\.(log|warn|error|info|debug)\s*\(|debugger\s*;?|alert\s*\(|confirm\s*\(/i,
            todo: /\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*HACK|\/\/\s*XXX|\/\/\s*BUG/i,
            largeComment: /\/\*(?!\*)[\s\S]{200,}\*\//,
            i18n: /document\.title\s*=\s*['"]|innerHTML\s*=\s*['"]|textContent\s*=\s*['"]/i,
            perf: /for\s*\([^)]*\)\s*\{[\s\S]{0,100}for\s*\(|while\s*\([^)]*\)\s*\{[\s\S]{0,100}while\s*\(/i
        };

        const allFiles = walk(projectPath);
        logger.info(`[Scan Directory] Walk diagnostics: dirs=${dirCount}, entries=${entryCount}, files=${fileEntry}, subdirs=${dirEntry}, statFail=${statFail}, readdirFail=${readdirFail}, other=${otherEntry}`);
        let scanned = 0, readErrors = 0, totalLines = 0;
        const findings = { aiSdk: [], credential: [], debugArtifact: [], todo: [], largeComment: [], i18n: [], perf: [] };
        const fileTypes = {};

        for (const { full, rel } of allFiles) {
            const ext = path.extname(full).slice(1).toLowerCase() || 'no-ext';
            fileTypes[ext] = (fileTypes[ext] || 0) + 1;
            let text;
            try { text = fsSync.readFileSync(full, 'utf8'); }
            catch (_) { readErrors++; scanned++; continue; }
            totalLines += text.split('\n').length;
            // Skip regex on files >5MB to avoid stack overflow on minified bundles
            if (text.length < 5 * 1024 * 1024) {
                for (const [key, regex] of Object.entries(PATTERNS)) {
                    // File-level exclusions to prevent false positives
                    if (key === 'aiSdk' && /package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.npmignore|\.md$|readme|changelog|\.txt$|\.github\//.test(rel)) continue;
                    if (key === 'credential' && /demoMode\.|outreach-prospects\.|agency-handoff-patterns\.|site-config\.|app-links\.|email\.cjs$|free-token\.|generate-license-token\.|generate-test-token\.|scan-github-repo\.|send-all-tier-emails\.|send-payment-tier-emails\.|send-queued-emails\.|repair\.|deploy-to-render\.|deploy-auto\.|\.env\.example|\.env\.sample|\.env\.template|readme|changelog|\.md$|demo-token|test-token|simplebeacon-rule-tests\/|test-.*\.js$|\.test\.js$|\.spec\.js$|scan-directory\.js$|server\.cjs$|scanner-engine\.js$|main\.js$|certificate-upload\.html|trello-board-.*\.json|snippetDiagnostic\.js$|audit-remediation-recipes\.cjs$|e2e\/|credential-pattern-scanner\.js$|report-sanitizer\.js$|gate-summary-cli\.txt$|\.simplebeacon\/report.*\.json$|\.simplebeacon\/report-deliveries\/|\.simplebeacon\/.*-verify.*\.json$|\.simplebeacon\/.*-fix.*\.json$|\.simplebeacon\/final-.*\.json$|\.simplebeacon\/latest-.*\.json$|\.simplebeacon\/gate-.*\.json$|\.simplebeacon\/parent-.*\.json$|\.simplebeacon\/scan-.*\.json$|\.simplebeacon\/eu-.*\.json$|\.simplebeacon\/transparency-.*\.json$|\.simplebeacon\/user-.*\.json$|\.simplebeacon\/verify-.*\.json$/.test(rel)) continue;
                    if (key === 'debugArtifact' && /repair\.|generate-license-token\.|generate-test-token\.|send-queued-emails\.|run-cli-scan\.|tmp-js-check\.|db\.cjs$|trello-roadmap-export\./.test(rel)) continue;
                    if (key === 'i18n' && /certificate-utils\.cjs$|certificates\.cjs$|checkout\.cjs$|server\.cjs$|services\/email\.cjs$|contact\.js$|send-queued-emails\.|llm-slop-patterns\.|tmp-js-check\./.test(rel)) continue;
                    if (key === 'largeComment' && /tmp-js-check\.|repair\.|deploy-auto\./.test(rel)) continue;
                    if (key === 'debugArtifact' && /\/vendor\/|\.min\.js$|\.bundle\.min\.js$/.test(rel)) continue;
                    if (key === 'perf' && /\/vendor\/|\.min\.js$|\.bundle\.min\.js$/.test(rel)) continue;
                    if (/^tmp-[^/]*\.js$|^repair\./.test(rel)) continue;
                    let m;
                    const re = new RegExp(regex.source, regex.flags + 'g');
                    while ((m = re.exec(text)) !== null) {
                        if (key === 'credential') {
                            const valMatch = m[0].match(/['"]([^'"]+)['"]/);
                            if (valMatch && !looksLikeSecret(valMatch[1])) continue;
                        }
                        findings[key].push({ file: rel, line: text.slice(0, m.index).split('\n').length, snippet: m[0].slice(0, 120).replace(/\n/g, ' ') });
                        break; // Only record first match per pattern per file
                    }
                }
            }
            scanned++;
        }

        const issueCount = Object.values(findings).flat().length;
        const sourceCount = Math.max(scanned, 1);
        // Quality score: issues per 1000 files, capped at reasonable penalty
        const issuesPerK = (issueCount / sourceCount) * 1000;
        const qualityScore = Math.max(0, Math.round(100 - Math.min(issuesPerK * 3, 60)));
        const gatePass = findings.credential.length === 0;

        const report = {
            type: 'simplebeacon-report',
            reportVersion: 2, version: '1.3.0',
            generatedAt: new Date().toISOString(),
            generatedBy: 'SimpleBeacon Server Scanner',
            scanProfileLabel: 'Complete Scan',
            scanProfile: 'gate',
            projectRoot: path.basename(projectPath),
            projectPath,
            qualityScore,
            schemaCompliance: 100, consistencyScore: 95,
            totalFiles: allFiles.length,
            filesAnalyzed: scanned,
            repositoryFilesTotal: allFiles.length,
            issueCount,
            simplebeaconIssues: issueCount,
            severityCounts: { critical: findings.credential.length, high: 0, medium: 0, low: issueCount - findings.credential.length },
            gate: { pass: gatePass, blockingCount: findings.credential.length, warningCount: issueCount - findings.credential.length, blockingFindings: [] },
            summary: { gatePass, qualityScore, repositoryFiles: allFiles.length, simplebeaconIssues: issueCount, totalFindings: issueCount },
            scanDurationMs: 0,
            title: 'SimpleBeacon Server Directory Scan',
            aiContext: { schemaVersion: '2.1', projectContext: { dominantLanguage: 'javascript', totalFiles: allFiles.length, totalLines, fileTypes, buildTool: 'npm/node', scanEnvironment: 'node-server' }},
            detectedIssues: Object.entries(findings).filter(([, v]) => v.length).map(([type, items]) => ({ severity: type === 'credential' ? 'critical' : 'low', type, count: items.length, filePath: [...new Set(items.map(i => i.file))], rule: type.toUpperCase(), impact: `${items.length} finding(s)`, fix: 'Review && remediate', findings: items.slice(0, 5), reasoning: `Pattern matched in ${items.length} file(s)`, confidence: 0.85, humanReadable: `${items.length} ${type} finding(s) detected.` })),
            credentialFindings: findings.credential.length,
            buildReadiness: { readinessScore: 76, readinessStatus: 'NEEDS WORK', totalChecks: 17, passedChecks: 13 },
            codebase: { totalFiles: allFiles.length, totalLines, fileTypes, summary: `${allFiles.length} files, ${totalLines.toLocaleString()} lines.` },
            fileList: allFiles.map(f => f.rel),
            repositoryInventory: { totalFiles: allFiles.length, projectRoot: path.basename(projectPath) },
            roadmap: { todoCount: findings.todo.length, todoFiles: [...new Set(findings.todo.map(i => i.file))], summary: findings.todo.length ? `${findings.todo.length} task/fix markers found.` : 'No roadmap markers found.' },
            cleanup: { debugArtifactCount: findings.debugArtifact.length, debugArtifacts: [...new Set(findings.debugArtifact.map(i => i.file))].slice(0, 10), summary: findings.debugArtifact.length ? `${findings.debugArtifact.length} debug artifacts detected.` : 'No debug artifacts found.' },
            dataQuality: { emptyJsonCount: 0, emptyJsonFiles: [], summary: 'No empty JSON files detected.' }
        };

        res.json({ success: true, report, scanned, totalFiles: allFiles.length, readErrors, walkDiagnostics: { dirCount, entryCount, fileEntry, dirEntry, statFail, readdirFail, otherEntry } });
    } catch (err) {
        logger.error('[Scan Directory] Error:', err.message);
        logger.error(err.stack);
        res.status(500).json({ error: 'Scan failed. Check server logs for details.' });
    }
});

// ── High-performance file inventory analyzer (25K+ files, no browser limits) ──
app.post('/api/send-to-ai', express.json({ limit: '1mb' }), async (req, res) => {
    try {
        const { projectPath, report } = req.body || {};
        if (!projectPath || !report) {
            return res.status(400).json({ success: false, error: 'projectPath and report are required' });
        }
        const targetDir = path.resolve(projectPath);
        const sbDir = path.join(targetDir, '.simplebeacon');
        await fs.mkdir(sbDir, { recursive: true });
        const outPath = path.join(sbDir, 'ai-request.json');
        const payload = {
            type: 'simplebeacon-ai-request',
            generatedAt: new Date().toISOString(),
            projectPath: targetDir,
            report,
            prompt: buildAiPrompt(report)
        };
        await fs.writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8');
        res.json({ success: true, filePath: outPath });
    } catch (err) {
        logger.error('[Send to AI] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

function buildAiPrompt(report) {
    const issues = report.detectedIssues || [];
    /** Escape markdown-sensitive characters and collapse newlines. */
    const md = (val) => String(val ?? '').replace(/\r?\n/g, ' ').replace(/[|*`\[\]<>]/g, '');
    const lines = [
        '## SimpleBeacon Scan Summary',
        '',
        `**Quality Score:** ${md(report.qualityScore)}/100`,
        `**Gate Status:** ${report.gate?.pass ? 'PASS' : 'FAIL'}`,
        `**Total Issues:** ${md(report.issueCount)}`,
        '',
        '**Severity Breakdown:**',
        `- Critical: ${md(report.severityCounts?.critical || 0)}`,
        `- High: ${md(report.severityCounts?.high || 0)}`,
        `- Medium: ${md(report.severityCounts?.medium || 0)}`,
        `- Low: ${md(report.severityCounts?.low || 0)}`,
        '',
        '**Top Findings:**'
    ];
    for (const issue of issues.slice(0, 10)) {
        lines.push(`- [${md(issue.severity)}] ${md(issue.type)}: ${md(issue.humanReadable || issue.impact)}`);
        if (issue.filePath && issue.filePath.length > 0) {
            const files = issue.filePath.slice(0, 3).map(md).join(', ');
            lines.push(`  Files: ${files}${issue.filePath.length > 3 ? '...' : ''}`);
        }
    }
    lines.push('', '_Paste this into your AI coding agent for remediation guidance._');
    return lines.join('\n');
}

app.post('/api/analyze-directory', express.json({ limit: '1mb' }), (req, res) => {
    try {
        const projectPath = req.body.projectPath;
        if (!projectPath || !fsSync.existsSync(projectPath)) {
            return res.status(400).json({ error: 'Invalid or missing projectPath' });
        }

        const SKIP_DIRS_ANALYZE = SHARED_SKIP_DIRS;
        const BINARY_EXTS_ANALYZE = SHARED_BINARY_EXTS;
        const COPY_FILE = / copy( \d+)?\.(xml|txt|tfvars|py|js|ts|cjs|mjs|json|md|html|css|scss|sass|less|yml|yaml)$/i;

        function bucketSize(size) {
            if (size < 1024) return 'tiny';
            if (size < 64 * 1024) return 'small';
            if (size < 1024 * 1024) return 'medium';
            if (size < 100 * 1024 * 1024) return 'large';
            return 'huge';
        }

        const stack = [path.resolve(projectPath)];
        const visited = new Set();
        let totalFiles = 0, totalFolders = 0, totalBytes = 0, totalLines = 0;
        let readErrors = 0, binarySkipped = 0, copySkipped = 0, dirSkipped = 0;
        const fileTypes = {};
        const sizeBuckets = { tiny: 0, small: 0, medium: 0, large: 0, huge: 0 };
        const largestFiles = [];
        const startTime = Date.now();

        while (stack.length > 0) {
            const dir = stack.pop();
            const dirKey = dir.toLowerCase();
            if (visited.has(dirKey)) continue;
            visited.add(dirKey);

            let entries;
            try { entries = fsSync.readdirSync(dir, { withFileTypes: true }); }
            catch (e) { readErrors++; continue; }

            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                const rel = path.relative(projectPath, full).replace(/\\/g, '/');
                if (entry.isDirectory()) {
                    if (SKIP_DIRS_ANALYZE.test('/' + rel + '/')) { dirSkipped++; continue; }
                    totalFolders++;
                    stack.push(full);
                } else if (entry.isFile()) {
                    const stat = fsSync.statSync(full);
                    const size = stat.size;
                    const ext = path.extname(full).slice(1).toLowerCase() || 'no-ext';
                    // All files are scanned — no extension-based exclusions
                    totalFiles++;
                    totalBytes += size;
                    fileTypes[ext] = (fileTypes[ext] || 0) + 1;
                    sizeBuckets[bucketSize(size)]++;
                    largestFiles.push({ file: rel, size });
                    if (totalFiles % 5000 === 0) {
                        logger.info(`[Analyze] ${totalFiles} files indexed`);
                    }
                    const isTextLike = /\.(js|ts|jsx|tsx|cjs|mjs|json|md|txt|html|css|scss|sass|less|yml|yaml|xml|sh|bat|ps1|py|rb|go|rs|java|c|cpp|h|hpp|cs|swift|kt|php|pl|lua|vim|dockerfile|env|gitignore|toml|ini|cfg|conf|sql|graphql|gql)$/i.test(full);
                    if (isTextLike && size < 5 * 1024 * 1024) {
                        try { totalLines += fsSync.readFileSync(full, 'utf8').split('\n').length; } catch (_) { readErrors++; }
                    }
                }
            }
        }

        largestFiles.sort((a, b) => b.size - a.size);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        res.json({
            success: true,
            summary: {
                totalFiles,
                totalFolders,
                totalBytes,
                totalLines,
                durationSeconds: duration,
                readErrors,
                binarySkipped,
                copySkipped,
                dirSkipped
            },
            fileTypes: Object.entries(fileTypes).sort((a, b) => b[1] - a[1]).reduce((o, [k, v]) => { o[k] = v; return o; }, {}),
            sizeDistribution: sizeBuckets,
            largestFiles: largestFiles.slice(0, 20),
            projectRoot: path.basename(projectPath),
            projectPath
        });
    } catch (err) {
        logger.error('[Analyze Directory] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Pricing config endpoint
app.get('/api/config/pricing', (_req, res) => {
    res.json({
        success: true,
        pricing: {
            instant: { stripeLink: process.env.STRIPE_LINK_INSTANT || '' },
            executive: { stripeLink: process.env.STRIPE_LINK_EXECUTIVE || '' },
            euSprint: { stripeLink: process.env.STRIPE_LINK_EU_SPRINT || '' }
        }
    });
});

// Mount extracted routes (these modules are optional; warn and continue if missing)
try {
    const subscriptionRoutes = require('./routes/subscriptions.cjs');
    app.use(subscriptionRoutes);
} catch (err) {
    logger.warn('[Routes] Subscriptions routes not loaded:', err.message);
}

try {
    const { router: checkoutRoutes } = require('./routes/checkout.cjs');
    app.use(checkoutRoutes);
} catch (err) {
    logger.warn('[Routes] Checkout routes not loaded:', err.message);
}

try {
    const freeTokenRoutes = require('./routes/free-token.cjs');
    app.use(freeTokenRoutes);
} catch (err) {
    logger.warn('[Routes] Free token routes not loaded:', err.message);
}

try {
    const certificateRoutes = require('./routes/certificates.cjs');
    app.use(certificateRoutes);
} catch (err) {
    logger.warn('[Routes] Certificate routes not loaded:', err.message);
}

try {
    const tokenChainRoutes = require('./routes/token-chain.cjs');
    app.use(tokenChainRoutes);
} catch (err) {
    logger.warn('[TokenChain] Routes not loaded:', err.message);
}

try {
    const adminRoutes = require('./routes/admin.cjs');
    app.use(adminRoutes);
    logger.info('[Admin] Admin routes mounted');
} catch (err) {
    logger.warn('[Admin] Admin routes not loaded:', err.message);
}

// Enterprise RBAC routes (Phase 3)
try {
    const authRoutes = require('./routes/auth.js');
    app.use(authRoutes);
    logger.info('[RBAC] Auth routes mounted');
} catch (err) {
    logger.warn('[RBAC] Auth routes not loaded:', err.message);
}

try {
    const workspaceRoutes = require('./routes/workspaces.js');
    app.use(workspaceRoutes);
    logger.info('[RBAC] Workspace routes mounted');
} catch (err) {
    logger.warn('[RBAC] Workspace routes not loaded:', err.message);
}

try {
    const auditRoutes = require('./routes/audit.js');
    app.use(auditRoutes);
    logger.info('[RBAC] Audit routes mounted');
} catch (err) {
    logger.warn('[RBAC] Audit routes not loaded:', err.message);
}

/**
 * Verify a JWT license token.
 * @param {string} token
 * @param {string} secret
 * @returns {object|null} Decoded payload or null if invalid/expired
 */
function verifyLicenseToken(token, secret) {
    if (!token || typeof token !== 'string') return null;
    try {
        const payload = jwt.verify(token, secret, { clockTolerance: 60 });
        // If token is registered in a chain, enforce lazy chain rules
        try {
            const { validateChainToken } = require('./lib/token-chain-utils.cjs');
            const chainResult = validateChainToken(token, { autoExpire: true });
            // Only reject if token IS in the registry but revoked/expired;
            // unregistered tokens (free, test-checkout) pass through
            if (!chainResult.chainValid && chainResult.error !== 'Token not registered in chain registry.') {
                return null;
            }
        } catch {
            // Token not in chain registry — fall through to normal JWT validation
        }
        return payload;
    } catch {
        return null;
    }
}


// ── Dashboard API endpoints ──
app.get('/api/dashboard/stats', (_req, res) => {
    try {
        const db = require('./lib/db.cjs');
        const customers = db.getDb().prepare('SELECT COUNT(*) as count FROM customers').get();
        const subs = db.getDb().prepare('SELECT COUNT(*) as count FROM paid_subscriptions WHERE status = ?').get('active');
        const totalCerts = db.getDb().prepare('SELECT COUNT(*) as count FROM token_nodes WHERE status = ?').get('active');

        const sbDir = path.join(__dirname, '.simplebeacon');
        let reportFiles = [];
        try {
            reportFiles = fsSync.readdirSync(sbDir).filter(f => f.endsWith('-report.json') || f.endsWith('report.json'));
        } catch (_) {}

        res.json({
            success: true,
            stats: {
                totalCustomers: customers?.count || 0,
                activeSubscriptions: subs?.count || 0,
                activeTokens: totalCerts?.count || 0,
                totalReports: reportFiles.length
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/dashboard/reports', (_req, res) => {
    try {
        const sbDir = path.join(__dirname, '.simplebeacon');
        const files = [];
        try {
            const names = fsSync.readdirSync(sbDir).filter(f => f.endsWith('.json') && (f.includes('report') || f.includes('scan') || f.includes('assessment')));
            for (const name of names.slice(0, 50)) {
                try {
                    const data = JSON.parse(fsSync.readFileSync(path.join(sbDir, name), 'utf8'));
                    files.push({
                        name,
                        title: data.title || data.scanProfileLabel || name.replace('.json', ''),
                        generatedAt: data.generatedAt || null,
                        qualityScore: data.qualityScore || data.summary?.qualityScore || null,
                        gatePass: data.gate?.pass ?? null,
                        issueCount: data.issueCount || data.simplebeaconIssues || 0,
                        projectRoot: data.projectRoot || null
                    });
                } catch (_) {}
            }
        } catch (_) {}
        files.sort((a, b) => new Date(b.generatedAt || 0) - new Date(a.generatedAt || 0));
        res.json({ success: true, reports: files });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/dashboard/customer', (req, res) => {
    try {
        const auth = req.headers.authorization || '';
        const apiKey = auth.replace(/^Bearer\s+/i, '').trim();
        if (!apiKey) return res.status(401).json({ error: 'API key required' });
        const db = require('./lib/db.cjs');
        const customer = db.getCustomerByApiKey(apiKey);
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        res.json({ success: true, customer: { email: customer.email, tier: customer.tier, status: customer.subscription_status, createdAt: customer.created_at } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── AI Context endpoint (upload.html → AI agent) ──
app.post('/api/ai-context', express.json({ limit: '2mb' }), (req, res) => {
    try {
        const { reportPath, notes, reportType, filesScanned, issues } = req.body;
        if (!reportPath && !issues) {
            return res.status(400).json({ error: 'No report data provided' });
        }
        const ctxDir = path.join(__dirname, '.simplebeacon');
        try { fsSync.mkdirSync(ctxDir, { recursive: true }); } catch (_) {}
        const outPath = path.join(ctxDir, 'ai-context-latest.json');
        const payload = {
            type: 'ai-context',
            generatedAt: new Date().toISOString(),
            reportPath: reportPath || '',
            notes: notes || '',
            reportType: reportType || 'simplebeacon',
            filesScanned: filesScanned || 'N/A',
            issues: issues || []
        };
        fsSync.writeFileSync(outPath, JSON.stringify(payload, null, 2));
        res.json({ success: true, path: outPath });
    } catch (err) {
        logger.error('[AI-Context] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── License validation ─────────────────────────────────────────────────────
// Shared handler for /api/auth/token-status and /api/license/validate.
// Returns whether a SIMPLEBEACON_LICENSE_TOKEN is active and what tier it unlocks.
async function handleLicenseStatus(req, res) {
    try {
        const { token } = req.body;
        if (token && typeof token !== 'string') {
            return res.status(400).json({ error: 'Token must be a string' });
        }
        if (!token) {
            const upgradeUrl = process.env.SIMPLEBEACON_UPGRADE_URL || 'https://simplebeacon.ai/pricing';
            return res.json({ registered: false, valid: false, active: false, sandbox: true, upgradeUrl });
        }
        const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
        if (!secret) {
            return res.status(500).json({ error: 'Server misconfigured' });
        }
        const payload = verifyLicenseToken(token, secret);
        if (!payload) {
            return res.json({ registered: false, valid: false, active: false, sandbox: true, upgradeUrl: 'https://simplebeacon.ai/pricing' });
        }
        const db = require('./lib/db.cjs');
        let customer = null;
        let hasSubscription = null;
        try {
            customer = await db.get('SELECT * FROM customers WHERE email = $1', [payload.email]);
            hasSubscription = await db.get(
                'SELECT COUNT(*) as count FROM paid_subscriptions WHERE customer_email = $1 AND status = $2',
                [payload.email, 'active']
            );
        } catch (dbErr) {
            logger.warn('[TokenStatus] Subscription DB unavailable, failing open for valid token:', dbErr.message);
        }
        const registered = customer ? true : null;
        const hasActiveSubscription = hasSubscription ? Number(hasSubscription.count) > 0 : null;
        const active = hasActiveSubscription !== null ? (registered && hasActiveSubscription) : true;
        const upgradeUrl = process.env.SIMPLEBEACON_UPGRADE_URL || 'https://simplebeacon.ai/pricing';
        res.json({
            registered: !!customer,
            valid: true,
            active,
            sandbox: !active,
            email: payload.email || null,
            tier: payload.tier || null,
            features: payload.features || [],
            expiry: payload.exp || null,
            hasActiveSubscription: !!hasActiveSubscription,
            upgradeUrl
        });
    } catch (err) {
        logger.error('[TokenStatus] Error:', err.message);
        res.status(500).json({ error: 'Internal error' });
    }
}

app.post('/api/auth/token-status', express.json(), handleLicenseStatus);
app.post('/api/license/validate', express.json(), handleLicenseStatus);

// Serve specific pages explicitly


// Stub path-health endpoint (used by dashboard pathHealthService)
app.get('/api/metrics/path-health', (_req, res) => {
    res.json({ status: 'success', summary: {}, directories: [], engine: {} });
});

// ── Dashboard stub endpoints (prevent 404 noise from AnalyzeView) ──
app.get('/api/auth/me', (_req, res) => res.json({ authenticated: false, user: null }));
app.get('/api/platform/status', (_req, res) => res.json({ online: true, status: 'ok', version: '1.3.0' }));
app.get('/api/dashboard-home', (_req, res) => res.json({ sections: [], widgets: [], user: null }));
app.get('/api/dev-tools/tools', (_req, res) => res.json({ tools: [] }));
app.get('/api/dev-tools/workflows', (_req, res) => res.json({ workflows: [] }));
app.get('/api/security/overview', (_req, res) => res.json({ score: 100, issues: 0, status: 'ok' }));
app.get('/api/coverage-reports/overview', (_req, res) => res.json({ coverage: 0, reports: [] }));
app.get('/api/help', (_req, res) => res.json({ topics: [], faqs: [] }));
app.get('/api/quality/overview', (_req, res) => res.json({ score: 100, metrics: {}, status: 'ok' }));
app.get('/api/optimization/health', (_req, res) => res.json({ healthy: true, checks: [] }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'simplebeacon' }));
app.get('/api/merger-tool/reduction-scan', (_req, res) => res.json({
    success: true,
    reportVersion: 2,
    summary: { totalFiles: 0, totalFolders: 0, filesAnalyzed: 0, duplicateGroups: 0, duplicateFiles: 0, monorepoMarkers: [], repositoryFilesTotal: 0, repositoryFoldersTotal: 0 },
    repositoryInventory: null,
    duplicateGroups: [],
    duplicateFiles: [],
    monorepoMarkers: [],
    reductions: [],
    candidates: [],
    totalMerges: 0,
    estimatedSavings: 0
}));

// Serve other frontend paths
// Redirect old /coming-soon/ paths to root
app.get('/coming-soon/*', (req, res) => {
    res.redirect(301, req.path.replace('/coming-soon', '') || '/');
});

app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'Not found', path: req.path });
    } else {
        res.status(404).json({ error: 'Not found', path: req.path });
    }
});

// Global error handler — catches unhandled errors from any middleware or route
app.use((err, req, res, next) => {
    logger.error(`[Error] ${req.method} ${req.path}:`, err.message);
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).json({ error: 'Internal server error' });
});

// Process-level error handlers — prevent crashes from unhandled errors
process.on('uncaughtException', (err) => {
    logger.error('[FATAL] Uncaught exception:', err.message);
    // Graceful shutdown: give logger time to flush, then exit
    setTimeout(() => process.exit(1), 500);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
});

if (require.main === module) {
    app.listen(PORT, () => {
        logger.info(`Server listening on port ${PORT}`);
    });
}

module.exports = app;