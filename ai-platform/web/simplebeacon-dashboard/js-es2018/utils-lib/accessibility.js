/**
 * accessibility utilities.
 */


/**
 * Check whether the user prefers reduced motion (accessibility).
 * @returns {boolean}
 */
export function prefersReducedMotion() {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}


/**
 * Check whether the user's system is set to dark mode.
 * @returns {boolean}
 */
export function prefersDarkMode() {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

