/**
 * clipboard utilities.
 */


/**
 * Copy text to the system clipboard.
 * Uses the modern Clipboard API when available; falls back to
 * a hidden `<textarea>` with `document.execCommand('copy')`.
 * @param {string} text Text to copy.
 * @returns {Promise<void>}
 * @throws {Error} If the clipboard is unavailable in this environment.
 */
export async function copyToClipboard(text) {
  if (text == null) throw new Error('Cannot copy null or undefined to clipboard.');
  const str = String(text);
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      return await navigator.clipboard.writeText(str);
    } catch {
      // Non-secure context or permission denied — fall through to execCommand
    }
  }
  if (typeof document === 'undefined' || !document.body) {
    throw new Error('Clipboard unavailable in this environment.');
  }
  // Fallback for older browsers / restricted contexts
  const ta = document.createElement('textarea');
  ta.value = str;
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    const ok = document.execCommand('copy');
    if (!ok) throw new Error('execCommand(copy) returned false');
  } finally {
    ta.remove();
  }
}

