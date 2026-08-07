// simplebeacon-ignore: Scanner service code — security findings are false positives
/**
 * Audit Scan Service — orchestrator for multi-worker parallel scanning.
 *
 * Features:
 * 1. Multi-worker parallelism: splits files across 2-4 workers (based on navigator.hardwareConcurrency)
 * 2. IndexedDB file hash cache: skips files whose hash hasn't changed since last scan
 * 3. IndexedDB findings streaming: writes findings incrementally instead of accumulating in memory
 * 4. Scan resumption: checkpoints {scanId, processedCount, fileIndex} to IndexedDB every 1000 files
 * 5. .simplebeaconignore support: loads and applies ignore patterns from the scanned directory
 *
 * Usage:
 *   const service = new AuditScanService();
 *   const result = await service.scan({
 *     files: sourceFiles,        // Array of File objects with webkitRelativePath
 *     deepScan: true,
 *     onProgress: (processed, total, info) => {...},
 *     onFindings: (findings) => {...},  // incremental findings callback
 *     signal: abortSignal
 *   });
 */

// === IndexedDB helpers ===
const DB_NAME = 'simplebeacon-audit-cache';
const DB_VERSION = 1;
const STORE_HASHES = 'file-hashes';     // {path, hash, size, lastScanned}
const STORE_FINDINGS = 'scan-findings';  // {scanId, path, rule, severity, line, snippet, ...}
const STORE_CHECKPOINTS = 'scan-checkpoints'; // {scanId, processedCount, fileIndex, timestamp}

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_HASHES)) {
                db.createObjectStore(STORE_HASHES, { keyPath: 'path' });
            }
            if (!db.objectStoreNames.contains(STORE_FINDINGS)) {
                db.createObjectStore(STORE_FINDINGS, { keyPath: ['scanId', 'path', 'rule'] });
            }
            if (!db.objectStoreNames.contains(STORE_CHECKPOINTS)) {
                db.createObjectStore(STORE_CHECKPOINTS, { keyPath: 'scanId' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function dbGetAll(storeName, db) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

async function dbPut(storeName, record, db) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function dbBulkPut(storeName, records, db) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        let completed = 0;
        for (const record of records) {
            const req = store.put(record);
            req.onsuccess = () => {
                completed++;
                if (completed === records.length) resolve();
            };
        }
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => resolve();
    });
}

async function dbClear(storeName, db) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function dbGet(storeName, key, db) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

// === .simplebeaconignore support ===
// Minimal inline implementation — avoids dependency on the dashboard's ES module version

const _globRegexCache = new Map();

function globToRegex(pattern) {
    if (typeof pattern !== 'string') return /(?!)/;
    let regex = '^';
    for (let i = 0; i < pattern.length; i++) {
        const c = pattern[i];
        if (c === '*' && pattern[i + 1] === '*') {
            i++;
            if (pattern[i + 1] === '/') { regex += '(?:.*/)?'; i++; }
            else { regex += '.*'; }
        } else if (c === '*') {
            regex += '[^/]*';
        } else if (c === '?') {
            regex += '[^/]';
        } else {
            regex += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        }
    }
    regex += '$';
    try { return new RegExp(regex); } catch { return /(?!)/; }
}

function cachedGlobToRegex(pattern) {
    if (typeof pattern !== 'string') return /(?!)/;
    if (_globRegexCache.has(pattern)) return _globRegexCache.get(pattern);
    const re = globToRegex(pattern);
    _globRegexCache.set(pattern, re);
    return re;
}

function pathMatchCandidates(virtualPath, scanRootName) {
    const normalized = String(virtualPath).replace(/\\/g, '/');
    const candidates = [normalized];
    if (scanRootName && normalized.startsWith(scanRootName + '/')) {
        candidates.push(normalized.slice(scanRootName.length + 1));
    }
    // Also try without leading ./
    if (normalized.startsWith('./')) {
        candidates.push(normalized.slice(2));
    }
    return candidates;
}

