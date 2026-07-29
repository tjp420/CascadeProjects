import { showToast } from '../utils.js';
import { ensureAllowedAnalysisRoots } from '../lib/analyzePathAllowlist.js';

function readDataTransferData(dt, type) {
    try {
        return dt.getData(type) || '';
    }
    catch (_a) {
        return '';
    }
}

function deriveDirFromFilePath(filePath) {
    if (!filePath) {
        return '';
    }
    const norm = filePath.replace(/\\/g, '/');
    const lastSlash = norm.lastIndexOf('/');
    return lastSlash > 0 ? norm.slice(0, lastSlash) : norm;
}

function extractFolderFromFilePath(filePath, folderName) {
    if (!filePath) {
        return '';
    }
    const norm = filePath.replace(/\\/g, '/');
    if (folderName) {
        const lower = norm.toLowerCase();
        const fname = folderName.toLowerCase();
        const idx = lower.indexOf(`/${fname}/`);
        if (idx >= 0) {
            return norm.slice(0, idx + fname.length + 1).replace(/\/+$/, '').replace(/\//g, '\\');
        }
        const endIdx = lower.lastIndexOf(`/${fname}`);
        if (endIdx >= 0) {
            return norm.slice(0, endIdx + fname.length).replace(/\/+$/, '').replace(/\//g, '\\');
        }
    }
    return deriveDirFromFilePath(filePath).replace(/\/+$/, '').replace(/\//g, '\\');
}

function extractFileUri(data) {
    if (!data) {
        return '';
    }
    const uri = data.trim().split('\n')[0]?.trim();
    if (uri && uri.startsWith('file:///')) {
        let p = uri.slice(8).replace(/\/$/, '');
        try {
            p = decodeURIComponent(p);
        }
        catch (_a) {
            // ignore
        }
        return p.replace(/\//g, '\\');
    }
    return '';
}

function getDroppedFolderPath(dt, folderName, files, items) {
    if (!dt) {
        return '';
    }
    const uriList = readDataTransferData(dt, 'text/uri-list');
    if (uriList) {
        const fromUri = extractFileUri(uriList);
        if (fromUri) {
            return fromUri;
        }
    }
    const plain = readDataTransferData(dt, 'text/plain');
    if (plain) {
        let trimmed = plain.trim().split('\n')[0]?.trim();
        trimmed = trimmed.replace(/^["']|["']$/g, '');
        if (trimmed && /^[a-zA-Z]:[\\/]/.test(trimmed)) {
            return trimmed.replace(/[\\/]+$/, '');
        }
    }
    const mozUrl = readDataTransferData(dt, 'text/x-moz-url');
    if (mozUrl) {
        const fromMoz = extractFileUri(mozUrl);
        if (fromMoz) {
            return fromMoz;
        }
    }
    if (files?.[0]?.path) {
        return extractFolderFromFilePath(String(files[0].path), folderName);
    }
    if (items?.[0]) {
        try {
            const file = items[0].getAsFile?.();
            if (file?.path) {
                return extractFolderFromFilePath(String(file.path), folderName);
            }
        }
        catch (_a) {
            // getAsFile may throw for directories
        }
    }
    return '';
}

function bindDragHighlight(dropzone) {
    let dragDepth = 0;
    const enter = (event) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepth++;
        dropzone.classList.add('drag-active');
    };
    const over = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
    };
    const leave = (event) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepth--;
        if (dragDepth <= 0) {
            dropzone.classList.remove('drag-active');
            dragDepth = 0;
        }
    };
    return { enter, over, leave };
}

/**
 * Bind drag-and-drop handlers for the Analyze path dropzone.
 * @param {HTMLElement} root
 * @param {object} ctx
 * @param {boolean} ctx.websiteMode
 * @param {() => string} ctx.deriveFallbackBase
 * @param {(resolvedPath: string, name: string, autoRun?: boolean) => void} ctx.onSetPath
 * @param {(files: FileList) => void} ctx.onHandleFiles
 */
export function bindPathDropzone(root, ctx) {
    const dropzone = root.querySelector('#analyze-path-dropzone');
    if (!dropzone || ctx.websiteMode) {
        return;
    }
    const { enter, over, leave } = bindDragHighlight(dropzone);
    const drop = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropzone.classList.remove('drag-active');
        try {
            await ensureAllowedAnalysisRoots(ctx.app);
        }
        catch (_a) {
            // ignore
        }
        const items = event.dataTransfer?.items;
        const files = event.dataTransfer?.files;
        const resolve = (name) => {
            const actualDir = getDroppedFolderPath(event.dataTransfer, name, files, items);
            if (actualDir) {
                return actualDir;
            }
            const pathInput = root.querySelector('#project-path-input');
            const currentInput = String(pathInput?.value || '').trim();
            const currentBase = currentInput
                ? currentInput.replace(/\\/g, '/').replace(/\/+$/, '').split('/').slice(0, -1).join('/')
                : '';
            const rawDefault = String(ctx.app?.state?.defaultProjectPath || '')
                .replace(/\\/g, '/')
                .replace(/\/+$/, '');
            const fallbackBase = String(ctx.deriveFallbackBase())
                .replace(/\\/g, '/')
                .replace(/\/+$/, '');
            const base = rawDefault || currentBase || fallbackBase;
            return base ? `${base}/${name}` : name;
        };
        if (items?.length) {
            const entry = items[0].webkitGetAsEntry?.();
            if (entry) {
                if (entry.isDirectory) {
                    const name = entry.name || '';
                    ctx.onSetPath(resolve(name), name, true);
                    return;
                }
                if (entry.isFile && files?.length) {
                    ctx.onHandleFiles(files);
                    return;
                }
            }
        }
        if (files?.length) {
            const file = files[0];
            const dtUriPath = getDroppedFolderPath(event.dataTransfer, undefined, files, items);
            if (dtUriPath) {
                ctx.onSetPath(dtUriPath, dtUriPath.split(/[\\/]/).pop() || 'folder', true);
                return;
            }
            if (file.path) {
                const targetPath = deriveDirFromFilePath(file.path) || file.path;
                ctx.onSetPath(targetPath, targetPath.split(/[\\/]/).pop() || 'folder', true);
                return;
            }
            ctx.onHandleFiles(files);
            return;
        }
        // Plain-text path paste (e.g., C:\Users\... or a file:// URI)
        const textPath = getDroppedFolderPath(event.dataTransfer, undefined, files, items);
        if (textPath) {
            ctx.onSetPath(textPath, textPath.split(/[\\/]/).pop() || 'folder', true);
            return;
        }
        showToast('Nothing detected. Drop a folder or file, or type a path manually.', 'warning');
    };
    dropzone.addEventListener('dragenter', enter); // simplebeacon-ignore memory-leak
    dropzone.addEventListener('dragover', over); // simplebeacon-ignore memory-leak
    dropzone.addEventListener('dragleave', leave); // simplebeacon-ignore memory-leak
    dropzone.addEventListener('drop', drop); // simplebeacon-ignore memory-leak
}

/**
 * Bind drag-and-drop handlers for the Analyze report dropzone.
 * @param {HTMLElement} root
 * @param {object} ctx
 * @param {(files: FileList) => void} ctx.onHandleFiles
 */
export function bindReportDropzone(root, ctx) {
    const dropzone = root.querySelector('#analyze-drop-zone');
    if (!dropzone) {
        return;
    }
    const { enter, over, leave } = bindDragHighlight(dropzone);
    const drop = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropzone.classList.remove('drag-active');
        const dt = event.dataTransfer;
        const files = dt?.files;
        if (dt?.items && dt.items.length > 0) {
            const entry = dt.items[0].webkitGetAsEntry?.();
            if (entry?.isDirectory) {
                showToast(`Directory "${entry.name || ''}" detected. Use Browse Folder or type the full path for best results.`, 'warning');
                return;
            }
        }
        if (!files?.length) {
            return;
        }
        const file = files[0];
        const isJson = file.name.endsWith('.json');
        const isZip = file.name.endsWith('.zip');
        if (isJson || isZip) {
            try {
                const text = await file.text();
                const report = JSON.parse(text);
                ctx.onLoadReport(report);
                showToast(`Report "${file.name}" loaded`, 'success');
            }
            catch {
                showToast('Failed to parse report JSON', 'error');
            }
            return;
        }
        ctx.onHandleFiles(files);
    };
    dropzone.addEventListener('dragenter', enter);
    dropzone.addEventListener('dragover', over);
    dropzone.addEventListener('dragleave', leave);
    dropzone.addEventListener('drop', drop);
}

/**
 * Bind drag-and-drop handlers for the Analyze quick-file dropzone.
 * @param {HTMLElement} root
 * @param {object} ctx
 * @param {(files: FileList) => void} ctx.onHandleFiles
 * @param {(resolvedPath: string, name: string, autoRun?: boolean) => void} ctx.onSetPath
 * @param {() => string} ctx.deriveFallbackBase
 */
export function bindFileDropzone(root, ctx) {
    const dropzone = root.querySelector('#analyze-file-dropzone');
    if (!dropzone) {
        return;
    }
    const { enter, over, leave } = bindDragHighlight(dropzone);
    const drop = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropzone.classList.remove('drag-active');
        const items = event.dataTransfer?.items;
        const files = event.dataTransfer?.files;
        if (items?.length) {
            const entry = items[0].webkitGetAsEntry?.();
            if (entry?.isDirectory) {
                const name = entry.name || '';
                const actualDir = getDroppedFolderPath(event.dataTransfer, name, files, items);
                const pathInput = root.querySelector('#project-path-input');
                const currentInput = String(pathInput?.value || '').trim();
                const currentBase = currentInput
                    ? currentInput.replace(/\\/g, '/').replace(/\/+$/, '').split('/').slice(0, -1).join('/')
                    : '';
                const rawDefault = String(ctx.app?.state?.defaultProjectPath || '')
                    .replace(/\\/g, '/')
                    .replace(/\/+$/, '');
                const fallbackBase = String(ctx.deriveFallbackBase())
                    .replace(/\\/g, '/')
                    .replace(/\/+$/, '');
                const base = rawDefault || currentBase || fallbackBase;
                const resolvedPath = actualDir || (base ? `${base}/${name}` : name);
                ctx.onSetPath(resolvedPath, name, false);
                showToast(`Folder "${name}" dropped — path set to ${resolvedPath}. Press Enter or click Analyze to start.`, 'info');
                return;
            }
        }
        if (files?.length) {
            ctx.onHandleFiles(files);
        }
        else {
            showToast('No file detected. Try dropping a source file or JSON report.', 'warning');
        }
    };
    dropzone.addEventListener('dragenter', enter);
    dropzone.addEventListener('dragover', over);
    dropzone.addEventListener('dragleave', leave);
    dropzone.addEventListener('drop', drop);
}

/**
 * Bind all Analyze drop zones.
 * @param {HTMLElement} root
 * @param {object} ctx
 */
export function bindAnalyzeDropzones(root, ctx) {
    bindPathDropzone(root, ctx);
    bindReportDropzone(root, ctx);
    bindFileDropzone(root, ctx);
}
