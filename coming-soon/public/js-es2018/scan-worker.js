// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Web Worker for browser-based file scanning.
 * Offloads analyzer execution from the main UI thread.
 */

const MAX_DISCOVERED_FILES = Number.MAX_SAFE_INTEGER;

const LANGUAGE_REGISTRY = {
    javascript: { extensions: ['js','cjs','mjs','ts','tsx','jsx'] },
    python: { extensions: ['py','pyw','pyi'] },
    java: { extensions: ['java','kt','scala','groovy'] },
    go: { extensions: ['go'] },
    rust: { extensions: ['rs'] },
    php: { extensions: ['php'] },
    ruby: { extensions: ['rb'] },
    dotnet: { extensions: ['cs','vb'] }
};

const PATTERN_REGISTRY = {
    debugArtifacts: {
        appliesTo: ['javascript'],
        pattern: /\bconsole\.(log|warn|error|info|debug|table|trace|dir|group)\s*\(|debugger\b|alert\s*\(|prompt\s*\(|confirm\s*\(/gi
    },
    todoMarkers: {
        appliesTo: ['javascript','python','java','go','rust','php','ruby','dotnet'],
        pattern: /(?:\/\/\s*|\/\*\s*|#\s*)\b(TODO|FIXME|HACK|XXX|BUG)\b/gi
    },
    credentials: {
        appliesTo: ['javascript','python','java','go','rust','php','ruby','dotnet'],
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
        if (config.extensions.includes(ext)) return langKey;
    }
    return null;
}

function detectDominantLanguage(paths) {
    const counts = {};
    for (const path of paths) {
        const ext = (path.match(/\.([^.]+)$/) || [null, ''])[1].toLowerCase();
        for (const [langKey, config] of Object.entries(LANGUAGE_REGISTRY)) {
            if (config.extensions.includes(ext)) { counts[langKey] = (counts[langKey] || 0) + 1; break; }
        }
    }
    const entries = Object.entries(counts);
    if (entries.length === 0) return 'javascript';
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
}

function getAnalyzersForLanguage(langKey) {
    return Object.entries(PATTERN_REGISTRY)
        .filter(([,entry]) => entry.appliesTo.includes(langKey))
        .map(([id]) => id);
}

/**
 * Extract up to `max` regex matches from text with line numbers and snippets.
 */
function extractMatches(text, pattern, max = 3) {
    const matches = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length && matches.length < max; i++) {
        const line = lines[i];
        pattern.lastIndex = 0; // Reset for global regexes
        if (pattern.test(line)) {
            matches.push({ line: i + 1, snippet: line.trim().slice(0, 120) });
        }
    }
    return matches;
}

/**
 * Compute a simple hash for duplicate detection.
 */
async function simpleHash(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // FNV-1a fallback
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Check if a file path should be skipped (node_modules, cache, test files).
 */
function shouldSkipFile(path, deepScan) {
    const normalized = path.replace(/\\/g, '/');
    if (/(^|[\/])(node_modules|\.git|\.github|\.husky|dist|build|\.next|out|coverage|frontend-build|\.github-sync|github-cache|\.simplebeacon|\.cursor|\.windsurf|deployments|backups)([\/]|$)/i.test(normalized)) return true;
    if (!deepScan && /(^|[\/])(docs\/|doc\/|third_party\/|thirdparty\/|geedocs\/|mapfiles\/|vendor\/)/i.test(normalized)) return true;
    if (!deepScan && /\.min\.js$|\.pack\.js$|\.bundle\.js$|\.map$/i.test(normalized)) return true;
    return false;
}

/**
 * Run a single analyzer on a file's text content.
 */
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

/**
 * Process a batch of files through all analyzers.
 */
async function scanFiles(files, deepScan) {
    const allResults = [];
    const issues = [];
    let processed = 0;

    let textErrors = 0;
    for (const file of files) {
        if (shouldSkipFile(file.path, deepScan)) continue;

        try {
            const fileObj = file.fileObj || file;
            if (typeof fileObj.text !== 'function') {
                textErrors++;
                continue;
            }
            const text = await fileObj.text();
            const hash = await simpleHash(text);

            const fileLang = detectFileLanguage(file.path);
            if (!fileLang) {
                processed++;
                continue;
            }
            const analyzers = getAnalyzersForLanguage(fileLang);
            for (const name of analyzers) {
                const results = runAnalyzer(name, text, file.path);
                if (results.length > 0) {
                    allResults.push(...results);
                    issues.push(...results.map(r => ({
                        severity: SEVERITY_MAP[name] || 'medium',
                        filePath: r.filePath,
                        rule: name,
                        impact: `${r.count} ${name} finding(s) detected`,
                        fix: 'Review and remediate before next release.'
                    })));
                }
            }

            processed++;
            if (processed % 50 === 0) {
                self.postMessage({ type: 'progress', processed, total: files.length });
            }
        } catch (err) {
            textErrors++;
        }
    }
    // Final progress update so UI reaches 100%
    self.postMessage({ type: 'progress', processed, total: files.length });
    if (textErrors > 0) {
        self.postMessage({ type: 'warn', message: `${textErrors} files could not be read in worker. Main thread handles actual scanning.` });
    }

    return {
        processed,
        totalFiles: files.length,
        findings: allResults,
        issues,
        issueCount: issues.length
    };
}

// Message handler
self.onmessage = async (e) => {
    const { type, files, scanId } = e.data;

    if (type === 'scan') {
        self.postMessage({ type: 'started', scanId, totalFiles: files.length });

        try {
            const results = await scanFiles(files, e.data.deepScan);
            self.postMessage({ type: 'complete', scanId, ...results });
        } catch (err) {
            self.postMessage({ type: 'error', scanId, error: err.message });
        }
    }
};
