/**
 * @module clipboard
 */
/**
 * Copy text to clipboard. Returns a promise resolving to true on success.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
    const s = String(text !== null && text !== void 0 ? text : '');
    if (!s) return false;
    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(s);
            return true;
        }
        if (typeof document !== 'undefined' && document.execCommand) {
            const ta = document.createElement('textarea');
            ta.value = s;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            ta.remove();
            return ok;
        }
    } catch (_a) {
        // fall through
    }
    return false;
}
