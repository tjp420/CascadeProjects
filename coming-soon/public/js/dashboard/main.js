// Copy-to-clipboard helper
window.copyToClipboard = function(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    navigator.clipboard.writeText(el.textContent).then(() => {
        const btn = el.nextElementSibling;
        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 1500); }
    });
};

window.togglePalette = function(id) {
    const palette = document.getElementById(id);
    if (!palette) return;
    palette.classList.toggle('collapsed');
    const header = palette.querySelector('.terminal-header');
    if (header) {
        const expanded = !palette.classList.contains('collapsed');
        header.setAttribute('aria-expanded', String(expanded));
    }
};

function decodeJwtPayload(token) {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 2 && parts.length !== 3) {

        return null;
    }
    const payloadBase64url = parts.length === 2 ? parts[0] : parts[1];
    if (!payloadBase64url) { return null; }
    const base64 = payloadBase64url.replace(/-/g, '+').replace(/_/g, '/');
    const rem = base64.length % 4;
    if (rem === 1) {

        return null;
    }
    const padded = base64 + '='.repeat((4 - rem) % 4);
    try {
        const binary = atob(padded);
        let decoded;
        if (typeof TextDecoder !== 'undefined') {
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            decoded = new TextDecoder().decode(bytes);
        } else {
            decoded = decodeURIComponent(escape(binary));
        }

        return JSON.parse(decoded);
    } catch (e) {

        return null;
    }
}

window.toggleModuleDropdown = function() {
    const dd = document.getElementById('analyzerDropdown');
    if (!dd) return;
    dd.classList.toggle('collapsed');
    const header = dd.querySelector('.select-all-bar');
    if (header) {
        const expanded = !dd.classList.contains('collapsed');
        header.setAttribute('aria-expanded', String(expanded));
    }
};

// Toast durations (ms)
const TOAST_DURATION_SHORT = 6000;
const TOAST_DURATION_LONG = 12000;

// DJB2 hash seed — scoped to avoid redeclaration with other dashboard scripts
(function() {
    const DJB2_HASH_SEED = 5381;

    window.simpleHash = async function(text) {
        let hash = DJB2_HASH_SEED;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) + hash) + text.charCodeAt(i);
        }
        return String(hash >>> 0);
    };
})();

// File count thresholds
const FILE_COUNT_HIGH = 65000;
const FILE_COUNT_VERY_HIGH = 100000;

// Local server ports to probe
const LOCAL_SERVER_PORTS = [38000, 50559, 3002, 3001, 3000, 8080, 5000];

// API base URL — localhost uses same-origin; production uses Render backend
const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? '' : 'https://simplebeacon.onrender.com';

// Free-token endpoint — resolved at request time so probeLocalServer() can set serverUploadUrl
function getFreeTokenUrl() {
    if (serverUploadUrl) return serverUploadUrl + '/api/free-token';
    const storedHost = localStorage.getItem('sb_api_host');
    if (storedHost) return storedHost + '/api/free-token';
    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const knownPorts = [38000, 50559, 3002, 3001, 3000, 8080, 5000];
    const currentPort = parseInt(location.port, 10);
    if (isLocal && knownPorts.includes(currentPort)) {
        return location.origin + '/api/free-token';
    }
    if (isLocal) {
        const devHost = '127.0.0.1';
        const devPort = '3000';
        return `http://${devHost}:${devPort}/api/free-token`;
    }
    return '/api/free-token';
}

// DOM element declarations — licenseInput declared in token-manager.js (same global scope)
const submitBtn = document.getElementById('submitBtn');
const status = document.getElementById('status');
const scanPreview = document.getElementById('scanPreview');
const scanMeta = document.getElementById('scanMeta');
const previewContent = document.getElementById('previewContent');

// Delegated click handler for scan preview module cards
if (scanPreview) {
    scanPreview.addEventListener('click', (e) => {
        const card = e.target.closest('.module-card');
        if (card && card.querySelector('.module-detail')) {
            card.classList.toggle('expanded');
        }
    });
}

// Tab elements
const tabCli = document.getElementById('tab-cli');
const tabBrowser = document.getElementById('tab-browser');
const viewCli = document.getElementById('view-cli');
const viewBrowser = document.getElementById('view-browser');

// Browser-local scanner elements
const localScanFileName = document.getElementById('localScanFileName');
const cliFolderInput = document.getElementById('cli-folder-input');
const cliFilesInput = document.getElementById('cli-files-input');
const dropzonePrompt = document.getElementById('terminal-dropzone-prompt');
const integrityHashEl = document.getElementById('integrity-hash');

// Browser sandbox dropzone
const browserFolderDropzone = document.getElementById('browser-folder-dropzone');
const jsonPasteInput = document.getElementById('jsonPasteInput');
const jsonPasteBtn = document.getElementById('jsonPasteBtn');

// Multi-folder accumulation to bypass Chrome's ~1,200 file picker cap
let accumulatedPickerFiles = [];
let isAccumulatingFolders = false;
let _pickerTriggeredByButton = false;

// Safe batch push: avoids "Maximum call stack size exceeded" when spreading large arrays
function safeBatchPush(target, source, batchSize) {
    batchSize = batchSize || 5000;
    for (var i = 0; i < source.length; i += batchSize) {
        var batch = source.slice(i, i + batchSize);
        target.push.apply(target, batch);
    }
}

// Run folder-size analyzer and show warnings before scan starts.
// Returns { proceed: boolean, analysis: object }.
function applyFolderSizeAnalysis(files, context) {
    var analyzer = (typeof ScanUtils !== 'undefined' && ScanUtils.analyzeFolderSize)
        ? ScanUtils.analyzeFolderSize
        : (typeof analyzeFolderSize !== 'undefined' ? analyzeFolderSize : null);
    if (!analyzer) {
        return { proceed: true, analysis: null };
    }
    var analysis = analyzer(files);
    if (!analysis || analysis.severity === 'ok') {
        return { proceed: true, analysis: analysis };
    }
    // Color-coded terminal line
    var color = analysis.severity === 'error' ? '#EF4444' : (analysis.severity === 'warn' ? '#F59E0B' : '#60A5FA');
    var icon = analysis.severity === 'error' ? '&#10008;' : (analysis.severity === 'warn' ? '&#9888;' : '&#9432;');
    appendTerminalLine('<span style="color:' + color + ';font-weight:700;">' + icon + ' ' + (context || 'Folder') + ':</span> ' + analysis.message, analysis.severity === 'error' ? 'error' : 'warn');
    // Toast for errors so the user sees it even if terminal is hidden
    if (analysis.severity === 'error') {
        showToast(analysis.message, 'error', 8000);
    } else if (analysis.severity === 'warn') {
        showToast(analysis.message, 'warning', TOAST_DURATION_SHORT);
    }
    return { proceed: !analysis.blocked, analysis: analysis };
}

// Module-scope constants for file discovery (shared by drop && change handlers)
// MAX_DISCOVERED_FILES is defined in scan-utils.js (loaded first)
const SKIP_DIRS = /[\/]dist[\/]|[\/]build[\/]|[\/]\.next[\/]|[\/]out[\/]|[\/]coverage[\/]|[\/]\.husky[\/]|[\/]frontend-build[\/]|[\/]\.github-sync[\/]|[\/]github-cache[\/]|[\/]\.simplebeacon[\/]|[\/]\.cursor[\/]|[\/]\.windsurf[\/]|[\/]deployments[\/]|[\/]backups[\/]|[\/]coming-soon-dev[\/]|[\/]node_modules[\/]|[\/]\.git[\/]/i;
const UPDATE_INTERVAL = 200;

function readEntriesChunk(reader) {
    return new Promise((resolve, reject) => {
        reader.readEntries(resolve, reject);
    });
}

async function traverseFileSystemEntry(entry, parentPath, files, state) {
    if (state.traverseAbort) return;
    if (files.length >= MAX_DISCOVERED_FILES) return;
    const currentPath = parentPath ? parentPath + '/' + entry.name : entry.name;
    const normalizedPath = currentPath.replace(/\\/g, '/');
    // Note: SKIP_DIRS removed from discovery — all files are counted for hygiene metrics
    if (entry.isFile) {
        if (files.length >= MAX_DISCOVERED_FILES) return;
        try {
            const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
            Object.defineProperty(file, 'webkitRelativePath', {
                value: currentPath,
                writable: false,
                configurable: true
            });
            files.push(file);
        } catch (err) {
            state.traverseErrors++;
            if (state.traverseErrors <= 5) {
                appendTerminalLine('File read error: ' + normalizedPath + ' \u2014 ' + err.name + ': ' + err.message, 'warn');
            }
        }
    } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const BATCH_SIZE = 100;
        let batch = [];
        while (!state.traverseAbort && files.length < MAX_DISCOVERED_FILES) {
            let results;
            try {
                results = await readEntriesChunk(dirReader);
            } catch (err) {
                appendTerminalLine(`Directory ${normalizedPath}: read error listing entries — ${err.name}: ${err.message}`, 'error');
                state.traverseErrors++;
                break;
            }
            if (!results || results.length === 0) break;
            for (const child of results) {
                if (files.length >= MAX_DISCOVERED_FILES) break;
                batch.push(child);
                if (batch.length >= BATCH_SIZE) {
                    await Promise.all(batch.map(async (c) => { try { await traverseFileSystemEntry(c, currentPath, files, state); } catch (err) { state.traverseErrors++; } }));
                    batch = [];
                    await new Promise(r => setTimeout(r, 0));
                }
            }
        }
        if (batch.length > 0 && !state.traverseAbort && files.length < MAX_DISCOVERED_FILES) {
            await Promise.all(batch.map(async (c) => { try { await traverseFileSystemEntry(c, currentPath, files, state); } catch (err) { state.traverseErrors++; } }));
        }
    }
    const now = Date.now();
    if (now - state.lastUpdate > UPDATE_INTERVAL) {
        state.lastUpdate = now;
        if (localScanFileName) {
            localScanFileName.textContent = `Discovered ${files.length.toLocaleString()} files...`;
        }
    }
}

// CLI Import Report dropzone
const cliJsonDropzone = document.getElementById('cli-json-dropzone');
const fileInput = document.getElementById('fileInput');
const cliFileName = document.getElementById('cliFileName');

let reportData = null;
let scanAbortController = null;

// Copy highlighted report data to clipboard
async function copyReportData(text, btn) {
    const panel = btn.closest('.module-detail-panel');
    if (panel && panel.classList.contains('inactive')) {
        showToast('This module is locked for your tier. Upgrade to copy data.', 'error');
        return;
    }
    try {
        await navigator.clipboard.writeText(text);
        const original = btn.innerHTML;
        btn.innerHTML = '<span>&#10003;</span> Copied';
        btn.style.background = 'rgba(16,185,129,0.25)';
        btn.style.borderColor = 'rgba(16,185,129,0.5)';
        btn.style.color = '#34D399';
        setTimeout(() => {
            btn.innerHTML = original;
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.style.color = '';
        }, 1500);
    } catch (e) {
        showToast('Failed to copy to clipboard', 'error');
    }
}

// Map module IDs to report section keys for filtering exports
const MODULE_REPORT_KEYS = {
    gate: ['gate', 'gateReport', 'credentialFindings', 'productionLeakFindings'],
    consolidation: ['consolidation'],
    'mock-data': ['mockDataCategories', 'mockSampleFiles'],
    roadmap: ['roadmap'],
    codebase: ['codebase', 'codeAnalysis', 'repositoryInventory', 'fileList'],
    'file-reduction': ['fileReduction', 'fileReductionPlan'],
    'data-quality': ['dataQuality'],
    cleanup: ['cleanup'],
    'npm-audit': ['npmAudit', 'dependencyAudit'],
    compliance: ['compliance', 'governance'],
    'eu-ai-act': ['euAiActSummary', 'euAiAct'],
    'dependency-vulns': ['dependencyAudit', 'vulnerabilityAudit'],
    'build-readiness': ['buildReadiness'],
    'ai-indicators': ['aiIndicators', 'aiSystemIndicators'],
    governance: ['governance', 'compliance'],
    'junk-files': ['junkFiles'],
    'ai-residue': ['aiResidue', 'aiResidueFindings'],
    performance: ['performance', 'performanceFindings'],
    'type-safety': ['typeSafety', 'typeSafetyFindings'],
    documentation: ['documentation', 'documentationFindings'],
    'test-coverage': ['testCoverage', 'testCoverageFindings'],
    accessibility: ['accessibility', 'accessibilityFindings'],
    i18n: ['i18n', 'i18nFindings'],
    'sensitive-data': ['sensitiveData', 'sensitiveDataFindings'],
    'config-drift': ['configDrift', 'configDriftFindings'],
    'security-headers': ['securityHeaders', 'securityHeadersFindings'],
    'database-patterns': ['databasePatterns', 'databasePatternsFindings'],
    'framework-practices': ['frameworkPractices', 'frameworkPracticesFindings'],
    'workspace-health': ['workspaceHealth', 'workspaceHealthFindings'],
    'unused-deps': ['unusedDeps', 'unusedDepsFindings'],
    'api-contract': ['apiContract', 'apiContractFindings'],
    complexity: ['complexity', 'complexityFindings'],
    'file-naming': ['fileNaming', 'fileNamingFindings'],
    'removable-files': ['removableFiles', 'removableFilesFindings']
};

// Filter a report object to only include sections the user has activated
function filterReportByModules(report, modules) {
    const out = {};
    const allowedKeys = new Set(['type', 'reportVersion', 'version', 'generatedAt', 'generatedBy', 'scanProfileLabel', 'checkEuAi', 'projectRoot', 'projectPath', 'scanTargetRoot', 'platformRoot', 'projectName', 'scanProfile', 'scanProfileLabel', 'qualityScore', 'schemaCompliance', 'consistencyScore', 'duplicateGroups', 'invalidJson', 'emptyFiles', 'schemaChecked', 'schemaPassed', 'totalFiles', 'filesAnalyzed', 'repositoryFilesTotal', 'repositoryFoldersTotal', 'excludedCount', 'excludedSummary', 'issueCount', 'simplebeaconIssues', 'detectedIssues', 'issues', 'rawIssues', 'severityCounts', 'gate', 'gateReport', 'summary', 'scanDurationMs', 'title', 'aiContext']);
    const moduleKeys = new Set();
    modules.forEach(id => {
        (MODULE_REPORT_KEYS[id] || []).forEach(k => moduleKeys.add(k));
    });
    // Always keep shared metadata
    for (const key of allowedKeys) {
        if (key in report) out[key] = report[key];
    }
    // Keep activated module sections
    for (const key of moduleKeys) {
        if (key in report) out[key] = report[key];
    }
    // Filter detectedIssues to only include types matching activated modules
    if (Array.isArray(out.detectedIssues)) {
        const issueTypeMap = {
            gate: ['Credential Pattern', 'credential'],
            consolidation: ['Duplicate File', 'Monorepo Marker'],
            'mock-data': ['Mock Data'],
            roadmap: ['TODO Marker', 'todo'],
            codebase: [],
            'file-reduction': ['Unused Asset', 'Duplicate File'],
            'data-quality': ['Empty JSON', 'Invalid JSON'],
            cleanup: ['Debug Artifact', 'debugArtifact'],
            'npm-audit': ['Dependency Vulnerability', 'Outdated Package'],
            compliance: ['License/Governance Marker'],
            'eu-ai-act': ['AI System Indicator', 'High-Risk AI', 'aiSdk'],
            'dependency-vulns': ['Dependency Vulnerability', 'CVE'],
            'build-readiness': ['Build Readiness'],
            'ai-indicators': ['AI System Indicator', 'aiSdk'],
            governance: ['License/Governance Marker'],
            'junk-files': ['Junk File', 'Temporary File'],
            'ai-residue': ['AI Residue', 'Stub Implementation', 'Error Swallowing', 'Deprecated Pattern', 'Hallucinated Import', 'Dead Code Block'],
            performance: ['Performance Anti-Pattern', 'perf'],
            'type-safety': ['Type Safety Gap'],
            documentation: ['Documentation Gap'],
            'test-coverage': ['Missing Test Coverage'],
            accessibility: ['Accessibility Gap'],
            i18n: ['i18n Issue', 'i18n'],
            'sensitive-data': ['Sensitive Data Exposure'],
            'config-drift': ['Configuration Drift'],
            'security-headers': ['Missing Security Header'],
            'database-patterns': ['Database Anti-Pattern'],
            'framework-practices': ['Framework Practice Issue'],
            'workspace-health': ['Workspace Health Issue'],
            'unused-deps': ['Unused Dependency'],
            'api-contract': ['API Contract Drift'],
            complexity: ['High Complexity'],
            'llm-slop': ['LLM Slop'],
            'token-bleed': ['Token Bleed'],
            'production-leak': ['Production Leak'],
            'fiction-kpi': ['Fiction KPI'],
            'architecture-drift': ['Architecture Drift'],
            'fix-preview': ['Fix Preview'],
            'sync-io': ['Synchronous I/O Pattern'],
            'eval-danger': ['Eval Danger', 'Dynamic Code Execution'],
            'inner-html-xss': ['innerHTML XSS', 'XSS Vulnerability'],
            'prototype-pollution': ['Prototype Pollution Risk'],
            'unhandled-promise': ['Unhandled Promise'],
            'magic-number': ['Magic Number'],
            'missing-strict-mode': ['Missing Strict Mode'],
            'uninitialized-read': ['Uninitialized Variable Read'],
            'unvalidated-redirect': ['Unvalidated Redirect'],
            'missing-rate-limit': ['Missing Rate Limiting'],
            'insecure-random': ['Insecure Random for Security'],
            'logging-secrets': ['Sensitive Data in Logs'],
            'hardcoded-confidence': ['Hardcoded Confidence Score'],
            'hardcoded-completion': ['Hardcoded Completion Rate'],
            'mock-path-leak': ['Mock/Fixture Path in Production'],
            'sample-json-ref': ['Sample JSON Reference'],
            'governance-marker': ['License/Governance Marker'],
            'ai-placeholder-comment': ['AI Placeholder Comment'],
            'ai-placeholder-block': ['AI Placeholder Block Comment'],
            'markdown-fence-leak': ['Markdown Fence in Code'],
            'empty-stub-function': ['Empty Stub Function'],
            'arrow-stub': ['Arrow Function Stub'],
            'roadmap-marker': ['Roadmap Marker']
        };
        const allowedTypes = new Set();
        modules.forEach(id => {
            (issueTypeMap[id] || []).forEach(t => allowedTypes.add(t));
        });
        if (allowedTypes.size > 0) {
            out.detectedIssues = out.detectedIssues.filter(i => allowedTypes.has(i.type));
        }
    }
    return out;
}

// Download selected module's full data as JSON
// Redact all leaf data values while preserving structure
function redactReport(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
    if (typeof obj === 'string') return '***REDACTED***';
    if (Array.isArray(obj)) return obj.length ? ['***REDACTED***'] : [];
    const out = {};
    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        const val = obj[key];
        if (typeof val === 'string') out[key] = '***REDACTED***';
        else if (typeof val === 'number' || typeof val === 'boolean') out[key] = val;
        else if (Array.isArray(val)) out[key] = val.length ? ['***REDACTED***'] : [];
        else if (val && typeof val === 'object') out[key] = redactReport(val);
        else out[key] = val;
    }
    return out;
}

