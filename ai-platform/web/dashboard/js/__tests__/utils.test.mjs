import { describe, it } from 'node:test';
import assert from 'node:assert';

import Utils, {
  escapeHtml,
  clamp,
  deepClone,
  fetchWithTimeout,
  copyToClipboard,
  sanitizePrivacyData,
  isVSCodeWebview,
  formatPathLabel,
  prefersReducedMotion,
  getNonce,
  deepFreeze,
  getExportNames,
  exportNames,
  getNamespaceNames,
  getBarrelMeta,
  validateBarrelIntegrity,
  freezeNamespace,
  __barrel__,
  compose,
  pipe,
  zipWith,
  curry,
  partial,
  tap,
  parseJsonSafe,
  parseResponseJson,
  stringifySafe,
} from '../utils.js';

describe('js/utils.js barrel', () => {
  it('flat named exports are functions', () => {
    assert.strictEqual(typeof escapeHtml, 'function');
    assert.strictEqual(typeof clamp, 'function');
    assert.strictEqual(typeof deepClone, 'function');
    assert.strictEqual(typeof fetchWithTimeout, 'function');
    assert.strictEqual(typeof copyToClipboard, 'function');
    assert.strictEqual(typeof sanitizePrivacyData, 'function');
    assert.strictEqual(typeof isVSCodeWebview, 'function');
    assert.strictEqual(typeof formatPathLabel, 'function');
    assert.strictEqual(typeof prefersReducedMotion, 'function');
    assert.strictEqual(typeof getNonce, 'function');
  });

  it('default export is frozen', () => {
    assert.strictEqual(Object.isFrozen(Utils), true);
  });

  it('default export contains all namespaces', () => {
    const expected = [
      'string',
      'number',
      'async',
      'array',
      'object',
      'url',
      'storage',
      'theme',
      'dom',
      'format',
      'type',
      'accessibility',
      'clipboard',
      'crypto',
      'download',
      'fetch',
      'fn',
      'path',
      'privacy',
      'vscode',
      'event',
      'polling',
      'inline',
    ];
    for (const key of expected) {
      assert.ok(Utils[key], `namespace "${key}" should exist`);
      assert.strictEqual(typeof Utils[key], 'object', `namespace "${key}" should be an object`);
    }
  });

  it('getNamespaceNames returns 23 namespaces including inline', () => {
    const names = getNamespaceNames();
    assert.strictEqual(names.length, 23);
    assert.ok(names.includes('inline'), 'inline should be in namespace names');
  });

  it('namespace exports are accessible', () => {
    assert.strictEqual(typeof Utils.string.escapeHtml, 'function');
    assert.strictEqual(typeof Utils.number.clamp, 'function');
    assert.strictEqual(typeof Utils.async.sleep, 'function');
    assert.strictEqual(typeof Utils.array.unique, 'function');
    assert.strictEqual(typeof Utils.object.deepClone, 'function');
    assert.strictEqual(typeof Utils.url.parseQueryString, 'function');
    assert.strictEqual(typeof Utils.storage.localStorageGet, 'function');
    assert.strictEqual(typeof Utils.theme.hexToRgba, 'function');
    assert.strictEqual(typeof Utils.dom.showToast, 'function');
    assert.strictEqual(typeof Utils.format.formatDate, 'function');
    assert.strictEqual(typeof Utils.type.isBlank, 'function');
  });

  it('deepFreeze works on plain objects', async () => {
    const utilsModule = await import('../utils.js');
    assert.strictEqual(Object.isFrozen(Utils), true);
    assert.ok(Utils.string, 'namespace should still be accessible even if not frozen');
  });

  it('deepFreeze is exported as a named export', () => {
    assert.strictEqual(typeof deepFreeze, 'function');
    const obj = { a: { b: 1 } };
    deepFreeze(obj);
    assert.strictEqual(Object.isFrozen(obj), true);
    assert.strictEqual(Object.isFrozen(obj.a), true);
  });

  it('getExportNames returns an array of strings', () => {
    const names = getExportNames();
    assert.ok(Array.isArray(names));
    assert.ok(names.length > 0);
    assert.ok(names.every((n) => typeof n === 'string'));
  });

  it('getExportNames contains expected flat exports', () => {
    const names = getExportNames();
    assert.ok(names.includes('escapeHtml'));
    assert.ok(names.includes('clamp'));
    assert.ok(names.includes('deepClone'));
    assert.ok(names.includes('sleep'));
    assert.ok(names.includes('deepFreeze'));
    assert.ok(names.includes('exportNames'));
    assert.ok(names.includes('stringifySafe'));
  });

  it('getExportNames is frozen', () => {
    const names = getExportNames();
    assert.strictEqual(Object.isFrozen(names), true);
  });

  it('barrel re-exports submodule functions (integrity spot-check)', async () => {
    // Import submodules directly and verify their exports are in getExportNames()
    const stringMod = await import('../utils-lib/string.js');
    const numberMod = await import('../utils-lib/number.js');
    const names = new Set(getExportNames());

    // Spot-check string exports
    assert.ok(names.has('escapeHtml'), 'escapeHtml from string.js should be re-exported');
    assert.ok(names.has('camelCase'), 'camelCase from string.js should be re-exported');

    // Spot-check number exports
    assert.ok(names.has('clamp'), 'clamp from number.js should be re-exported');
    assert.ok(names.has('formatBytes'), 'formatBytes from number.js should be re-exported');

    // Verify getExportNames itself is present
    assert.ok(names.has('getExportNames'), 'getExportNames should be self-listed');
  });

  it('getNamespaceNames returns all 23 namespaces and is frozen', () => {
    const names = getNamespaceNames();
    assert.ok(Array.isArray(names), 'should return an array');
    assert.strictEqual(Object.isFrozen(names), true, 'should be frozen');
    assert.strictEqual(names.length, 23);
    const expected = [
      'string',
      'number',
      'async',
      'array',
      'object',
      'url',
      'storage',
      'theme',
      'dom',
      'format',
      'type',
      'accessibility',
      'clipboard',
      'crypto',
      'download',
      'fetch',
      'fn',
      'path',
      'privacy',
      'vscode',
      'event',
      'polling',
      'inline',
    ];
    for (const ns of expected) {
      assert.ok(names.includes(ns), `should include namespace "${ns}"`);
    }
  });

  it('__barrel__ metadata is present with all fields', () => {
    assert.ok(__barrel__, '__barrel__ should be defined');
    assert.strictEqual(__barrel__.name, 'simplebeacon-dashboard-utils');
    assert.strictEqual(__barrel__.moduleCount, 23);
    assert.ok(typeof __barrel__.exportCount === 'number');
    assert.ok(typeof __barrel__.namespaceCount === 'number');
    assert.strictEqual(__barrel__.version, '1.0.0');
    assert.ok(typeof __barrel__.timestamp === 'string');
    assert.ok(Array.isArray(__barrel__.exports));
    assert.ok(Array.isArray(__barrel__.namespaces));
  });

  it('__barrel__ is attached to default export', () => {
    assert.ok(Utils.__barrel__, 'default export should have __barrel__');
    assert.strictEqual(Utils.__barrel__, __barrel__);
  });

  it('validateBarrelIntegrity passes for healthy barrel', () => {
    const result = validateBarrelIntegrity();
    assert.strictEqual(result.valid, true, `errors: ${result.errors.join(', ')}`);
    assert.deepStrictEqual(result.errors, []);
  });

  it('compose chains functions right-to-left', () => {
    const add1 = (x) => x + 1;
    const double = (x) => x * 2;
    assert.strictEqual(compose(double, add1)(3), 8);
  });

  it('pipe chains functions left-to-right', () => {
    const add1 = (x) => x + 1;
    const double = (x) => x * 2;
    assert.strictEqual(pipe(add1, double)(3), 8);
  });

  it('zipWith applies function to paired elements', () => {
    assert.deepStrictEqual(
      zipWith([1, 2, 3], [4, 5, 6], (a, b) => a + b),
      [5, 7, 9]
    );
  });

  it('curry transforms multi-arg functions', () => {
    const add = curry((a, b, c) => a + b + c);
    assert.strictEqual(add(1)(2)(3), 6);
    assert.strictEqual(add(1, 2)(3), 6);
  });

  it('partial fixes leading arguments', () => {
    const add5 = partial((a, b) => a + b, 5);
    assert.strictEqual(add5(3), 8);
  });

  it('tap runs side effects and returns original value', () => {
    let sideEffect = 0;
    const result = tap(5, (x) => {
      sideEffect = x;
    });
    assert.strictEqual(result, 5);
    assert.strictEqual(sideEffect, 5);
  });

  it('new inline utilities appear in getExportNames', () => {
    const names = getExportNames();
    assert.ok(names.includes('compose'), 'compose should be exported');
    assert.ok(names.includes('pipe'), 'pipe should be exported');
    assert.ok(names.includes('zipWith'), 'zipWith should be exported');
    assert.ok(names.includes('curry'), 'curry should be exported');
    assert.ok(names.includes('partial'), 'partial should be exported');
    assert.ok(names.includes('tap'), 'tap should be exported');
    assert.ok(names.includes('parseJsonSafe'), 'parseJsonSafe should be exported');
    assert.ok(names.includes('parseResponseJson'), 'parseResponseJson should be exported');
    assert.ok(names.includes('stringifySafe'), 'stringifySafe should be exported');
    assert.ok(names.includes('exportNames'), 'exportNames should be exported');
  });

  it('parseJsonSafe, parseResponseJson and stringifySafe are flat named exports', () => {
    const names = getExportNames();
    assert.ok(names.includes('parseJsonSafe'));
    assert.ok(names.includes('parseResponseJson'));
    assert.ok(names.includes('stringifySafe'));
  });

  it('exportNames aliases getExportNames', () => {
    assert.strictEqual(typeof exportNames, 'function');
    assert.deepStrictEqual(exportNames(), getExportNames());
  });

  it('stringifySafe is a flat named export', () => {
    assert.strictEqual(typeof stringifySafe, 'function');
    assert.strictEqual(stringifySafe({ a: 1 }), '{"a":1}');
    assert.strictEqual(
      stringifySafe({
        toJSON() {
          throw new Error('bad');
        },
      }),
      null
    );
  });

  it('freezeNamespace does not mutate inputs and returns frozen copies', () => {
    const map = new Map([['a', { b: 1 }]]);
    const frozen = freezeNamespace(map);
    assert.notStrictEqual(frozen, map);
    assert.strictEqual(Object.isFrozen(frozen), true);
    assert.strictEqual(Object.isFrozen(frozen.get('a')), true);
    assert.strictEqual(map.get('a').b, 1);

    const obj = { nested: { value: 2 } };
    const frozenObj = freezeNamespace(obj);
    assert.notStrictEqual(frozenObj, obj);
    assert.strictEqual(Object.isFrozen(frozenObj), true);
    assert.strictEqual(Object.isFrozen(frozenObj.nested), true);
    assert.strictEqual(Object.isFrozen(obj), false);
  });

  it('getBarrelMeta is a flat named export and exposed on Utils', () => {
    assert.strictEqual(typeof getBarrelMeta, 'function');
    assert.strictEqual(getBarrelMeta(), __barrel__);
    assert.strictEqual(Utils.getBarrelMeta, getBarrelMeta);
    assert.strictEqual(Utils.getBarrelMeta(), __barrel__);
  });
});

