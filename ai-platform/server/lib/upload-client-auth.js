/**
 * Resolve JWT for upload API calls from browser storage keys.
 * Shared by client upload service and unit tests.
 */
function resolveUploadAuthToken(storage = null) {
    const read = (store, key) => {
        try {
            return store?.getItem?.(key) || null;
        } catch {
            return null;
        }
    };

    const stores = [];
    if (storage) {
        stores.push(storage);
    } else if (typeof window !== 'undefined') {
        if (window.localStorage) stores.push(window.localStorage);
        if (window.sessionStorage) stores.push(window.sessionStorage);
    }

    const keys = ['access_token', 'token', 'authToken'];
    for (const store of stores) {
        for (const key of keys) {
            const value = read(store, key);
            if (value) return value;
        }
    }
    return null;
}

module.exports = { resolveUploadAuthToken };
