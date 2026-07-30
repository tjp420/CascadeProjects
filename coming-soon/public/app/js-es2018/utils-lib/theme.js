/**
 * Convert a hex color string to an rgba() string.
 * Supports #rrggbb and #rgb formats.
 * @param {string} hex
 * @param {number} [alpha=1]
 * @returns {string}
 */
export function hexToRgba(hex, alpha = 1) {
    if (typeof hex !== 'string')
        return 'rgba(0,0,0,1)';
    let h = hex.replace('#', '');
    if (h.length === 3) {
        h = h.split('').map(c => c + c).join('');
    }
    if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h))
        return 'rgba(0,0,0,1)';
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    const a = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
    return `rgba(${r},${g},${b},${a})`;
}
/**
 * Lighten or darken a hex color by a percentage.
 * @param {string} color Hex color string.
 * @param {number} percent Positive to lighten, negative to darken.
 * @returns {string}
 */
export function shadeColor(color, percent) {
    if (typeof color !== 'string')
        return '#000000';
    let hex = color.replace('#', '');
    if (hex.length === 3)
        hex = hex.split('').map(c => c + c).join('');
    if (hex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(hex))
        return color;
    const f = parseInt(hex, 16);
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent) / 100;
    const r = Math.round(((f >> 16) & 0xFF) * (1 - p) + t * p);
    const g = Math.round(((f >> 8) & 0xFF) * (1 - p) + t * p);
    const b = Math.round((f & 0xFF) * (1 - p) + t * p);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
/**
 * Return black or white text color for best contrast against a hex background.
 * @param {string} hex Background hex color.
 * @returns {string} '#000000' or '#ffffff'.
 */
export function contrastColor(hex) {
    if (typeof hex !== 'string')
        return '#000000';
    let h = hex.replace('#', '');
    if (h.length === 3)
        h = h.split('').map(c => c + c).join('');
    if (h.length !== 6)
        return '#000000';
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
}
/**
 * Read a CSS custom property from :root.
 * @param {string} name
 * @param {string} [fallback]
 * @returns {string}
 */
export function getCssVar(name, fallback = '') {
    if (typeof document === 'undefined' || !document.documentElement)
        return fallback;
    const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return val || fallback;
}
/**
 * Set a CSS custom property on :root.
 * @param {string} name
 * @param {string} value
 * @returns {void}
 */
export function setCssVar(name, value) {
    if (typeof document === 'undefined' || !document.documentElement)
        return;
    document.documentElement.style.setProperty(name, value);
}
/**
 * Check whether the user prefers reduced motion (accessibility).
 * @returns {boolean}
 */
export function prefersReducedMotion() {
    if (typeof window === 'undefined' || !window.matchMedia)
        return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
/**
 * Check whether the user's system is set to dark mode.
 * @returns {boolean}
 */
export function prefersDarkMode() {
    if (typeof window === 'undefined' || !window.matchMedia)
        return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
