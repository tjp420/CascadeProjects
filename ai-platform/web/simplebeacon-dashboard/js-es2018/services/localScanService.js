// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
import { showToast } from '../utils.js';
import { canUseDirectoryPicker, isLikelyWebkitDirectoryFileCap, browserFolderCapMessage, isEmbeddedDashboardFrame } from '../utils-lib/dom.js';
import { normalizeSimplebeaconReport } from './analyzeService.js?v=20260715scanfix1';
import {
  createIgnoreContext,
  extractIgnorePatternsFromLegacyFiles,
  filterQueueByIgnore,
  isIgnoredVirtualPath,
  loadIgnorePatternsFromDirHandle
} from '../utils-lib/simplebeaconignore.browser.js?v=20260715scanfix1';
const WORKER_URL = new URL('../workers/scan-worker.js?v=20260715scanfix1', import.meta.url);
const MAX_FILES = 100000;
const SCAN_BATCH_SIZE = 400;
const BATCH_TIMEOUT_MS = 10 * 60 * 1000;
const SKIP_DIRS = /(^|[\\/])(node_modules|\.git|\.github|\.husky|dist|build|\.next|out|coverage|frontend-build|\.github-sync|github-cache|\.simplebeacon|\.cursor|\.windsurf|deployments|backups|\.vscode-test|\.vsix-patch-temp|logs|cache|\.cache|tmp|temp|target|\.wrangler|\.cargo[\\/]registry|\.cargo[\\/]git)([\\/]|$)/i;
/**
 * Recursively collect FileSystemFileHandle entries from a directory handle.
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} pathPrefix
 * @param {Array<{path:string, handle:FileSystemFileHandle}>} files
 * @returns {Promise<Array<{path:string, handle:FileSystemFileHandle}>>}
 */
