/**
 * Web Worker for browser-based file scanning.
 * Offloads analyzer execution from the main UI thread.
 */

const MAX_DISCOVERED_FILES = 100000;

/**
 * Extract up to `max` regex matches from text with line numbers and snippets.
 */
function extractMatches(text, pattern, max = 3) {
    const matches = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length && matches.length < max; i++) {
        const line = lines[i];
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
function shouldSkipFile(path) {
    const normalized = path.replace(/\\/g, '/');
    return /(^|[\/])node_modules([\/]|$)/i.test(normalized) ||
           /\.simplebeacon[\/]/i.test(normalized) ||
           /github-cache[\/]/i.test(normalized) ||
           /\.git[\/]/i.test(normalized) ||
           /test-.*\.js$|\.test\.|\.spec\./i.test(normalized) ||
           /server\.cjs$/i.test(normalized);
}

/**
 * Run a single analyzer on a file's text content.
 */
function runAnalyzer(name, text, filePath) {
    const results = [];
    const patterns = {
        debugArtifacts: /console\.(log|warn|error|info|debug|table|trace|dir|group)\s*\(|debugger\b|alert\s*\(|prompt\s*\(|confirm\s*\(/gi,
        todoMarkers: /(?:\/\/\s*|\/\*\s*|#\s*)\b(TODO|FIXME|HACK|XXX|BUG)\b/gi,
        credentials: /(password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key|client[_-]?secret)\s*[:=]\s*['"`][^'"`\s]{8,}/gi,
        mockData: /test[-_]?data|fixture|mock|stub|dummy|sample|example.*data/gi,
        euAiAct: /ai_system|high_risk|transparency|conformity|bias_audit|data_governance/gi
    };

    if (patterns[name]) {
        const matches = extractMatches(text, patterns[name], 5);
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
async function scanFiles(files) {
    const allResults = [];
    const issues = [];
    let processed = 0;

    for (const file of files) {
        if (shouldSkipFile(file.path)) continue;

        try {
            const text = await file.text();
            const hash = await simpleHash(text);

            const analyzers = ['debugArtifacts', 'todoMarkers', 'credentials', 'mockData', 'euAiAct'];
            for (const name of analyzers) {
                const results = runAnalyzer(name, text, file.path);
                if (results.length > 0) {
                    allResults.push(...results);
                    issues.push(...results.map(r => ({
                        severity: name === 'credentials' ? 'critical' : name === 'euAiAct' ? 'high' : 'medium',
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
            // Skip unreadable files
        }
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
            const results = await scanFiles(files);
            self.postMessage({ type: 'complete', scanId, ...results });
        } catch (err) {
            self.postMessage({ type: 'error', scanId, error: err.message });
        }
    }
};
