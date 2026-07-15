/**
 * @module download
 */
import { notifyDownloadComplete } from './notify.js';
/**
 * Download a Blob as a file.
 * Uses VS Code webview message passing when in a sandboxed webview,
 * falls back to a standard anchor download in regular browsers.
 * @param {Blob} blob
 * @param {string} filename
 * @returns {void}
 * @throws {Error} When blob is missing or document is unavailable.
 */
export function normalDownload(blob, filename) {
    if (!(blob instanceof Blob)) {
        throw new Error('Download is unavailable: invalid blob.');
    }
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
    }
    finally {
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }
    notifyDownloadComplete(filename || 'download');
}
export function downloadBlob(blob, filename) {
    if (!(blob instanceof Blob)) {
        throw new Error('Download is unavailable: no valid blob provided.');
    }
    if (typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function') {
        let vscode;
        try {
            vscode = window.acquireVsCodeApi();
        }
        catch (_a) {
            // VS Code API unavailable — fall through to normal download
            return normalDownload(blob, filename);
        }
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
                normalDownload(blob, filename);
            }
            catch (err) {
                console.error('Fallback download failed:', err);
            }
        };
        reader.readAsDataURL(blob);
        return;
    }
    normalDownload(blob, filename);
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
    }
    catch (err) {
        throw new Error(`Failed to serialize data to JSON: ${(err === null || err === void 0 ? void 0 : err.message) || String(err)}`);
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
/**
 * Convert an array of objects to CSV and download it as a file.
 * @param {Object[]} rows Array of plain objects.
 * @param {string} filename Download filename.
 * @param {string[]} [headers] Optional explicit column order; auto-detected from first row if omitted.
 */
export function downloadCsv(rows, filename, headers) {
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('CSV download requires a non-empty array of rows.');
    }
    if (typeof filename !== 'string') {
        throw new Error('Download requires a valid filename string.');
    }
    const cols = Array.isArray(headers) && headers.length > 0 ? headers : Object.keys(rows[0]);
    const escape = (val) => {
        const s = val == null ? '' : String(val);
        if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    };
    const lines = [cols.join(','), ...rows.map(row => cols.map(c => escape(row[c])).join(','))];
    const csv = lines.join('\n');
    downloadText(csv, filename, 'text/csv');
}
