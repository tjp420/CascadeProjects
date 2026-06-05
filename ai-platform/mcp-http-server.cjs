/**
 * MCP HTTP Server — exposes Simplebeacon MCP tools over HTTP for the certificate upload page.
 * Replaces the Express API backend with direct MCP tool invocation.
 * All scanning runs locally with --offline enforcement.
 */

require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const { sendEmail } = require('./server/lib/email-service.cjs');
const Busboy = require('busboy');
const AdmZip = require('adm-zip');
const { generateLicenseToken } = require('./packages/simplebeacon-cli/src/lib/license-token.js');
const { executeSecureAuditFromDir, wipeDirectorySync } = require('./server/utils/data-processor.cjs');

// In-memory scan progress store (scanId -> { status, current, total, filename, percent, reportJson, error })
const scanJobs = new Map();

// Prevent crashes from stream errors during multipart upload
process.on('unhandledRejection', (err) => {
    console.error('[MCP HTTP] Unhandled rejection (non-fatal):', err.message || err);
});
process.on('uncaughtException', (err) => {
    console.error('[MCP HTTP] Uncaught exception (non-fatal):', err.message || err);
});

function extractZipIfNeeded(tmpDir) {
    const entries = fs.readdirSync(tmpDir, { withFileTypes: true });
    const zipFiles = entries.filter(e => e.isFile() && e.name.toLowerCase().endsWith('.zip'));
    if (zipFiles.length === 0) return tmpDir;
    // If exactly one zip and no other files, extract directly into tmpDir
    const nonZip = entries.filter(e => !e.name.toLowerCase().endsWith('.zip'));
    for (const z of zipFiles) {
        const zipPath = path.join(tmpDir, z.name);
        const zip = new AdmZip(zipPath);
        if (nonZip.length === 0 && zipFiles.length === 1) {
            zip.extractAllTo(tmpDir, true);
        } else {
            const extractDir = path.join(tmpDir, z.name.replace(/\.zip$/i, ''));
            zip.extractAllTo(extractDir, true);
        }
        fs.unlinkSync(zipPath);
    }
    // Prune excluded directories and artifacts so they never enter the scan
    const SKIP_DIRS = ['node_modules', '.git', '.simplebeacon', '.github', '.husky', 'coverage', 'dist', 'build'];
    const SKIP_FILES = [
        'cp936.json', 'cp949.json', 'cp950.json', 'eucjp.json', 'gbk-added.json',
        'shiftjis.json', 'big5-added.json', 'gb18030-ranges.json', 'gb18030.json',
        'codes.json', 'types.json'
    ];
    function prune(dir) {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
            const itemPath = path.join(dir, item.name);
            if (item.isDirectory()) {
                if (SKIP_DIRS.includes(item.name)) {
                    fs.rmSync(itemPath, { recursive: true, force: true });
                    continue;
                }
                prune(itemPath);
            } else if (item.isFile()) {
                if (SKIP_FILES.includes(item.name) || item.name.endsWith('.d.ts')) {
                    fs.unlinkSync(itemPath);
                }
            }
        }
    }
    prune(tmpDir);
    return tmpDir;
}

function parseUrlEncoded(body) {
    const params = {};
    const pairs = body.split('&');
    for (const pair of pairs) {
        const [key, value] = pair.split('=').map(decodeURIComponent);
        if (key) params[key] = value || '';
    }
    return params;
}

