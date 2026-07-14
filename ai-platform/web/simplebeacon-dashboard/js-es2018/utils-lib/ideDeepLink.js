/**
 * IDE deep-link bridge — open findings in VS Code / Cursor without copy-paste.
 */
import { getVSCodeApi } from './type.js';

function normalizeSlashes(filePath) {
    return String(filePath || '').replace(/\\/g, '/');
}

function isAbsolutePath(filePath) {
    const p = String(filePath || '');
    return /^([A-Za-z]:[\\/]|\\\\|\/)/.test(p);
}

/**
 * Resolve a relative file path against a project root when possible.
 * @param {string} filePath
 * @param {string} [projectRoot]
 * @returns {string}
 */
export function resolveAbsoluteFilePath(filePath, projectRoot) {
    const raw = String(filePath || '').trim();
    if (!raw)
        return '';
    if (isAbsolutePath(raw))
        return raw;
    const root = String(projectRoot || '').trim().replace(/[\\/]+$/, '');
    if (!root)
        return raw;
    const sep = root.includes('\\') ? '\\' : '/';
    const rel = raw.replace(/^[/\\]+/, '').replace(/\//g, sep);
    return `${root}${sep}${rel}`;
}

/**
 * Build a vscode:// or cursor:// file URL (fallback when extension bridge unavailable).
 * @param {string} filePath
 * @param {number} [line]
 * @returns {string|null}
 */
export function buildIdeFileUrl(filePath, line = 1, options = {}) {
    const absolute = resolveAbsoluteFilePath(filePath, options.projectRoot);
    if (!absolute || !isAbsolutePath(absolute))
        return null;
    const scheme = options.scheme || (typeof navigator !== 'undefined' && /Cursor/i.test(navigator.userAgent || '') ? 'cursor' : 'vscode');
    const normalized = normalizeSlashes(absolute);
    const lineNum = Math.max(1, Number(line) || 1);
    if (/^\/\//.test(normalized) || /^[A-Za-z]:\//.test(normalized)) {
        return `${scheme}://file/${normalized}:${lineNum}`;
    }
    return `${scheme}://file/${normalized}:${lineNum}`;
}

/**
 * Open a file at line in the host IDE when embedded in VS Code/Cursor.
 * @param {string} filePath
 * @param {number} [line]
 * @param {{ projectRoot?: string }} [options]
 * @returns {boolean} true when a bridge handler was invoked
 */
export function openInIde(filePath, line = 1, options = {}) {
    const absolute = resolveAbsoluteFilePath(filePath, options.projectRoot);
    if (!absolute)
        return false;
    const lineNum = Math.max(1, Number(line) || 1);
    const payload = { command: 'openFile', file: absolute, path: absolute, line: lineNum };

    const vscode = getVSCodeApi();
    if (vscode) {
        try {
            vscode.postMessage(payload);
            return true;
        }
        catch (_a) { /* fall through */ }
    }

    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        try {
            window.parent.postMessage(payload, '*');
            return true;
        }
        catch (_b) { /* fall through */ }
    }

    const url = buildIdeFileUrl(absolute, lineNum, options);
    if (url) {
        try {
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.rel = 'noopener';
            anchor.click();
            return true;
        }
        catch (_c) { /* ignore */ }
    }
    return false;
}

/**
 * Render label + optional IDE open control for a file reference.
 * @param {string} filePath
 * @param {number} [line]
 * @param {{ projectRoot?: string, label?: string }} [options]
 * @returns {HTMLElement}
 */
export function renderIdeFileLink(filePath, line = 1, options = {}) {
    const wrap = document.createElement('span');
    wrap.className = 'ide-file-link';
    const label = options.label || filePath.split(/[\\/]/).pop() || filePath;
    const canOpen = Boolean(resolveAbsoluteFilePath(filePath, options.projectRoot)) || isAbsolutePath(filePath);
    if (canOpen) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ide-file-link-btn btn-link text-xs';
        btn.textContent = line > 1 ? `${label}:${line}` : label;
        btn.title = `Open ${filePath}${line > 1 ? `:${line}` : ''} in editor`;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openInIde(filePath, line, options);
        });
        wrap.appendChild(btn);
    }
    else {
        const code = document.createElement('code');
        code.textContent = label;
        wrap.appendChild(code);
    }
    return wrap;
}

/**
 * @param {Object} app
 * @returns {string}
 */
export function resolveProjectRootFromApp(app) {
    var _a, _b, _c, _d;
    const report = (_a = app === null || app === void 0 ? void 0 : app.state) === null || _a === void 0 ? void 0 : _a.report;
    return String((report === null || report === void 0 ? void 0 : report.projectRoot)
        || (report === null || report === void 0 ? void 0 : report.projectPath)
        || ((_b = app === null || app === void 0 ? void 0 : app.state) === null || _b === void 0 ? void 0 : _b.lastProjectPath)
        || ((_c = app === null || app === void 0 ? void 0 : app.state) === null || _c === void 0 ? void 0 : _c.defaultProjectPath)
        || ((_d = app === null || app === void 0 ? void 0 : app.state) === null || _d === void 0 ? void 0 : _d.pathInputDraft)
        || '');
}
