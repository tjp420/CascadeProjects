/**
 * Live scan progress — written to .simplebeacon/scan-progress.json for dashboard polling.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_MIN_WRITE_MS = Number(process.env.SIMPLEBEACON_PROGRESS_WRITE_MS) || 120;

function resolveScanProgressPath(scanRoot, options = {}) {
    if (options.progressPath) return options.progressPath;
    if (process.env.SIMPLEBEACON_PROGRESS_FILE) {
        return process.env.SIMPLEBEACON_PROGRESS_FILE;
    }
    const root = String(scanRoot || '').trim();
    if (!root) return null;
    return path.join(root, '.simplebeacon', 'scan-progress.json');
}

function createScanProgressWriter(progressPath, meta = {}) {
    if (!progressPath) {
        return {
            update() {},
            clear() {},
            get path() { return null; }
        };
    }

    let lastWriteAt = 0;
    let pending = null;
    let timer = null;
    const startedAt = new Date().toISOString();

    const flush = () => {
        timer = null;
        if (!pending) return;
        const payload = {
            active: true,
            ...meta,
            ...pending,
            startedAt,
            updatedAt: new Date().toISOString()
        };
        pending = null;
        try {
            fs.mkdirSync(path.dirname(progressPath), { recursive: true });
            const tmp = `${progressPath}.tmp`;
            fs.writeFileSync(tmp, `${JSON.stringify(payload)}\n`, 'utf8');
            fs.renameSync(tmp, progressPath);
        } catch {
            /* best-effort */
        }
    };

    const scheduleFlush = () => {
        if (DEFAULT_MIN_WRITE_MS <= 0) {
            lastWriteAt = Date.now();
            flush();
            return;
        }
        const now = Date.now();
        const wait = Math.max(0, DEFAULT_MIN_WRITE_MS - (now - lastWriteAt));
        if (timer) return;
        timer = setTimeout(() => {
            lastWriteAt = Date.now();
            flush();
        }, wait);
        if (typeof timer.unref === 'function') timer.unref();
    };

    return {
        path: progressPath,
        update(patch = {}) {
            pending = { ...(pending || {}), ...patch };
            scheduleFlush();
        },
        clear() {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            pending = null;
            try {
                if (fs.existsSync(progressPath)) fs.unlinkSync(progressPath);
            } catch {
                /* ignore */
            }
        }
    };
}

function readScanProgress(progressPath) {
    if (!progressPath || !fs.existsSync(progressPath)) {
        return { active: false };
    }
    try {
        const raw = fs.readFileSync(progressPath, 'utf8');
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') return { active: false };
        return { active: true, ...data };
    } catch {
        return { active: false };
    }
}

module.exports = {
    createScanProgressWriter,
    readScanProgress,
    resolveScanProgressPath
};