// CORS headers for local development
function setCorsHeaders(res, origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// Simple token validation (same logic as flexible-analyze-api)
async function validateToken(token) {
    if (!token) return null;

    // Always verify cryptographic expiration first
    let payload = null;
    try {
        const { verifyLicenseToken } = require('./packages/simplebeacon-cli/src/lib/license-token');
        payload = verifyLicenseToken(token);
    } catch (e) {
        payload = null;
    }

    // Check subscription store
    const storePath = path.join(__dirname, '.simplebeacon', 'subscriptions.json');
    if (fs.existsSync(storePath)) {
        try {
            const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
            const record = Object.values(store.subscriptions || {}).find(
                (s) => s.licenseToken === token
            );
            if (record && ['executive', 'agency', 'community', 'euai', 'universal', 'instant_report', 'executive_clearance', 'eu_ai_act_sprint'].includes(record.licenseTier)) {
                // Reject if subscription is explicitly deactivated
                if (record.subscriptionActive === false) return null;
                // Reject if token is cryptographically expired
                if (!payload) return null;
                return record;
            }
        } catch (e) {
            // Fall through to crypto verify
        }
    }

    // Fallback: verify token cryptographically
    if (!payload) return null;
    const tier = payload.tier || 'executive';
    if (!['executive', 'agency', 'community', 'euai', 'universal', 'instant_report', 'executive_clearance', 'eu_ai_act_sprint'].includes(tier)) return null;
    return {
        licenseToken: token,
        licenseTier: tier,
        email: payload.email || '',
        features: payload.features || []
    };
}

// Quick recursive file counter for progress reporting
function countFilesSync(dir) {
    let count = 0;
    const walk = (d) => {
        try {
            for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
                const full = path.join(d, entry.name);
                if (entry.isDirectory()) {
                    walk(full);
                } else if (entry.isFile()) {
                    count++;
                }
            }
        } catch { /* ignore permission errors */ }
    };
    walk(dir);
    return count;
}

// Run Simplebeacon CLI scan
async function runScan(projectPath, options = {}) {
    const cliBin = path.join(__dirname, 'packages/simplebeacon-cli/bin/simplebeacon.js');
    const reportOut = path.join(projectPath, '.simplebeacon', 'report.json');
    fs.mkdirSync(path.dirname(reportOut), { recursive: true });

    // Write a minimal config to force scanning the uploaded directory
    const configPath = path.join(projectPath, '.simplebeacon', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
        scanPaths: ['.'],
        productionPaths: ['.'],
        ignore: [
            '.simplebeacon', '.github', '.husky',
            'package-lock.json', '*.log', '*.backup.*', '*.tmp',
            '*.markdown', '*.md', '*.d.ts',
            'cp936.json', 'cp949.json', 'cp950.json', 'eucjp.json',
            'gbk-added.json', 'shiftjis.json', 'big5-added.json',
            'gb18030-ranges.json', 'gb18030.json', 'codes.json', 'types.json'
        ],
        fullDirectoryScan: true,
        fullDirectoryScanMaxFiles: 100000,
        fullDirectoryScanSkipDirs: ['.simplebeacon', '.github', '.husky', 'coverage', 'dist', 'build']
    }, null, 2));

    const offlineFlag = options.offline !== false ? '--offline' : '';
    const fullScanFlag = options.fullDirectoryScan ? '--full' : '';
    const nodePath = process.execPath;
    const scanCmd = `"${nodePath}" "${cliBin}" scan --path "${projectPath}" --config "${configPath}" --format json --output "${reportOut}" ${offlineFlag} ${fullScanFlag}`;

    const onProgress = options.onProgress;
    let progressTimer = null;
    let fileCount = 0;

    if (typeof onProgress === 'function') {
        fileCount = countFilesSync(projectPath);
        onProgress({ current: 0, total: fileCount, filename: 'Counting files...', percent: 0 });
        // Pulse progress every 3s so UI doesn't look frozen during long CLI run
        let pulse = 0;
        progressTimer = setInterval(() => {
            pulse += 3;
            const heuristic = Math.min(fileCount, Math.round(fileCount * (pulse / 120))); // assume ~2 min
            onProgress({ current: heuristic, total: fileCount, filename: 'Simplebeacon CLI scan in progress...', percent: Math.round((heuristic / Math.max(fileCount, 1)) * 100) });
        }, 3000);
    }

    try {
        // No artificial timeout — scan runs as long as needed (RAM-limited only)
        // Do NOT set cwd to projectPath — Windows PATHEXT resolves bare commands to .JS files in cwd via WScript
        const scanEnv = { ...process.env, FORCE_COLOR: '0' };
        if (process.platform === 'win32' && scanEnv.PATHEXT) {
            scanEnv.PATHEXT = scanEnv.PATHEXT.split(';').filter(e => e.toLowerCase() !== '.js').join(';');
        }
        await execAsync(scanCmd, {
            timeout: 0,
            env: scanEnv
        });
    } catch (err) {
        if (!fs.existsSync(reportOut)) throw err;
    } finally {
        if (progressTimer) clearInterval(progressTimer);
    }

    if (typeof onProgress === 'function') {
        onProgress({ current: fileCount, total: fileCount, filename: 'Scan complete', percent: 100 });
    }

    return JSON.parse(fs.readFileSync(reportOut, 'utf8'));
}

