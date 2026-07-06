/**
 * UrlCompressor.js — Native CompressionStream (GZIP) utilities
 * Compresses heavy report objects into compact, URL-safe Base64 hashes.
 */
/**
 * Compress a report object into a URL-safe base64 hash string.
 * Uses the native browser CompressionStream API for hardware-accelerated GZIP.
 * @param {object} reportObj — any JSON-serializable report payload
 * @returns {Promise<string>} URL-safe base64 string (no padding, no +/)
 */
export async function compressReportToHash(reportObj) {
    const jsonString = JSON.stringify(reportObj);
    const stream = new Blob([jsonString]).stream();
    // Process text stream through native hardware GZIP compression pipeline
    const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
    const response = new Response(compressedStream);
    const buffer = await response.arrayBuffer();
    // Translate binary buffer array to base64 string
    const bytes = new Uint8Array(buffer);
    let binaryString = '';
    const len = bytes.length;
    const chunkSize = 0x8000; // 32KB chunks to avoid stack overflow on large buffers
    for (let i = 0; i < len; i += chunkSize) {
        binaryString += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binaryString)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, ''); // Clean padding for URL safety
}
/**
 * Reconstitute a URL hash segment back into a clean, parsing-ready object.
 * @param {string} hashString — URL-safe base64 string from compressReportToHash
 * @returns {Promise<object>} the original report object
 */
export async function decompressHashToReport(hashString) {
    if (!hashString || typeof hashString !== 'string') {
        throw new TypeError('decompressHashToReport: hashString must be a non-empty string');
    }
    // Restore base64 URL padding transformations
    let base64 = hashString.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4)
        base64 += '=';
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    // Feed bytes into decompression pipeline
    const stream = new Blob([bytes]).stream();
    const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
    const response = new Response(decompressedStream);
    const jsonText = await response.text();
    return JSON.parse(jsonText);
}
/**
 * Synchronous check: does the runtime support CompressionStream?
 * Useful for feature-gating in legacy environments.
 * @returns {boolean}
 */
export function isCompressionSupported() {
    return (typeof CompressionStream !== 'undefined' &&
        typeof DecompressionStream !== 'undefined' &&
        typeof Response !== 'undefined' &&
        typeof Blob !== 'undefined');
}
/**
 * Fallback compressor for environments without CompressionStream.
 * Simply returns a JSON-stringified, URI-encoded payload.
 * @param {object} reportObj
 * @returns {string}
 */
export function compressReportToHashFallback(reportObj) {
    try {
        const json = JSON.stringify(reportObj);
        return encodeURIComponent(json);
    }
    catch (_a) {
        return '';
    }
}
/**
 * Estimate compression ratio for telemetry / UI feedback.
 * @param {object} reportObj
 * @returns {Promise<{original:number, compressed:number, ratio:number}>}
 */
export async function estimateCompressionRatio(reportObj) {
    const original = JSON.stringify(reportObj).length;
    const compressed = (await compressReportToHash(reportObj)).length;
    return {
        original,
        compressed,
        ratio: original > 0 ? +(compressed / original).toFixed(3) : 0
    };
}
