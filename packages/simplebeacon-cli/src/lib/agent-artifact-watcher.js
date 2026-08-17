/**
 * Refresh agent supercharge artifacts when report.json changes on disk.
 */

const fs = require('fs');
const path = require('path');

const activeWatchers = new Map();

function refreshFromReport(reportPath, options = {}) {
    const reportFile = path.resolve(reportPath);
    const scanRoot = options.scanRoot || path.dirname(path.dirname(reportFile));
    let report = null;
    try {
        report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    } catch {
        return { ok: false, error: 'invalid report.json' };
    }
    try {
        const { writeAgentSupercharge } = require('./agent-supercharge');
        const { writeAgentBrief } = require('./agent-brief');
        const { writeAiContext } = require('./agent-context-pack');
        writeAgentBrief(scanRoot, report, options);
        writeAiContext(scanRoot, { ...options, report });
        const sc = writeAgentSupercharge(scanRoot, { ...options, report });
        return { ok: true, path: sc.path, scanRoot };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

function watchAgentArtifacts(scanRoot, options = {}) {
    const root = path.resolve(scanRoot);
    const reportPath = path.join(root, '.simplebeacon', 'report.json');
    const key = reportPath;
    if (activeWatchers.has(key)) {
        return activeWatchers.get(key);
    }

    const debounceMs = options.debounceMs || 800;
    let timer = null;

    const handler = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            if (!fs.existsSync(reportPath)) return;
            const result = refreshFromReport(reportPath, { ...options, scanRoot: root });
            if (typeof options.onRefresh === 'function') {
                options.onRefresh(result);
            }
        }, debounceMs);
    };

    let watcher = null;
    try {
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        watcher = fs.watch(path.dirname(reportPath), { persistent: false }, (event, file) => {
            if (file === 'report.json' || !file) handler();
        });
        if (fs.existsSync(reportPath)) handler();
    } catch {
        /* non-fatal */
    }

    const entry = {
        reportPath,
        scanRoot: root,
        stop() {
            if (timer) clearTimeout(timer);
            if (watcher) {
                try { watcher.close(); } catch { /* ignore */ }
            }
            activeWatchers.delete(key);
        }
    };
    activeWatchers.set(key, entry);
    return entry;
}

function stopAllArtifactWatchers() {
    for (const entry of activeWatchers.values()) {
        entry.stop();
    }
}

module.exports = {
    refreshFromReport,
    watchAgentArtifacts,
    stopAllArtifactWatchers
};