// Run additional analyses — maps all 11 frontend types to backend analyzers
async function runAnalysis(type, projectPath, baseReport) {
    const results = { simplebeacon: baseReport };
    const runComplete = type === 'complete';
    
    // 1. Codebase analysis
    if (type === 'codebase' || runComplete) {
        try {
            const { analyzeCodebase } = require('./server/lib/codebase-analyzer.cjs');
            const scanJob = scanJobs.get(projectPath);
            const progressCb = scanJob ? (p) => { scanJob.current = p.current; scanJob.total = p.total; scanJob.filename = p.filename; scanJob.percent = p.percent; } : null;
            results.codebase = await analyzeCodebase(projectPath, { context: 'complete', scanProfile: 'default', onProgress: progressCb });
        } catch (e) {
            results.codebase = { error: e.message };
        }
    }
    
    // 2. npm audit
    if (type === 'npm-audit' || runComplete) {
        try {
            const { runNpmAuditAsync } = require('./server/lib/npm-audit-runner.cjs');
            results.npmAudit = await runNpmAuditAsync(projectPath, { force: false });
        } catch (e) {
            results.npmAudit = { error: e.message };
        }
    }
    
    // 3. Compliance checklist
    if (type === 'compliance' || runComplete) {
        try {
            const { evaluateComplianceChecklist } = require('./packages/simplebeacon-cli/src/compliance-checklist');
            results.compliance = evaluateComplianceChecklist(baseReport);
        } catch (e) {
            results.compliance = { error: e.message };
        }
    }
    
    // 4. Data cleanup / file reduction / data quality / cleanup assistant (all share the same engine)
    if (['data-cleanup', 'file-reduction', 'data-quality', 'cleanup-assistant'].includes(type) || runComplete) {
        try {
            const { runDataCleanupScan } = require('./server/lib/data-cleanup-scan.cjs');
            const profile = type === 'file-reduction' ? 'file-reduction' : type === 'data-quality' ? 'data-quality' : 'all';
            results.dataCleanup = await runDataCleanupScan(projectPath, { profile });
            // Also alias for frontend-specific names
            results.fileReduction = results.dataCleanup;
            results.dataQuality = results.dataCleanup;
            results.cleanupAssistant = results.dataCleanup;
        } catch (e) {
            results.dataCleanup = { error: e.message };
            results.fileReduction = { error: e.message };
            results.dataQuality = { error: e.message };
            results.cleanupAssistant = { error: e.message };
        }
    }
    
    // 5. EU AI Act audit
    if (type === 'eu-ai-act' || runComplete) {
        try {
            const { buildEuAiActAuditReport } = require('./server/lib/eu-ai-act-audit-report.cjs');
            results.euAiAct = await buildEuAiActAuditReport({ projectPath });
        } catch (e) {
            results.euAiAct = { error: e.message };
        }
    }
    
    // 6. Roadmap (dynamic generator)
    if (type === 'roadmap' || runComplete) {
        try {
            const { generateCodeRoadmap } = require('./server/lib/code-roadmap-generator.cjs');
            results.roadmap = await generateCodeRoadmap(projectPath, {}, { scanReport: baseReport, includeFiles: true });
        } catch (e) {
            results.roadmap = { error: e.message };
        }
    }
    
    // 7. Mock scan / consolidation (uses the base report as a mock-style summary)
    if (['mock-scan', 'consolidation'].includes(type) || runComplete) {
        try {
            results.mockScan = {
                summary: 'Mock scan summary based on gate report',
                filesScanned: baseReport.filesAnalyzed || 0,
                issuesFound: baseReport.issueCount || 0,
                qualityScore: baseReport.qualityScore || 0,
                generatedAt: new Date().toISOString()
            };
            results.consolidation = results.mockScan;
        } catch (e) {
            results.mockScan = { error: e.message };
            results.consolidation = { error: e.message };
        }
    }
    
    return results;
}

