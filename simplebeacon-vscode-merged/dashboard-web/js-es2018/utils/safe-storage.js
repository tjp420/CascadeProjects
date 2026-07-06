/**
 * @module safe-storage
 * Safe wrappers around localStorage and sessionStorage that gracefully handle
 * sandboxed iframes, private browsing mode, and storage quota errors.
 */

/** @returns {boolean} */
function storageAvailable(type) {
  try {
    const storage = type === 'local' ? window.localStorage : window.sessionStorage;
    const testKey = '__sb_storage_test__';
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

const _localOk = typeof window !== 'undefined' ? storageAvailable('local') : false;
const _sessionOk = typeof window !== 'undefined' ? storageAvailable('session') : false;

/**
 * Safely get an item from localStorage.
 * @param {string} key
 * @param {string|null} [defaultValue=null]
 * @returns {string|null}
 */
export function localStorageGet(key, defaultValue = null) {
  if (!_localOk) return defaultValue;
  try {
    const val = window.localStorage.getItem(key);
    return val === null ? defaultValue : val;
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Safely set an item in localStorage.
 * @param {string} key
 * @param {string} value
 * @returns {boolean}
 */
export function localStorageSet(key, value) {
  if (!_localOk) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Safely remove an item from localStorage.
 * @param {string} key
 * @returns {boolean}
 */
export function localStorageRemove(key) {
  if (!_localOk) return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Safely get and parse JSON from localStorage.
 * @param {string} key
 * @param {any} [defaultValue=null]
 * @returns {any}
 */
export function localStorageGetJson(key, defaultValue = null) {
  const raw = localStorageGet(key, null);
  if (raw === null) return defaultValue;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Safely stringify and set JSON in localStorage.
 * @param {string} key
 * @param {any} value
 * @returns {boolean}
 */
export function localStorageSetJson(key, value) {
  try {
    return localStorageSet(key, JSON.stringify(value));
  } catch (e) {
    return false;
  }
}

/**
 * Safely get an item from sessionStorage.
 * @param {string} key
 * @param {string|null} [defaultValue=null]
 * @returns {string|null}
 */
export function sessionStorageGet(key, defaultValue = null) {
  if (!_sessionOk) return defaultValue;
  try {
    const val = window.sessionStorage.getItem(key);
    return val === null ? defaultValue : val;
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Safely set an item in sessionStorage.
 * @param {string} key
 * @param {string} value
 * @returns {boolean}
 */
export function sessionStorageSet(key, value) {
  if (!_sessionOk) return false;
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Safely remove an item from sessionStorage.
 * @param {string} key
 * @returns {boolean}
 */
export function sessionStorageRemove(key) {
  if (!_sessionOk) return false;
  try {
    window.sessionStorage.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Safely get and parse JSON from sessionStorage.
 * @param {string} key
 * @param {any} [defaultValue=null]
 * @returns {any}
 */
export function sessionStorageGetJson(key, defaultValue = null) {
  const raw = sessionStorageGet(key, null);
  if (raw === null) return defaultValue;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Safely stringify and set JSON in sessionStorage.
 * @param {string} key
 * @param {any} value
 * @returns {boolean}
 */
export function sessionStorageSetJson(key, value) {
  try {
    return sessionStorageSet(key, JSON.stringify(value));
  } catch (e) {
    return false;
  }
}

/**
 * Clear all keys matching a prefix from localStorage.
 * @param {string} prefix
 * @returns {number} number of items removed
 */
export function localStorageClearPrefix(prefix) {
  if (!_localOk || !prefix) return 0;
  let count = 0;
  try {
    const keys = Object.keys(window.localStorage).filter(k => k.startsWith(prefix));
    keys.forEach(k => { window.localStorage.removeItem(k); count++; });
  } catch (e) { /* ignore */ }
  return count;
}
