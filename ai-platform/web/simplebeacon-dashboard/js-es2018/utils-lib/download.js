/**
 * download utilities.
 */


/**
 * Download a Blob as a file.
 * Uses VS Code webview message passing when in a sandboxed webview,
 * falls back to a standard anchor download in regular browsers.
 * @param {Blob} blob
 * @param {string} filename
 * @returns {void}
 * @throws {Error} When blob is missing or document is unavailable.
 */
export function downloadBlob(blob, filename) {
    if (!(blob instanceof Blob)) {
        throw new Error('Download is unavailable: no valid blob provided.');
    }
    // Standard anchor-based download (extracted so it can be reused as a fallback).
    function _anchorDownload() {
        if (typeof document === 'undefined' || !document.body) {
            throw new Error('Download is unavailable in this environment.');
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'download';
        a.rel = 'noopener';
        document.body.appendChild(a);
        try {
            a.click();
        } finally {
            a.remove();
            // revoke on next tick — download starts synchronously from click()
            setTimeout(() => URL.revokeObjectURL(url), 0);
        }
    }
    // VS Code: webview fallback — blob downloads via <a download> are blocked in sandboxed webviews
    if (typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function') {
        const vscode = window.acquireVsCodeApi();
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            const commaIdx = result.indexOf(',');
            const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
            vscode.postMessage({ command: 'downloadFile', filename: filename || 'download', mimeType: blob.type, base64 });
        };
        reader.onerror = () => {
            console.error('FileReader failed to convert blob for VS Code download. Falling back to normal download.');
            try {
                _anchorDownload();
            } catch (err) {
                console.error('Fallback download failed:', err);
            }
        };
        reader.readAsDataURL(blob);
        return;
    }
    _anchorDownload();
}


/**
 * Serialize data to JSON and trigger a download.
 * @param {unknown} data
 * @param {string} filename
 * @returns {void}
 * @throws {Error} When JSON serialization fails.
 */
export function downloadJson(data, filename) {
    if (typeof filename !== 'string') {
        throw new Error('Download requires a valid filename string.');
    }
    let json;
    try {
        json = JSON.stringify(data, null, 2);
    } catch (err) {
        throw new Error(`Failed to serialize data to JSON: ${err?.message || String(err)}`);
    }
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, filename);
}


/**
 * Create a text blob and trigger a download.
 * @param {string} content
 * @param {string} filename
 * @param {string} [mime='text/plain']
 * @returns {void}
 */
export function downloadText(content, filename, mime = 'text/plain') {
    if (content == null) {
        throw new Error('Download is unavailable: no content provided.');
    }
    if (typeof filename !== 'string') {
        throw new Error('Download requires a valid filename string.');
    }
    const blob = new Blob([content], { type: mime });
    downloadBlob(blob, filename);
}