// Download selected module's full data as JSON
function downloadSelectedModule(btn) {
    try {
        const container = btn.closest('[style*="display:flex;gap:8px"]') || btn.parentElement;
        if (!container) { showToast('Export button layout error', 'error'); return; }
        const select = container.querySelector('.module-dropdown');
        if (!select || !select.value) {
            showToast('Select a module first', 'warning');
            return;
        }
        const data = window._scanPreviewData || {};
        if (select.value === '__full_report__') {
            const tier = window._tokenPayload?.tier || window._tokenPayload?.product || 'locked';
            const isFree = tier === 'instant';
            const projectName = data.projectRoot || data.projectPath || data.projectName || 'local-scan';
            // Only include data for modules the user has activated
            const activatedModules = Array.from(selectedModules);
            const filteredData = filterReportByModules(data, activatedModules);
            const rawReport = {
                metadata: {
                    projectName,
                    generatedAt: new Date().toISOString(),
                    scanVersion: '1.3.0',
                    totalModules: (window._scanPreviewModules || []).length,
                    activatedModules,
                    exportType: isFree ? 'redacted-report' : 'filtered-report',
                    tier
                },
                ...filteredData
            };
            const fullReport = isFree ? redactReport(rawReport) : rawReport;
            const blob = new Blob([JSON.stringify(fullReport, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `simplebeacon-full-report-${projectName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showToast(isFree ? 'Downloaded redacted report (upgrade for full data)' : `Downloaded report with ${activatedModules.length} activated module(s)`, 'success');
            return;
        }
                const mod = (window._scanPreviewModules || []).find(m => m.id === select.value);
        if (!mod) {

            showToast('Module ! found', 'error');
            return;
        }
    const num = mod.num;
    if (!isModulePaidFor(num)) {
        showToast('This module is locked for your tier. Upgrade to export.', 'error');
        return;
    }
    const projectName = data.projectRoot || data.projectPath || data.projectName || 'local-scan';
    const now = new Date().toISOString();
    const totalFiles = (data.codebase?.totalFiles) || data.totalFiles || data.filesAnalyzed || 1;
    const totalLines = (data.codebase?.totalLines) || data.totalLines || 0;

    // Build rich module data based on module number
    let moduleData = { metadata: { projectName, generatedAt: now, scanVersion: '1.3.0', moduleId: mod.id, moduleLabel: mod.title, totalFiles, totalLines } };

    // Pre-compute issue arrays once to avoid O(NxM) re-filtering across module branches
    const _allIssues = data.detectedIssues || data.issues || [];
    const _gateIssues = _allIssues.filter(i => ['high','critical','medium'].includes(i.severity));
    const _warningIssues = _allIssues.filter(i => i.severity === 'low' || i.severity === 'warning');

    if (num === '1') {
        const g = data.gateReport || data.gate || {};
        const gateIssues = _gateIssues;
        const bc = gateIssues.length || g.blockingCount || 0;
        const wc = _warningIssues.length || g.warningCount || 0;
        const pass = bc === 0 ? true : false;
        moduleData = { ...moduleData, pass, blockingCount: bc, warningCount: wc, status: pass === true ? 'PASS' : 'BLOCKED', blockingFindings: gateIssues.slice(0, 15).map(i => ({ severity: i.severity, type: i.type, count: i.count || 0, filePath: i.filePath, rule: i.rule, impact: i.impact, fix: i.fix, findings: (i.findings || []).slice(0, 3).map(f => ({ file: f.file, matches: (f.matches || []).slice(0, 3).map(m => ({ line: m.line, snippet: m.snippet })) })) })), allIssues: _allIssues.slice(0, 20).map(i => ({ severity: i.severity, type: i.type, count: i.count || 0, filePath: i.filePath, rule: i.rule, impact: i.impact, fix: i.fix })), severityCounts: data.severityCounts || {}, qualityScore: data.qualityScore ?? null };
    } else if (num === '2') {
        const cons = data.consolidation || {};
        const dupFiles = (cons.duplicateFiles || []).map(g => {
            const paths = Array.isArray(g) ? g : (g.paths || []);
            return paths.filter(p => !/\.simplebeacon\//i.test(p));
        }).filter(g => g.length > 1);
        const dupCount = cons.duplicateGroups || dupFiles.length || 0;
        moduleData = { ...moduleData, monorepoMarkers: cons.monorepoMarkers || (cons.monorepoMarkers || []).length || 0, duplicateGroups: dupCount, duplicateGroupsDetail: dupFiles.slice(0, 5).map(g => g.slice(0, 3)), summary: dupCount ? `${dupCount} duplicate file group${dupCount === 1 ? '' : 's'} detected.` : 'No duplicate files detected.' };
    } else if (num === '3') {
        const mockCats = data.mockDataCategories || [];
        const mockTotal = data.mockSampleFiles ?? mockCats.reduce((a, c) => a + (c.fileCount || 0), 0);
        moduleData = { ...moduleData, fileCount: mockTotal, categories: mockCats.map(c => ({ category: c.category, fileCount: c.fileCount || 0, confidence: c.confidence, description: c.description })), affectedFiles: mockCats.flatMap(c => c.affectedFiles || []).slice(0, 10), summary: mockTotal ? `${mockTotal} mock/fixture file${mockTotal === 1 ? '' : 's'} detected.` : 'No mock data found.' };
    } else if (num === '4') {
        // Synthesize roadmap from all report data
        const rm = data.roadmap || {};
        const baseTodos = (rm.todoFiles || []).filter(Boolean);
        const baseCount = rm.todoCount || baseTodos.length || 0;

        // Gather action items from all other modules
        const actionItems = [];

        // Gate blockers
        const gate = data.gate || data.gateReport || {};
        const blockers = (gate.blockingCount || 0) + (data.detectedIssues || []).filter(i => ['high','critical'].includes(i.severity)).length;
        if (blockers > 0) {
            const gateFindings = gate.blockingFindings || [];
            const maxSeverity = gateFindings.length ? gateFindings.reduce((max, f) => {
                const order = { critical: 3, high: 2, medium: 1, low: 0 };
                return (order[f.severity] || 0) > (order[max] || 0) ? f.severity : max;
            }, 'low') : 'high';
            actionItems.push({ task: `Fix ${blockers} blocking security issue${blockers === 1 ? '' : 's'} before release`, priority: maxSeverity, source: 'gate' });
        }

        // Build artifacts
        const cl = data.cleanup || {};
        const debugCount = cl.debugArtifactCount || (cl.debugArtifacts || []).length || 0;
        if (debugCount > 0) actionItems.push({ task: `Remove ${debugCount} build artifact${debugCount === 1 ? '' : 's'} (log statements, breakpoint statements, alerts)`, priority: 'high', source: 'cleanup' });

        // Data quality
        const dq = data.dataQuality || {};
        const emptyCount = dq.emptyJsonCount || (dq.emptyJsonFiles || []).length || 0;
        if (emptyCount > 0) actionItems.push({ task: `Clean up ${emptyCount} empty JSON file${emptyCount === 1 ? '' : 's'}`, priority: 'low', source: 'data-quality' });

        // File reduction
        const fr = data.fileReduction || data.fileReductionPlan || {};
        const assetCount = (fr.unusedAssetCandidates || []).length;
        if (assetCount > 0) actionItems.push({ task: `Review && remove ${assetCount} unused asset${assetCount === 1 ? '' : 's'}`, priority: 'medium', source: 'file-reduction' });

        // Consolidation
        const cons = data.consolidation || {};
        const dupCount = cons.duplicateGroups || 0;
        if (dupCount > 0) actionItems.push({ task: `Consolidate ${dupCount} duplicate file group${dupCount === 1 ? '' : 's'}`, priority: 'medium', source: 'consolidation' });

        // EU AI Act
        const eu = data.euAiActSummary || {};
        if ((eu.highRiskIndicators || 0) > 0) actionItems.push({ task: 'Schedule EU AI Act legal review (high-risk indicators detected)', priority: 'critical', source: 'eu-ai-act' });
        if ((eu.aiSystemIndicators || 0) > 0) actionItems.push({ task: 'Document AI system classification under EU AI Act Article 6', priority: 'medium', source: 'eu-ai-act' });
        if ((eu.transparencyGaps || 0) > 0) actionItems.push({ task: 'Address transparency gaps per EU AI Act Article 10', priority: 'medium', source: 'eu-ai-act' });

        // npm audit
        const npm = data.npmAudit || {};
        const pkgCount = npm.packageJsonCount || 0;
        const depCount = npm.dependencyCount || 0;
        if (pkgCount > 0 && depCount / pkgCount > 50) actionItems.push({ task: `Audit ${depCount} dependencies — dependency density is high`, priority: 'low', source: 'npm-audit' });

        // Mock data
        const mockCats = data.mockDataCategories || [];
        const mockTotal = data.mockSampleFiles ?? mockCats.reduce((a, c) => a + (c.fileCount || 0), 0);
        if (mockTotal > 0) actionItems.push({ task: `Ensure ${mockTotal} mock/fixture file${mockTotal === 1 ? '' : 's'} are excluded from production builds`, priority: 'low', source: 'mock-data' });

        const totalTodos = baseCount + actionItems.length;
        moduleData = { ...moduleData,
            todoCount: totalTodos,
            todoFiles: baseTodos.slice(0, 10),
            baseTodoCount: baseCount,
            actionItems: actionItems.slice(0, 15),
            summary: totalTodos ? `${totalTodos} roadmap item${totalTodos === 1 ? '' : 's'} (${baseCount} task/fix marker${baseCount === 1 ? '' : 's'} + ${actionItems.length} synthesized action item${actionItems.length === 1 ? '' : 's'})` : 'No roadmap items found.'
        };
    } else if (num === '5') {
        const cb = data.codebase || data.codeAnalysis || {};
        const ftEntries = Object.entries(cb.fileTypes || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
        moduleData = { ...moduleData, totalFiles: cb.totalFiles || totalFiles, totalLines: cb.totalLines || totalLines, fileTypeBreakdown: ftEntries.map(([ext, count]) => ({ extension: ext, count, percentage: totalFiles > 0 ? ((count / totalFiles) * 100).toFixed(1) + '%' : '0.0%' })), summary: cb.summary || `${(cb.totalFiles || totalFiles).toLocaleString()} files analyzed, ${(cb.totalLines || totalLines).toLocaleString()} lines of code.` };
    } else if (num === '6') {
        const fr = data.fileReduction || data.fileReductionPlan || {};
        const assetLen = (fr.unusedAssetCandidates || []).length;
        moduleData = { ...moduleData, unusedAssetCandidates: (fr.unusedAssetCandidates || []).slice(0, 10), unusedAssetCount: assetLen, duplicateGroups: fr.duplicateGroups || 0, summary: fr.summary || (assetLen ? `${assetLen} image asset${assetLen === 1 ? '' : 's'} detected for review.` : 'No file reduction opportunities.') };
    } else if (num === '7') {
        const dq = data.dataQuality || {};
        const emptyFiles = (dq.emptyJsonFiles || []).filter(Boolean);
        const ec = dq.emptyJsonCount || emptyFiles.length || 0;
        moduleData = { ...moduleData, emptyJsonFiles: emptyFiles.slice(0, 10), emptyJsonCount: ec, summary: ec ? `${ec} empty JSON file${ec === 1 ? '' : 's'} detected.` : 'No data quality issues.' };
    } else if (num === '8') {
        const cl = data.cleanup || {};
        const debugIssue = (data.detectedIssues || []).find(i => i.type === 'Debug Artifact');
        const artifacts = (cl.debugArtifacts || []).filter(Boolean);
        const ac = cl.debugArtifactCount || artifacts.length || 0;
        moduleData = { ...moduleData, debugArtifacts: artifacts.slice(0, 10), debugArtifactCount: ac, findings: (debugIssue?.findings || []).slice(0, 5).map(f => ({ file: f.file, matches: (f.matches || []).slice(0, 3).map(m => ({ line: m.line, snippet: m.snippet })) })), summary: ac ? `${ac} debug artifact${ac === 1 ? '' : 's'} detected.` : 'No debug artifacts found.' };
    } else if (num === '9') {
        const npm = data.npmAudit || {};
        moduleData = { ...moduleData, packageJsonCount: npm.packageJsonCount || 0, dependencyCount: npm.dependencyCount || 0, packageJsonFiles: (npm.packageJsonFiles || []).slice(0, 5), summary: npm.summary || (npm.packageJsonCount ? `${npm.packageJsonCount} package.json file${npm.packageJsonCount === 1 ? '' : 's'} found with ${(npm.dependencyCount || 0).toLocaleString()} total dependenc${(npm.dependencyCount || 0) === 1 ? 'y' : 'ies'}.` : 'No package.json files found.') };
    } else if (num === '10') {
        const comp = data.compliance || {};
        const licFiles = (comp.licenseFiles || []).filter(Boolean);
        const secFiles = (comp.securityFiles || []).filter(Boolean);
        const licCount = licFiles.length || comp.licenseCount || 0;
        const secCount = secFiles.length || comp.securityCount || 0;
        const govScore = licCount + secCount;
        let health;
        if (govScore >= 5) health = 'excellent';
        else if (govScore >= 2) health = 'good';
        else if (govScore >= 1) health = 'fair';
        else health = 'poor';
        const standardFiles = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'SECURITY.md', 'SECURITY.txt', 'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', 'PRIVACY.md', 'CHANGELOG.md', 'NOTICE'];
        const foundFiles = [...licFiles.map(f => f.toUpperCase()), ...secFiles.map(f => f.toUpperCase())];
        const missing = standardFiles.filter(f => !foundFiles.some(found => found.includes(f.replace('.md', '').replace('.txt', ''))));
        const recs = [];
        if (licCount === 0) recs.push('Add a LICENSE file to clarify distribution terms.');
        if (secCount === 0) recs.push('Add SECURITY.md to disclose vulnerability reporting.');
        if (!foundFiles.some(f => f.includes('CODE_OF_CONDUCT'))) recs.push('Add CODE_OF_CONDUCT.md to set community standards.');
        if (!foundFiles.some(f => f.includes('CONTRIBUTING'))) recs.push('Add CONTRIBUTING.md to guide external contributions.');
        moduleData = { ...moduleData, metrics: { riskScore: Math.max(0, 40 - govScore * 5), priority: health === 'excellent' || health === 'good' ? 'low' : (health === 'fair' ? 'medium' : 'high') }, licenseCount: licCount, securityCount: secCount, governanceScore: govScore, complianceHealth: health, licenseFiles: licFiles.slice(0, 5), securityFiles: secFiles.slice(0, 5), missingGovernanceFiles: missing.slice(0, 5), recommendations: recs.slice(0, 4), remediation: recs[0] || 'Verify license compatibility with your distribution model.', summary: `${licCount} license file${licCount === 1 ? '' : 's'}, ${secCount} security/governance file${secCount === 1 ? '' : 's'} detected.` };
    } else if (num === '11') {
        const eu = data.euAiActSummary || data.euAiAct || {};
        const euIndicators = eu.aiSystemIndicators || 0;
        const euHighRisk = eu.highRiskIndicators || 0;
        moduleData = { ...moduleData, aiSystemIndicators: euIndicators, highRiskIndicators: euHighRisk, transparencyGaps: eu.transparencyGaps || 0, documentationArtifacts: eu.documentationArtifacts || 0, documentationFound: (eu.documentationFound || []).slice(0, 5), controls: (eu.controls || []).slice(0, 5), summary: eu.deadlineNote || (euHighRisk ? 'High-risk AI systems must comply with EU AI Act requirements by August 2026' : euIndicators ? `${euIndicators} AI system indicator${euIndicators === 1 ? '' : 's'} detected; review EU AI Act applicability.` : 'Review EU AI Act requirements.') };
    } else if (num === '12') {
        const depAudit = data.dependencyAudit || data.vulnerabilityAudit || {};
        const vulnIssues = (data.detectedIssues || []).filter(i => i.type && /vulnerab|cve|npm audit|dependency|outdated/i.test(i.type) && !/unused/i.test(i.type));
        const vc = depAudit.vulnerabilityCount || vulnIssues.length || 0;
        const cc = depAudit.critical || vulnIssues.filter(i => i.severity === 'critical').length || 0;
        const hc = depAudit.high || vulnIssues.filter(i => i.severity === 'high').length || 0;
        const affected = (depAudit.affectedPackages || depAudit.affectedFiles || []).filter(Boolean);
        moduleData = { ...moduleData, metrics: { riskScore: vc > 0 ? Math.min(100, cc * 25 + hc * 10 + (vc - cc - hc) * 2) : 0, priority: cc > 0 ? 'critical' : (hc > 0 ? 'high' : (vc > 0 ? 'medium' : 'low')) }, vulnerabilityCount: vc, critical: cc, high: hc, moderate: depAudit.moderate || vulnIssues.filter(i => i.severity === 'medium').length || 0, low: depAudit.low || vulnIssues.filter(i => i.severity === 'low').length || 0, affectedPackages: affected.slice(0, 10), outdatedPackages: (depAudit.outdatedPackages || []).slice(0, 10), summary: vc ? `${vc} dependency issue${vc === 1 ? '' : 's'} detected${cc ? ` (${cc} critical)` : ''}.` : 'No dependency vulnerabilities found.', recommendations: cc > 0 ? ['Update critical dependencies immediately.', 'Review changelogs for breaking changes before bumping major versions.'] : (vc > 0 ? ['Run npm audit fix to auto-resolve patchable issues.', 'Schedule dependency update sprint within 30 days.'] : ['Keep dependencies current with automated Dependabot || Renovate.']), remediation: cc > 0 ? 'Upgrade critical && high-severity packages before next release.' : (vc > 0 ? 'Run npm audit fix || yarn audit fix to resolve patchable vulnerabilities.' : 'No remediation needed — dependency hygiene is clean.') };
    } else if (num === '13') {
        const allFiles = data.fileList || data.repositoryInventory?.totalFiles || [];
        const filePaths = Array.isArray(allFiles) ? allFiles : [];
        const lowerPaths = filePaths.map(f => (typeof f === 'string' ? f : f.path || '').toLowerCase());
        const checks = [
            { name: 'package.json', found: lowerPaths.some(p => p.endsWith('package.json')), critical: true },
            { name: 'Lockfile', found: lowerPaths.some(p => /package-lock\.json|yarn\.lock|pnpm-lock\.yaml/.test(p)), critical: true },
            { name: 'README', found: lowerPaths.some(p => /readme\.?/.test(p)), critical: true },
            { name: 'CHANGELOG', found: lowerPaths.some(p => /changelog|changes|history/i.test(p)), critical: false },
            { name: 'Tests', found: lowerPaths.some(p => /test|spec|\.test\.|\.spec\.|__tests__|jest\.config|vitest\.config|cypress/i.test(p)), critical: true },
            { name: 'CI/CD', found: lowerPaths.some(p => /\.github\/workflows|\.gitlab-ci|jenkins|\.circleci|\.travis|azure-pipelines|build\.yml|deploy\.yml/i.test(p)), critical: true },
            { name: 'Docker', found: lowerPaths.some(p => /dockerfile|docker-compose|\.dockerignore/i.test(p)), critical: false },
            { name: 'Linting/Formatting', found: lowerPaths.some(p => /eslint|prettier|\.editorconfig|lint-staged|husky/i.test(p)), critical: false },
            { name: 'TypeScript Config', found: lowerPaths.some(p => /tsconfig|\.ts$/i.test(p)), critical: false },
            { name: 'Build Tool Config', found: lowerPaths.some(p => /(webpack|rollup|vite|esbuild|parcel|babel|gulpfile|gruntfile)/i.test(p)), critical: false },
            { name: 'Dev Server / HMR', found: lowerPaths.some(p => /vite\.config|webpack\.dev|nodemon|live-reload|hmr/i.test(p)), critical: false },
            { name: '.env.example', found: lowerPaths.some(p => /\.env\.example|\.env\.sample|\.env\.template/i.test(p)), critical: true },
            { name: '.gitignore', found: lowerPaths.some(p => p.includes('.gitignore')), critical: true },
            { name: 'Build artifacts ignored', found: !lowerPaths.some(p => /\/(dist|build|\.next|out)\//.test(p) && !/node_modules\//.test(p)), critical: true },
            { name: 'Git LFS config', found: lowerPaths.some(p => p.includes('.gitattributes')), critical: false },
            { name: 'Build cache config', found: lowerPaths.some(p => /\.eslintcache|\.parcel-cache|\.next\/cache/i.test(p)), critical: false },
            { name: '.npmignore', found: lowerPaths.some(p => p.includes('.npmignore')), critical: false }
        ];
        const missingCritical = checks.filter(c => c.critical && !c.found);
        const missingNice = checks.filter(c => !c.critical && !c.found);
        const score = Math.round(((checks.filter(c => c.found).length / checks.length) * 100));
        moduleData = { ...moduleData, metrics: { riskScore: 100 - score, priority: missingCritical.length > 2 ? 'critical' : (missingCritical.length > 0 ? 'high' : (missingNice.length > 3 ? 'medium' : 'low')) }, readinessScore: score, readinessStatus: score >= 80 ? 'READY' : (score >= 50 ? 'NEEDS WORK' : 'BLOCKED'), checklist: checks, missingCritical: missingCritical.map(c => c.name), missingRecommended: missingNice.map(c => c.name), totalChecks: checks.length, passedChecks: checks.filter(c => c.found).length, summary: `${score >= 80 ? 'READY' : (score >= 50 ? 'NEEDS WORK' : 'BLOCKED')} — ${checks.filter(c => c.found).length} of ${checks.length} checklist items present.${missingCritical.length ? ` ${missingCritical.length} critical blocker${missingCritical.length === 1 ? '' : 's'}.` : ''}`, recommendations: missingCritical.length > 0 ? ['Add all critical files before production deployment.', 'Start with package.json, README, .gitignore, && .env.example.'] : (missingNice.length > 0 ? ['Add recommended files to improve maintainability.', 'Consider Docker, linting config, && CHANGELOG.'] : ['Project is fully ready for production. All checklist items present.']), remediation: missingCritical.length > 0 ? `Missing critical: ${missingCritical.map(c => c.name).join(', ')}.` : (missingNice.length > 0 ? `Missing recommended: ${missingNice.map(c => c.name).join(', ')}.` : 'No remediation needed.') };
    } else if (num === '14') {
        const aiInd = data.aiIndicators || data.aiSystemIndicators || {};
        const sdkCount = aiInd.sdkCount || aiInd.aiSystemIndicators || 0;
        const modelCount = aiInd.modelCount || 0;
        const aiFiles = (aiInd.files || []).slice(0, 10);
        moduleData = { ...moduleData, sdkCount, modelCount, files: aiFiles, summary: sdkCount ? `${sdkCount} AI SDK import${sdkCount === 1 ? '' : 's'} detected.` : 'No AI system indicators found.', recommendations: sdkCount > 0 ? ['Verify all AI integrations are approved.', 'Document model usage for compliance.'] : ['No AI remediation needed.'] };
    } else if (num === '15') {
        const gov = data.governance || {};
        const comp = data.compliance || {};
        const licCount = gov.licenseHeaders || comp.licenseCount || 0;
        const copyrightCount = gov.copyrightNotices || 0;
        const govFiles = (gov.files || []).slice(0, 10);
        moduleData = { ...moduleData, licenseCount: licCount, copyrightCount, files: govFiles, summary: licCount ? `${licCount} license header${licCount === 1 ? '' : 's'} detected.` : 'No license or governance markers found.', recommendations: licCount === 0 ? ['Add LICENSE file.', 'Add SECURITY.md for vulnerability reporting.'] : ['Verify license compatibility with distribution model.'] };
    } else if (num === '16') {
        const junk = data.junkFiles || {};
        const junkCount = junk.fileCount || 0;
        const junkFiles = (junk.files || []).slice(0, 10);
        moduleData = { ...moduleData, fileCount: junkCount, files: junkFiles, summary: junkCount ? `${junkCount} junk/temp file${junkCount === 1 ? '' : 's'} detected.` : 'No junk or temporary files found.', recommendations: junkCount > 0 ? ['Remove temporary files, editor backups, and OS artifacts before production builds.'] : ['No junk remediation needed.'] };
    } else if (num === '17') {
        const ar = data.aiResidue || {};
        const arHits = ar.aiResidueHits || 0;
        const arFindings = (ar.aiResidueFindings || []).slice(0, 10);
        moduleData = { ...moduleData, hitCount: arHits, findings: arFindings.map(f => ({ file: f.file, type: f.type })), summary: arHits > 0 ? `${arHits} AI residue pattern${arHits === 1 ? '' : 's'} detected.` : 'No AI residue patterns found.', recommendations: arHits > 0 ? ['Replace stubs with real implementations.', 'Modernize deprecated APIs.', 'Add proper error handling.'] : ['No AI residue remediation needed.'] };
    } else if (num === '18') {
        const perf = data.performance || {};
        const perfCount = perf.performanceHits || 0;
        const perfFindings = (perf.performanceFindings || []).slice(0, 10);
        moduleData = { ...moduleData, issueCount: perfCount, findings: perfFindings.map(f => ({ file: f.file, type: f.type })), summary: perfCount > 0 ? `${perfCount} performance issue${perfCount === 1 ? '' : 's'} detected.` : 'No performance issues found.', recommendations: perfCount > 0 ? ['Optimize nested loops.', 'Debounce event handlers.', 'Review regex complexity.'] : ['No performance remediation needed.'] };
    } else if (num === '19') {
        const ts = data.typeSafety || {};
        const tsCount = ts.typeSafetyHits || 0;
        const tsFindings = (ts.typeSafetyFindings || []).slice(0, 10);
        moduleData = { ...moduleData, gapCount: tsCount, findings: tsFindings.map(f => ({ file: f.file, type: f.type })), summary: tsCount > 0 ? `${tsCount} type safety gap${tsCount === 1 ? '' : 's'} detected.` : 'No type safety gaps found.', recommendations: tsCount > 0 ? ['Replace any with specific types.', 'Add PropTypes or migrate to TypeScript.', 'Limit function parameters.'] : ['No type safety remediation needed.'] };
    } else if (num === '20') {
        const doc = data.documentation || {};
        const docCount = doc.documentationHits || 0;
        const docFindings = (doc.documentationFindings || []).slice(0, 10);
        moduleData = { ...moduleData, gapCount: docCount, findings: docFindings.map(f => ({ file: f.file, type: f.type })), summary: docCount > 0 ? `${docCount} documentation gap${docCount === 1 ? '' : 's'} detected.` : 'No documentation gaps found.', recommendations: docCount > 0 ? ['Add JSDoc to public functions.', 'Keep README in sync with recent changes.'] : ['No documentation remediation needed.'] };
    } else if (num === '21') {
        const tc = data.testCoverage || {};
        const tcCount = tc.testCoverageHits || 0;
        const tcFindings = (tc.testCoverageFindings || []).slice(0, 10);
        moduleData = { ...moduleData, gapCount: tcCount, findings: tcFindings.map(f => ({ file: f.file, type: f.type })), summary: tcCount > 0 ? `${tcCount} test coverage gap${tcCount === 1 ? '' : 's'} detected.` : 'No test coverage gaps found.', recommendations: tcCount > 0 ? ['Implement skipped tests.', 'Add tests for complex untested functions.'] : ['No test coverage remediation needed.'] };
    } else if (num === '22') {
        const a11y = data.accessibility || {};
        const a11yCount = a11y.accessibilityHits || 0;
        const a11yFindings = (a11y.accessibilityFindings || []).slice(0, 10);
        moduleData = { ...moduleData, issueCount: a11yCount, findings: a11yFindings.map(f => ({ file: f.file, type: f.type })), summary: a11yCount > 0 ? `${a11yCount} accessibility issue${a11yCount === 1 ? '' : 's'} detected.` : 'No accessibility issues found.', recommendations: a11yCount > 0 ? ['Add alt text to images.', 'Add aria-label to buttons.', 'Associate labels with form inputs.'] : ['No accessibility remediation needed.'] };
    } else if (num === '23') {
        const i18n = data.i18n || {};
        const i18nCount = i18n.i18nHits || 0;
        const i18nFindings = (i18n.i18nFindings || []).slice(0, 10);
        moduleData = { ...moduleData, issueCount: i18nCount, findings: i18nFindings.map(f => ({ file: f.file, type: f.type })), summary: i18nCount > 0 ? `${i18nCount} i18n issue${i18nCount === 1 ? '' : 's'} detected.` : 'No i18n issues found.', recommendations: i18nCount > 0 ? ['Wrap UI strings in t()/i18n().', 'Use locale-aware date and currency formatting.'] : ['No i18n remediation needed.'] };
    } else if (num === '24') {
        const sd = data.sensitiveData || {};
        const sdCount = sd.sensitiveDataHits || 0;
        const sdFindings = (sd.sensitiveDataFindings || []).slice(0, 10);
        moduleData = { ...moduleData, exposureCount: sdCount, findings: sdFindings.map(f => ({ file: f.file, type: f.type })), summary: sdCount > 0 ? `${sdCount} sensitive data exposure${sdCount === 1 ? '' : 's'} detected.` : 'No sensitive data exposures found.', recommendations: sdCount > 0 ? ['Remove PII from logs and source.', 'Sanitize user data.', 'Avoid storing tokens in localStorage.'] : ['No sensitive data remediation needed.'] };
    } else if (num === '25') {
        const cd = data.configDrift || {};
        const cdCount = cd.configDriftHits || 0;
        const cdFindings = (cd.configDriftFindings || []).slice(0, 10);
        moduleData = { ...moduleData, driftCount: cdCount, findings: cdFindings.map(f => ({ file: f.file, type: f.type })), summary: cdCount > 0 ? `${cdCount} configuration drift${cdCount === 1 ? '' : 's'} detected.` : 'No configuration drift found.', recommendations: cdCount > 0 ? ['Move secrets to environment variables.', 'Externalize URLs.', 'Never commit .env files.'] : ['No config drift remediation needed.'] };
    } else if (num === '26') {
        const sh = data.securityHeaders || {};
        const shCount = sh.securityHeadersHits || 0;
        const shFindings = (sh.securityHeadersFindings || []).slice(0, 10);
        moduleData = { ...moduleData, referenceCount: shCount, findings: shFindings.map(f => ({ file: f.file, type: f.type })), summary: shCount > 0 ? `${shCount} security header reference${shCount === 1 ? '' : 's'} found.` : 'No security header configs found.', recommendations: shCount > 0 ? ['Ensure CSP is configured.', 'Add X-Frame-Options.', 'Enable HSTS and Referrer-Policy.'] : ['No security header remediation needed.'] };
    } else if (num === '27') {
        const dbp = data.databasePatterns || {};
        const dbpCount = dbp.databasePatternsHits || 0;
        const dbpFindings = (dbp.databasePatternsFindings || []).slice(0, 10);
        moduleData = { ...moduleData, issueCount: dbpCount, findings: dbpFindings.map(f => ({ file: f.file, type: f.type })), summary: dbpCount > 0 ? `${dbpCount} database anti-pattern${dbpCount === 1 ? '' : 's'} detected.` : 'No database anti-patterns found.', recommendations: dbpCount > 0 ? ['Use parameterized queries.', 'Add pagination limits.', 'Wrap database operations in transactions.'] : ['No database pattern remediation needed.'] };
    } else if (num === '28') {
        const fp = data.frameworkPractices || {};
        const fpCount = fp.frameworkPracticesHits || 0;
        const fpFindings = (fp.frameworkPracticesFindings || []).slice(0, 10);
        moduleData = { ...moduleData, issueCount: fpCount, findings: fpFindings.map(f => ({ file: f.file, type: f.type })), summary: fpCount > 0 ? `${fpCount} framework practice issue${fpCount === 1 ? '' : 's'} detected.` : 'No framework practice issues found.', recommendations: fpCount > 0 ? ['Fix hook dependencies.', 'Avoid direct DOM access.', 'Add cleanup in Angular components.'] : ['No framework practice remediation needed.'] };
    } else if (num === '29') {
        const wh = data.workspaceHealth || {};
        const whCount = wh.workspaceHealthHits || 0;
        const whFindings = (wh.workspaceHealthFindings || []).slice(0, 10);
        moduleData = { ...moduleData, issueCount: whCount, findings: whFindings.map(f => ({ file: f.file, type: f.type })), summary: whCount > 0 ? `${whCount} workspace health issue${whCount === 1 ? '' : 's'} detected.` : 'No workspace health issues found.', recommendations: whCount > 0 ? ['Refactor shared code into common packages.', 'Align dependency versions across workspace.'] : ['No workspace health remediation needed.'] };
    } else if (num === '30') {
        const ud = data.unusedDeps || {};
        const udCount = ud.unusedDepsHits || 0;
        const udFindings = (ud.unusedDepsFindings || []).slice(0, 10);
        moduleData = { ...moduleData, flagCount: udCount, findings: udFindings.map(f => ({ file: f.file, type: f.type })), summary: udCount > 0 ? `${udCount} unused dependency flag${udCount === 1 ? '' : 's'} detected.` : 'No unused dependency flags found.', recommendations: udCount > 0 ? ['Remove unused packages from package.json.', 'Update lockfile after removal.'] : ['No unused dependency remediation needed.'] };
    } else if (num === '31') {
        const ac = data.apiContract || {};
        const acCount = ac.apiContractHits || 0;
        const acFindings = (ac.apiContractFindings || []).slice(0, 10);
        moduleData = { ...moduleData, driftCount: acCount, findings: acFindings.map(f => ({ file: f.file, type: f.type })), summary: acCount > 0 ? `${acCount} API contract drift${acCount === 1 ? '' : 's'} detected.` : 'No API contract drift found.', recommendations: acCount > 0 ? ['Sync OpenAPI specs with implementation.', 'Verify frontend consumes all endpoints.'] : ['No API contract remediation needed.'] };
    } else if (num === '32') {
        const cx = data.complexity || {};
        const cxCount = cx.complexityHits || 0;
        const cxFindings = (cx.complexityFindings || []).slice(0, 10);
        moduleData = { ...moduleData, issueCount: cxCount, findings: cxFindings.map(f => ({ file: f.file, type: f.type })), summary: cxCount > 0 ? `${cxCount} complexity issue${cxCount === 1 ? '' : 's'} detected.` : 'No complexity issues found.', recommendations: cxCount > 0 ? ['Extract helper functions.', 'Reduce nesting with early returns.', 'Apply cyclomatic complexity limits.'] : ['No complexity remediation needed.'] };
    } else if (num === '33') {
        const fn = data.fileNaming || {};
        const fnCount = fn.hits || 0;
        const fnFindings = (fn.findings || []).slice(0, 10);
        moduleData = { ...moduleData, issueCount: fnCount, findings: fnFindings.map(f => ({ file: f.file, type: f.type, detail: f.detail, suggestion: f.suggestion })), styleStats: fn.styleStats || {}, summary: fnCount > 0 ? `${fnCount} file naming issue${fnCount === 1 ? '' : 's'} detected.` : 'No file naming issues found.', recommendations: fnCount > 0 ? ['Standardize on one naming convention across the project.', 'Remove spaces and special characters from filenames.', 'Use descriptive names for data files instead of generic names like data.json.'] : ['No file naming remediation needed.'] };
    } else if (num === '34') {
        const rf = data.removableFiles || {};
        const rfCount = rf.totalRemovable || 0;
        const rfCats = (rf.categories || []).filter(c => c.removable).slice(0, 10);
        moduleData = { ...moduleData, removableCount: rfCount, totalFiles: rf.totalFiles || 0, totalRemovableFormatted: rf.totalRemovableFormatted || '0 B', categories: rfCats.map(c => ({ category: c.category, label: c.label, count: c.count, bytes: c.bytes, examples: c.examples, action: c.action })), summary: rf.summary || 'No removable files detected.', recommendations: rfCount > 0 ? ['Review node_modules — delete and run npm install to regenerate.', 'Remove build artifacts (dist, build, .next) — they regenerate on build.', 'Add .gitignore entries for cache dirs, logs, and OS metadata files.', 'Delete empty files and temporary/backup files.'] : ['No file removal needed.'] };
    }

    const blob = new Blob([JSON.stringify(moduleData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mod.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${mod.title} module data`, 'success');
    } catch (err) {

        showToast('Export failed: ' + (err.message || err), 'error');
    }
}

// Map module number to custom-plan scan ID
function isModulePaidFor(moduleNum) {
    const numStr = String(moduleNum);
    const map = {
        '1':'gate','2':'consolidation','3':'mock-data','4':'roadmap','5':'codebase',
        '6':'file-reduction','7':'data-quality','8':'cleanup','9':'npm-audit',
        '10':'compliance','11':'eu-ai-act','12':'dependency-vulns','13':'build-readiness',
        '14':'ai-indicators','15':'governance','16':'junk-files','17':'ai-residue',
        '18':'performance','19':'type-safety','20':'documentation','21':'test-coverage',
        '22':'accessibility','23':'i18n','24':'sensitive-data','25':'config-drift',
        '26':'security-headers','27':'database-patterns','28':'framework-practices',
        '29':'workspace-health','30':'unused-deps','31':'api-contract','32':'complexity',
        '33':'llm-slop','34':'token-bleed','35':'production-leak','36':'fiction-kpi',
        '37':'architecture-drift','38':'fix-preview','39':'removable-files','40':'consistency-score'
    };
    let payload = window._tokenPayload;
    // Re-parse current token from input if cached payload is missing/stale
    if (!payload) {
        const token = (typeof licenseInput !== 'undefined' && licenseInput) ? licenseInput.value.trim() : '';
        if (token) payload = decodeJwtPayload(token);
    }
    // No token = free tier (same access as 'instant')
    if (!payload) {
        return ['1','3'].includes(numStr);
    }
    const tier = String(payload.tier || payload.product || '').toLowerCase();
    const allAccess = ['executive','euai','eusprint','operator','continuous_shield','runtime_shield','universal'];
    if (allAccess.includes(tier)) return true;
    if (tier === 'instant') {
        return ['1','3'].includes(numStr);
    }
    if (tier === 'custom' && Array.isArray(payload.features)) {
        return payload.features.includes(map[numStr]) || payload.features.includes(numStr);
    }
    // Fallback: if the corresponding analyzer card is NOT locked, treat as paid
    if (typeof analyzerCardGrid !== 'undefined' && analyzerCardGrid) {
        const card = analyzerCardGrid.querySelector(`[data-value="${map[numStr]}"]`) || analyzerCardGrid.querySelector(`[data-value="${numStr}"]`);
        if (card && !card.classList.contains('locked')) return true;
    }
    return false;
}

// Toast notification system
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { info: '&#8505;', success: '&#9989;', error: '&#10060;', warning: '&#9888;' };
    // Defense-in-depth: escapeHtml even for toast text in case caller passes dynamic/user-controlled strings
    const safeMsg = escapeHtml(String(message));
    toast.innerHTML = `<span style="font-size:1.1rem;flex-shrink:0;">${icons[type] || icons.info}</span><span style="flex:1;">${safeMsg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastFadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Browser sandbox scan profiles
const BROWSER_SCAN_PROFILES = {
    gate: {
        label: 'Gate Scan',
        help: 'Credential patterns, AI/LLM imports, && hardcoded secrets. Fastest scan.',
        note: 'Browser sandbox runs a lightweight <strong>Gate Scan</strong> (AI patterns + credential heuristics). For deep analysis, use the <strong>CLI tab</strong>.',
        reportType: 'simplebeacon-report',
        title: 'SimpleBeacon Platform Gate Scan',
        checkAi: true,
        checkCredentials: true,
        checkDebug: false,
        checkGov: false
    },
    codebase: {
        label: 'Codebase Audit',
        help: 'Full file inventory, structural analysis, && path hygiene. Slower but comprehensive.',
        note: 'Browser sandbox runs a <strong>Codebase Audit</strong> — full file inventory && structural path analysis.',
        reportType: 'simplebeacon-report',
        title: 'SimpleBeacon Codebase Audit',
        checkAi: true,
        checkCredentials: true,
        checkDebug: 1,
        checkGov: false
    },
    euai: {
        label: 'EU AI Act Sprint',
        help: 'Flags AI system indicators, ML model serving endpoints, && LLM dependencies.',
        note: 'Browser sandbox runs an <strong>EU AI Act Sprint</strong> — AI system indicators && ML/LLM detection.',
        reportType: 'simplebeacon-report',
        title: 'SimpleBeacon EU AI Act Sprint',
        checkAi: true,
        checkCredentials: false,
        checkDebug: false,
        checkGov: true
    },
    compliance: {
        label: 'Compliance Check',
        help: 'Governance markers, license headers, && security policy checks.',
        note: 'Browser sandbox runs a <strong>Compliance Check</strong> — governance && security policy scanning.',
        reportType: 'simplebeacon-report',
        title: 'SimpleBeacon Compliance Check',
        checkAi: false,
        checkCredentials: true,
        checkDebug: false,
        checkGov: true
    },
    hygiene: {
        label: 'Hygiene Sweep',
        help: 'Debug artifacts, console.logs, open items, && cleanup markers.',
        note: 'Browser sandbox runs a <strong>Hygiene Sweep</strong> — debug artifacts && cleanup marker detection.',
        reportType: 'simplebeacon-report',
        title: 'SimpleBeacon Hygiene Sweep',
        checkAi: false,
        checkCredentials: false,
        checkDebug: 1,
        checkGov: false
    },
    complete: {
        label: 'Complete Scan',
        help: 'All 15 analysis engines — gate, consolidation, mock data, roadmap, codebase, file reduction, data quality, cleanup, npm audit, compliance, EU AI Act, dependency vulns, build readiness, AI indicators, governance.',
        note: 'Browser sandbox runs a <strong>Complete Scan</strong> — all 15 SimpleBeacon analysis engines for maximum coverage.',
        reportType: 'simplebeacon-report',
        title: 'SimpleBeacon Complete Scan',
        checkAi: true,
        checkCredentials: true,
        checkDebug: 1,
        checkGov: true,
        checkEuAi: true,
        checkAiResidue: true
    },
    instant: {
        label: 'Instant Report',
        help: 'Lightweight snapshot for quick status checks.',
        note: 'Browser sandbox runs an <strong>Instant Report</strong> — quick gate + codebase snapshot.',
        reportType: 'simplebeacon-report',
        title: 'SimpleBeacon Instant Report',
        checkAi: true,
        checkCredentials: true,
        checkDebug: false,
        checkGov: false,
        checkEuAi: false
    }
};

// Which report sections each profile includes
const PROFILE_SECTIONS = {
    gate:       ['gateReport'],
    instant:    ['gateReport', 'codebase'],
    codebase:   ['gateReport', 'consolidation', 'codebase', 'roadmap', 'fileReduction', 'npmAudit'],
    aislopcop:  ['gateReport', 'llmSlop', 'tokenBleed', 'productionLeak', 'fictionKpi', 'aiResidue'],
    euai:       ['gateReport', 'euAiActSummary', 'compliance'],
    compliance: ['gateReport', 'compliance', 'npmAudit'],
    hygiene:    ['gateReport', 'cleanup', 'dataQuality', 'fileReduction', 'mockDataCategories'],
    complete:   ['gateReport', 'consolidation', 'mockDataCategories', 'roadmap', 'codebase', 'fileReduction', 'dataQuality', 'cleanup', 'npmAudit', 'compliance', 'euAiActSummary', 'dependencyAudit', 'buildReadiness', 'aiIndicators', 'governance', 'junkFiles', 'aiResidue', 'performance', 'typeSafety', 'documentation', 'testCoverage', 'accessibility', 'i18n', 'sensitiveData', 'configDrift', 'securityHeaders', 'databasePatterns', 'frameworkPractices', 'workspaceHealth', 'unusedDeps', 'apiContract', 'complexity', 'llmSlop', 'tokenBleed', 'productionLeak', 'fictionKpi', 'architectureDrift']
};

// Profile selector wiring — browserScanProfile, scanProfileHelp, analyzerCardGrid,
// selectAllModules, and selectAllCount are declared in token-manager.js (same global scope)
const sandboxNoteText = document.getElementById('sandboxNoteText');

// 52 Individual Analyzer Module Cards
const MODULE_CARDS = [
    { id: 'gate', label: 'Gate Scan', desc: 'Credential patterns, AI/LLM imports, hardcoded secrets.', icon: '&#128737;' },
    { id: 'consolidation', label: 'Consolidation', desc: 'Duplicate file groups && monorepo markers.', icon: '&#128260;' },
    { id: 'mock-data', label: 'Mock Data', desc: 'Fixture, sample, && test-data files.', icon: '&#129522;' },
    { id: 'roadmap', label: 'Roadmap', desc: 'Task, fix, workaround, && bug markers in code.', icon: '&#128220;' },
    { id: 'codebase', label: 'Codebase Audit', desc: 'File type breakdown, line counts, && structure.', icon: '&#128187;' },
    { id: 'file-reduction', label: 'File Reduction', desc: 'Unused image assets && duplicate content.', icon: '&#128450;' },
    { id: 'data-quality', label: 'Data Quality', desc: 'Empty || trivial JSON files.', icon: '&#127922;' },
    { id: 'cleanup', label: 'Cleanup', desc: 'Debug artifacts: console.log, debugger, open items.', icon: '&#129532;' },
    { id: 'npm-audit', label: 'npm Audit', desc: 'Package.json files && dependency counts.', icon: '&#128230;' },
    { id: 'compliance', label: 'Compliance', desc: 'License, security, && governance files.', icon: '&#128196;' },
    { id: 'eu-ai-act', label: 'EU AI Act', desc: 'AI system indicators && regulatory readiness.', icon: '&#127757;' },
    { id: 'dependency-vulns', label: 'Dependency Vulns', desc: 'CVE && outdated dependency audit.', icon: '&#128274;' },
    { id: 'build-readiness', label: 'Build Readiness', desc: 'Systematic project health scan — missing files, configs, scripts, && deploy blockers.', icon: '&#127959;' },
    { id: 'ai-indicators', label: 'AI System Indicators', desc: 'AI/LLM SDK imports && model inference patterns.', icon: '&#129302;' },
    { id: 'governance', label: 'License & Governance', desc: 'License headers, copyright notices, && governance markers.', icon: '&#128220;' },
    { id: 'junk-files', label: 'Junk & Temp Files', desc: 'OS/editor artifacts, backup files, caches, && temporary downloads.', icon: '&#128465;' },
    { id: 'ai-residue', label: 'AI Residue', desc: 'Hallucinated imports, stub implementations, error swallowing, deprecated patterns.', icon: '&#129302;' },
    { id: 'performance', label: 'Performance', desc: 'Nested loops, memory leaks, event listener leaks, inefficient regex.', icon: '&#128640;' },
    { id: 'type-safety', label: 'Type Safety', desc: 'any types, missing PropTypes, runtime typeof checks, parameter count bloat.', icon: '&#128295;' },
    { id: 'documentation', label: 'Documentation', desc: 'Missing JSDoc, undocumented public functions, stale README, complex code without comments.', icon: '&#128214;' },
    { id: 'test-coverage', label: 'Test Coverage', desc: 'Source files without tests, empty test files, untested complex functions.', icon: '&#129514;' },
    { id: 'accessibility', label: 'Accessibility', desc: 'Missing alt text, unlabeled inputs, color-only indicators, missing lang attr.', icon: '&#9855;' },
    { id: 'i18n', label: 'i18n Readiness', desc: 'Hardcoded UI strings, locale-ignorant formatting, unwrapped concatenated text.', icon: '&#127760;' },
    { id: 'sensitive-data', label: 'Sensitive Data', desc: 'PII patterns, email/phone/SSN in source, personal data in logs or storage.', icon: '&#128373;' },
    { id: 'config-drift', label: 'Config Drift', desc: 'Environment files in source control, literal endpoint values, credentials in configuration, inconsistent environment variable naming.', icon: '&#9881;' },
    { id: 'security-headers', label: 'Security Headers', desc: 'Missing CSP, X-Frame-Options, HSTS, or Referrer-Policy in server configs.', icon: '&#128274;' },
    { id: 'database-patterns', label: 'Database Patterns', desc: 'Raw SQL concatenation, missing limits, no transaction rollback, unindexed queries.', icon: '&#128187;' },
    { id: 'framework-practices', label: 'Framework Practices', desc: 'React hook misuse, Vue Options API in Vue 3, missing Angular unsubscribes.', icon: '&#128421;' },
    { id: 'workspace-health', label: 'Workspace Health', desc: 'Circular imports, mismatched dependency versions, missing shared configs.', icon: '&#128207;' },
    { id: 'unused-deps', label: 'Unused Dependencies', desc: 'Packages in package.json with no import/require references in source.', icon: '&#128230;' },
    { id: 'api-contract', label: 'API Contract', desc: 'REST endpoints with no frontend call, GraphQL types without resolvers, stale OpenAPI specs.', icon: '&#128260;' },
    { id: 'complexity', label: 'Complexity Metrics', desc: 'Over-long functions, bloated files, high cyclomatic complexity, deep nesting.', icon: '&#128200;' },
    { id: 'llm-slop', label: 'LLM Slop', desc: 'Placeholder debris, markdown code fences leaked into source, hardcoded AI-default metrics.', icon: '&#129302;' },
    { id: 'token-bleed', label: 'Token Bleed', desc: 'LLM API calls without max_tokens limits and unchunked long string literals in prompts.', icon: '&#9889;' },
    { id: 'production-leak', label: 'Production Leak', desc: 'Mock, fixture, or sample data paths referenced in production source code.', icon: '&#128227;' },
    { id: 'fiction-kpi', label: 'Fiction KPI', desc: 'Hardcoded metrics, completion rates, and AI confidence scores that may be fabricated.', icon: '&#128202;' },
    { id: 'architecture-drift', label: 'Architecture Drift', desc: 'Hybrid/SSM model identifiers without schema validators and unguarded LLM calls.', icon: '&#127959;' },
    { id: 'fix-preview', label: 'Fix Preview', desc: 'Before/after code diffs with copyable patches for each remediation task.', icon: '&#128295;' },
    { id: 'sync-io', label: 'Sync I/O', desc: 'Synchronous fs operations that block the event loop.', icon: '&#128190;' },
    { id: 'eval-danger', label: 'Eval Danger', desc: 'Dangerous runtime code evaluation — injection risk.', icon: '&#9888;' },
    { id: 'inner-html-xss', label: 'innerHTML XSS', desc: 'Unsanitized innerHTML assignments — XSS vulnerability.', icon: '&#128274;' },
    { id: 'prototype-pollution', label: 'Prototype Pollution', desc: 'Object.prototype or __proto__ modification risks.', icon: '&#128163;' },
    { id: 'unhandled-promise', label: 'Unhandled Promise', desc: 'Promise chains missing .catch() error handlers.', icon: '&#128711;' },
    { id: 'magic-number', label: 'Magic Numbers', desc: 'Hardcoded numeric literals that should be named constants.', icon: '&#128290;' },
    { id: 'missing-strict-mode', label: 'Missing Strict Mode', desc: "Files without 'use strict' — implicit globals risk.", icon: '&#128220;' },
    { id: 'uninitialized-read', label: 'Uninitialized Read', desc: 'Variables used before assignment.', icon: '&#128221;' },
    { id: 'unvalidated-redirect', label: 'Unvalidated Redirect', desc: 'Open redirect vulnerabilities from user-controlled URLs.', icon: '&#10132;' },
    { id: 'missing-rate-limit', label: 'Missing Rate Limit', desc: 'API endpoints without rate limiting — DoS risk.', icon: '&#9200;' },
    { id: 'insecure-random', label: 'Insecure Random', desc: 'Math.random() used for security/cryptographic purposes.', icon: '&#127922;' },
    { id: 'logging-secrets', label: 'Logging Secrets', desc: 'Passwords, tokens, or secrets written to logs.', icon: '&#128373;' },
    { id: 'hardcoded-confidence', label: 'Hardcoded Confidence', desc: 'Static confidence scores that should be dynamic.', icon: '&#128200;' },
    { id: 'hardcoded-completion', label: 'Hardcoded Completion', desc: 'Static completion rates that should be real metrics.', icon: '&#128201;' },
    { id: 'mock-path-leak', label: 'Mock Path Leak', desc: 'Mock/fixture paths referenced in production code.', icon: '&#128227;' },
    { id: 'sample-json-ref', label: 'Sample JSON Ref', desc: 'Sample JSON files referenced in production code.', icon: '&#128196;' },
    { id: 'governance-marker', label: 'Governance Marker', desc: 'License and copyright markers for open-source compliance.', icon: '&#9878;' },
    { id: 'ai-placeholder-comment', label: 'AI Placeholder', desc: 'Placeholder comments generated by AI (TODO: implement).', icon: '&#129302;' },
    { id: 'ai-placeholder-block', label: 'AI Placeholder Block', desc: 'Block comments with AI placeholder text.', icon: '&#128172;' },
    { id: 'markdown-fence-leak', label: 'Markdown Fence Leak', desc: 'Markdown code fences (```) leaked into source files.', icon: '&#128208;' },
    { id: 'empty-stub-function', label: 'Empty Stub', desc: 'Empty function bodies — likely AI-generated stubs.', icon: '&#128269;' },
    { id: 'arrow-stub', label: 'Arrow Stub', desc: 'Arrow functions returning empty objects.', icon: '&#10145;' },
    { id: 'roadmap-marker', label: 'Roadmap Marker', desc: 'Unresolved HACK/XXX/WORKAROUND markers.', icon: '&#128739;' },
    { id: 'file-naming', label: 'File Naming', desc: 'Naming convention issues, spaces, special chars, mixed styles, and data-handling filenames.', icon: '&#128451;' },
    { id: 'removable-files', label: 'Removable Files', desc: 'node_modules, build artifacts, caches, logs, temp files, and OS metadata that can be removed.', icon: '&#128465;' }
];

// TIER_MODULE_MAP is declared in token-manager.js (same global scope)

// selectedModules is declared in token-manager.js (same global scope)
// Multi-select module picker for ZIP export

// Render analyzer cards as multi-select checklist
function renderAnalyzerCards() {
    if (!analyzerCardGrid) return;
    analyzerCardGrid.innerHTML = '';
    MODULE_CARDS.forEach(mod => {
        const card = document.createElement('div');
        card.className = 'analyzer-card';
        card.dataset.value = mod.id;
        card.innerHTML = `
            <div class="card-check">&#10003;</div>
            <div class="card-icon">${mod.icon}</div>
            <div class="card-title">${mod.label}</div>
            <div class="card-desc">${mod.desc}</div>
            <div class="card-hint"></div>
        `;
        card.addEventListener('click', () => {
            if (card.classList.contains('locked')) {
                showToast('Upgrade your token to unlock this module.', 'warning');
                return;
            }
            toggleModuleSelection(mod.id, card);
        });
        analyzerCardGrid.appendChild(card);
    });
    // Default: select all unlocked modules
    syncModuleSelectionFromTier();
    // Wire Select All checkbox
    if (selectAllModules) {
        selectAllModules.addEventListener('change', () => {
            const unlocked = Array.from(analyzerCardGrid.children).filter(c => !c.classList.contains('locked'));
            if (selectAllModules.checked) {
                unlocked.forEach(card => {
                    card.classList.add('selected');
                    selectedModules.add(card.dataset.value);
                });
            } else {
                unlocked.forEach(card => {
                    card.classList.remove('selected');
                    selectedModules.delete(card.dataset.value);
                });
            }
            updateSelectAllUI();
        });
    }
}

function toggleModuleSelection(id, card) {
    if (selectedModules.has(id)) {
        selectedModules.delete(id);
        card.classList.remove('selected');
    } else {
        selectedModules.add(id);
        card.classList.add('selected');
    }
    updateSelectAllUI();
}

function updateSelectAllUI() {
    if (!selectAllModules || !selectAllCount || !analyzerCardGrid) return;
    const unlocked = Array.from(analyzerCardGrid.children).filter(c => !c.classList.contains('locked'));
    const selectedUnlocked = unlocked.filter(c => c.classList.contains('selected'));
    selectAllModules.checked = unlocked.length > 0 && selectedUnlocked.length === unlocked.length;
    selectAllModules.indeterminate = selectedUnlocked.length > 0 && selectedUnlocked.length < unlocked.length;
    selectAllCount.textContent = `${selectedUnlocked.length}/${unlocked.length} selected`;
}

// Manual base64 decoder fallback (works in all browsers)
function base64Decode(input) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let output = '';
    let i = 0;
    while (i < input.length) {
        const enc1 = chars.indexOf(input[i++]);
        const enc2 = chars.indexOf(input[i++]);
        const enc3 = chars.indexOf(input[i++]);
        const enc4 = chars.indexOf(input[i++]);
        if (enc1 < 0 || enc2 < 0) break;
        const chr1 = (enc1 << 2) | (enc2 >> 4);
        output += String.fromCharCode(chr1);
        if (enc3 >= 0 && enc3 < 64) {
            const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            output += String.fromCharCode(chr2);
        }
        if (enc4 >= 0 && enc4 < 64) {
            const chr3 = ((enc3 & 3) << 6) | enc4;
            output += String.fromCharCode(chr3);
        }
    }
    return output;
}

