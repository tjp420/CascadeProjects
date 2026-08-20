// SimpleBeacon dashboard site config stub
if (typeof window !== 'undefined' && !window.__SB_SITE_CONFIG__) {
    Object.defineProperty(window, '__SB_SITE_CONFIG__', {
        value: Object.freeze({
            features: Object.freeze({ scan: true, analyze: true, upload: true }),
            version: '1.0.0',
            env: 'development'
        }),
        writable: false,
        configurable: false
    });
}