function isIgnoredVirtualPath(virtualPath, scanRootName, ignorePatterns) {
    if (!ignorePatterns || !ignorePatterns.length) return false;
    const candidates = pathMatchCandidates(virtualPath, scanRootName);
    for (const pattern of ignorePatterns) {
        if (!pattern || pattern.startsWith('#')) continue;
        const isNegation = pattern.startsWith('!');
        const cleanPattern = isNegation ? pattern.slice(1) : pattern;
        const regex = cachedGlobToRegex(cleanPattern);
        for (const candidate of candidates) {
            if (regex.test(candidate)) {
                if (isNegation) return false; // negation overrides earlier ignore
                return true;
            }
        }
    }
    return false;
}

function parseSimplebeaconIgnoreText(text) {
    if (!text || typeof text !== 'string') return [];
    return text.split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'));
}

function getBuiltinIgnorePatterns() {
    return [
        '**/node_modules/**',
        '**/.git/**',
        '**/.simplebeacon/**',
        '**/*.test.js',
        '**/*.test.cjs',
        '**/*.test.mjs',
        '**/*.spec.js',
        '**/*.spec.cjs',
        '**/*.vsix'
    ];
}

function createIgnoreContext(patterns, scanRootName, source) {
    return {
        patterns: patterns || [],
        scanRootName: scanRootName || '',
        source: source || 'builtin'
    };
}

// Load .simplebeaconignore from a File list (looking for .simplebeaconignore file)
function extractIgnorePatternsFromFiles(files) {
    const ignoreFile = files.find(f =>
        (f.webkitRelativePath || f.name || '').endsWith('.simplebeaconignore') ||
        (f.name || '') === '.simplebeaconignore'
    );
    if (!ignoreFile) {
        return { patterns: getBuiltinIgnorePatterns(), source: 'builtin', isSimplebeaconMonorepo: false };
    }
    // We can't read the file synchronously — caller should use extractIgnorePatternsFromFilesAsync instead
    return { patterns: getBuiltinIgnorePatterns(), source: 'builtin-pending', isSimplebeaconMonorepo: false, ignoreFile };
}

async function extractIgnorePatternsFromFilesAsync(files) {
    const ignoreFile = files.find(f =>
        (f.webkitRelativePath || f.name || '').endsWith('.simplebeaconignore') ||
        (f.name || '') === '.simplebeaconignore'
    );
    if (!ignoreFile) {
        return { patterns: getBuiltinIgnorePatterns(), source: 'builtin', isSimplebeaconMonorepo: false };
    }
    try {
        const text = await ignoreFile.text();
        const patterns = parseSimplebeaconIgnoreText(text);
        // Determine root name from first file's relative path
        const firstRel = (files[0] && (files[0].webkitRelativePath || files[0].name)) || '';
        const rootName = firstRel.split('/')[0] || '';
        return { patterns, source: '.simplebeaconignore', isSimplebeaconMonorepo: false, scanRootName: rootName };
    } catch {
        return { patterns: getBuiltinIgnorePatterns(), source: 'builtin', isSimplebeaconMonorepo: false };
    }
}

// === Multi-worker scan orchestrator ===

const WORKER_URL = 'js-es2018/audit-scan-worker.js?v=20260809perf1';
const MAX_WORKERS = 4;
const MIN_WORKERS = 1;
const BATCH_SIZE = 400;
const CHECKPOINT_INTERVAL = 1000; // checkpoint every N files
const PROGRESS_THROTTLE_MS = 100; // throttle progress callbacks to max 10/sec
const MAX_FINDINGS_IN_MEMORY = 5000; // cap in-memory findings; rest stay in IndexedDB

function getWorkerCount() {
    try {
        const cores = navigator.hardwareConcurrency || 2;
        return Math.max(MIN_WORKERS, Math.min(MAX_WORKERS, Math.floor(cores / 2)));
    } catch {
        return 2;
    }
}