function syncModuleSelectionFromTier() {
    if (!analyzerCardGrid) return;
    const token = document.getElementById('licenseToken')?.value || '';
    let tier = 'locked';
    let allowed = null;
    if (token) {
        const json = decodeJwtPayload(token);
        if (json) {
            tier = json.tier || 'locked';
            const customModules = Array.isArray(json.features) ? json.features : (Array.isArray(json.modules) ? json.modules : null);
            if (customModules && customModules.length > 0) {
                const all = TIER_MODULE_MAP.universal || [];
                const numToId = {'1':'gate','2':'consolidation','3':'mock-data','4':'roadmap','5':'codebase','6':'file-reduction','7':'data-quality','8':'cleanup','9':'npm-audit','10':'compliance','11':'eu-ai-act','12':'dependency-vulns','13':'build-readiness','14':'ai-indicators','15':'governance','16':'junk-files','17':'ai-residue','18':'performance','19':'type-safety','20':'documentation','21':'test-coverage','22':'accessibility','23':'i18n','24':'sensitive-data','25':'config-drift','26':'security-headers','27':'database-patterns','28':'framework-practices','29':'workspace-health','30':'unused-deps','31':'api-contract','32':'complexity'};
                allowed = customModules.map(m => numToId[m] || m).filter(m => all.includes(m));
            }
        }
    }
    if (!allowed) allowed = TIER_MODULE_MAP[tier] || TIER_MODULE_MAP.locked;
    selectedModules.clear();
    Array.from(analyzerCardGrid.children).forEach(card => {
        const ok = allowed.includes(card.dataset.value);
        const mod = MODULE_CARDS.find(m => m.id === card.dataset.value);
        card.classList.toggle('locked', !ok);
        card.title = ok ? '' : (mod ? mod.desc : '');
        const hint = card.querySelector('.card-hint');
        if (hint) hint.textContent = ok ? '' : 'Upgrade to Team or Enterprise to unlock';
        if (ok) {
            selectedModules.add(card.dataset.value);
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
    // Update UI help text based on first selected module
    const first = Array.from(analyzerCardGrid.children).find(c => c.classList.contains('selected'));
    if (first && scanProfileHelp) {
        const mod = MODULE_CARDS.find(m => m.id === first.dataset.value);
        scanProfileHelp.textContent = mod ? mod.desc : 'Select modules to include in your ZIP report.';
    }
    updateSelectAllUI();
}

// PRODUCT_CONFIG and TIER_PROFILES are declared in token-manager.js (same global scope)


renderAnalyzerCards();
if (typeof bindPresetButtons === 'function') bindPresetButtons();

function filterScanProfiles(tier, features) {
    const isCustom = tier === 'custom' && Array.isArray(features) && features.length > 0;
    const allowed = isCustom ? features : (TIER_PROFILES[tier] || TIER_PROFILES.universal);

    let firstEnabled = null;
    // Update hidden select
    if (browserScanProfile) {
        Array.from(browserScanProfile.options).forEach(opt => {
            const ok = allowed.includes(opt.value);
            opt.disabled = !ok;
            if (ok && !firstEnabled) firstEnabled = opt.value;
        });
    }
    // Update visual cards
    if (analyzerCardGrid) {
        Array.from(analyzerCardGrid.children).forEach(card => {
            const ok = allowed.includes(card.dataset.value);
            card.classList.toggle('locked', !ok);
            if (ok && !firstEnabled) firstEnabled = card.dataset.value;
        });
    }
    if (firstEnabled && browserScanProfile && !allowed.includes(browserScanProfile.value)) {
        browserScanProfile.value = firstEnabled;
    }
}

function resetScanProfiles() {
    if (browserScanProfile) {
        Array.from(browserScanProfile.options).forEach(opt => {
            opt.disabled = false;
        });
    }
    if (analyzerCardGrid) {
        Array.from(analyzerCardGrid.children).forEach(card => {
            card.classList.remove('locked');
        });
    }
    updateDropzoneGate();
}

function applyProductFromToken(token) {
    const banner = document.getElementById('sprintBanner');
    if (!token) {
        window._tokenPayload = null;
        if (banner) banner.style.display = 'none';
        filterScanProfiles('locked');
        syncModuleSelectionFromTier();
        updateDropzoneGate();
        // Reset product UI so user can enter a new token cleanly
        const infoCard = document.getElementById('productInfoCard');
        if (infoCard) infoCard.style.display = 'none';
        document.getElementById('productLabel').textContent = '';
        document.getElementById('pageTitle').textContent = 'Upload Your Scan Report';
        document.getElementById('pageSubtitle').textContent = 'Generate an Executive Risk Certificate from your local SimpleBeacon scan.';
        document.getElementById('tokenHelp').textContent = 'Paste the license token from your payment confirmation email.';
        document.getElementById('submitBtn').style.display = '';
        return;
    }
    try {
        const cleanToken = token.trim().replace(/\s/g, '');

        const payload = decodeJwtPayload(cleanToken);
        if (!payload) return;
        window._tokenPayload = payload;

        const tier = payload.tier || payload.product || 'executive';
        filterScanProfiles(tier, payload.features);
        syncModuleSelectionFromTier();

        const config = PRODUCT_CONFIG[tier] || PRODUCT_CONFIG.universal || {};
        const productLabelEl = document.getElementById('productLabel');
        if (productLabelEl) productLabelEl.textContent = config.label || '';
        const pageTitleEl = document.getElementById('pageTitle');
        if (pageTitleEl) pageTitleEl.textContent = config.title || '';
        const pageSubtitleEl = document.getElementById('pageSubtitle');
        if (pageSubtitleEl) pageSubtitleEl.textContent = config.subtitle || '';
        const tokenHelpEl = document.getElementById('tokenHelp');
        if (tokenHelpEl) tokenHelpEl.textContent = config.tokenHelp || '';
        const submitBtnEl = document.getElementById('submitBtn');
        if (submitBtnEl && !config.showUpload) {
            submitBtnEl.style.display = 'none';
        }
        if (config.scanCommand) {
            const helpTexts = document.querySelectorAll('.help-text');
            helpTexts.forEach(h => {
                if (h.textContent.includes('simplebeacon.js scan')) {
                    h.innerHTML = `Generated by: <code>${config.scanCommand}</code>`;
                }
            });
        }
        const infoCard = document.getElementById('productInfoCard');
        if (infoCard) {
            infoCard.style.display = 'block';
            document.getElementById('productDetails').innerHTML = `
                <strong style="color:var(--text-main);font-size:1.1rem;">${config.label}</strong><br>
                <span style="color:var(--accent);font-weight:700;font-size:1.05rem;">${config.price || ''}</span><br>
                <span style="color:var(--text-muted);font-size:0.85rem;">${config.subtitle}</span>
            `;
        }

        // Sprint banner: show days remaining for paid tiers
        const banner = document.getElementById('sprintBanner');
        if (banner && payload.exp && tier !== 'community') {
            const totalDays = tier === 'euai' ? 30 : (tier === 'executive' ? 90 : (tier === 'instant' ? 7 : 30));
            const msRemaining = (payload.exp * 1000) - Date.now();
            const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
            const isExpired = daysRemaining === 0;
            const pct = isExpired ? 0 : Math.max(0, Math.min(100, (msRemaining / (totalDays * 24 * 60 * 60 * 1000)) * 100));

            const daysEl = document.getElementById('sprintDays');
            const tierEl = document.getElementById('sprintTier');
            const projEl = document.getElementById('sprintProject');
            const fill = document.getElementById('sprintExpiryFill');

            if (isExpired) {
                daysEl.innerHTML = '<span style="color:#EF4444;font-weight:700;">EXPIRED</span>';
                tierEl.textContent = config.label;
                projEl.textContent = payload.projectName || 'default-project';
                fill.style.width = '0%';
                fill.style.background = 'linear-gradient(90deg,#EF4444,#991B1B)';
                banner.style.border = '1px solid rgba(239,68,68,0.4)';
                banner.style.background = 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(153,27,27,0.08))';
            } else {
                daysEl.textContent = daysRemaining;
                tierEl.textContent = config.label;
                projEl.textContent = payload.projectName || 'default-project';
                fill.style.width = pct + '%';

                // Color shift as expiry approaches
                if (pct < 15) fill.style.background = 'linear-gradient(90deg,#EF4444,#F59E0B)';
                else if (pct < 40) fill.style.background = 'linear-gradient(90deg,#F59E0B,#10B981)';
                else fill.style.background = 'linear-gradient(90deg,#2563EB,#10B981)';

                banner.style.border = '';
                banner.style.background = '';
            }

            banner.style.display = 'block';
        }
    } catch (e) {

        // Don't lock UI on decode error — let user fix the token
    } finally {
        updateDropzoneGate();
    }
}

// Auto-detect from URL session_id || token
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session_id');
const urlToken = urlParams.get('token');
if (urlToken) {
    licenseInput.value = urlToken;
    applyProductFromToken(urlToken);
    updateSubmit();
    updateDropzoneGate();
} else {
    filterScanProfiles('locked');
    syncModuleSelectionFromTier();
    updateDropzoneGate();
}
if (sessionId) {
    // Could fetch session details from backend here
    document.getElementById('pageSubtitle').innerHTML += '<br><em style="color:var(--accent);">Payment confirmed. Check your email for the license token.</em>';
}

// Token resend functionality
const resendBtn = document.getElementById('resendTokenBtn');
const resendEmail = document.getElementById('resendEmail');
const resendStatus = document.getElementById('resendStatus');

if (resendBtn) {
resendBtn.addEventListener('click', async () => {
    const email = resendEmail.value.trim();
    if (!email || !email.includes('@')) {
        resendStatus.textContent = 'Please enter a valid email address.';
        resendStatus.style.color = 'var(--error)';
        resendStatus.style.display = 'block';
        return;
    }
    resendBtn.disabled = true;
    resendBtn.textContent = 'Sending...';
    try {
        const response = await fetch(API_BASE + '/api/simplebeacon/billing/resend-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const result = await response.json();
        if (result.success) {
            resendStatus.textContent = result.message || 'Token sent to your inbox. Check your email (&& spam folder).';
            resendStatus.style.color = 'var(--success)';
        } else if (result.redirectToPricing) {
            window.location.href = 'pricing.html';
            return;
        } else {
            resendStatus.textContent = result.error || 'Could ! resend token. Please email ' + ((window.SIMPLEBEACON_SITE || {}).auditEmail || 'audit@simplebeacon.ai') + ' for help.';
            resendStatus.style.color = 'var(--error)';
        }
    } catch (err) {
        resendStatus.textContent = 'Network error. Please email ' + ((window.SIMPLEBEACON_SITE || {}).auditEmail || 'audit@simplebeacon.ai') + ' for help.';
        resendStatus.style.color = 'var(--error)';
    }
    resendStatus.style.display = 'block';
    resendBtn.disabled = false;
    resendBtn.textContent = 'Get Token';
});
}

// Developer Sandbox — generate a community token without payment
// Reads optional email from inline input for token recovery
const tryFreeBtn = document.getElementById('tryFreeBtn');
if (tryFreeBtn) {
tryFreeBtn.addEventListener('click', async () => {
    const btn = document.getElementById('tryFreeBtn');
    const originalText = '\u2699\uFE0F Try Free Sandbox';
    const email = (document.getElementById('resendEmail')?.value || '').trim();

    btn.disabled = true;
    btn.classList.add('btn-loading');
    let serverMsg = '';
    try {
        const response = await fetch(getFreeTokenUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        if (!response.ok) {
            const text = await response.text();
            try {
                const parsed = JSON.parse(text);
                if (parsed.error) serverMsg = parsed.error;
            } catch { serverMsg = text; }
            if (!serverMsg) serverMsg = 'Server returned ' + response.status;
            console.error('[FreeToken] HTTP', response.status, serverMsg);
            btn.textContent = originalText;
            showToast('Token generation failed: ' + serverMsg, 'error');
            return;
        }
        const data = await response.json();
        if (data.success && data.token) {
            licenseInput.value = data.token;
            applyProductFromToken(data.token);
            updateSubmit();
            updateDropzoneGate();
            btn.textContent = 'Free Token Ready ✓';
            btn.style.borderColor = 'var(--success)';
            btn.style.color = 'var(--success)';
            try { history.replaceState(null, '', '?token=' + encodeURIComponent(data.token)); } catch(e) {}
            if (email) showToast('Token generated. Save your email to recover this token later.', 'success');
        } else {
            console.error('[FreeToken] API error:', data);
            btn.textContent = originalText;
            showToast('Could not provision sandbox: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (err) {
        const msg = err?.message || String(err);
        console.error('[FreeToken] Network error:', msg);
        btn.textContent = originalText;
        showToast('Token generation failed: ' + msg, 'error');
    } finally {
        btn.classList.remove('btn-loading');
    }
});
}

// Wire up token input to validate format and update UI, but DO NOT auto-login.
// Login / Register only happens on Enter key (handled in audit.html auth modal).
licenseInput.addEventListener('input', () => {
    const tokenError = document.getElementById('tokenError');
    if (tokenError) tokenError.classList.add('hidden-display');
    const token = licenseInput.value.trim();
    // Only update button state and dropzone gate — do NOT unlock features here
    updateSubmit();
    updateDropzoneGate();
    // Show token inspector preview without applying product features
    if (token && hasValidToken()) {
        const payload = decodeJwtPayload(token);
        if (payload && typeof renderTokenInspector === 'function') {
            renderTokenInspector(payload);
        }
    }
});

function registerTokenInVault(token) {
    const payload = decodeJwtPayload(token);
    const tier = payload?.tier || payload?.product || 'free';
    const isFree = ['community', 'starter', 'instant', 'free', 'developer', 'sandbox'].includes(tier);
    const user = payload ? { email: payload.sub || 'token-user', plan: tier } : { email: 'token-user', plan: tier };
    const features = Array.isArray(payload?.features) ? payload.features : (Array.isArray(payload?.modules) ? payload.modules : null);
    const exp = payload?.exp || null;

    let vault = [];
    try {
        const raw = localStorage.getItem('sb-token-vault');
        if (raw) vault = JSON.parse(raw);
    } catch (e) { /* ignore */ }
    if (!Array.isArray(vault)) vault = [];

    const existing = vault.find((v) => v.token === token);
    if (existing) {
        existing.tier = tier;
        existing.exp = exp;
        existing.features = features;
        existing.user = user;
    } else {
        vault.push({ token, user, tier, exp, features, addedAt: new Date().toISOString(), usedAt: null });
    }
    localStorage.setItem('sb-token-vault', JSON.stringify(vault));

    if (isFree && features && features.length) {
        let accountFeatures = [];
        try {
            const raw = localStorage.getItem('sb-account-features');
            if (raw) accountFeatures = JSON.parse(raw);
        } catch (e) { /* ignore */ }
        if (!Array.isArray(accountFeatures)) accountFeatures = [];
        const merged = new Set([...accountFeatures, ...features]);
        localStorage.setItem('sb-account-features', JSON.stringify(Array.from(merged)));
    }

    if (!isFree) {
        const accountTokens = JSON.parse(localStorage.getItem('sb-account-tokens') || '[]');
        if (!Array.isArray(accountTokens)) accountTokens = [];
        if (!accountTokens.some((t) => t.token === token)) {
            accountTokens.push({ token, tier, exp, registeredAt: new Date().toISOString() });
            localStorage.setItem('sb-account-tokens', JSON.stringify(accountTokens));
        }
    }
}

function hideTokenSection() {
    const tokenSection = document.querySelector('.token-section');
    const tokenCard = tokenSection?.closest('.card');
    if (tokenCard) {
        tokenCard.style.display = 'none';
    } else if (tokenSection) {
        tokenSection.style.display = 'none';
    }
}

// Auto-restore sign-in on page load
(function restoreTokenSignIn() {
    const savedToken = localStorage.getItem('cascadeAuthToken');
    if (savedToken && savedToken.length > 20 && savedToken.includes('.')) {
        licenseInput.value = savedToken;
        applyProductFromToken(savedToken);
        updateDropzoneGate();
        const payload = decodeJwtPayload(savedToken);
        const tier = payload?.tier || payload?.product || '';
        const freeTiers = ['community','starter','instant','free','developer','sandbox'];
        if (!freeTiers.includes(tier)) {
            hideTokenSection();
        }
    }
})();

// Token gate — browser scan requires a valid token
function hasValidToken() {
    const val = licenseInput.value.trim();
    return val.length > 20 && val.includes('.');
}

function updateDropzoneGate() {
    if (!browserFolderDropzone) return;
    const locked = !hasValidToken();
    browserFolderDropzone.classList.toggle('locked', locked);
    const overlay = document.getElementById('dropzoneGateOverlay');
    if (overlay) overlay.style.display = locked ? 'flex' : 'none';
}

// Stepper state management
function updateStepper() {
    const step1 = document.getElementById('stepper1');
    const step2 = document.getElementById('stepper2');
    const step3 = document.getElementById('stepper3');
    const line1 = document.getElementById('stepperLine1');
    const line2 = document.getElementById('stepperLine2');
    const hasFile = reportData !== null;
    const hasToken = licenseInput.value.trim().length > 10;

    if (!step1 || !step2 || !step3) return;

    // Step 1: Upload Scan
    if (hasFile) {
        step1.classList.remove('active');
        step1.classList.add('done');
        line1.classList.add('done');
    } else {
        step1.classList.add('active');
        step1.classList.remove('done');
        line1.classList.remove('done');
    }

    // Step 2: Enter Token
    if (hasFile && hasToken) {
        step2.classList.remove('active');
        step2.classList.add('done');
        line2.classList.add('done');
    } else if (hasFile) {
        step2.classList.add('active');
        step2.classList.remove('done');
        line2.classList.add('active');
        line2.classList.remove('done');
    } else {
        step2.classList.remove('active', 'done');
        line2.classList.remove('active', 'done');
    }

    // Step 3: Certificate
    if (hasFile && hasToken) {
        step3.classList.add('active');
        step3.classList.remove('done');
    } else {
        step3.classList.remove('active', 'done');
    }
}

// localStorage persistence
const LS_KEY_TOKEN = 'simplebeacon_token';
const LS_KEY_SCAN = 'simplebeacon_scan_data';

// v10-stale-guard — always purge cached scan data on fresh page load
(function clearStaleCache() {
    try {
        var isFresh = !sessionStorage.getItem('sb_main_visited');
        if (isFresh) {
            localStorage.removeItem(LS_KEY_SCAN);
            for (var k in localStorage) { if (k.indexOf('sbr_') === 0) localStorage.removeItem(k); }
        }
        sessionStorage.setItem('sb_main_visited', '1');
    } catch (e) { /* ignore */ }
})();

function saveToLocalStorage() {
    try {
        const token = licenseInput.value.trim();
        if (token) {
            localStorage.setItem(LS_KEY_TOKEN, token);
            // Sync to main dashboard keys so both analyzers share the same token
            localStorage.setItem('cascadeAuthToken', token);
            localStorage.setItem('access_token', token);
            localStorage.setItem('token', token);
            localStorage.setItem('authToken', token);
        }
        if (reportData) localStorage.setItem(LS_KEY_SCAN, JSON.stringify(reportData));
    } catch (e) { /* Storage may be full || disabled */ }
}

function loadFromLocalStorage() {
    try {
        // Try main dashboard token keys first, then fallback to upload.html's own key
        const dashboardKeys = ['cascadeAuthToken', 'access_token', 'token', 'authToken'];
        let savedToken = localStorage.getItem(LS_KEY_TOKEN);
        if (!savedToken) {
            for (const key of dashboardKeys) {
                const t = localStorage.getItem(key);
                if (t) { savedToken = t; break; }
            }
        }
        if (savedToken && !licenseInput.value.trim()) {
            licenseInput.value = savedToken;
            try {
                applyProductFromToken(savedToken);
                updateDropzoneGate();
            } catch (e) {

                localStorage.removeItem(LS_KEY_TOKEN);
                for (const key of dashboardKeys) localStorage.removeItem(key);
                licenseInput.value = '';
            }
        }
        const savedScan = localStorage.getItem(LS_KEY_SCAN);
        if (savedScan) {
            const parsed = JSON.parse(savedScan);
            const totalFiles = parsed.totalFiles || parsed.repositoryFilesTotal || 0;
            const projectName = parsed.projectName || parsed.projectRoot || '';
            const generatedAt = parsed.generatedAt ? new Date(parsed.generatedAt) : null;
            const ageHours = generatedAt ? (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60) : 0;
            const isStaleProject = /^(css|js|test|temp|untitled|default|project)$/i.test(projectName) || projectName.includes('CascadeProjects') && !projectName.includes('coming-soon');
            if (totalFiles > 1000 || isStaleProject || ageHours > 0.001) {
                localStorage.removeItem(LS_KEY_SCAN);
                const reason = totalFiles > 1000 ? 'large file count' : (isStaleProject ? 'stale project name' : 'expired');
                showToast('Cleared stale scan cache (' + reason + '). Please re-upload your report.', 'warning');
                return;
            }
            reportData = parsed;
            if (typeof window.renderPreview === 'function') window.renderPreview(reportData);
            scanPreview.style.display = 'block';
            updateSubmit();
            showToast('Restored previous scan from browser storage', 'info');
            showStatus('Restored previous scan from browser storage.', 'success');
            // Scroll user to the restored certificate section after a brief delay
            setTimeout(() => {
                const tokenRow = document.getElementById('tokenActionRow');
                if (tokenRow && tokenRow.style.display !== 'none') {
                    tokenRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 400);
        }
    } catch (e) { /* Ignore parse errors */ }
}

// Reset button — clear uploaded scan
const resetBtn = document.getElementById('resetBtn');
if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        console.log('[resetBtn] clicked');
        reportData = null;
        window._scanPreviewData = null;
        window._scanPreviewModules = null;
        // Abort any in-progress scan
        if (scanAbortController) { scanAbortController.abort(); scanAbortController = null; }
        if (typeof cliFileName !== 'undefined' && cliFileName) cliFileName.textContent = '';
        if (typeof cliJsonDropzone !== 'undefined' && cliJsonDropzone) cliJsonDropzone.classList.remove('has-file');
        if (typeof fileInput !== 'undefined' && fileInput) fileInput.value = '';
        if (scanPreview) { scanPreview.innerHTML = ''; scanPreview.style.display = 'none'; }
        const localScanFileName = document.getElementById('localScanFileName');
        if (localScanFileName) localScanFileName.textContent = '';
        // Clear secure report block
        const secureBlock = document.getElementById('secureReportBlock');
        if (secureBlock) secureBlock.remove();
        // Clear hash ribbons
        ['browserHashRibbon', 'cliHashRibbon'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.style.display = 'none'; el.innerHTML = ''; }
        });
        if (integrityHashEl) {
            integrityHashEl.textContent = 'HASH: NOT_YET_CALCULATED';
            integrityHashEl.style.color = '#64748B';
        }
        // Reset terminal && browser scan panels
        accumulatedPickerFiles = [];
        isAccumulatingFolders = false;
        if (terminalConsole) terminalConsole.innerHTML = '';
        if (dropzonePrompt) dropzonePrompt.style.display = '';
        if (panelStatus) { panelStatus.textContent = 'AWAITING_INPUT'; panelStatus.style.color = '#F59E0B'; }
        if (panelMetrics) { panelMetrics.innerHTML = ''; panelMetrics.style.display = 'none'; }
        if (panelProgressContainer) panelProgressContainer.style.display = 'none';
        if (panelProgressBar) panelProgressBar.style.width = '0%';
        // Hide cancel && log buttons
        const cancelBtn = document.getElementById('cancelScanBtn');
        if (cancelBtn) cancelBtn.style.display = 'none';
        const downloadLogBtn = document.getElementById('downloadLogBtn');
        if (downloadLogBtn) downloadLogBtn.style.display = 'none';
        // Reset scan profiles
        resetScanProfiles();
        syncModuleSelectionFromTier();
        // Hide status && token action row
        status.style.display = 'none';
        status.className = 'status';
        const tokenActionRow = document.getElementById('tokenActionRow');
        if (tokenActionRow) tokenActionRow.style.display = 'none';
        // Clear persisted scan data
        try { localStorage.removeItem(LS_KEY_SCAN); } catch (e) { /* ignore */ }
        updateSubmit();
        updateStepper();
        showToast('Scan cleared. Upload a new report to continue.', 'info');
    });
}

// Note: beforeunload confirmation removed — users can leave freely.

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === '1') { e.preventDefault(); tabCli.click(); }
        if (e.key === '2') { e.preventDefault(); tabBrowser.click(); }
    }
    if (e.key === 'Escape') {
        // Clear any status messages
        status.style.display = 'none';
    }
});