describe('util.inline namespace', () => {
  it('Utils.inline exists and is frozen', () => {
    assert.ok(Utils.inline, 'Utils.inline should exist');
    assert.strictEqual(Object.isFrozen(Utils.inline), true);
  });

  it('Utils.inline contains all barrel-native utilities', () => {
    assert.strictEqual(typeof Utils.inline.compose, 'function');
    assert.strictEqual(typeof Utils.inline.pipe, 'function');
    assert.strictEqual(typeof Utils.inline.zipWith, 'function');
    assert.strictEqual(typeof Utils.inline.curry, 'function');
    assert.strictEqual(typeof Utils.inline.partial, 'function');
    assert.strictEqual(typeof Utils.inline.tap, 'function');
    assert.strictEqual(typeof Utils.inline.parseJsonSafe, 'function');
    assert.strictEqual(typeof Utils.inline.parseResponseJson, 'function');
    assert.strictEqual(typeof Utils.inline.stringifySafe, 'function');
  });
});

describe('parseJsonSafe', () => {
  it('parses valid JSON', () => {
    assert.deepStrictEqual(parseJsonSafe('{"a":1}', null), { a: 1 });
  });

  it('returns fallback on invalid JSON', () => {
    assert.strictEqual(parseJsonSafe('not json', 'fallback'), 'fallback');
  });

  it('returns fallback for null input', () => {
    assert.strictEqual(parseJsonSafe(null, 'fallback'), 'fallback');
  });
});

describe('parseResponseJson', () => {
  it('parses JSON response', async () => {
    const res = {
      headers: { get: () => 'application/json' },
      text: async () => '{"a":1}',
    };
    const data = await parseResponseJson(res);
    assert.deepStrictEqual(data, { a: 1 });
  });

  it('returns fallback for non-JSON content type', async () => {
    const res = {
      headers: { get: () => 'text/html' },
      text: async () => '<html></html>',
    };
    const data = await parseResponseJson(res);
    assert.deepStrictEqual(data, {});
  });

  it('returns fallback on JSON parse error', async () => {
    const res = {
      headers: { get: () => 'application/json' },
      text: async () => 'not valid json',
    };
    const data = await parseResponseJson(res, 'fallback');
    assert.strictEqual(data, 'fallback');
  });

  it('returns custom fallback when provided', async () => {
    const res = {
      headers: { get: () => 'application/json' },
      text: async () => '',
    };
    const data = await parseResponseJson(res, { empty: true });
    assert.deepStrictEqual(data, { empty: true });
  });
});
