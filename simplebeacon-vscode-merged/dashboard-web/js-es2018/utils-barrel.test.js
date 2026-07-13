/**
 * @module utils-barrel.test
 * DOM-stubbed test that imports the full utils.js barrel and exercises its public API.
 * Run with: node --test js-es2018/utils-barrel.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

function makeStorage() {
    const store = new Map();
    return {
        getItem(key) { return store.has(key) ? String(store.get(key)) : null; },
        setItem(key, value) { store.set(String(key), String(value)); },
        removeItem(key) { store.delete(key); },
        clear() { store.clear(); },
        key(index) { return [...store.keys()][index] ?? null; },
        get length() { return store.size; }
    };
}

function defineGlobal(key, value) {
    try {
        Object.defineProperty(globalThis, key, { value, writable: true, configurable: true, enumerable: true });
    } catch {
        globalThis[key] = value;
    }
}

function setupDomStubs() {
    defineGlobal('window', globalThis);
    defineGlobal('document', {
        createElement: () => ({ className: '', classList: { add() {}, remove() {}, toggle() {} }, style: {}, appendChild() {}, setAttribute() {}, getAttribute: () => null, addEventListener() {}, removeEventListener() {}, textContent: '', innerHTML: '', querySelector: () => null, querySelectorAll: () => [] }),
        body: { appendChild() {}, removeChild() {} },
        documentElement: { classList: { add() {}, remove() {} } },
        addEventListener() {},
        removeEventListener() {},
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementById: () => null,
        hidden: false
    });
    defineGlobal('localStorage', makeStorage());
    defineGlobal('sessionStorage', makeStorage());
    defineGlobal('matchMedia', (query) => ({
        matches: false,
        media: query,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {}
    }));
    defineGlobal('fetch', () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(''), json: () => Promise.resolve({}), headers: new Map() }));
    defineGlobal('AbortController', class AbortController {
        constructor() { this.signal = { aborted: false, addEventListener() {}, removeEventListener() {} }; }
        abort() { this.signal.aborted = true; }
    });
    defineGlobal('requestAnimationFrame', (cb) => setTimeout(cb, 0));
    defineGlobal('cancelAnimationFrame', (id) => clearTimeout(id));
    defineGlobal('navigator', { onLine: true, clipboard: undefined });
    defineGlobal('URL', URL);
    defineGlobal('location', { href: 'http://localhost/', origin: 'http://localhost' });
}

describe('utils barrel', () => {
    it('imports without throwing and has all expected exports', async () => {
        setupDomStubs();
        const utils = await import('./utils.js');

        assert.strictEqual(typeof utils.integrityTest, 'function');
        assert.strictEqual(typeof utils.escapeHtml, 'function');
        assert.strictEqual(typeof utils.formatNumber, 'function');
        assert.strictEqual(typeof utils.showToast, 'function');
        assert.strictEqual(typeof utils.deepFreeze, 'function');
        assert.strictEqual(typeof utils.getExportNames, 'function');
        assert.strictEqual(typeof utils.getBarrelMeta, 'function');
        assert.ok(utils.__barrel__);
        assert.ok(Array.isArray(utils.__barrel__.exports));
        assert.ok(utils.__barrel__.exports.length > 200);

        const result = utils.integrityTest();
        assert.strictEqual(result.passed, true, 'integrityTest failures: ' + result.failures.join(', '));
    });

    it('barrel metadata is well-formed', async () => {
        setupDomStubs();
        const utils = await import('./utils.js');
        assert.ok(utils.__barrel__);
        assert.strictEqual(typeof utils.__barrel__.name, 'string');
        assert.strictEqual(typeof utils.__barrel__.version, 'string');
        assert.ok(Array.isArray(utils.__barrel__.exports));
        assert.ok(utils.__barrel__.exports.length > 200);
        assert.ok(Array.isArray(utils.__barrel__.namespaces));
    });

    it('default export exposes all namespaces', async () => {
        setupDomStubs();
        const utils = await import('./utils.js');
        assert.ok(utils.default);
        ['string', 'number', 'async', 'array', 'object', 'format', 'dom', 'type', 'functional', 'storage', 'url', 'misc'].forEach(ns => {
            assert.ok(utils.default[ns], 'missing namespace: ' + ns);
        });
    });
});
