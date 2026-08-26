/**
 * Safely read from localStorage, returning a fallback on any error.
 * Handles quota exceeded, private mode, and missing window errors.
 * @template T
 * @param {string} key Storage key.
 * @param {T} [fallback] Fallback value when read fails or key is absent.
 * @returns {T | undefined}
 */
export function localStorageGet(key, fallback) {
  if (typeof window === "undefined" || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Safely write to localStorage. Silently fails on quota exceeded or private mode.
 * @param {string} key Storage key.
 * @param {*} value Serializable value.
 * @returns {boolean} True if the write succeeded.
 */
export function localStorageSet(key, value) {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely remove a key from localStorage.
 * @param {string} key Storage key.
 * @returns {boolean} True if removal succeeded or key did not exist.
 */
export function localStorageRemove(key) {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely read a raw string from localStorage (no JSON parse).
 * @param {string} key Storage key.
 * @param {string} [fallback] Fallback value when read fails or key is absent.
 * @returns {string | undefined}
 */
export function localStorageGetString(key, fallback) {
  if (typeof window === "undefined" || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw;
  } catch {
    return fallback;
  }
}

/**
 * Safely write a raw string to localStorage (no JSON stringify).
 * @param {string} key Storage key.
 * @param {string} value Raw string value.
 * @returns {boolean} True if the write succeeded.
 */
export function localStorageSetString(key, value) {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    window.localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely read from sessionStorage, returning a fallback on any error.
 * @template T
 * @param {string} key Storage key.
 * @param {T} [fallback] Fallback value when read fails or key is absent.
 * @returns {T | undefined}
 */
export function sessionStorageGet(key, fallback) {
  if (typeof window === "undefined" || !window.sessionStorage) return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Safely write to sessionStorage. Silently fails on quota exceeded.
 * @param {string} key Storage key.
 * @param {*} value Serializable value.
 * @returns {boolean} True if the write succeeded.
 */
export function sessionStorageSet(key, value) {
  if (typeof window === "undefined" || !window.sessionStorage) return false;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely remove a key from sessionStorage.
 * @param {string} key Storage key.
 * @returns {boolean} True if removal succeeded or key did not exist.
 */
export function sessionStorageRemove(key) {
  if (typeof window === "undefined" || !window.sessionStorage) return false;
  try {
    window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
