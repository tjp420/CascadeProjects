import { showToast } from '../utils.js';
const WORKER_URL = new URL('../workers/scan-worker.js?v=20260709noise2', import.meta.url);
const MAX_FILES = 50000;
const SKIP_DIRS = /(^|[\\/])(node_modules|\.git|\.github|\.husky|dist|build|\.next|out|coverage|frontend-build|\.github-sync|github-cache|\.simplebeacon|\.cursor|\.windsurf|deployments|backups)([\\/]|$)/i;
/**
 * Recursively collect FileSystemFileHandle entries from a directory handle.
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} pathPrefix
 * @param {Array<{path:string, handle:FileSystemFileHandle}>} files
 * @returns {Promise<Array<{path:string, handle:FileSystemFileHandle}>>}
 */
async function collectFiles(dirHandle, pathPrefix = '', files = []) {
    if (files.length >= MAX_FILES)
        return files;
    for await (const [name, handle] of dirHandle.entries()) {
        const fullPath = pathPrefix ? `${pathPrefix}/${name}` : name;
        if (SKIP_DIRS.test(fullPath))
            continue;
        if (handle.kind === 'directory') {
            await collectFiles(handle, fullPath, files);
        }
        else if (handle.kind === 'file') {
            files.push({ path: fullPath, handle });
        }
        if (files.length >= MAX_FILES)
            break;
    }
    return files;
}
/**
 * Build a Simplebeacon-compatible report from worker findings.
 * @param {string} projectName
 * @param {Array<Object>} findings
 * @param {number} totalFiles
 * @param {number} analyzedFiles
 * @returns {Object}
 */
function buildReport(projectName, findings, totalFiles, analyzedFiles) {
    const categories = {};
    const findingsList = [];
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
        const severity = f.severity || 'medium';
        if (severityCounts[severity] !== undefined)
            severityCounts[severity] += 1;
        if (!categories[rule])
            categories[rule] = { severity, findings: [] };
        categories[rule].findings.push({
            file: f.filePath,
            line: f.line || 1,
            message: f.impact || `${rule} finding`,
            severity
        });
        findingsList.push({
            category: rule,
            file: f.filePath,
            line: f.line || 1,
            severity,
            message: f.impact || `${rule} finding`
        });
    }
    return {
        type: 'simplebeacon-report',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        projectPath: projectName,
        projectRoot: projectName,
        summary: {
            totalFiles,
            codeFilesAnalyzed: analyzedFiles,
            codeFilesDiscovered: totalFiles,
            totalFindings: findingsList.length,
            severityCounts
        },
        categories,
        findings: findingsList,
        inventory: { totalFiles, totalFolders: 0, scannedFiles: analyzedFiles },
        gate: { pass: findingsList.length === 0 && totalFiles > 0, score: findingsList.length === 0 && totalFiles > 0 ? 100 : 0 }
    };
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
    if (!options.files && !window.showDirectoryPicker && !options.dirHandle) {
        throw new Error('Your browser does not support the local directory picker. Use Chrome/Edge or run the server locally.');
    }
    let projectName = options.projectPath || 'local-project';
    let files = [];
    if (options.files && options.files.length) {
        const fileArray = Array.from(options.files);
        const firstRel = fileArray[0].webkitRelativePath || fileArray[0].name || '';
        projectName = options.projectPath || firstRel.split('/')[0] || 'local-project';
        files = fileArray.map((f) => ({ path: f.webkitRelativePath || f.name, handle: f }));
    }
    else {
        const dirHandle = options.dirHandle || await window.showDirectoryPicker();
        projectName = options.projectPath || dirHandle.name || 'local-project';
        files = await collectFiles(dirHandle);
    }
    if (files.length === 0) {
        throw new Error(`No files were found in "${projectName}". The folder may be empty, permission was denied, or all files were excluded. Try selecting the folder again or use the local agent.`);
    }
    const workerFiles = files.map((f) => ({ path: f.path, fileObj: f.handle }));
    return new Promise((resolve, reject) => {
        const worker = new Worker(WORKER_URL, { type: 'module' });
        const signal = options.signal;
        let settled = false;
        function cleanup() {
            if (!settled) {
                settled = true;
                worker.terminate();
            }
        }
        if (signal) {
            signal.addEventListener('abort', () => {
                cleanup();
                reject(new Error('Local scan cancelled.'));
            });
        }
        worker.onmessage = (e) => {
            const { type, scanId, processed, total, findings, issues, error } = e.data;
            if (type === 'progress' && options.onProgress) {
                options.onProgress(processed, total);
            }
            if (type === 'complete') {
                cleanup();
                const analyzedFiles = files.filter((f) => /\.(js|cjs|mjs|ts|tsx|jsx|py|java|go|rs|php|rb|cs|vb)$/i.test(f.path)).length;
                resolve(buildReport(projectName, issues, total, analyzedFiles));
            }
            if (type === 'error') {
                cleanup();
                reject(new Error(error || 'Local scan failed'));
            }
        };
        worker.onerror = (err) => {
            cleanup();
            reject(new Error(err.message || 'Local scan worker failed'));
        };
        worker.postMessage({ type: 'scan', files: workerFiles, deepScan: false, scanId: crypto.randomUUID() });
    });
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