// Real-time token validation feedback
function validateTokenVisual() {
    const val = licenseInput.value.trim();
    const indicator = document.getElementById('tokenValidIndicator');
    if (!indicator) return;
    if (val.length === 0) {
        indicator.classList.remove('show', 'valid', 'invalid');
        updateDropzoneGate();
        return;
    }
    const looksValid = val.length > 20 && val.includes('.');
    indicator.classList.add('show');
    if (looksValid) {
        indicator.classList.add('valid');
        indicator.classList.remove('invalid');
        indicator.innerHTML = '<span>&#10003;</span> Token format looks valid';
    } else {
        indicator.classList.add('invalid');
        indicator.classList.remove('valid');
        indicator.innerHTML = '<span>&#9888;</span> Token too short || malformed';
    }
    updateDropzoneGate();
}

function updateSubmit() {
    const hasToken = licenseInput.value.trim().length > 10;
    const hasFile = reportData !== null;
    const tokenActionRow = document.getElementById('tokenActionRow');
    const certEmptyState = document.getElementById('certEmptyState');
    const certSubmitBtn = document.getElementById('certSubmitBtn');
    if (scanPreview) scanPreview.style.display = hasFile ? 'block' : 'none';
    if (certEmptyState) certEmptyState.style.display = hasFile ? 'none' : 'block';
    const resetBtnEl = document.getElementById('resetBtn');
    if (resetBtnEl) resetBtnEl.style.display = hasFile ? 'inline-block' : 'none';
    if (hasFile) updateStepper();

    // Always show token row so users can change tokens freely
    if (tokenActionRow) tokenActionRow.style.display = 'block';
    if (hasFile) {
        // Certificate generation no longer requires a token (token gates browser scan only)
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>&#128229;</span> Generate Certificate';
            submitBtn.style.opacity = '1';
        }
        if (certSubmitBtn) {
            certSubmitBtn.disabled = false;
            certSubmitBtn.innerHTML = '<span>&#128229;</span> Generate Certificate';
            certSubmitBtn.style.opacity = '1';
        }
        // Re-render preview to update watermark/unlock state
        if (reportData && typeof window.renderPreview === 'function') window.renderPreview(reportData);
    } else {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>&#128229;</span> Generate Certificate';
            submitBtn.style.opacity = '1';
        }
        if (certSubmitBtn) {
            certSubmitBtn.disabled = true;
            certSubmitBtn.innerHTML = '<span>&#128229;</span> Generate Certificate';
            certSubmitBtn.style.opacity = '1';
        }
    }
    updateStepper();
    validateTokenVisual();
    saveToLocalStorage();
}