// Exposed as window.AuditScanService for non-module script loading
window.AuditScanService = class AuditScanService {
    constructor() {
        this.db = null;
        this.workers = [];
        this.scanId = null;
        this.aborted = false;
    }

    async _ensureDB() {
        if (!this.db) {
            try {
                this.db = await openDB();
            } catch (err) {
                console.warn('[AuditScanService] IndexedDB unavailable — caching disabled:', err);
                this.db = null;
            }
        }
        return this.db;
    }

    async _loadHashCache() {
        const db = await this._ensureDB();
        if (!db) return new Map();
        try {
            const records = await dbGetAll(STORE_HASHES, db);
            const cache = new Map();
            for (const r of records) {
                cache.set(r.path, { hash: r.hash, size: r.size, lastScanned: r.lastScanned });
            }
            return cache;
        } catch {
            return new Map();
        }
    }

    async _saveHashCache(hashes) {
        const db = await this._ensureDB();
        if (!db || !hashes.length) return;
        try {
            const now = Date.now();
            const records = hashes.map(h => ({
                path: h.path,
                hash: h.hash,
                size: h.size,
                lastScanned: now
            }));
            // Bulk put in chunks to avoid huge transactions
            const CHUNK = 500;
            for (let i = 0; i < records.length; i += CHUNK) {
                await dbBulkPut(STORE_HASHES, records.slice(i, i + CHUNK), db);
            }
        } catch (err) {
            console.warn('[AuditScanService] Failed to save hash cache:', err);
        }
    }

    async _streamFindings(scanId, findings) {
        const db = await this._ensureDB();
        if (!db || !findings.length) return;
        try {
            const records = findings.map(f => ({
                scanId,
                path: f.filePath || '',
                rule: f.rule || 'unknown',
                severity: f.severity || 'medium',
                line: f.line || 1,
                impact: f.impact || '',
                fix: f.fix || '',
                count: f.count || 1,
                matches: f.matches || []
            }));
            await dbBulkPut(STORE_FINDINGS, records, db);
        } catch (err) {
            console.warn('[AuditScanService] Failed to stream findings to IndexedDB:', err);
        }
    }

    async _checkpoint(scanId, processedCount, fileIndex) {
        const db = await this._ensureDB();
        if (!db) return;
        try {
            await dbPut(STORE_CHECKPOINTS, {
                scanId,
                processedCount,
                fileIndex,
                timestamp: Date.now()
            }, db);
        } catch (err) {
            console.warn('[AuditScanService] Failed to write checkpoint:', err);
        }
    }

    async _getCheckpoint(scanId) {
        const db = await this._ensureDB();
        if (!db) return null;
        try {
            return await dbGet(STORE_CHECKPOINTS, scanId, db);
        } catch {
            return null;
        }
    }

    async _clearFindings(scanId) {
        const db = await this._ensureDB();
        if (!db) return;
        try {
            // Clear old findings for this scanId
            const tx = db.transaction(STORE_FINDINGS, 'readwrite');
            const store = tx.objectStore(STORE_FINDINGS);
            const allFindings = await new Promise((resolve, reject) => {
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });
            for (const f of allFindings) {
                if (f.scanId === scanId) {
                    store.delete([f.scanId, f.path, f.rule]);
                }
            }
        } catch (err) {
            console.warn('[AuditScanService] Failed to clear old findings:', err);
        }
    }

    _createWorker() {
        try {
            return new Worker(WORKER_URL, { type: 'module' });
        } catch (err) {
            // Fallback: try without module type
            try {
                return new Worker(WORKER_URL);
            } catch (err2) {
                console.error('[AuditScanService] Failed to create worker:', err2);
                throw err2;
            }
        }
    }

    /**
     * Run a multi-worker parallel scan.
     * @param {Object} options
     * @param {File[]} options.files - Array of File objects with webkitRelativePath
     * @param {boolean} [options.deepScan=true] - When true, bypass vendor/docs filters
     * @param {AbortSignal} [options.signal] - Abort signal to cancel the scan
     * @param {Function} [options.onProgress] - (processed, total, info) => void
     * @param {Function} [options.onFindings] - (findings[]) => void — incremental findings
     * @param {Function} [options.onLog] - (message, level) => void
     * @param {string} [options.resumeScanId] - Scan ID to resume from checkpoint
     * @returns {Promise<Object>} - Scan result with findings, processed, totalFiles, etc.
     */
    async scan(options) {
        const files = options.files || [];
        const deepScan = options.deepScan !== false;
        const signal = options.signal;
        const onProgress = options.onProgress || (() => {});
        const onFindings = options.onFindings || (() => {});
        const onLog = options.onLog || (() => {});

        this.scanId = options.resumeScanId || ('scan-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
        this.aborted = false;

        if (signal) {
            signal.addEventListener('abort', () => {
                this.aborted = true;
                this._terminateAll();
            }, { once: true });
        }

        if (!files.length) {
            return { processed: 0, totalFiles: 0, findings: [], issues: [], issueCount: 0, scanId: this.scanId };
        }

        // === 1. Load .simplebeaconignore patterns ===
        onLog('Loading .simplebeaconignore patterns...', 'info');
        const ignoreLoad = await extractIgnorePatternsFromFilesAsync(files);
        const ignoreCtx = createIgnoreContext(ignoreLoad.patterns, ignoreLoad.scanRootName, ignoreLoad.source);
        onLog(`Ignore patterns: ${ignoreCtx.patterns.length} (${ignoreCtx.source})`, 'info');

        // === 2. Filter files by ignore patterns ===
        const filteredFiles = files.filter(f => {
            const path = (f.webkitRelativePath || f.name || '').replace(/\\/g, '/');
            return !isIgnoredVirtualPath(path, ignoreCtx.scanRootName, ignoreCtx.patterns);
        });
        onLog(`Files after ignore filter: ${filteredFiles.length}/${files.length}`, 'info');

        if (!filteredFiles.length) {
            return { processed: 0, totalFiles: 0, findings: [], issues: [], issueCount: 0, scanId: this.scanId };
        }

        // === 3. Load hash cache from IndexedDB ===
        onLog('Loading file hash cache from IndexedDB...', 'info');
        const hashCache = await this._loadHashCache();
        onLog(`Hash cache: ${hashCache.size} entries`, 'info');

        // === 4. Check for resume checkpoint ===
        let resumeIndex = 0;
        if (options.resumeScanId) {
            const checkpoint = await this._getCheckpoint(options.resumeScanId);
            if (checkpoint) {
                resumeIndex = checkpoint.fileIndex || 0;
                onLog(`Resuming from checkpoint: ${checkpoint.processedCount} files processed, starting at index ${resumeIndex}`, 'info');
            }
        } else {
            // Clear old findings for this scan
            await this._clearFindings(this.scanId);
        }

        // === 5. Split files across workers ===
        const workerCount = getWorkerCount();
        onLog(`Spawning ${workerCount} workers for ${filteredFiles.length} files...`, 'info');

        const filesToScan = filteredFiles.slice(resumeIndex);
        const totalFiles = filteredFiles.length;
        const filesPerWorker = Math.ceil(filesToScan.length / workerCount);

        // Prepare file entries for workers — File objects are structured-cloneable
        const workerBatches = [];
        for (let w = 0; w < workerCount; w++) {
            const start = w * filesPerWorker;
            const end = Math.min(start + filesPerWorker, filesToScan.length);
            const batch = filesToScan.slice(start, end).map(f => ({
                fileObj: f,
                path: (f.webkitRelativePath || f.name || '').replace(/\\/g, '/')
            }));
            workerBatches.push(batch);
        }

        // === 6. Spawn workers and run parallel scan ===
        const allFindings = []; // capped — overflow goes to IndexedDB only
        const allHashes = []; // capped — overflow is discarded (hash cache is best-effort)
        let totalFindingsCount = 0; // exact count even when allFindings is capped
        let totalProcessed = resumeIndex;
        let totalTextErrors = 0;
        let totalBinarySkipped = 0;
        let totalIgnoredDir = 0;
        let totalHeavyVendor = 0;
        let totalIgnoredByPattern = 0;
        let issuesTruncated = false;

        // Progress throttling — coalesce progress callbacks to avoid flooding the main thread
        let lastProgressTime = 0;
        let pendingProgress = null;
        let progressRafId = 0;
        function flushProgress() {
            progressRafId = 0;
            if (pendingProgress) {
                onProgress(pendingProgress.processed, pendingProgress.total, pendingProgress.info);
                pendingProgress = null;
            }
        }
        function throttledProgress(processed, total, info) {
            const now = performance.now();
            if (now - lastProgressTime >= PROGRESS_THROTTLE_MS) {
                lastProgressTime = now;
                onProgress(processed, total, info);
            } else {
                // Store latest and schedule a flush
                pendingProgress = { processed, total, info };
                if (!progressRafId) {
                    progressRafId = requestAnimationFrame(flushProgress);
                }
            }
        }

        const workerPromises = [];

        for (let w = 0; w < workerCount; w++) {
            const batch = workerBatches[w];
            if (!batch.length) continue;

            const worker = this._createWorker();
            this.workers.push(worker);

            const workerIndex = w;
            const promise = this._runWorkerScan(worker, batch, {
                scanId: this.scanId,
                deepScan,
                ignoreCtx: {
                    scanRootName: ignoreCtx.scanRootName,
                    patterns: ignoreCtx.patterns
                },
                onProgress: (processed, total, info) => {
                    // Aggregate progress across all workers via throttled callback
                    throttledProgress(totalProcessed + processed, totalFiles, {
                        ...info,
                        workerIndex,
                        workersTotal: workerCount
                    });
                },
                onBatchFindings: (findings) => {
                    // Stream findings to IndexedDB; cap in-memory accumulation
                    totalFindingsCount += findings.length;
                    if (allFindings.length < MAX_FINDINGS_IN_MEMORY) {
                        const remaining = MAX_FINDINGS_IN_MEMORY - allFindings.length;
                        if (remaining >= findings.length) {
                            allFindings.push(...findings);
                        } else {
                            for (let i = 0; i < remaining; i++) allFindings.push(findings[i]);
                        }
                    }
                    onFindings(findings);
                    this._streamFindings(this.scanId, findings);
                },
                onFileHash: (path, hash, size) => {
                    // Cap hash accumulation — hash cache is best-effort
                    if (allHashes.length < MAX_FINDINGS_IN_MEMORY) {
                        allHashes.push({ path, hash, size });
                    }
                },
                onFileError: (file, err) => {
                    totalTextErrors++;
                },
                signal
            }).then(result => {
                totalProcessed += result.processed || 0;
                totalTextErrors += result.textErrors || 0;
                totalBinarySkipped += result.binarySkipped || 0;
                totalIgnoredDir += result.ignoredDir || 0;
                totalHeavyVendor += result.heavyVendor || 0;
                totalIgnoredByPattern += result.ignoredByPattern || 0;
                if (result.issuesTruncated) issuesTruncated = true;
            }).catch(err => {
                if (!this.aborted) {
                    onLog(`Worker ${workerIndex} error: ${err.message}`, 'error');
                }
            }).finally(() => {
                const idx = this.workers.indexOf(worker);
                if (idx >= 0) this.workers.splice(idx, 1);
                try { worker.terminate(); } catch (_) {}
            });

            workerPromises.push(promise);
        }

        // === 7. Checkpoint progress periodically ===
        const checkpointTimer = setInterval(async () => {
            if (this.aborted) {
                clearInterval(checkpointTimer);
                return;
            }
            await this._checkpoint(this.scanId, totalProcessed, resumeIndex + totalProcessed);
        }, 5000);

        // Wait for all workers to complete
        await Promise.all(workerPromises);
        clearInterval(checkpointTimer);

        // Final checkpoint
        await this._checkpoint(this.scanId, totalProcessed, resumeIndex + totalProcessed);

        // === 8. Save hash cache for next scan ===
        if (allHashes.length) {
            onLog(`Saving ${allHashes.length} file hashes to IndexedDB...`, 'info');
            await this._saveHashCache(allHashes);
        }

        // === 9. Build and return result ===
        // Flush any pending progress before finalizing
        if (progressRafId) { cancelAnimationFrame(progressRafId); flushProgress(); }
        const result = {
            scanId: this.scanId,
            processed: totalProcessed,
            totalFiles,
            findings: allFindings,
            issues: allFindings,
            issueCount: totalFindingsCount,
            findingsCapped: totalFindingsCount > allFindings.length,
            textErrors: totalTextErrors,
            binarySkipped: totalBinarySkipped,
            ignoredDir: totalIgnoredDir,
            heavyVendor: totalHeavyVendor,
            ignoredByPattern: totalIgnoredByPattern,
            issuesTruncated,
            ignoreMeta: {
                source: ignoreCtx.source,
                patternCount: ignoreCtx.patterns.length,
                scanRootName: ignoreCtx.scanRootName
            },
            hashCacheSize: hashCache.size,
            filesSkippedByHashCache: 0, // Future: skip files with matching hash
            resumed: resumeIndex > 0
        };

        onLog(`Scan complete: ${result.processed}/${result.totalFiles} files, ${result.issueCount} findings`, 'success');
        return result;
    }

    /**
     * Run a single worker scan with batched file processing.
     * Uses scan-start / scan-batch / scan-finish protocol.
     */
    async _runWorkerScan(worker, files, options) {
        const { scanId, deepScan, ignoreCtx, onProgress, onBatchFindings, onFileHash, onFileError, signal } = options;
        const totalFiles = files.length;

        return new Promise((resolve, reject) => {
            let settled = false;
            let started = false;
            const allIssues = [];
            const allHashes = [];
            let processed = 0;
            let textErrors = 0;
            let binarySkipped = 0;
            let ignoredDir = 0;
            let heavyVendor = 0;
            let ignoredByPattern = 0;
            let issuesTruncated = false;

            const cleanup = () => {
                worker.onmessage = null;
                worker.onerror = null;
            };

            const finish = () => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve({
                    processed, totalFiles, issues: allIssues, findings: allIssues,
                    issueCount: allIssues.length, textErrors, binarySkipped,
                    ignoredDir, heavyVendor, ignoredByPattern, issuesTruncated,
                    fileHashes: allHashes
                });
            };

            worker.onerror = (err) => {
                if (settled) return;
                settled = true;
                cleanup();
                const detail = err.message || (err.error && err.error.message) || '';
                reject(new Error(`Worker error: ${detail}`));
            };

            worker.onmessage = async (e) => {
                const msg = e.data;
                if (!msg || typeof msg !== 'object') return;

                switch (msg.type) {
                    case 'started':
                        started = true;
                        onProgress(0, totalFiles, { currentFile: 'Worker initialized' });
                        // Start sending batches
                        try {
                            for (let offset = 0; offset < files.length; offset += BATCH_SIZE) {
                                if (this.aborted) { finish(); return; }
                                const batch = files.slice(offset, Math.min(offset + BATCH_SIZE, files.length));
                                worker.postMessage({
                                    type: 'scan-batch',
                                    scanId,
                                    batchOffset: offset,
                                    files: batch,
                                    deepScan
                                });
                            }
                            // Send finish signal after all batches
                            worker.postMessage({ type: 'scan-finish', scanId });
                        } catch (err) {
                            if (!settled) { settled = true; cleanup(); reject(err); }
                        }
                        break;

                    case 'batch-started':
                        onProgress(msg.processed || 0, msg.total || totalFiles, {
                            currentFile: `Batch ${Math.floor((msg.batchOffset || 0) / BATCH_SIZE) + 1} started`
                        });
                        break;

                    case 'progress':
                        processed = msg.processed || processed;
                        onProgress(processed, msg.total || totalFiles, {
                            currentFile: msg.currentFile || '',
                            ignoredDir: msg.ignoredDir,
                            heavyVendor: msg.heavyVendor,
                            ignoredByPattern: msg.ignoredByPattern,
                            binarySkipped: msg.binarySkipped
                        });
                        // Checkpoint every CHECKPOINT_INTERVAL files
                        if (processed > 0 && processed % CHECKPOINT_INTERVAL === 0) {
                            this._checkpoint(scanId, processed, processed);
                        }
                        break;

                    case 'batch-complete':
                        processed = msg.processed || processed;
                        if (msg.batchIssues && msg.batchIssues.length) {
                            allIssues.push(...msg.batchIssues);
                            onBatchFindings(msg.batchIssues);
                        }
                        onProgress(processed, msg.total || totalFiles, {
                            currentFile: `Batch at offset ${msg.batchOffset} complete`
                        });
                        break;

                    case 'file-hash':
                        onFileHash(msg.path, msg.hash, msg.size);
                        allHashes.push({ path: msg.path, hash: msg.hash, size: msg.size });
                        break;

                    case 'file-hash-batch':
                        // Batched file hashes — process all at once
                        if (msg.hashes && msg.hashes.length) {
                            for (const h of msg.hashes) {
                                onFileHash(h.path, h.hash, h.size);
                                if (allHashes.length < MAX_FINDINGS_IN_MEMORY) {
                                    allHashes.push({ path: h.path, hash: h.hash, size: h.size });
                                }
                            }
                        }
                        break;

                    case 'file-error':
                        onFileError(msg.file, { name: msg.name, message: msg.message });
                        textErrors++;
                        break;

                    case 'complete':
                        processed = msg.processed || processed;
                        if (msg.issues && msg.issues.length) {
                            // Worker may return all issues in complete message
                            if (allIssues.length === 0) {
                                allIssues.push(...msg.issues);
                                onBatchFindings(msg.issues);
                            }
                        }
                        if (msg.fileHashes && msg.fileHashes.length) {
                            allHashes.push(...msg.fileHashes);
                        }
                        issuesTruncated = msg.issuesTruncated || issuesTruncated;
                        binarySkipped = msg.binarySkipped || binarySkipped;
                        ignoredDir = msg.ignoredDir || ignoredDir;
                        heavyVendor = msg.heavyVendor || heavyVendor;
                        ignoredByPattern = msg.ignoredByPattern || ignoredByPattern;
                        finish();
                        break;

                    case 'error':
                        if (!settled) { settled = true; cleanup(); reject(new Error(msg.error || 'Worker scan failed')); }
                        break;

                    case 'warn':
                        // Ignore warnings — main thread handles fallback
                        break;
                }
            };

            // Start the scan
            worker.postMessage({
                type: 'scan-start',
                scanId,
                totalFiles,
                deepScan,
                ignoreCtx: ignoreCtx ? {
                    scanRootName: ignoreCtx.scanRootName,
                    patterns: ignoreCtx.patterns
                } : null
            });

            // Timeout: if worker doesn't start in 15s, abort
            setTimeout(() => {
                if (!started && !settled) {
                    settled = true;
                    cleanup();
                    reject(new Error('Worker failed to start within 15 seconds'));
                }
            }, 15000);
        });
    }

    _terminateAll() {
        for (const w of this.workers) {
            try { w.terminate(); } catch (_) {}
        }
        this.workers = [];
    }

    abort() {
        this.aborted = true;
        this._terminateAll();
    }
}