const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin || req.headers.referer || '*';
    setCorsHeaders(res, origin);
    
    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    
    // Health check
    if (req.url === '/api/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            platform: 'Simplebeacon MCP',
            version: '1.0.0',
            mode: 'air-gapped'
        }));
        return;
    }

    // Resend license token
    if (req.url === '/api/simplebeacon/billing/resend-token' && req.method === 'POST') {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', async () => {
            try {
                const body = JSON.parse(Buffer.concat(chunks).toString());
                const email = String(body.email || '').trim().toLowerCase();
                if (!email || !email.includes('@')) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'email is required' }));
                    return;
                }
                const storePath = path.join(__dirname, '.simplebeacon', 'subscriptions.json');
                let record = null;
                if (fs.existsSync(storePath)) {
                    const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
                    record = Object.values(store.subscriptions || {}).find(
                        (s) => String(s.email || '').toLowerCase() === email && s.licenseToken
                    );
                }
                if (!record) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, redirectToPricing: true, error: 'No token found for this email' }));
                    return;
                }

                // Send token via email instead of returning it in the response
                const emailResult = await sendEmail({
                    to: record.email,
                    subject: 'Your Simplebeacon License Token',
                    text: `Here is your Simplebeacon license token:\n\n${record.licenseToken}\n\nTier: ${record.licenseTier || record.product || 'executive'}\n\nKeep this token safe — it is your key to accessing the Simplebeacon dashboard and generating certificates.`,
                    html: `<p>Here is your Simplebeacon license token:</p><pre style="background:#f4f4f4;padding:12px;border-radius:6px;word-break:break-all;">${record.licenseToken}</pre><p>Tier: <strong>${record.licenseTier || record.product || 'executive'}</strong></p><p>Keep this token safe — it is your key to accessing the Simplebeacon dashboard and generating certificates.</p>`
                });

                if (emailResult.sent || emailResult.queued) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, sent: true, message: 'Token sent to your inbox. Check your email (and spam folder).' }));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: emailResult.error || 'Failed to send email' }));
                }
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }
    
    // Free community token generation
    if (req.url === '/api/free-token' && req.method === 'GET') {
        try {
            const token = generateLicenseToken({
                email: 'community@simplebeacon.local',
                tier: 'community',
                features: ['scan', 'certificate'],
                clientName: 'Community User',
                projectName: 'Community Scan'
            }, 'simplebeacon-dev-insecure', 525600); // 1 year expiry
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, token, tier: 'community' }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
        }
        return;
    }

    // Upload and analyze directory — streams uploads directly to disk via busboy for reliability
    if (req.url === '/api/analyze/upload-directory' && req.method === 'POST') {
        const tmpDir = path.join(os.tmpdir(), `sb-upload-${Date.now()}`);
        fs.mkdirSync(tmpDir, { recursive: true });

        let token = '';
        let analysisType = 'simplebeacon';
        let filesReceived = 0;
        let busboyError = null;
        let filePathsList = [];
        const pendingWrites = [];

        function sanitizeUploadPath(rawPath) {
            let safe = String(rawPath || '')
                .replace(/^[\\/]+/, '')
                .replace(/\.\.[\\/]/g, '');
            safe = safe.split('').filter((c) => {
                const code = c.charCodeAt(0);
                return code > 31 && code !== 127;
            }).join('');
            return safe;
        }

        const busboy = Busboy({ headers: req.headers });

        busboy.on('field', (name, value) => {
            console.log('[MCP HTTP] Field received:', name, 'length:', value.length);
            if (name === 'licenseToken') token = value.trim();
            else if (name === 'analysisType') analysisType = value.trim().toLowerCase();
            else if (name === 'filePaths') {
                try { filePathsList = JSON.parse(value); console.log('[MCP HTTP] filePaths count:', filePathsList.length); } catch (e) { filePathsList = []; }
            }
        });

        busboy.on('file', (name, fileStream, info) => {
            console.log('[MCP HTTP] File received:', info.filename, 'field:', name);
            const relPath = filePathsList.length > 0 ? filePathsList.shift() : (info.filename || 'unknown');
            const safePath = sanitizeUploadPath(relPath);
            const outPath = path.join(tmpDir, safePath);
            const writePromise = new Promise((resolve, reject) => {
                try {
                    fs.mkdirSync(path.dirname(outPath), { recursive: true });
                    const writeStream = fs.createWriteStream(outPath);
                    fileStream.pipe(writeStream);
                    writeStream.on('finish', () => { console.log('[MCP HTTP] File written:', safePath); filesReceived++; resolve(); });
                    writeStream.on('error', (err) => { console.error('[MCP HTTP] Write stream error:', safePath, err.message); reject(err); });
                    fileStream.on('error', (err) => { console.error('[MCP HTTP] File stream error:', safePath, err.message); reject(err); });
                } catch (err) {
                    console.error('[MCP HTTP] File write error:', safePath, err.message);
                    fileStream.resume();
                    reject(err);
                }
            });
            pendingWrites.push(writePromise);
        });

        busboy.on('error', (err) => {
            busboyError = err;
            console.error('[MCP HTTP] Busboy error:', err.message);
        });

        busboy.on('finish', async () => {
            if (busboyError) {
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Upload parse failed: ' + busboyError.message }));
                }
                try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
                return;
            }

            // Wait for all file writes to complete before checking count
            await Promise.allSettled(pendingWrites);

            try {
                const record = await validateToken(token);
                if (!record) {
                    if (!res.headersSent) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Invalid license token' }));
                    }
                    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
                    return;
                }
                if (filesReceived === 0) {
                    if (!res.headersSent) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'No files uploaded' }));
                    }
                    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
                    return;
                }

                // Extract any uploaded zip archives so all files are available for scanning
                extractZipIfNeeded(tmpDir);

                const scanId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                scanJobs.set(tmpDir, { status: 'scanning', current: 0, total: 0, filename: '', percent: 0, reportJson: null, error: null, analysisType, scanId });

                if (!res.headersSent) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, scanId, status: 'scanning', filesReceived }));
                }

                // Run scan in background using zero-retention pipeline
                setImmediate(async () => {
                    let sandboxDir = null;
                    try {
                        // Copy uploaded files into isolated sandbox for guaranteed cleanup
                        const { generateSandboxId, copyDirectorySync } = require('./server/utils/data-processor.cjs');
                        const sandboxRoot = path.join(os.tmpdir(), 'simplebeacon_sandbox');
                        if (!fs.existsSync(sandboxRoot)) fs.mkdirSync(sandboxRoot, { recursive: true });
                        sandboxDir = path.join(sandboxRoot, generateSandboxId());
                        copyDirectorySync(tmpDir, sandboxDir);

                        const scanJob = scanJobs.get(tmpDir);
                        const progressCb = scanJob ? (p) => { scanJob.current = p.current; scanJob.total = p.total; scanJob.filename = p.filename; scanJob.percent = p.percent; } : null;
                        const report = await runScan(sandboxDir, { offline: true, fullDirectoryScan: true, onProgress: progressCb });
                        const results = await runAnalysis(analysisType, sandboxDir, report);
                        let reportJson = report;
                        const typeMap = {
                            'codebase': results.codebase, 'npm-audit': results.npmAudit, 'compliance': results.compliance,
                            'data-cleanup': results.dataCleanup, 'file-reduction': results.fileReduction,
                            'data-quality': results.dataQuality, 'cleanup-assistant': results.cleanupAssistant,
                            'eu-ai-act': results.euAiAct, 'roadmap': results.roadmap,
                            'mock-scan': results.mockScan, 'consolidation': results.consolidation
                        };
                        if (analysisType !== 'simplebeacon' && analysisType !== 'complete' && typeMap[analysisType]) {
                            const specific = typeMap[analysisType];
                            if (specific) reportJson = specific;
                        }
                        if (analysisType === 'complete') reportJson = { ...report, _completeResults: results };

                        const job = scanJobs.get(tmpDir);
                        if (job) {
                            job.status = 'complete';
                            job.reportJson = reportJson;
                            job.results = results;
                            console.log('[MCP HTTP] Scan complete. reportJson type:', typeof reportJson, 'keys:', reportJson ? Object.keys(reportJson).slice(0, 5) : 'null');
                        }
                    } catch (err) {
                        const job = scanJobs.get(tmpDir);
                        if (job) { job.status = 'error'; job.error = err.message; }
                        console.error('[MCP HTTP] Background scan failed:', err.message);
                    } finally {
                        // ZERO-RETENTION ENFORCER: purge all user code immediately, keep only report JSON in memory
                        wipeDirectorySync(sandboxDir);
                        wipeDirectorySync(tmpDir);
                        console.log('[MCP HTTP] Zero-retention purge complete. Source code wiped from disk.');
                    }
                });
            } catch (error) {
                console.error('[MCP HTTP] Upload/scan init failed:', error.message);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: error.message }));
                }
                try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
            }
        });

        req.on('error', (err) => {
            console.error('[MCP HTTP] Upload stream error:', err.message);
            busboy.destroy(err);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Upload stream failed: ' + err.message }));
            }
        });

        req.pipe(busboy);
        return;
    }

    // Poll scan progress
    if (req.url.startsWith('/api/analyze/progress') && req.method === 'GET') {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const scanId = url.searchParams.get('scanId');
        let job = null;
        for (const [, value] of scanJobs) { if (value.scanId === scanId) { job = value; break; } }
        if (!job) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Scan not found' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true, status: job.status, current: job.current, total: job.total,
            filename: job.filename, percent: job.percent,
            reportJson: job.status === 'complete' ? job.reportJson : undefined, error: job.error
        }));
        return;
    }
    
    // Download certificate ZIP from report JSON
    if (req.url === '/api/reports/download' && req.method === 'POST') {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', async () => {
            try {
                const body = JSON.parse(Buffer.concat(chunks).toString());
                const authHeader = String(req.headers.authorization || '');
                const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
                const licenseToken = bearerToken || String(body.licenseToken || '').trim();
                const reportJson = body.reportJson || body.report || null;
                
                if (!licenseToken) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'licenseToken is required' }));
                    return;
                }
                if (!reportJson || typeof reportJson !== 'object') {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'reportJson is required' }));
                    return;
                }
                
                // Validate token
                const record = await validateToken(licenseToken);
                if (!record) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Invalid license token' }));
                    return;
                }
                
                // Strip _completeResults from main report to keep certificate/audit clean
                // (completeResults are added as individual JSON files below)
                const completeResults = reportJson._completeResults || {};
                const cleanReport = { ...reportJson };
                delete cleanReport._completeResults;
                
                // Generate certificate HTML
                const { buildCertificateModel, renderCertificateHtml } = require('./server/lib/code-hygiene-certificate.cjs');
                const deliveryId = `delivery_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const certificateModel = buildCertificateModel({
                    report: cleanReport,
                    certificate_id: deliveryId,
                    generated_at: new Date().toISOString(),
                    milestone: 'release',
                    client_name: record.email || 'Client',
                    project_name: cleanReport.projectName || cleanReport.scanTargetRoot || 'Project',
                    agency_name: 'SimpleBeacon',
                    branding: { agency_name: 'SimpleBeacon' }
                });
                const certificateHtml = renderCertificateHtml(certificateModel);
                
                // Generate executive audit report HTML
                let auditReportHtml = null;
                try {
                    const { buildCompleteAuditReport } = require('./server/lib/complete-scan-audit-report.cjs');
                    const totalScanned = cleanReport.ruleScopedFilesAnalyzed
                        || cleanReport.repositoryFilesTotal
                        || cleanReport.llmSlopFilesScanned
                        || cleanReport.filesAnalyzed
                        || 0;
                    const completeScanPayload = {
                        type: 'simplebeacon-complete-scan',
                        version: '1.3.0',
                        generatedAt: new Date().toISOString(),
                        projectPath: cleanReport.projectRoot || cleanReport.scanTargetRoot || '',
                        results: {
                            simplebeacon: cleanReport,
                            codebase: {
                                summary: {
                                    codeFilesAnalyzed: totalScanned,
                                    productionFilesScanned: cleanReport.productionLeakScanned || 0,
                                    productionFindings: cleanReport.productionLeakFindings || 0
                                }
                            }
                        }
                    };
                    const auditResult = await buildCompleteAuditReport(completeScanPayload, {
                        client: record.email || 'Client',
                        company: record.email || 'Client',
                        assessor: 'SimpleBeacon',
                        aiProvider: 'demo'
                    });
                    auditReportHtml = auditResult.html;
                } catch (auditErr) {
                    console.warn('[MCP HTTP] Audit report generation skipped:', auditErr.message);
                }
                
                // Build minimal ZIP with report JSON + certificate HTML
                const archiver = require('archiver');
                const { PassThrough } = require('stream');
                const pass = new PassThrough();
                const zipChunks = [];
                pass.on('data', (c) => zipChunks.push(c));
                
                const archive = archiver('zip', { zlib: { level: 9 } });
                archive.pipe(pass);
                
                const date = new Date().toISOString().slice(0, 10);
                const slug = String(cleanReport.projectRoot || cleanReport.scanTargetRoot || 'project')
                    .replace(/[\\/]/g, '-').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40);
                const root = `simplebeacon-export-${record.licenseTier || 'operator'}-${slug}-${date}`;
                
                // Certificate + individual reports for each analyzer
                archive.append(certificateHtml, { name: `${root}/reports/agency-certificate.html` });
                if (auditReportHtml) {
                    archive.append(auditReportHtml, { name: `${root}/reports/executive-audit.html` });
                }
                archive.append(JSON.stringify(cleanReport, null, 2), { name: `${root}/json/simplebeacon-gate.json` });
                
                // Add individual analyzer JSON files from complete scan results
                const analyzerFiles = [
                    { key: 'codebase', filename: 'codebase-summary.json' },
                    { key: 'npmAudit', filename: 'npm-audit-summary.json' },
                    { key: 'compliance', filename: 'compliance-checklist.json' },
                    { key: 'dataCleanup', filename: 'data-cleanup-summary.json' },
                    { key: 'euAiAct', filename: 'eu-ai-act-assessment.json' },
                    { key: 'roadmap', filename: 'roadmap-plan.json' },
                    { key: 'mockScan', filename: 'mock-scan-summary.json' },
                    { key: 'consolidation', filename: 'consolidation-report.json' }
                ];
                for (const { key, filename } of analyzerFiles) {
                    const data = completeResults[key];
                    if (data && !data.error) {
                        archive.append(JSON.stringify(data, null, 2), { name: `${root}/json/${filename}` });
                    }
                }
                
                // Public summary (redacted)
                const publicSummary = {
                    certificateId: deliveryId,
                    generatedAt: new Date().toISOString(),
                    projectName: cleanReport.projectName || cleanReport.scanTargetRoot || 'Project',
                    totalFiles: cleanReport.totalFiles || cleanReport.filesAnalyzed || 0,
                    filesAnalyzed: cleanReport.filesAnalyzed || 0,
                    ruleScopedFilesAnalyzed: cleanReport.ruleScopedFilesAnalyzed || 0,
                    issueCount: cleanReport.issueCount || 0,
                    qualityScore: cleanReport.qualityScore || 0,
                    gatePass: cleanReport.gate?.pass === true,
                    analyzersRun: Object.keys(completeResults).filter(k => !completeResults[k]?.error),
                    privacy: { mode: 'air-gapped', dataRemainsLocal: true }
                };
                archive.append(JSON.stringify(publicSummary, null, 2), { name: `${root}/json/public-summary.json` });
                
                // Re-attestation note
                const reAttestationNote = {
                    note: 'Re-attestation available',
                    certificateId: deliveryId,
                    generatedAt: new Date().toISOString(),
                    instructions: 'Upload updated files and re-run Complete Scan to generate a new certificate with fresh attestation.',
                    privacyGuarantee: 'All re-scans remain fully air-gapped. No data leaves this machine.'
                };
                archive.append(JSON.stringify(reAttestationNote, null, 2), { name: `${root}/json/re-attestation-note.json` });
                
                archive.append('SimpleBeacon Certificate Export\n\nOpen reports/agency-certificate.html in any browser and print to PDF (Ctrl+P / Cmd+P → Save as PDF).\n\nFor the full executive audit, open reports/executive-audit.html.\n\nIndividual analyzer results are in the json/ folder.\n', { name: `${root}/README.txt` });
                await archive.finalize();
                pass.end();
                
                const zipBuffer = Buffer.concat(zipChunks);
                const zipFilename = `${root}.zip`;
                
                res.writeHead(200, {
                    'Content-Type': 'application/zip',
                    'Content-Disposition': `attachment; filename="${zipFilename}"`,
                    'Content-Length': zipBuffer.length
                });
                res.end(zipBuffer);
                
            } catch (error) {
                console.error('[MCP HTTP] Download error:', error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }
    
    // Default 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Not found' }));
});

const PORT = process.env.MCP_HTTP_PORT || 54355;
server.listen(PORT, () => {
    console.log(`[MCP HTTP] Server running on http://localhost:${PORT}`);
    console.log(`[MCP HTTP] Mode: air-gapped (offline scanning enforced)`);
    console.log(`[MCP HTTP] All scans run locally via Simplebeacon CLI MCP tools`);
});

module.exports = { server };