// === Tab Toggle ===
if (tabCli && tabBrowser && viewCli && viewBrowser) {
    tabCli.addEventListener('click', () => {
        tabCli.classList.add('active');
        tabBrowser.classList.remove('active');
        viewCli.style.display = 'block';
        viewBrowser.style.display = 'none';
    });
    tabBrowser.addEventListener('click', () => {
        tabBrowser.classList.add('active');
        tabCli.classList.remove('active');
        viewBrowser.style.display = 'block';
        viewCli.style.display = 'none';
    });
}

// === CLI Sub-tab Toggle ===
const tabCliImport = document.getElementById('tab-cli-import');
const tabCliSetup = document.getElementById('tab-cli-setup');
const viewCliImport = document.getElementById('view-cli-import');
const viewCliSetup = document.getElementById('view-cli-setup');
if (tabCliImport && tabCliSetup && viewCliImport && viewCliSetup) {
    tabCliImport.addEventListener('click', () => {
        tabCliImport.classList.add('active');
        tabCliSetup.classList.remove('active');
        viewCliImport.style.display = 'block';
        viewCliSetup.style.display = 'none';
        // Reset inner tabs to Drag & Drop on reopen
        if (tabImportUpload && tabImportPaste && viewImportUpload && viewImportPaste) {
            tabImportUpload.classList.add('active');
            tabImportPaste.classList.remove('active');
            viewImportUpload.style.display = 'block';
            viewImportPaste.style.display = 'none';
        }
    });
    tabCliSetup.addEventListener('click', () => {
        tabCliSetup.classList.add('active');
        tabCliImport.classList.remove('active');
        viewCliSetup.style.display = 'block';
        viewCliImport.style.display = 'none';
    });
}

