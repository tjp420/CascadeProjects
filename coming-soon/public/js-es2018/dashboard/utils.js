// SimpleBeacon Dashboard Utilities
// Pure helper functions extracted from main.js
function escapeHtml(str) {
    if (!str)
        return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
// simpleHash is defined in main.js — use the shared version
if (typeof window !== 'undefined' && !window.simpleHash) {
    window.simpleHash = async function (text) {
        let hash = 5381;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) + hash) + text.charCodeAt(i);
        }
        return String(hash >>> 0);
    };
}
// SHA-256 helper using Web Crypto API
async function computeSha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
// Robust file reader: File.text() with FileReader fallback for older browsers
async function readFileText(file) {
    if (typeof file.text === 'function') {
        return await file.text();
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('FileReader error'));
        reader.readAsText(file);
    });
}
function showHashRibbon(elementId, valueId, text) {
    const ribbon = document.getElementById(elementId);
    const value = document.getElementById(valueId);
    if (ribbon && value) {
        value.textContent = "sha256-" + text;
        ribbon.style.display = 'flex';
    }
}
if (typeof window !== 'undefined') {
    window.escapeHtml = escapeHtml;
    window.simpleHash = simpleHash;
    window.computeSha256 = computeSha256;
    window.readFileText = readFileText;
    window.showHashRibbon = showHashRibbon;
}
