/**
 * @module storage
 */

export function localStorageGet(key, fallback) {
    if (typeof window === 'undefined' || !window.localStorage)
        return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        if (raw === null)
            return fallback;
        return JSON.parse(raw);
    }
    catch (_a) {
        return fallback;
    }
}

export function localStorageSet(key, value) {
    if (typeof window === 'undefined' || !window.localStorage)
        return false;
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
    }
    catch (_a) {
        return false;
    }
}

export function localStorageRemove(key) {
    if (typeof window === 'undefined' || !window.localStorage)
        return false;
    try {
        window.localStorage.removeItem(key);
        return true;
    }
    catch (_a) {
        return false;
    }
}

export function localStorageGetString(key, fallback) {
    if (typeof window === 'undefined' || !window.localStorage)
        return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        if (raw === null)
            return fallback;
        return raw;
    }
    catch (_a) {
        return fallback;
    }
}

export function localStorageSetString(key, value) {
    if (typeof window === 'undefined' || !window.localStorage)
        return false;
    try {
        window.localStorage.setItem(key, String(value));
        return true;
    }
    catch (_a) {
        return false;
    }
}

export function sessionStorageGet(key, fallback) {
    if (typeof window === 'undefined' || !window.sessionStorage)
        return fallback;
    try {
        const raw = window.sessionStorage.getItem(key);
        if (raw === null)
            return fallback;
        return JSON.parse(raw);
    }
    catch (_a) {
        return fallback;
    }
}

export function sessionStorageSet(key, value) {
    if (typeof window === 'undefined' || !window.sessionStorage)
        return false;
    try {
        window.sessionStorage.setItem(key, JSON.stringify(value));
        return true;
    }
    catch (_a) {
        return false;
    }
}

export function sessionStorageRemove(key) {
    if (typeof window === 'undefined' || !window.sessionStorage)
        return false;
    try {
        window.sessionStorage.removeItem(key);
        return true;
    }
    catch (_a) {
        return false;
    }
}