// === One-Click Install ===
const oneClickInstallBtn = document.getElementById('oneClickInstallBtn');
const installCommandEl = document.getElementById('installCommand');
if (oneClickInstallBtn && installCommandEl) {
    oneClickInstallBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(installCommandEl.textContent).then(() => {
            showToast('Install command copied! Paste in your terminal.', 'success');
        }).catch(() => {
            showToast('Copy failed. Select && copy manually.', 'error');
        });
    });
}

// === Drag & Drop / Copy & Paste Inner Tab Toggle ===
const tabImportUpload = document.getElementById('tab-import-upload');
const tabImportPaste = document.getElementById('tab-import-paste');
const viewImportUpload = document.getElementById('view-import-upload');
const viewImportPaste = document.getElementById('view-import-paste');
if (tabImportUpload && tabImportPaste && viewImportUpload && viewImportPaste) {
    tabImportUpload.addEventListener('click', () => {
        tabImportUpload.classList.add('active');
        tabImportPaste.classList.remove('active');
        viewImportUpload.style.display = 'block';
        viewImportPaste.style.display = 'none';
    });
    tabImportPaste.addEventListener('click', () => {
        tabImportPaste.classList.add('active');
        tabImportUpload.classList.remove('active');
        viewImportPaste.style.display = 'block';
        viewImportUpload.style.display = 'none';
    });
}

// === Browser Folder Dropzone ===
// showDirectoryPicker must be called SYNCHRONOUSLY inside a user-gesture handler.
// Using .then() instead of await preserves the gesture chain through the click event.
// Drag-and-drop is the fallback for browsers without File System Access API.
function triggerDirectoryPicker() {
    if (!hasValidToken()) {
        showToast('Paste a license token to unlock scanning.', 'warning');
        licenseInput.focus();
        licenseInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    if (isPickerActive) {
        console.log('[triggerDirectoryPicker] already running — skip');
        return;
    }
    isPickerActive = true;
    // _pickerTriggeredByButton is set by the caller (startLocalScan) when appropriate

    // Prefer File System Access API directory picker (Chrome/Edge)
    // Secure context required: HTTPS, localhost, or 127.0.0.1
    const isSecureContext = typeof window.isSecureContext !== 'undefined'
        ? window.isSecureContext
        : location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (typeof showDirectoryPicker === 'function' && isSecureContext) {
        console.log('[triggerDirectoryPicker] calling showDirectoryPicker synchronously');
        var pickerTimeout = setTimeout(function() {
            if (isPickerActive) {
                console.log('[triggerDirectoryPicker] picker timeout — resetting isPickerActive');
                isPickerActive = false;
            }
        }, 30000);
        // Call synchronously — do NOT await here — to preserve user gesture
        showDirectoryPicker().then((dirHandle) => {
            clearTimeout(pickerTimeout);
            console.log('[triggerDirectoryPicker] dirHandle acquired');
            return collectFilesFromDirectoryHandle(dirHandle);
        }).then((files) => {
            console.log('[triggerDirectoryPicker] collected ' + files.length + ' files');
            const pickerCheck = applyFolderSizeAnalysis(files, 'Picker');
            if (!pickerCheck.proceed) {
                isPickerActive = false;
                return;
            }
            safeBatchPush(accumulatedPickerFiles, files);
            isAccumulatingFolders = true;
            showAccumulationPrompt();
            // Auto-start scan if user triggered via Start Local Scan button
            if (_pickerTriggeredByButton) {
                _pickerTriggeredByButton = false;
                console.log('[triggerDirectoryPicker] auto-starting scan from button trigger');
                setTimeout(function() { window._startAccumulatedScan(); }, 100);
            }
        }).catch((err) => {
            clearTimeout(pickerTimeout);
            console.log('[triggerDirectoryPicker] error: ' + err.name + ' ' + err.message);
            if (err.name === 'AbortError') {
                _pickerTriggeredByButton = false;
                isPickerActive = false;
                return;
            }
            // User gesture expired inside promise handler — can't programmatically click input.
            // Show drag-and-drop guidance instead.
            showToast('Browser folder picker unavailable (' + err.name + '). Drag & drop your project folder onto the dropzone below.', 'warning', TOAST_DURATION_LONG);
        }).finally(() => {
            clearTimeout(pickerTimeout);
            // Safety net: always release picker lock so button never deadlocks
            isPickerActive = false;
        });
        return;
    }

    tryWebkitDirectoryFallback();
}

function tryWebkitDirectoryFallback() {
    const folderInput = document.getElementById('cli-folder-input');
    if (folderInput) {
        console.log('[triggerDirectoryPicker] using webkitdirectory input');
        try {
            // _pickerTriggeredByButton is managed by the caller (startLocalScan sets it, dropzone does not)
            folderInput.click();
            // Don't reset isPickerActive here — the change (or cancel) event on the input will release it.
            // This prevents duplicate startLocalScan calls caused by click-event bubbling.
            // Safety net: if the browser blocks the picker or the user cancels without firing
            // an event (Firefox/Safari), release the lock so the button doesn't deadlock.
            setTimeout(function() {
                if (isPickerActive) {
                    console.log('[triggerDirectoryPicker] fallback safety timeout — releasing isPickerActive');
                    isPickerActive = false;
                }
            }, 30000);
            return;
        } catch (e) {
            console.log('[triggerDirectoryPicker] input click blocked:', e);
        }
    }
    console.log('[triggerDirectoryPicker] showing drag-and-drop guidance');
    showToast('Drag & drop your project folder onto the dropzone below to start scanning.', 'info', TOAST_DURATION_LONG);
    if (browserFolderDropzone) {
        browserFolderDropzone.scrollIntoView({ behavior: 'smooth', block: 'center' });
        browserFolderDropzone.classList.add('pulse-highlight');
        setTimeout(() => browserFolderDropzone.classList.remove('pulse-highlight'), 4000);
    }
    isPickerActive = false;
}

async function collectFilesFromDirectoryHandle(dirHandle) {
    console.log('[collectFilesFromDirectoryHandle] starting, dirHandle=' + (dirHandle ? (dirHandle.name + ' kind=' + dirHandle.kind) : 'null'));
    if (!dirHandle || dirHandle.kind !== 'directory') {
        console.error('[collectFilesFromDirectoryHandle] invalid dirHandle');
        appendTerminalLine('Invalid directory handle — picker may have returned a file instead of a folder.', 'error');
        return [];
    }
    const files = [];
    let traverseErrors = 0;
    let lastUpdate = Date.now();
    const localScanFileName = document.getElementById('localScanFileName');
    if (localScanFileName) localScanFileName.textContent = 'Discovering files...';

    async function traverse(handle, parentPath) {
        if (files.length >= MAX_DISCOVERED_FILES) return;
        const currentPath = parentPath ? parentPath + '/' + handle.name : handle.name;
        const normalizedPath = currentPath.replace(/\\/g, '/');
        // Note: SKIP_DIRS removed from discovery — all files are counted for hygiene metrics

        if (handle.kind === 'file') {
            if (files.length >= MAX_DISCOVERED_FILES) return;
            try {
                const file = await handle.getFile();
                Object.defineProperty(file, 'webkitRelativePath', {
                    value: currentPath,
                    writable: false,
                    configurable: true
                });
                files.push(file);
            } catch (err) {
                traverseErrors++;
                if (traverseErrors <= 5) {
                    appendTerminalLine('File read error: ' + normalizedPath + ' — ' + err.name + ': ' + err.message, 'warn');
                }
            }
        } else if (handle.kind === 'directory') {
            try {
                const iterable = typeof handle.values === 'function' ? handle.values() : (typeof handle.entries === 'function' ? handle.entries() : null);
                if (!iterable) {
                    appendTerminalLine(`Directory ${normalizedPath}: no iterator API available (values/entries missing)`, 'warn');
                    return;
                }
                // Stream entries from iterator in bounded batches to avoid OOM on huge dirs
                const BATCH_SIZE = 100;
                let batch = [];
                for await (const item of iterable) {
                    if (files.length >= MAX_DISCOVERED_FILES) break;
                    batch.push(Array.isArray(item) ? item[1] : item);
                    if (batch.length >= BATCH_SIZE) {
                        try {
                            await Promise.all(batch.map(entry => traverse(entry, currentPath)));
                        } catch (err) {
                            appendTerminalLine(`Batch error in ${normalizedPath}: ${err.name}: ${err.message}`, 'warn');
                            traverseErrors++;
                        }
                        batch = [];
                        await new Promise(r => setTimeout(r, 0));
                    }
                }
                if (batch.length > 0 && files.length < MAX_DISCOVERED_FILES) {
                    try {
                        await Promise.all(batch.map(entry => traverse(entry, currentPath)));
                    } catch (err) {
                        appendTerminalLine(`Batch error in ${normalizedPath}: ${err.name}: ${err.message}`, 'warn');
                        traverseErrors++;
                    }
                }
            } catch (err) {
                appendTerminalLine(`Directory ${normalizedPath}: read error listing entries — ${err.name}: ${err.message}`, 'error');
                traverseErrors++;
                return;
            }
        }

        const now = Date.now();
        if (now - lastUpdate > UPDATE_INTERVAL) {
            lastUpdate = now;
            if (localScanFileName) {
                localScanFileName.textContent = 'Discovered ' + files.length.toLocaleString() + ' files...';
            }
        }
    }

    try {
        await traverse(dirHandle, '');
    } catch (err) {
        appendTerminalLine(`Directory traversal failed: ${err.name}: ${err.message}`, 'error');
        console.error(err);
    }

    if (files.length >= MAX_DISCOVERED_FILES) {
        appendTerminalLine('<span style="color:#EF4444;font-weight:700;">&#9888; File limit reached:</span> ' + MAX_DISCOVERED_FILES.toLocaleString() + ' files discovered. Use CLI for full coverage.', 'warn');
    }
    appendTerminalLine('&#128451; Discovery complete: ' + files.length.toLocaleString() + ' files, ' + traverseErrors + ' read errors.');
    if (traverseErrors > 0) {
        appendTerminalLine('Warning: ' + traverseErrors + ' files/dirs could not be read during directory traversal.', 'warn');
    }
    if (files.length >= MAX_DISCOVERED_FILES) {
        appendTerminalLine('<span style="color:#F59E0B;font-weight:700;">&#9888; Large repo:</span> ' + files.length.toLocaleString() + ' files discovered.', 'warn');
    }
    if (localScanFileName) {
        localScanFileName.innerHTML = '<span style="font-size:1.1rem;font-weight:700;color:#60A5FA;">' + files.length.toLocaleString() + '</span> <span style="font-size:0.75rem;color:#94A3B8;">files in directory</span>';
    }
    appendTerminalLine('<span style="color:#60A5FA;font-weight:700;">&#128451;</span> Directory contains <strong>' + files.length.toLocaleString() + '</strong> files.');
    // Diagnostic: warn if showDirectoryPicker returned suspiciously few files
    if (files.length > 0 && files.length < 3000) {
        appendTerminalLine('<span style="color:#F59E0B;font-weight:700;">&#9888; Low file count detected:</span> The browser directory picker may have capped results at ~1,000–1,500 files. For large directories, try <strong>dragging and dropping</strong> the folder onto the dropzone instead — it uses a different API with higher limits.', 'warn');
    }
    return files;
}

if (browserFolderDropzone) browserFolderDropzone.addEventListener('click', (e) => {
    if (!e.isTrusted) return;  // ignore programmatic clicks (e.g. folderInput.click())
    if (e.target.closest('#terminal-console')) return;
    triggerDirectoryPicker();
});
if (dropzonePrompt) dropzonePrompt.addEventListener('click', (e) => {
    e.stopPropagation();
    triggerDirectoryPicker();
});
let _browserDragDepth = 0;
if (browserFolderDropzone) browserFolderDropzone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (!hasValidToken()) return;
    _browserDragDepth++;
    if (_browserDragDepth === 1) {
        browserFolderDropzone.classList.add('dragover');
        const fileCount = e.dataTransfer.items?.length || e.dataTransfer.files?.length || 0;
        const prompt = browserFolderDropzone.querySelector('#terminal-dropzone-prompt p');
        if (prompt && !browserFolderDropzone.dataset.originalText) {
            browserFolderDropzone.dataset.originalText = prompt.innerHTML;
        }
        if (prompt) prompt.innerHTML = `<span style="color:#60A5FA;font-weight:600;">&#128737; ${fileCount > 0 ? fileCount + ' item' + (fileCount > 1 ? 's' : '') + ' ready to scan' : 'Drop to scan'}</span>`;
    }
});
if (browserFolderDropzone) browserFolderDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
});
if (browserFolderDropzone) browserFolderDropzone.addEventListener('dragleave', (e) => {
    _browserDragDepth--;
    if (_browserDragDepth <= 0) {
        _browserDragDepth = 0;
        browserFolderDropzone.classList.remove('dragover');
        const prompt = browserFolderDropzone.querySelector('#terminal-dropzone-prompt p');
        if (prompt && browserFolderDropzone.dataset.originalText) {
            prompt.innerHTML = browserFolderDropzone.dataset.originalText;
        }
    }
});
if (browserFolderDropzone) browserFolderDropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    _browserDragDepth = 0;
    browserFolderDropzone.classList.remove('dragover');
    if (!hasValidToken()) {
        showToast('Paste a license token to unlock scanning.', 'warning');
        licenseInput.focus();
        licenseInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    const prompt = browserFolderDropzone.querySelector('#terminal-dropzone-prompt p');
    if (prompt && browserFolderDropzone.dataset.originalText) {
        prompt.innerHTML = browserFolderDropzone.dataset.originalText;
    }
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
        const localScanFileName = document.getElementById('localScanFileName');
        if (localScanFileName) localScanFileName.textContent = 'Discovering files...';
        const files = [];
        const state = { traverseErrors: 0, traverseAbort: false, lastUpdate: Date.now() };

        // Allow Escape to cancel during discovery
        const onKeyDown = (ev) => {
            if (ev.key === 'Escape') {
                state.traverseAbort = true;
                if (localScanFileName) localScanFileName.textContent = 'Discovery cancelled by user.';
                appendTerminalLine('Discovery cancelled by user.', 'warn');
                document.removeEventListener('keydown', onKeyDown);
            }
        };
        document.addEventListener('keydown', onKeyDown);

        for (let i = 0; i < items.length && !state.traverseAbort; i++) {
            const entry = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
            if (entry) await traverseFileSystemEntry(entry, '', files, state);
        }
        document.removeEventListener('keydown', onKeyDown);

        if (state.traverseAbort) return;

        // Fallback: some browsers (Firefox, Safari) don't expose webkitGetAsEntry for dropped folders
        if (files.length === 0 && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const dtFiles = Array.from(e.dataTransfer.files);
            const hasRelativePath = dtFiles.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
            if (hasRelativePath) {
                // Chrome/Edge flattened drop — files already have webkitRelativePath
                safeBatchPush(files, dtFiles);
            } else {
                // Flat file list without paths — create minimal File wrappers
                dtFiles.forEach(f => {
                    if (!f.webkitRelativePath) {
                        Object.defineProperty(f, 'webkitRelativePath', { value: f.name, configurable: true });
                    }
                    files.push(f);
                });
            }
        }

        if (files.length >= MAX_DISCOVERED_FILES) {
            appendTerminalLine(`<span style="color:#EF4444;font-weight:700;">&#9888; File limit reached:</span> ${MAX_DISCOVERED_FILES.toLocaleString()} files discovered. Browser memory limit — use CLI for full coverage.`, 'warn');
        }
        if (state.traverseErrors > 0) {
            appendTerminalLine(`Warning: ${state.traverseErrors} files could ! be read during directory traversal.`, 'warn');
        }
        if (files.length >= MAX_DISCOVERED_FILES) {
            appendTerminalLine(`<span style="color:#F59E0B;font-weight:700;">&#9888; Large repo:</span> ${files.length.toLocaleString()} files discovered. Scanning very large repositories in-browser may be slow — consider using the CLI for best performance.`, 'warn');
        }
        if (localScanFileName) {
            localScanFileName.innerHTML = `<span style="font-size:1.1rem;font-weight:700;color:#60A5FA;">${files.length.toLocaleString()}</span> <span style="font-size:0.75rem;color:#94A3B8;">files in directory</span>`;
        }
        appendTerminalLine(`<span style="color:#60A5FA;font-weight:700;">&#128451;</span> Directory contains <strong>${files.length.toLocaleString()}</strong> files.`);
        const dropCheck = applyFolderSizeAnalysis(files, 'Drop');
        if (!dropCheck.proceed) return;
        // Defensive stale-data purge before new scan
        window._scanPreviewData = null;
        window._scanPreviewModules = null;
        if (typeof selectedModules !== 'undefined' && selectedModules.clear) selectedModules.clear();
        if (scanPreview) { scanPreview.innerHTML = ''; }
        if (typeof window.processLocalCLIScan === 'function') await window.processLocalCLIScan(files);
    }
});

