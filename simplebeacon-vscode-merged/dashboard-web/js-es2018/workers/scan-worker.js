// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Local browser scan worker for the AI platform dashboard.
 * Scans files selected by the user on their own hardware — no data is sent to the server.
 *
 * This version streams large files through a Rust/WebAssembly chunk analyzer (with a
 * pure-JS fallback) instead of loading the entire file into memory at once.
 */
import { analyzeFileChunks, findingsToIssues } from './scan-wasm-bridge.js?v=20260709noise3';
const MAX_DISCOVERED_FILES = 500000;
const MAX_ISSUES = 100000;
const SCAN_BATCH_SIZE = 400;
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5 MB
const FILE_READ_TIMEOUT_MS = 30000;
const CHUNK_ANALYZE_TIMEOUT_MS = 120000;
const BINARY_EXTENSIONS = /\.(exe|dll|bin|so|dylib|wasm|zip|tar|gz|tgz|bz2|7z|rar|iso|img|dmg|pkg|deb|msi|apk|ipa|woff|woff2|ttf|otf|eot|png|jpg|jpeg|gif|bmp|ico|webp|avif|svg|mp3|mp4|wav|avi|mov|mkv|webm|pdf|doc|docx|xls|xlsx|ppt|pptx|sqlite|db|lock|scx|scm|sc2map|sc2data|chk|mix|vxl|shp|tmp|mpq|w3x|w3m|nif|bik|ogv|dat|vsix|pack|bundle|map)$/i;
const LANGUAGE_REGISTRY = {
    javascript: { extensions: ['js', 'cjs', 'mjs', 'ts', 'tsx', 'jsx'] },
    python: { extensions: ['py', 'pyw', 'pyi'] },
    java: { extensions: ['java', 'kt', 'scala', 'groovy'] },
    go: { extensions: ['go'] },
    rust: { extensions: ['rs'] },
    php: { extensions: ['php'] },
    ruby: { extensions: ['rb'] },
    dotnet: { extensions: ['cs', 'vb'] }
};
const PATTERN_REGISTRY = {
    debugArtifacts: {
        appliesTo: ['javascript'],
        pattern: /\bconsole\.(log|warn|error|info|debug|table|trace|dir|group)\s*\(|debugger\b|alert\s*\(|prompt\s*\(|confirm\s*\(/gi
    },
    todoMarkers: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        pattern: /(?:\/\/\s*|\/\*\s*|#\s*)\b(TODO|FIXME|HACK|XXX|BUG)\b/gi
    },
    credentials: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        pattern: /(password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key|client[_-]?secret)\s*[:=]\s*['"`][^'"`\s]{8,}/gi
    },
    euAiAct: {
        appliesTo: ['javascript'],
        pattern: /ai_system|high_risk|transparency|conformity|bias_audit|data_governance/gi
    },
    pythonDebug: {
        appliesTo: ['python'],
        pattern: /\bprint\s*\(|\bpprint\s*\(|\blogging\.debug\s*\(|\bbreakpoint\s*\(/i
    },
    javaDebug: {
        appliesTo: ['java'],
        pattern: /\bSystem\.(out|err)\.(print|println)\s*\(|\be\.printStackTrace\s*\(|\bjava\.util\.logging\./i
    },
    pythonFramework: {
        appliesTo: ['python'],
        pattern: /\bDEBUG\s*=\s*True\b|\bapp\.run\s*\(\s*[^)]*debug\s*=\s*True/i
    },
    javaFramework: {
        appliesTo: ['java'],
        pattern: /spring\.datasource\.(password|url)\s*=\s*['"][^'"]{4,}|log4j.*CVE|log4shell|jndi:ldap/i
    },
    goDebug: {
        appliesTo: ['go'],
        pattern: /\bfmt\.Print(?:ln|f)?\s*\(|\blog\.Print(?:ln|f)?\s*\(|\blog\.Fatal(?:f|ln)?\s*\(|\bpanic\s*\(/i
    },
    goFramework: {
        appliesTo: ['go'],
        pattern: /\bgin\.SetMode\s*\(\s*gin\.DebugMode|http\.ListenAndServe\s*\(\s*["'][^"']+["']\s*,\s*nil\s*\)/i
    },
    rustDebug: {
        appliesTo: ['rust'],
        pattern: /\bprintln!\s*\(|\beprintln!\s*\(|\bdbg!\s*\(|\bprint!\s*\(|\bpanic!\s*\(/i
    },
    rustFramework: {
        appliesTo: ['rust'],
        pattern: /\.unwrap\s*\(\s*\)(?:\s*\?\s*\.unwrap\s*\(\s*\))+|\.expect\s*\(\s*["']\s*["']\s*\)/i
    },
    phpDebug: {
        appliesTo: ['php'],
        pattern: /\becho\s+['"]|\bvar_dump\s*\(|\bprint_r\s*\(|\bdie\s*\(|\bexit\s*\(|\bdebug_backtrace\s*\(|\btrigger_error\s*\(/i
    },
    phpFramework: {
        appliesTo: ['php'],
        pattern: /APP_DEBUG\s*=>\s*true|APP_ENV\s*=>\s*['"]local['"]|DB::raw\s*\(|mysql_query\s*\(|mysqli_query\s*\(|PDO\s*::\s*query\s*\(|eval\s*\(/i
    },
    dotnetDebug: {
        appliesTo: ['dotnet'],
        pattern: /\bConsole\.Write(Line)?\s*\(|\bDebug\.Write(Line)?\s*\(|\bTrace\.Write(Line)?\s*\(|\bDebugger\.Break\s*\(/i
    },
    dotnetFramework: {
        appliesTo: ['dotnet'],
        pattern: /connectionString\s*=\s*["'][^"']{10,}|Integrated\s+Security\s*=\s*false|Server=localhost;|\.UseInMemoryDatabase\s*\(/i
    },
    rubyDebug: {
        appliesTo: ['ruby'],
        pattern: /\bputs\s+['"]|\bp\s+['"]|\bdebugger\b|\bdebug\s+['"]|\bbinding\.irb\b|\bbinding\.pry\b|\bRails\.logger\.debug\s*\(/i
    },
    rubyFramework: {
        appliesTo: ['ruby'],
        pattern: /\.permit!\s*\)|\bskip_before_action\b|\beval\s*\(|\bsend\s*\(\s*params\[/i
    }
};
const SEVERITY_MAP = {
    credentials: 'critical',
    euAiAct: 'high'
};
function detectFileLanguage(path) {
    const ext = (path.match(/\.([^.]+)$/) || [null, ''])[1].toLowerCase();
    for (const [langKey, config] of Object.entries(LANGUAGE_REGISTRY)) {
        if (config.extensions.includes(ext))
            return langKey;
    }
    return null;
}
function getAnalyzersForLanguage(langKey) {
    return Object.entries(PATTERN_REGISTRY)
        .filter(([, entry]) => entry.appliesTo.includes(langKey))
        .map(([id]) => id);
}
function extractMatches(text, pattern, max = 3) {
    const matches = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length && matches.length < max; i++) {
        const line = lines[i];
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
            matches.push({ line: i + 1, snippet: line.trim().slice(0, 120) });
        }
    }
    return matches;
}
function shouldSkipFile(path, deepScan) {
    const normalized = path.replace(/\\/g, '/');
    if (/(^|[\/])(node_modules|\.git|\.github|\.husky|dist|build|\.next|out|coverage|frontend-build|\.github-sync|github-cache|\.simplebeacon|\.cursor|\.windsurf|deployments|backups|\.vscode-test|\.vsix-patch-temp|logs|cache|\.cache|tmp|temp)([\/]|$)/i.test(normalized))
        return true;
    if (!deepScan && /(^|[\/])(docs\/|doc\/|third_party\/|thirdparty\/|geedocs\/|mapfiles\/|vendor\/)/i.test(normalized))
        return true;
    if (!deepScan && /\.min\.js$|\.pack\.js$|\.bundle\.js$|\.map$/i.test(normalized))
        return true;
    return false;
}
function isBinary(path) {
    return BINARY_EXTENSIONS.test(path);
}
function isBinaryOrLarge(path, size) {
    return isBinary(path) || size > LARGE_FILE_THRESHOLD;
}
function runAnalyzer(name, text, filePath) {
    const results = [];
    const reg = PATTERN_REGISTRY[name];
    if (reg && reg.pattern) {
        const matches = extractMatches(text, reg.pattern, 5);
        if (matches.length > 0) {
            results.push({
                analyzer: name,
                filePath,
                matches,
                count: matches.length
            });
        }
    }
    return results;
}
async function withTimeout(promise, ms, label) {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(`Timed out after ${Math.round(ms / 1000)}s: ${label}`)), ms);
            })
        ]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
async function resolveFile(fileEntry) {
    const fileObj = fileEntry.fileObj || fileEntry;
    if (typeof fileObj.getFile === 'function') {
        return fileObj.getFile();
    }
    return fileObj;
}
async function analyzeWithTextPatterns(file, filePath) {
    const text = await withTimeout(file.text(), FILE_READ_TIMEOUT_MS, filePath);
    const fileLang = detectFileLanguage(filePath);
    if (!fileLang)
        return [];
    const analyzers = getAnalyzersForLanguage(fileLang);
    const issues = [];
    for (const name of analyzers) {
        const results = runAnalyzer(name, text, filePath);
        for (const r of results) {
            for (const m of r.matches) {
                issues.push({
                    severity: SEVERITY_MAP[name] || 'medium',
                    filePath: r.filePath,
                    rule: name,
                    line: m.line,
                    impact: `${r.count} ${name} finding(s) detected`,
                    fix: 'Review and remediate before next release.'
                });
            }
        }
    }
    return issues;
}
async function scanFiles(files, deepScan, state = null) {
    const allResults = state?.allResults || [];
    const issues = state?.issues || [];
    let processed = state?.processed || 0;
    let textErrors = state?.textErrors || 0;
    let chunkAnalyzed = state?.chunkAnalyzed || 0;
    let binarySkipped = state?.binarySkipped || 0;
    let issuesTruncated = state?.issuesTruncated || false;
    for (const file of files) {
        if (issues.length >= MAX_ISSUES) {
            issuesTruncated = true;
            break;
        }
        if (shouldSkipFile(file.path, deepScan)) {
            processed++;
            continue;
        }
        try {
            const fileObj = await withTimeout(resolveFile(file), FILE_READ_TIMEOUT_MS, file.path);
            if (!fileObj || typeof fileObj.slice !== 'function') {
                textErrors++;
                processed++;
                continue;
            }
            const size = fileObj.size || 0;
            if (isBinary(file.path)) {
                binarySkipped += 1;
                processed++;
                continue;
            }
            if (size > LARGE_FILE_THRESHOLD) {
                const results = await withTimeout(analyzeFileChunks(fileObj, file.path), CHUNK_ANALYZE_TIMEOUT_MS, file.path);
                chunkAnalyzed += 1;
                const chunkIssues = findingsToIssues(results, file.path);
                if (chunkIssues.length > 0) {
                    for (const issue of chunkIssues) {
                        if (issues.length >= MAX_ISSUES) {
                            issuesTruncated = true;
                            break;
                        }
                        issues.push(issue);
                    }
                    allResults.push({
                        analyzer: 'chunkAnalyzer',
                        filePath: file.path,
                        matches: chunkIssues.map((i) => ({ line: i.line, snippet: i.impact })),
                        count: chunkIssues.length
                    });
                }
            }
            else if (detectFileLanguage(file.path)) {
                const textIssues = await analyzeWithTextPatterns(fileObj, file.path);
                for (const issue of textIssues) {
                    if (issues.length >= MAX_ISSUES) {
                        issuesTruncated = true;
                        break;
                    }
                    issues.push(issue);
                }
            }
            processed++;
            const total = state?.totalFiles || files.length;
            if (processed % 25 === 0) {
                self.postMessage({ type: 'progress', processed, total, currentFile: file.path });
            }
        }
        catch (err) {
            textErrors++;
            processed++;
        }
    }
    const total = state?.totalFiles || files.length;
    self.postMessage({ type: 'progress', processed, total, currentFile: files.length ? files[files.length - 1].path : '' });
    return {
        processed,
        totalFiles: total,
        findings: allResults,
        issues,
        issueCount: issues.length,
        chunkAnalyzed,
        binarySkipped,
        issuesTruncated,
        allResults,
        textErrors
    };
}
self.onmessage = async (e) => {
    const { type, files, scanId, batchOffset, totalFiles, deepScan } = e.data;
    if (type === 'scan') {
        self.postMessage({ type: 'started', scanId, totalFiles: files.length });
        try {
            const results = await scanFiles(files, deepScan);
            self.postMessage({ type: 'complete', scanId, ...results });
        }
        catch (err) {
            self.postMessage({ type: 'error', scanId, error: err.message });
        }
        return;
    }
    if (type === 'scan-start') {
        self.scanState = {
            scanId,
            totalFiles: totalFiles || 0,
            allResults: [],
            issues: [],
            processed: 0,
            textErrors: 0,
            chunkAnalyzed: 0,
            binarySkipped: 0,
            issuesTruncated: false,
            deepScan: Boolean(deepScan)
        };
        self.postMessage({ type: 'started', scanId, totalFiles: self.scanState.totalFiles });
        return;
    }
    if (type === 'scan-batch') {
        const state = self.scanState;
        if (!state || state.scanId !== scanId) {
            self.postMessage({ type: 'error', scanId, error: 'Scan batch received before scan-start' });
            return;
        }
        try {
            const batch = Array.isArray(files) ? files : [];
            const results = await scanFiles(batch, state.deepScan, state);
            state.allResults = results.allResults;
            state.issues = results.issues;
            state.processed = results.processed;
            state.textErrors = results.textErrors;
            state.chunkAnalyzed = results.chunkAnalyzed;
            state.binarySkipped = results.binarySkipped;
            state.issuesTruncated = results.issuesTruncated;
            self.postMessage({
                type: 'batch-complete',
                scanId,
                batchOffset: batchOffset || 0,
                processed: state.processed,
                total: state.totalFiles
            });
        }
        catch (err) {
            self.postMessage({ type: 'error', scanId, error: err.message });
        }
        return;
    }
    if (type === 'scan-finish') {
        const state = self.scanState;
        if (!state || state.scanId !== scanId) {
            self.postMessage({ type: 'error', scanId, error: 'Scan finish received before scan-start' });
            return;
        }
        self.postMessage({
            type: 'complete',
            scanId,
            processed: state.processed,
            totalFiles: state.totalFiles,
            findings: state.allResults,
            issues: state.issues,
            issueCount: state.issues.length,
            chunkAnalyzed: state.chunkAnalyzed,
            binarySkipped: state.binarySkipped,
            issuesTruncated: state.issuesTruncated
        });
        self.scanState = null;
    }
};