async function collectFiles(dirHandle, pathPrefix = '', files = [], ignoreCtx = null) {
    if (files.length >= MAX_FILES)
        return files;
    if (ignoreCtx && pathPrefix && isIgnoredVirtualPath(pathPrefix, ignoreCtx.scanRootName, ignoreCtx.patterns)) {
        return files;
    }
    let entryCount = 0;
    for await (const [name, handle] of dirHandle.entries()) {
        const fullPath = pathPrefix ? `${pathPrefix}/${name}` : name;
        if (ignoreCtx && isIgnoredVirtualPath(fullPath, ignoreCtx.scanRootName, ignoreCtx.patterns)) {
            continue;
        }
        if (SKIP_DIRS.test(fullPath))
            continue;
        if (handle.kind === 'directory') {
            await collectFiles(handle, fullPath, files, ignoreCtx);
        }
        else if (handle.kind === 'file') {
            if (name === '.simplebeaconignore')
                continue;
            files.push({ path: fullPath, handle });
        }
        if (files.length >= MAX_FILES)
            break;
        entryCount += 1;
        if (entryCount % 500 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }
    return files;
}
/**
 * Build a Simplebeacon-compatible report from worker findings.
 * @param {string} projectName
 * @param {Array<Object>} findings
 * @param {number} totalFiles
 * @param {number} analyzedFiles
 * @param {Object} [meta]
 * @returns {Object}
 */
function buildReport(projectName, findings, totalFiles, analyzedFiles, meta = {}) {
    const categories = {};
    const findingsList = [];
    const rawIssues = [];
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    if (totalFiles === 0) {
        findingsList.push({
            category: 'scan-empty',
            file: '',
            line: 0,
            severity: 'high',
            message: 'No files were discovered. The folder may be empty, permission was denied, or all entries were excluded.'
        });
        severityCounts.high += 1;
        categories['scan-empty'] = { severity: 'high', findings: [findingsList[0]] };
    }
    for (const f of findings || []) {
        const rule = f.rule || f.analyzer || 'finding';
        const severity = String(f.severity || 'medium').toLowerCase();
        const count = Number(f.count) || 1;
        if (severityCounts[severity] !== undefined)
            severityCounts[severity] += count;
        if (!categories[rule])
            categories[rule] = { severity, findings: [] };
        const entry = {
            file: f.filePath,
            line: f.line || 1,
            message: f.impact || `${rule} finding`,
            severity,
            count
        };
        categories[rule].findings.push(entry);
        findingsList.push({
            category: rule,
            file: f.filePath,
            line: f.line || 1,
            severity,
            message: f.impact || `${rule} finding`,
            count
        });
        rawIssues.push({
            type: rule,
            filePath: f.filePath || '',
            line: f.line || 1,
            severity,
            description: f.impact || `${rule} finding`,
            count
        });
    }
    const totalFindings = rawIssues.reduce((sum, i) => sum + (i.count || 1), 0);
    const issueCount = totalFindings;
    const blockingCount = rawIssues.filter((i) => i.severity === 'critical' || i.severity === 'high')
        .reduce((sum, i) => sum + (Number(i.count) || 1), 0);
    return {
        type: 'simplebeacon-report',
        version: '1.0.0',
        reportVersion: 2,
        generatedAt: new Date().toISOString(),
        scanSource: 'browser-local',
        projectPath: projectName,
        projectRoot: projectName,
        summary: {
            totalFiles,
            codeFilesAnalyzed: analyzedFiles,
            codeFilesDiscovered: totalFiles,
            totalFindings,
            severityCounts
        },
        categories,
        findings: findingsList,
        rawIssues,
        detectedIssues: rawIssues,
        issueCount,
        severityCounts,
        repositoryFilesTotal: totalFiles,
        ruleScopedFilesAnalyzed: analyzedFiles,
        inventory: { totalFiles, totalFolders: 0, scannedFiles: analyzedFiles },
        repositoryInventory: { totalFiles, totalFolders: 0, projectRoot: projectName },
        repositoryFoldersTotal: 0,
        ignoreMeta: meta.ignoreMeta || null,
        gate: {
            pass: blockingCount === 0 && totalFiles > 0,
            blockingCount,
            warningCount: totalFindings - blockingCount,
            score: blockingCount === 0 && totalFiles > 0 ? 100 : 0
        },
        issuesTruncated: Boolean(meta.issuesTruncated),
        scanLimitNote: meta.issuesTruncated
            ? `Findings capped at ${rawIssues.length.toLocaleString()} for browser memory. Download JSON or use the CLI for the full list.`
            : (totalFiles >= MAX_FILES ? `File inventory capped at ${MAX_FILES.toLocaleString()} files. Use the CLI for full monorepo coverage.` : null)
    };
}
/**
 * Run batched scan through the worker to avoid postMessage limits on large repos.
 * @param {Worker} worker
 * @param {Array} workerFiles
 * @param {Object} options
 * @returns {Promise<Object>}
 */
function runBatchedWorkerScan(worker, workerFiles, options = {}) {
    const scanId = crypto.randomUUID();
    const totalFiles = workerFiles.length;
    const ignoreCtx = options.ignoreCtx || null;
    return new Promise((resolve, reject) => {
        let settled = false;
        const cleanup = (terminate = true) => {
            if (settled)
                return;
            settled = true;
            if (terminate)
                worker.terminate();
        };
        worker.onerror = (err) => {
            cleanup();
            reject(new Error(err.message || 'Local scan worker failed'));
        };
        worker.onmessage = async (e) => {
            const { type, processed, total, issues, error, issuesTruncated, totalFiles: completeTotal, currentFile } = e.data;
            if (type === 'progress' && options.onProgress) {
                options.onProgress(processed, total, { currentFile });
            }
            if (type === 'batch-complete' && options.onProgress) {
                options.onProgress(processed, total, { currentFile: currentFile || `Batch ${Math.floor((e.data.batchOffset || 0) / SCAN_BATCH_SIZE) + 1} complete` });
            }
            if (type === 'error') {
                cleanup();
                reject(new Error(error || 'Local scan failed'));
            }
            if (type === 'complete') {
                cleanup();
                const resolvedTotal = completeTotal || totalFiles;
                const analyzedFiles = workerFiles.filter((f) => /\.(js|cjs|mjs|ts|tsx|jsx|py|java|go|rs|php|rb|cs|vb)$/i.test(f.path)).length;
                resolve(buildReport(options.projectName || 'local-project', issues, resolvedTotal, analyzedFiles, {
                    issuesTruncated,
                    ignoreMeta: options.ignoreCtx
                        ? {
                            source: options.ignoreCtx.source || 'builtin',
                            patternCount: options.ignoreCtx.patterns?.length || 0,
                            scanRootName: options.ignoreCtx.scanRootName || ''
                        }
                        : null
                }));
            }
        };
        worker.postMessage({
            type: 'scan-start',
            scanId,
            totalFiles,
            deepScan: false,
            ignoreCtx: ignoreCtx
                ? { scanRootName: ignoreCtx.scanRootName, patterns: ignoreCtx.patterns }
                : null
        });
        (async () => {
            try {
                for (let offset = 0; offset < workerFiles.length; offset += SCAN_BATCH_SIZE) {
                    const batch = workerFiles.slice(offset, offset + SCAN_BATCH_SIZE);
                    await new Promise((batchResolve, batchReject) => {
                        let batchTimer = null;
                        const finishBatch = (fn) => {
                            if (batchTimer)
                                clearTimeout(batchTimer);
                            worker.removeEventListener('message', onBatch);
                            fn();
                        };
                        const onBatch = (ev) => {
                            if (ev.data.scanId !== scanId)
                                return;
                            if (ev.data.type === 'batch-complete' && ev.data.batchOffset === offset) {
                                finishBatch(() => batchResolve());
                            }
                            if (ev.data.type === 'error') {
                                finishBatch(() => batchReject(new Error(ev.data.error || 'Batch scan failed')));
                            }
                        };
                        worker.addEventListener('message', onBatch);
                        batchTimer = setTimeout(() => {
                            finishBatch(() => {
                                console.warn(`[localScan] Batch at offset ${offset} timed out — skipping ${batch.length} files and continuing`);
                                batchResolve();
                            });
                        }, BATCH_TIMEOUT_MS);
                        worker.postMessage({
                            type: 'scan-batch',
                            scanId,
                            batchOffset: offset,
                            files: batch,
                            deepScan: false
                        });
                    });
                }
                worker.postMessage({ type: 'scan-finish', scanId });
            }
            catch (err) {
                cleanup();
                reject(err);
            }
        })();
    });
}
/**
 * Run a local browser-based scan against a directory selected by the user.
 * No file contents are ever sent to the server.
 * @param {Object} options
 * @param {AbortSignal} [options.signal]
 * @param {(processed:number, total:number) => void} [options.onProgress]
 * @param {FileSystemDirectoryHandle} [options.dirHandle] Optional directory handle from drag-and-drop.
 * @param {FileList|File[]} [options.files] Optional dropped files (legacy directory entry) to scan locally.
 * @param {string} [options.projectPath] Optional display path/label to use as projectPath in the report.
 * @returns {Promise<Object>}
 */
export async function runLocalScan(options = {}) {
    if (!options.files && !options.dirHandle && !canUseDirectoryPicker()) {
        throw new Error('Your browser does not support the local directory picker. Use Chrome/Edge or run the server locally.');
    }
    let projectName = options.projectPath || 'local-project';
    let files = [];
    let ignoreCtx = null;
    if (options.files && options.files.length) {
        const fileArray = Array.from(options.files);
        const firstRel = fileArray[0].webkitRelativePath || fileArray[0].name || '';
        projectName = options.projectPath || firstRel.split('/')[0] || 'local-project';
        const ignoreLoad = await extractIgnorePatternsFromLegacyFiles(fileArray);
        ignoreCtx = createIgnoreContext(ignoreLoad.patterns, projectName, ignoreLoad.source);
        files = fileArray
            .filter((f) => {
                const path = f.webkitRelativePath || f.name;
                return !isIgnoredVirtualPath(path, ignoreCtx.scanRootName, ignoreCtx.patterns);
            })
            .map((f) => ({ path: f.webkitRelativePath || f.name, handle: f }));
    }
    else {
        const dirHandle = options.dirHandle;
        if (!dirHandle) {
            if (isEmbeddedDashboardFrame() || !canUseDirectoryPicker()) {
                throw new Error('Folder picker is blocked in this embed. Use drag-and-drop, the legacy Browse dialog, or scan via the Local Agent with a typed path.');
            }
            const picked = await window.showDirectoryPicker();
            projectName = options.projectPath || picked.name || 'local-project';
            const ignoreLoad = await loadIgnorePatternsFromDirHandle(picked);
            ignoreCtx = createIgnoreContext(ignoreLoad.patterns, projectName, ignoreLoad.source);
            files = await collectFiles(picked, '', [], ignoreCtx);
        }
        else {
            projectName = options.projectPath || dirHandle.name || 'local-project';
            const ignoreLoad = await loadIgnorePatternsFromDirHandle(dirHandle);
            ignoreCtx = createIgnoreContext(ignoreLoad.patterns, projectName, ignoreLoad.source);
            files = await collectFiles(dirHandle, '', [], ignoreCtx);
        }
    }
    const beforeIgnoreCount = files.length;
    files = filterQueueByIgnore(files.map((f) => ({ ...f, virtualPath: f.path })), ignoreCtx)
        .map((f) => ({ path: f.path || f.virtualPath, handle: f.handle }));
    if (ignoreCtx && files.length < beforeIgnoreCount) {
        showToast(`Excluded ${beforeIgnoreCount - files.length} paths via ${ignoreCtx.source || 'ignore'} rules.`, 'info', { duration: 5000 });
    }
    if (files.length === 0) {
        throw new Error(`No files were found in "${projectName}". The folder may be empty, permission was denied, or all files were excluded. Try selecting the folder again or use the local agent.`);
    }
    if (options.files && isLikelyWebkitDirectoryFileCap(files.length)) {
        showToast(browserFolderCapMessage(files.length).replace(/\*\*/g, ''), 'warning', { duration: 14000 });
    }
    if (files.length >= MAX_FILES) {
        showToast(`Large repo — scanning first ${MAX_FILES.toLocaleString()} files. Use CLI for unlimited coverage.`, 'warning', { duration: 8000 });
    }
    else if (files.length > 3000) {
        showToast(`Scanning ${files.length.toLocaleString()} files locally — this may take a few minutes.`, 'info', { duration: 6000 });
    }
    const workerFiles = files.map((f) => ({ path: f.path, fileObj: f.handle }));
    const worker = new Worker(WORKER_URL, { type: 'module' });
    if (options.signal) {
        options.signal.addEventListener('abort', () => worker.terminate(), { once: true });
    }
    const report = await runBatchedWorkerScan(worker, workerFiles, {
        onProgress: options.onProgress,
        projectName,
        ignoreCtx
    });
    return normalizeSimplebeaconReport(report);
}
/**
 * Local scan service compatible with the dashboard's ScanService API.
 */
export class LocalScanService {
    constructor() {
        this.report = null;
    }
    async runScan(options) {
        this.report = await runLocalScan(options);
        return this.report;
    }
    async fetchReport() {
        return this.report;
    }
    async fetchRepositoryInventory() {
        return this.report ? this.report.inventory : null;
    }
    async fetchHistory() {
        return [];
    }
    async fetchBaseline() {
        return null;
    }
    async fetchConfig() {
        return null;
    }
}