// === Keyboard Shortcuts ===
document.addEventListener('keydown', (e) => {
    // Escape -> clear status messages
    if (e.key === 'Escape') {
        const statusEl = document.getElementById('status');
        if (statusEl) statusEl.style.display = 'none';
    }
});

// SHA-256 helper using Web Crypto API
async function computeSha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function showHashRibbon(elementId, valueId, text) {
    const ribbon = document.getElementById(elementId);
    const value = document.getElementById(valueId);
    if (ribbon && value) {
        value.textContent = 'sha256-' + text;
        ribbon.style.display = 'flex';
    }
    if (integrityHashEl) {
        integrityHashEl.textContent = 'HASH: sha256-' + text;
        integrityHashEl.style.color = '#34D399';
    }
}

// ── 6-Dimension Data Quality Validator ──────────────────────────────
function validateReportQuality(report) {
    const dims = [];
    let passCount = 0;

    // 1. Accuracy — counts mirror reality
    // totalFiles/repositoryFilesTotal = raw inventory; filesAnalyzed/codebase.totalFiles = actually scanned
    const accChecks = [
        report.totalFiles === report.repositoryFilesTotal,
        report.filesAnalyzed === (report.codebase?.totalFiles || report.filesAnalyzed),
        report.filesAnalyzed <= report.totalFiles,
        report.issueCount === report.simplebeaconIssues
    ];
    const accPass = accChecks.every(Boolean);
    dims.push({ name: 'Accuracy', pass: accPass, note: accPass ? 'Counts align across all fields' : 'Mismatch: inventory vs analyzed counts or issue totals inconsistent' });
    if (accPass) passCount++;

    // 2. Completeness — required modules present
    const requiredModules = ['gateReport', 'gate'];
    const missingMods = requiredModules.filter(m => !report[m] || typeof report[m] !== 'object');
    const compPass = missingMods.length === 0;
    dims.push({ name: 'Completeness', pass: compPass, note: compPass ? 'All core modules present' : `Missing modules: ${missingMods.join(', ')}` });
    if (compPass) passCount++;

    // 3. Consistency — cross-field arithmetic holds
    const sevSum = (report.severityCounts?.critical || 0) + (report.severityCounts?.high || 0) + (report.severityCounts?.medium || 0) + (report.severityCounts?.low || 0);
    const summaryFindings = report.summary?.totalFindings ?? -1;
    const consChecks = [
        sevSum === report.issueCount,
        summaryFindings === report.issueCount || summaryFindings === -1,
        (report.gateReport?.blockingCount ?? 0) === (report.gate?.blockingCount ?? 0)
    ];
    const consPass = consChecks.every(Boolean);
    dims.push({ name: 'Consistency', pass: consPass, note: consPass ? 'Cross-field arithmetic verified' : `severitySum(${sevSum})≠issueCount(${report.issueCount}) || gate mismatch` });
    if (consPass) passCount++;

    // 4. Timeliness — timestamp valid && within 5 min window
    const scanDate = new Date(report.generatedAt);
    const nowMs = Date.now();
    const MS_PER_MINUTE = 60000;
    const ageMin = (nowMs - scanDate.getTime()) / MS_PER_MINUTE;
    const timePass = !isNaN(scanDate.getTime()) && ageMin >= -2 && ageMin <= 5;
    dims.push({ name: 'Timeliness', pass: timePass, note: timePass ? `Timestamp valid (${ageMin.toFixed(1)}m ago)` : 'Timestamp missing, future-dated, || stale' });
    if (timePass) passCount++;

    // 5. Validity — schema types && ranges
    const qs = report.qualityScore;
    const valChecks = [
        Number.isFinite(qs) && qs >= 0 && qs <= 100,
        Number.isFinite(report.totalFiles) && report.totalFiles >= 0,
        Array.isArray(report.detectedIssues),
        Array.isArray(report.issues),
        typeof report.projectRoot === 'string' && report.projectRoot.length > 0
    ];
    const valPass = valChecks.every(Boolean);
    dims.push({ name: 'Validity', pass: valPass, note: valPass ? 'Schema types && ranges correct' : 'qualityScore, totalFiles, || arrays have invalid types/ranges' });
    if (valPass) passCount++;

    // 6. Integrity — report is serializable (proxy for tamper-check)
    let intPass = false;
    let intNote = '';
    try {
        const copy = JSON.parse(JSON.stringify(report));
        intPass = copy && typeof copy === 'object';
        intNote = intPass ? 'Deep-clone serialization successful' : 'Report ! serializable';
    } catch (e) {
        intNote = 'Serialization failed — circular reference || non-JSON data';
    }
    dims.push({ name: 'Integrity', pass: intPass, note: intNote });
    if (intPass) passCount++;

    const score = Math.round((passCount / 6) * 100);
    const overall = passCount === 6 ? 'PASS' : (passCount >= 4 ? 'REVIEW' : 'FAIL');
    return { dims, score, overall, passCount };
}

function renderQualityScorecard(report) {
    const { dims, score, overall, passCount } = validateReportQuality(report);
    const overallColor = overall === 'PASS' ? '#34D399' : (overall === 'REVIEW' ? '#F59E0B' : '#EF4444');
    appendTerminalLine('');
    appendTerminalLine(`Data Quality Scorecard — ${overall} (${score}/100)`, overall === 'PASS' ? 'success' : (overall === 'REVIEW' ? 'warn' : 'error'));
    for (const d of dims) {
        const icon = d.pass ? '✓' : '✗';
        const color = d.pass ? '#34D399' : '#EF4444';
        appendTerminalLine(`  ${icon} <span style="color:${color};">${d.name}</span> — ${d.note}`);
    }
    appendTerminalLine(`  ${passCount}/6 dimensions passed · Report is ${overall === 'PASS' ? 'ready for certificate generation' : 'flagged for review'}.`);
    return { dims, score, overall };
}

function handleJsonFile(file) {
    if (!file.name.endsWith('.json')) {
        showToast('Please upload a .json file', 'error');
        showStatus('Please upload a .json file', 'error');
        return;
    }
    if (typeof cliFileName !== 'undefined' && cliFileName) cliFileName.textContent = file.name;
    if (typeof cliJsonDropzone !== 'undefined' && cliJsonDropzone) cliJsonDropzone.classList.add('has-file');
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            reportData = JSON.parse(e.target.result);
            // Compute hash of raw JSON content
            const hash = await computeSha256(e.target.result);
            showHashRibbon('cliHashRibbon', 'cliHashValue', hash);
            if (typeof window.renderPreview === 'function') window.renderPreview(reportData);
            scanPreview.style.display = 'block';
            updateSubmit();
            showToast(`Loaded "${file.name}" — ${(e.target.result.length / 1024).toFixed(1)} KB`, 'success');
            // Show file metadata
            const metaDisplay = document.getElementById('fileMetaDisplay');
            if (metaDisplay) {
                const safeName = file.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                metaDisplay.innerHTML = `
                    <span style="color:#60A5FA;font-weight:600;">&#128206; ${safeName}</span>
                    <span style="margin-left:12px;">${(e.target.result.length / 1024).toFixed(1)} KB</span>
                    <span style="margin-left:12px;color:var(--text-muted);">Modified: ${new Date(file.lastModified).toLocaleDateString()}</span>
                `;
                metaDisplay.style.display = 'block';
            }
            // Auto-scroll to certificate section
            document.getElementById('tokenActionRow').scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (err) {
            showToast('Invalid JSON file', 'error');
            showStatus('Invalid JSON file', 'error');
            reportData = null;
            if (scanPreview) scanPreview.style.display = 'none';
            updateSubmit();
        }
    };
    reader.readAsText(file);
}

if (cliFolderInput) {
    cliFolderInput.addEventListener('cancel', () => {
        console.log('[cliFolderInput] cancel event — releasing isPickerActive');
        isPickerActive = false;
    });
    cliFolderInput.addEventListener('change', async (e) => {
        isPickerActive = false;
        if (!hasValidToken()) {
        showToast('Paste a license token to unlock scanning.', 'warning');
        licenseInput.focus();
        licenseInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        e.target.value = '';
        return;
    }
    const entries = e.target.webkitEntries || [];
    const filesArray = e.target.files || [];
    // Prefer .files — it's flattened, has webkitRelativePath, and is reliable across browsers.
    // webkitEntries traversal is buggy in Firefox (only returns top-level items, won't recurse).
    if (filesArray.length > 0) {
        const pickedFiles = Array.from(filesArray);
        // Firefox webkitdirectory only returns top-level files (non-recursive).
        // Detect shallow listings so the user can switch to drag-and-drop for full coverage.
        const hasSubdirFiles = pickedFiles.some(f => {
            const rp = f.webkitRelativePath || '';
            return (rp.match(/\//g) || []).length >= 2;
        });
        const isFirefox = /Firefox\//i.test(navigator.userAgent);
        if (isFirefox && !hasSubdirFiles && pickedFiles.length > 0) {
            console.log('[cliFolderInput] Firefox non-recursive folder picker: ' + pickedFiles.length + ' top-level files only');
            showToast('Firefox folder picker is non-recursive — only ' + pickedFiles.length + ' top-level file(s) found. Drag & drop your project folder onto the dropzone below for a full recursive scan.', 'warning', 10000);
            if (browserFolderDropzone) {
                browserFolderDropzone.scrollIntoView({ behavior: 'smooth', block: 'center' });
                browserFolderDropzone.classList.add('pulse-highlight');
                setTimeout(() => browserFolderDropzone.classList.remove('pulse-highlight'), 4000);
            }
            // Accept the partial file list so the scan can proceed with what Firefox provides
        }
        console.log('[cliFolderInput] using .files: ' + pickedFiles.length + ' files');
        const inputCheck = applyFolderSizeAnalysis(pickedFiles, 'Folder input');
        if (!inputCheck.proceed) {
            e.target.value = '';
            return;
        }
        safeBatchPush(accumulatedPickerFiles, pickedFiles);
        e.target.value = '';
        showAccumulationPrompt();
        // Auto-start scan if user triggered via Start Local Scan button
        if (_pickerTriggeredByButton) {
            _pickerTriggeredByButton = false;
            console.log('[cliFolderInput] auto-starting scan from button trigger');
            setTimeout(() => window._startAccumulatedScan(), 100);
        }
        return;
    }
    if (entries.length === 0) {
        if (!e.target.value) {
            e.target.value = '';
            return;
        }
        showToast('Directory picker returned no files. Try dragging and dropping the folder onto the dropzone below.', 'warning', TOAST_DURATION_SHORT);
        e.target.value = '';
        return;
    }
    // Last resort: traverse webkitEntries
    console.log('[cliFolderInput] traversing webkitEntries: ' + entries.length + ' entries');
    e.target.value = '';
    const files = [];
    let traverseErrors = 0;
    let traverseAbort = false;
    let lastUpdate = Date.now();
    const state = { traverseErrors, traverseAbort, lastUpdate };
    if (localScanFileName) localScanFileName.textContent = 'Discovering files...';
    for (const entry of entries) {
        if (state.traverseAbort) break;
        await traverseFileSystemEntry(entry, '', files, state);
    }
    console.log('[cliFolderInput] webkitEntries traversal done: ' + files.length + ' files');
    safeBatchPush(accumulatedPickerFiles, files);
    isAccumulatingFolders = true;
    showAccumulationPrompt();
    // Auto-start scan if user triggered via Start Local Scan button
    if (_pickerTriggeredByButton) {
        _pickerTriggeredByButton = false;
        console.log('[cliFolderInput] auto-starting scan from button trigger (webkitEntries)');
        setTimeout(function() { window._startAccumulatedScan(); }, 100);
    }
});
}

function showAccumulationPrompt() {
    const total = accumulatedPickerFiles.length;
    if (terminalConsole) terminalConsole.style.display = 'block';
    var badgeColor = '#60A5FA';
    if (total > FILE_COUNT_VERY_HIGH) badgeColor = '#EF4444';
    else if (total > FILE_COUNT_HIGH) badgeColor = '#EF4444';
    else if (total > 10000) badgeColor = '#F59E0B';
    else if (total > 5000) badgeColor = '#F59E0B';
    appendTerminalLine('<span style="color:#60A5FA;font-weight:700;">&#128451; Accumulated:</span> <strong style="color:' + badgeColor + ';">' + total.toLocaleString() + '</strong> files from folder pick.');
    appendTerminalLine(
        '<span style="color:#94A3B8;">&#10148;</span> ' +
        '<a href="#" onclick="window._addAnotherFolder();return false;" style="color:#60A5FA;text-decoration:underline;font-weight:600;">Add another folder</a>' +
        ' <span style="color:#64748B;">or</span> ' +
        '<a href="#" onclick="window._startAccumulatedScan();return false;" style="color:#34D399;text-decoration:underline;font-weight:600;">Start scan</a>'
    );
    if (localScanFileName) {
        localScanFileName.innerHTML = '<span style="font-size:1.1rem;font-weight:700;color:' + badgeColor + ';">' + total.toLocaleString() + '</span> <span style="font-size:0.75rem;color:#94A3B8;">files accumulated</span>';
    }
}

window._addAnotherFolder = function() {
    triggerDirectoryPicker();
};


// Upload accumulated files to the local server for full CLI scan
async function uploadFilesToServer(files, serverUrl) {
    const token = licenseInput ? licenseInput.value.trim() : '';
    if (!token) {
        showToast('License token required for server scan.', 'warning');
        return false;
    }
    if (files.length > 100000) {
        appendTerminalLine('<span style="color:#F59E0B;font-weight:700;">&#9888; Large repo:</span> ' + files.length.toLocaleString() + ' files exceed server upload limit (100k). Falling back to browser scan.', 'warn');
        return false;
    }
    const formData = new FormData();
    const filePaths = [];
    for (const file of files) {
        formData.append('files', file, file.name);
        filePaths.push(file.webkitRelativePath || file.name);
    }
    formData.append('filePaths', JSON.stringify(filePaths));
    formData.append('licenseToken', token);
    formData.append('analysisType', 'simplebeacon');

    appendTerminalLine('<span style="color:#60A5FA;font-weight:700;">&#9654;</span> Uploading ' + files.length.toLocaleString() + ' files to server for full CLI scan...');
    try {
        const res = await fetch(serverUrl + '/api/analyze/upload-directory', {
            method: 'POST',
            body: formData
        });
        if (!res.ok) {
            const errText = await res.text().catch(() => 'HTTP ' + res.status);
            appendTerminalLine('Server upload failed: ' + errText, 'error');
            return false;
        }
        const { scanId } = await res.json();
        appendTerminalLine('Server scan started. ID: <code>' + scanId + '</code>. Polling for results...');

        let pollCount = 0;
        const maxPolls = 360;
        while (pollCount < maxPolls) {
            pollCount++;
            await new Promise(r => setTimeout(r, 3000));
            const progressRes = await fetch(serverUrl + '/api/analyze/progress?scanId=' + encodeURIComponent(scanId));
            if (!progressRes.ok) continue;
            const data = await progressRes.json();
            if (data.status === 'scanning') {
                const pct = data.percent || 0;
                appendTerminalLine('Server scan progress: ' + pct + '% (' + (data.current || 0) + '/' + (data.total || '?') + ' files)');
                continue;
            }
            if (data.status === 'error') {
                appendTerminalLine('Server scan failed: ' + (data.error || 'Unknown error'), 'error');
                return false;
            }
            if (data.status === 'complete') {
                appendTerminalLine('Server scan complete! Rendering report...', 'success');
                if (data.reportJson) {
                    reportData = data.reportJson;
                    if (typeof window.renderPreview === 'function') window.renderPreview(reportData);
                    scanPreview.style.display = 'block';
                    updateSubmit();
                    setTimeout(() => {
                        const row = document.getElementById('tokenActionRow');
                        if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300);
                }
                return true;
            }
        }
        appendTerminalLine('Server scan polling timed out.', 'warn');
        return false;
    } catch (err) {
        appendTerminalLine('Server upload error: ' + (err && err.message ? err.message : String(err)), 'error');
        return false;
    }
}
window._startAccumulatedScan = async function() {
    console.log('[_startAccumulatedScan] called, accumulated=' + accumulatedPickerFiles.length);
    isPickerActive = false;
    if (accumulatedPickerFiles.length === 0) {
        appendTerminalLine('No files accumulated.', 'warn');
        return;
    }
    const files = accumulatedPickerFiles.slice();
    accumulatedPickerFiles = [];
    isAccumulatingFolders = false;
    const accCheck = applyFolderSizeAnalysis(files, 'Accumulated');
    if (!accCheck.proceed) {
        appendTerminalLine('Scan cancelled — folder exceeds safe limits.', 'warn');
        return;
    }
    appendTerminalLine('<span style="color:#60A5FA;font-weight:700;">&#9654;</span> Starting scan with <strong>' + files.length.toLocaleString() + '</strong> files...');

    // Try server upload first for full CLI scan
    if (serverUploadUrl) {
        const ok = await uploadFilesToServer(files, serverUploadUrl);
        if (ok) {
            console.log('[_startAccumulatedScan] server upload completed');
            return;
        }
        appendTerminalLine('Server scan failed, falling back to browser scan...', 'warn');
    }
if (typeof window.processLocalCLIScan !== 'function') {
        appendTerminalLine('Scanner engine not loaded. Hard reload the page (Ctrl+Shift+R).', 'error');
        console.error('[_startAccumulatedScan] processLocalCLIScan not found');
        return;
    }
    // Defensive stale-data purge before new scan
    window._scanPreviewData = null;
    window._scanPreviewModules = null;
    if (typeof selectedModules !== 'undefined' && selectedModules.clear) selectedModules.clear();
    if (scanPreview) { scanPreview.innerHTML = ''; }
    console.log('[_startAccumulatedScan] calling processLocalCLIScan with ' + files.length + ' files');
    try {
        await window.processLocalCLIScan(files);
        console.log('[_startAccumulatedScan] processLocalCLIScan completed');
    } catch (err) {
        appendTerminalLine('Scan error: ' + (err && err.message ? err.message : String(err)), 'error');
        console.error('[_startAccumulatedScan] processLocalCLIScan error:', err);
    }
};
if (cliFilesInput) cliFilesInput.addEventListener('change', (e) => {
    if (!hasValidToken()) {
        showToast('Paste a license token to unlock scanning.', 'warning');
        licenseInput.focus();
        licenseInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        e.target.value = '';
        return;
    }
    if (e.target.files.length > 0) window.processLocalCLIScan(Array.from(e.target.files));
});

// === CLI JSON Dropzone ===
let _cliDragDepth = 0;
if (cliJsonDropzone) {
    cliJsonDropzone.addEventListener('click', () => {
        if (fileInput) fileInput.click();
    });
    cliJsonDropzone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        _cliDragDepth++;
        if (_cliDragDepth === 1) {
            cliJsonDropzone.classList.add('dragover');
            const fileCount = e.dataTransfer.items?.length || e.dataTransfer.files?.length || 0;
            const prompt = cliJsonDropzone.querySelector('p');
            if (prompt && !cliJsonDropzone.dataset.originalText) {
                cliJsonDropzone.dataset.originalText = prompt.innerHTML;
            }
            if (prompt) prompt.innerHTML = `<span style="color:#60A5FA;font-weight:600;">&#128206; ${fileCount > 0 ? fileCount + ' file' + (fileCount > 1 ? 's' : '') + ' ready to drop' : 'Drop JSON file'}</span>`;
        }
    });
    cliJsonDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    cliJsonDropzone.addEventListener('dragleave', () => {
        _cliDragDepth--;
        if (_cliDragDepth <= 0) {
            _cliDragDepth = 0;
            cliJsonDropzone.classList.remove('dragover');
            const prompt = cliJsonDropzone.querySelector('p');
            if (prompt && cliJsonDropzone.dataset.originalText) {
                prompt.innerHTML = cliJsonDropzone.dataset.originalText;
            }
        }
    });
    cliJsonDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        _cliDragDepth = 0;
        cliJsonDropzone.classList.remove('dragover');
        const prompt = cliJsonDropzone.querySelector('p');
        if (prompt && cliJsonDropzone.dataset.originalText) {
            prompt.innerHTML = cliJsonDropzone.dataset.originalText;
        }
        const file = e.dataTransfer.files[0];
        if (file) handleJsonFile(file);
    });
}
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleJsonFile(e.target.files[0]);
    });
}

// === JSON Paste Handler ===
if (jsonPasteInput) {
    jsonPasteInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (jsonPasteBtn) jsonPasteBtn.click();
        }
    });
}

if (jsonPasteBtn && jsonPasteInput) {
    jsonPasteBtn.addEventListener('click', async () => {
        const text = jsonPasteInput.value.trim();
        if (!text) {
            showToast('Paste JSON content first', 'warning');
            return;
        }
        try {
            reportData = JSON.parse(text);
            const hash = await computeSha256(text);
            if (integrityHashEl) integrityHashEl.textContent = hash;
            if (typeof window.renderPreview === 'function') window.renderPreview(reportData);
            scanPreview.style.display = 'block';
            updateSubmit();
            showToast('JSON loaded! Ready to generate certificate.', 'success');
            showStatus('JSON loaded. Click Generate Certificate to download your ZIP.', 'success');
        } catch (err) {
            showToast('Invalid JSON: ' + err.message, 'error');
            showStatus('Invalid JSON: ' + err.message, 'error');
            reportData = null;
            if (scanPreview) scanPreview.style.display = 'none';
            updateSubmit();
        }
    });
}

// NOTE: renderPreview extracted to ui-renderer.js
function showStatus(message, type) {
    status.className = 'status ' + type;
    status.textContent = message;
    status.style.display = 'block';
}

// === Browser Scanner Engine ===
const terminalConsole = document.getElementById('terminal-console');
const panelStatus = document.getElementById('panel-status');
const panelMetrics = document.getElementById('panel-metrics');
const panelProgressContainer = document.getElementById('panel-progress-container');
const panelProgressBar = document.getElementById('panel-progress-bar');

// 2. Terminal writer
function appendTerminalLine(text, type) {
    const line = document.createElement('div');
    const ts = new Date().toLocaleTimeString().split(' ')[0];
    let indicator = `<span style="color:#64748B;">[${ts}]</span> `;
    if (type === 'success') indicator += '<span style="color:#10B981;">&#10003; SUCCESS:</span> ';
    else if (type === 'warn') indicator += '<span style="color:#F59E0B;">&#9888; WARN:</span> ';
    else if (type === 'error') indicator += '<span style="color:#EF4444;">&#10007; CRITICAL:</span> ';
    else if (type === 'input') indicator += '<span style="color:#60A5FA;">&#10095;</span> ';
    line.insertAdjacentHTML('beforeend', indicator + text);
    line.style.marginBottom = '2px';
    terminalConsole.appendChild(line);
    terminalConsole.scrollTop = terminalConsole.scrollHeight;
}

// Parse .simplebeaconignore contents into RegExp patterns (gitignore-style)
function parseIgnoreFile(ignoreText) {
    return ignoreText.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
            let pattern = line;
            if (pattern.startsWith('/')) pattern = pattern.slice(1);
            // Convert wildcards to placeholders, escape regex specials, then restore
            pattern = pattern
                .replace(/\*\*/g, '__GLOBSTAR__')
                .replace(/\*/g, '__STAR__')
                .replace(/\?/g, '__QMARK__');
            pattern = pattern.replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&');
            pattern = pattern
                .replace(/__GLOBSTAR__/g, '.*')
                .replace(/__STAR__/g, '[^/]*')
                .replace(/__QMARK__/g, '[^/]');
            return new RegExp(pattern, 'i');
        });
}

// 3. Main scan engine
// NOTE: processLocalCLIScan extracted to scanner-engine.js
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// Client-side certificate generator — zero data leaves the browser
// NOTE: generateSovereignCertificate && doGenerateCertificate extracted to certificate-module.js

if (submitBtn) submitBtn.addEventListener('click', () => {
    if (typeof openCertCredentialsModal === 'function') openCertCredentialsModal();
    else if (typeof doGenerateCertificate === 'function') doGenerateCertificate(submitBtn);
    else showToast('Certificate generator not loaded yet. Please refresh the page.', 'error');
});

const certSubmitBtn = document.getElementById('certSubmitBtn');
if (certSubmitBtn) {
    certSubmitBtn.addEventListener('click', () => {
        if (typeof openCertCredentialsModal === 'function') openCertCredentialsModal();
        else if (typeof doGenerateCertificate === 'function') doGenerateCertificate(certSubmitBtn);
        else showToast('Certificate generator not loaded yet. Please refresh the page.', 'error');
    });
}

// Ensure UI state is synchronized on load (restored scans, URL tokens, etc.)
updateSubmit();

// === Clear Session button ===
const clearSessionBtn = document.getElementById('clearSessionBtn');
if (clearSessionBtn) {
    clearSessionBtn.addEventListener('click', () => {
        const hasData = reportData !== null || licenseInput.value.trim().length > 0;
        if (hasData && !confirm('Clear session?\n\nThis will remove your scan data && license token from this page && browser storage.')) {
            return;
        }
        reportData = null;
        licenseInput.value = '';
        if (typeof cliFileName !== 'undefined' && cliFileName) cliFileName.textContent = '';
        if (typeof cliJsonDropzone !== 'undefined' && cliJsonDropzone) cliJsonDropzone.classList.remove('has-file');
        scanPreview.style.display = 'none';
        const metaDisplay = document.getElementById('fileMetaDisplay');
        if (metaDisplay) metaDisplay.style.display = 'none';
        try {
            localStorage.removeItem(LS_KEY_TOKEN);
            localStorage.removeItem(LS_KEY_SCAN);
            // Also clear main dashboard keys so both analyzers stay in sync
            localStorage.removeItem('cascadeAuthToken');
            localStorage.removeItem('access_token');
            localStorage.removeItem('token');
            localStorage.removeItem('authToken');
        } catch (e) { /* ignore */ }
        applyProductFromToken('');
        updateSubmit();
        updateDropzoneGate();
        showToast('Session cleared. Token && scan data removed.', 'info');
    });
}

// === Copy JSON button ===
const copyJsonBtn = document.getElementById('copyJsonBtn');
if (copyJsonBtn) {
    copyJsonBtn.addEventListener('click', () => {
        if (!reportData) return;
        navigator.clipboard.writeText(JSON.stringify(reportData, null, 2)).then(() => {
            copyJsonBtn.textContent = 'Copied!';
            setTimeout(() => copyJsonBtn.innerHTML = '&#128203; Copy JSON', 1500);
            showToast('Report JSON copied to clipboard', 'success');
        });
    });
}

// === Collapse Preview button ===
const collapsePreviewBtn = document.getElementById('collapsePreviewBtn');
if (collapsePreviewBtn && previewContent) {
    collapsePreviewBtn.addEventListener('click', () => {
        const isHidden = previewContent.style.display === 'none';
        previewContent.style.display = isHidden ? 'block' : 'none';
        scanMeta.style.display = isHidden ? 'block' : 'none';
        collapsePreviewBtn.innerHTML = isHidden ? '&#9650; Collapse' : '&#9660; Expand';
    });
}

// === Page Load: restore previous session ===
loadFromLocalStorage();

// Detail panel overlay — reusable for matrix rows && issue items
const detailOverlay = document.createElement('div');
detailOverlay.className = 'detail-overlay';
detailOverlay.innerHTML = `<div class="detail-panel"><button type="button" class="close-btn">&times;</button><div id="detail-panel-content"></div></div>`;
detailOverlay.querySelector('.close-btn').addEventListener('click', () => detailOverlay.classList.remove('active'));
detailOverlay.addEventListener('click', e => { if (e.target === detailOverlay) detailOverlay.classList.remove('active'); });
document.body.appendChild(detailOverlay);

function showDetailPanel(title, rows) {
    const content = document.getElementById('detail-panel-content');
    const safeTitle = escapeHtml(title);
    const rowHtml = rows.map(r => `<div class="detail-row"><div class="detail-label">${escapeHtml(r.label)}</div><div class="detail-value">${escapeHtml(r.value)}</div></div>`).join('');
    content.innerHTML = `<h3>${safeTitle}</h3><div class="detail-meta">Click anywhere outside to close</div>${rowHtml}`;
    detailOverlay.classList.add('active');
}

// Event delegation for matrix rows && issue items inside scanPreview
document.addEventListener('click', e => {
    const row = e.target.closest('.matrix-row');
    if (row && row.dataset.detailTitle) {
        const tier = window._tokenPayload?.tier || window._tokenPayload?.product || 'locked';
        const blockedInFree = ['Credential & Secret Hygiene','Risk Management System','Transparency Obligations','AI System Classification (Annex III)','Prohibited AI Practices Audit','SimpleBeacon Gate Attestation'];
        if (tier === 'instant' && blockedInFree.includes(row.dataset.detailTitle)) {
            showToast('Upgrade to Executive or Universal tier to view this control detail.','error');
            return;
        }
        const d = row.dataset;
        showDetailPanel(d.detailTitle, [
            { label: 'Control ID', value: d.detailId || 'N/A' },
            { label: 'Status', value: `<span class="status-pill ${d.detailStatus || 'review'}">${d.detailStatus ? d.detailStatus.toUpperCase() : 'REVIEW'}</span>` },
            { label: 'Description', value: d.detailDesc || '' },
            { label: 'Action', value: d.detailAction || '' }
        ]);
        return;
    }
    const item = e.target.closest('.issue-item[data-issue]');
    if (item) {
        try {
            const issue = JSON.parse(item.dataset.issue.replace(/&#39;/g, "'"));
            const rows = [
                { label: 'Type', value: issue.type || 'Finding' },
                { label: 'Severity', value: (issue.severity || 'low').toUpperCase() },
                { label: 'Description', value: issue.description || '' }
            ];
            if (issue.confidence) rows.push({ label: 'Confidence', value: Math.round(issue.confidence * 100) + '%' });
            if (issue.reasoning) rows.push({ label: 'How we found this', value: issue.reasoning });
            if (issue.humanReadable) rows.push({ label: 'In plain English', value: issue.humanReadable });
            if (issue.impact) rows.push({ label: 'Impact', value: issue.impact });
            if (issue.fix) rows.push({ label: 'Remediation', value: issue.fix });
            if (issue.count) rows.push({ label: 'Occurrences', value: String(issue.count) });
            showDetailPanel(issue.type || 'Finding Detail', rows);
        } catch (err) { console.warn('Failed to parse issue detail:', err); }
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Local Scanner Bridge — auto-discovery + SSE streaming (unlimited file support)
// ═══════════════════════════════════════════════════════════════════════════════
const SCANNER_BRIDGE_PORT = 3456;
const BRIDGE_URL = localStorage.getItem('simplebeacon-bridge-url') || 'http://127.0.0.1:' + SCANNER_BRIDGE_PORT;
let bridgeAvailable = false;
let bridgeEventSource = null;
let serverUploadUrl = null;

async function probeLocalBridge() {
    try {
        const res = await fetch(`${BRIDGE_URL}/health`, { method: 'GET', mode: 'cors', signal: AbortSignal.timeout(2000) });
        if (res.ok) {
            bridgeAvailable = true;
            const panel = document.getElementById('local-scanner-panel');
            if (panel) panel.style.display = 'block';
            appendTerminalLine('<span style="color:#34D399;font-weight:700;">&#9889; Local Scanner Bridge detected</span> — scans will use native file system (no file limits).', 'info');
        }
    } catch (_) {
        bridgeAvailable = false;
    }
}

// Detect local SimpleBeacon server (e.g. ai-platform dashboard) for full scans
async function probeLocalServer() {
    const SERVER_PORTS = LOCAL_SERVER_PORTS;
    const currentPort = parseInt(location.port, 10);
    // Skip detection if we're already served from the server
    if (!isNaN(currentPort) && SERVER_PORTS.includes(currentPort)) return;
    for (const port of SERVER_PORTS) {
        if (port === currentPort) continue;
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 1500);
            const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: controller.signal });
            clearTimeout(timer);
            if (!response.ok) continue;
            serverUploadUrl = `http://127.0.0.1:${port}`;
            const banner = document.getElementById('serverDetectedBanner');
            const link = document.getElementById('serverDashboardLink');
            const vaultLink = document.getElementById('vaultLink');
            if (banner) {
                banner.style.display = 'flex';
                if (link) link.href = `http://127.0.0.1:${port}/#/analyze`;
            }
            if (vaultLink) vaultLink.href = `http://127.0.0.1:${port}/#/dashboard`;
            return;
        } catch (_) {
            // Server not running on this port
        }
    }
}

function appendLocalScannerLine(html, type) {
    const term = document.getElementById('localScannerTerminal');
    if (!term) return;
    const line = document.createElement('div');
    line.className = 'log-line';
    line.innerHTML = `<span class="log-ts">${new Date().toLocaleTimeString()}</span> ${html}`;
    term.appendChild(line);
    term.scrollTop = term.scrollHeight;
}

let isPickerActive = false;
async function startLocalScan() {
    console.log('[startLocalScan] entered. accumulated=' + accumulatedPickerFiles.length + ' bridge=' + bridgeAvailable);
    if (isPickerActive) {
        console.log('[startLocalScan] picker already active — ignoring duplicate click');
        return;
    }
    if (!hasValidToken()) {
        showToast('Paste a license token to unlock scanning.', 'warning');
        licenseInput.focus();
        licenseInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    // If files were accumulated via drag-and-drop / directory picker, start browser scan immediately
    if (accumulatedPickerFiles.length > 0) {
        console.log('[startLocalScan] routing to _startAccumulatedScan (pre-accumulated)');
        window._startAccumulatedScan();
        return;
    }
    const pathInput = document.getElementById('localScannerPath');
    const rawPath = pathInput ? pathInput.value : '';
    const directoryPath = rawPath.trim();
    console.log('[startLocalScan] pathInput=' + (pathInput ? 'found' : 'null') + ' rawPath=' + JSON.stringify(rawPath) + ' directoryPath=' + JSON.stringify(directoryPath));

    // No path typed → show drag-and-drop guidance (browser blocks all programmatic pickers)
    if (!directoryPath) {
        console.log('[startLocalScan] no path — showing drag-and-drop guidance');
        _pickerTriggeredByButton = true;
        triggerDirectoryPicker();
        return;
    }

    // Path typed + bridge available → use native bridge scan
    if (!bridgeAvailable) {
        showToast('Local bridge not running. Enter a path only when the bridge is active, or use drag & drop.', 'warning');
        return;
    }

    const progressDiv = document.getElementById('localScannerProgress');
    const progressBar = document.getElementById('localScannerProgressBar');
    const statusDiv = document.getElementById('localScannerStatus');
    const term = document.getElementById('localScannerTerminal');
    if (progressDiv) progressDiv.style.display = 'block';
    if (term) term.style.display = 'block';
    if (statusDiv) statusDiv.textContent = 'Starting scan...';
    if (progressBar) progressBar.style.width = '0%';

    if (bridgeEventSource) {
        bridgeEventSource.close();
        bridgeEventSource = null;
    }

    bridgeEventSource = new EventSource(`${BRIDGE_URL}/events`);
    bridgeEventSource.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            if (e.lastEventId === 'phase') {
                appendLocalScannerLine(`<span style="color:#60A5FA;">&#10148;</span> ${data.message || data.phase}`, 'info');
                if (statusDiv) statusDiv.textContent = data.message || data.phase;
            }
            if (e.lastEventId === 'progress') {
                if (progressBar) progressBar.style.width = data.percent + '%';
                if (statusDiv) statusDiv.textContent = `${data.percent}% — ${data.processed.toLocaleString()} / ${data.total.toLocaleString()} files (${data.findingsSoFar} findings)`;
            }
            if (e.lastEventId === 'discoveryComplete') {
                appendLocalScannerLine(`<span style="color:#60A5FA;font-weight:700;">&#128451;</span> Discovered ${data.totalFiles.toLocaleString()} files`, 'info');
            }
            if (e.lastEventId === 'complete') {
                appendLocalScannerLine(`<span style="color:#34D399;font-weight:700;">&#10004;</span> Scan complete — ${data.filesAnalyzed.toLocaleString()} files analyzed in ${(data.durationMs / 1000).toFixed(1)}s`, 'success');
                if (bridgeEventSource) { bridgeEventSource.close(); bridgeEventSource = null; }
                fetchReportAndLoad();
            }
            if (e.lastEventId === 'error') {
                appendLocalScannerLine(`<span style="color:#EF4444;">&#10008;</span> ${data.message}`, 'error');
            }
            if (e.lastEventId === 'cancelled') {
                appendLocalScannerLine(`<span style="color:#F59E0B;">&#9209;</span> Scan cancelled`, 'warn');
                if (bridgeEventSource) { bridgeEventSource.close(); bridgeEventSource = null; }
            }
        } catch (_) {}
    };

    console.log('[startLocalScan] posting to bridge with directoryPath=' + JSON.stringify(directoryPath));
    fetch(`${BRIDGE_URL}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directoryPath })
    }).then(r => {
        console.log('[startLocalScan] bridge POST status=' + r.status);
        return r.json();
    }).then(j => {
        console.log('[startLocalScan] bridge POST response=' + JSON.stringify(j));
        appendLocalScannerLine(`<span style="color:#60A5FA;">&#9432;</span> Scan job started: ${j.scanId}`, 'info');
    }).catch(err => {
        appendLocalScannerLine(`<span style="color:#EF4444;">&#10008;</span> Failed to start scan: ${err.message}`, 'error');
        if (bridgeEventSource) { bridgeEventSource.close(); bridgeEventSource = null; }
    });
}

async function fetchReportAndLoad() {
    try {
        const res = await fetch(`${BRIDGE_URL}/result`, { mode: 'cors' });
        if (!res.ok) throw new Error('Report not ready');
        const report = await res.json();
        appendLocalScannerLine(`<span style="color:#34D399;font-weight:700;">&#128229;</span> Report loaded — ${report.totalFiles ? report.totalFiles.toLocaleString() : '?'} files, score ${report.qualityScore != null ? report.qualityScore : '?'}/100`, 'success');
        reportData = report;
        if (typeof window.renderPreview === 'function') {
            window.renderPreview(reportData);
            scanPreview.style.display = 'block';
            updateSubmit();
        }
        showToast(`Local scan complete: ${report.totalFiles ? report.totalFiles.toLocaleString() : '?'} files`, 'success');
    } catch (err) {
        appendLocalScannerLine(`<span style="color:#EF4444;">&#10008;</span> Failed to load report: ${err.message}`, 'error');
    }
}

// Wire up local scanner UI when DOM is ready
function initLocalScannerUI() {
    probeLocalBridge();
    probeLocalServer();
    const panel = document.getElementById('local-scanner-panel');
    if (panel) panel.style.display = 'block';

    // Wire up elements that previously used inline event handlers (CSP compliance)
    document.querySelectorAll('.cmd-copy[data-copy-target]').forEach(btn => {
        btn.addEventListener('click', () => copyToClipboard(btn.dataset.copyTarget));
    });

    const serverDashboardLinkTrigger = document.getElementById('serverDashboardLinkTrigger');
    if (serverDashboardLinkTrigger) {
        serverDashboardLinkTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            const link = document.getElementById('serverDashboardLink');
            if (link) link.click();
        });
    }

    const selectAllBar = document.getElementById('selectAllBar');
    if (selectAllBar) {
        selectAllBar.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
                toggleModuleDropdown();
            }
        });
        selectAllBar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleModuleDropdown();
            }
        });
    }

    document.querySelectorAll('.schema-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('open');
        });
    });

    const scanFolderChip = document.getElementById('scanFolderChip');
    if (scanFolderChip) {
        scanFolderChip.addEventListener('click', () => {
            document.getElementById('tab-browser').click();
            document.getElementById('browser-folder-dropzone').scrollIntoView({behavior:'smooth'});
        });
    }

    const roadmapLink = document.getElementById('roadmapLink');
    if (roadmapLink) {
        roadmapLink.addEventListener('mouseover', () => {
            roadmapLink.style.background = 'rgba(37,99,235,0.2)';
            roadmapLink.style.color = '#93C5FD';
        });
        roadmapLink.addEventListener('mouseout', () => {
            roadmapLink.style.background = 'rgba(37,99,235,0.1)';
            roadmapLink.style.color = '#60A5FA';
        });
    }

    const btn = document.getElementById('startLocalScanBtn');
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startLocalScan();
        });
        console.log('[main.js] startLocalScanBtn listener attached');
    } else {
        console.warn('[main.js] startLocalScanBtn not found in DOM');
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLocalScannerUI);
} else {
    initLocalScannerUI();
}
