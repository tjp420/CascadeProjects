import { describe, it } from 'node:test';
import assert from 'node:assert';

import Utils, {
  compose, pipe, zipWith, curry, partial, tap,
  parseJsonSafe, parseResponseJson, stringifySafe,
  getExportNames, exportNames, getNamespaceNames, validateBarrelIntegrity, __barrel__,
  getFacadeMeta, escapeHtml, clamp, deepClone
} from '../utils.js';

describe('dashboard-web/js/utils.js barrel', () => {
  it('getExportNames returns a frozen array of strings', () => {
    const names = getExportNames();
    assert.ok(Array.isArray(names));
    assert.ok(names.length > 0);
    assert.ok(names.every((n) => typeof n === 'string'));
    assert.strictEqual(Object.isFrozen(names), true);
  });

  it('getExportNames includes barrel-native utilities', () => {
    const names = getExportNames();
    assert.ok(names.includes('compose'));
    assert.ok(names.includes('pipe'));
    assert.ok(names.includes('zipWith'));
    assert.ok(names.includes('curry'));
    assert.ok(names.includes('partial'));
    assert.ok(names.includes('tap'));
    assert.ok(names.includes('parseJsonSafe'));
    assert.ok(names.includes('parseResponseJson'));
    assert.ok(names.includes('getExportNames'));
    assert.ok(names.includes('exportNames'));
    assert.ok(names.includes('getNamespaceNames'));
    assert.ok(names.includes('validateBarrelIntegrity'));
    assert.ok(names.includes('setDefaultBarrel'));
    assert.ok(names.includes('__barrel__'));
    assert.ok(names.includes('stringifySafe'));
  });

  it('__barrel__ metadata has all required fields', () => {
    assert.ok(__barrel__);
    assert.strictEqual(__barrel__.name, 'simplebeacon-dashboard-utils');
    assert.ok(typeof __barrel__.exportCount === 'number');
    assert.ok(typeof __barrel__.namespaceCount === 'number');
    assert.strictEqual(__barrel__.version, '1.0.0');
    assert.ok(typeof __barrel__.timestamp === 'string');
    assert.ok(Array.isArray(__barrel__.exports));
    assert.ok(Array.isArray(__barrel__.namespaces));
  });

  it('__barrel__ has correct moduleCount and namespaceCount', () => {
    assert.strictEqual(__barrel__.moduleCount, 15);
    assert.strictEqual(__barrel__.namespaceCount, 15);
  });

  it('__barrel__ is attached to default export', () => {
    assert.strictEqual(Utils.__barrel__, __barrel__);
  });

  it('validateBarrelIntegrity passes', () => {
    const result = validateBarrelIntegrity();
    assert.strictEqual(result.valid, true, `errors: ${result.errors.join(', ')}`);
    assert.deepStrictEqual(result.errors, []);
  });

  it('default export is frozen', () => {
    assert.strictEqual(Object.isFrozen(Utils), true);
  });

  it('default export contains all namespaces', () => {
    const expected = [
      'string', 'number', 'async', 'array', 'object', 'format', 'dom', 'type',
      'functional', 'storage', 'url', 'misc', 'safeStorage', 'eventBus', 'inline'
    ];
    for (const key of expected) {
      assert.ok(Utils[key], `namespace "${key}" should exist`);
      assert.strictEqual(typeof Utils[key], 'object', `namespace "${key}" should be an object`);
    }
  });

  it('inline namespace contains barrel-native utilities', () => {
    assert.ok(Utils.inline);
    assert.strictEqual(typeof Utils.inline.compose, 'function');
    assert.strictEqual(typeof Utils.inline.pipe, 'function');
    assert.strictEqual(typeof Utils.inline.zipWith, 'function');
    assert.strictEqual(typeof Utils.inline.curry, 'function');
    assert.strictEqual(typeof Utils.inline.partial, 'function');
    assert.strictEqual(typeof Utils.inline.tap, 'function');
    assert.strictEqual(typeof Utils.inline.parseJsonSafe, 'function');
    assert.strictEqual(typeof Utils.inline.parseResponseJson, 'function');
    assert.strictEqual(typeof Utils.inline.stringifySafe, 'function');
    assert.strictEqual(Object.isFrozen(Utils.inline), true);
  });

  it('getNamespaceNames returns frozen array with 15 namespaces including inline', () => {
    const names = getNamespaceNames();
    assert.ok(Array.isArray(names));
    assert.strictEqual(names.length, 15);
    assert.ok(names.includes('inline'));
    assert.strictEqual(Object.isFrozen(names), true);
  });

  it('compose chains right-to-left', () => {
    const add1 = (x) => x + 1;
    const double = (x) => x * 2;
    assert.strictEqual(compose(double, add1)(3), 8);
  });

  it('pipe chains left-to-right', () => {
    const add1 = (x) => x + 1;
    const double = (x) => x * 2;
    assert.strictEqual(pipe(add1, double)(3), 8);
  });

  it('flat named exports are accessible', () => {
    assert.strictEqual(typeof escapeHtml, 'function');
    assert.strictEqual(typeof clamp, 'function');
    assert.strictEqual(typeof deepClone, 'function');
  });

  it('facade metadata is available via getFacadeMeta and default export', () => {
    assert.strictEqual(typeof getFacadeMeta, 'function');
    assert.strictEqual(Utils.getFacadeMeta, getFacadeMeta);
    assert.strictEqual(Object.isFrozen(getFacadeMeta()), true);
    assert.strictEqual(Utils.__facade__, getFacadeMeta());
  });

  it('stringifySafe is a flat named export', () => {
    assert.strictEqual(typeof stringifySafe, 'function');
    assert.strictEqual(stringifySafe({ a: 1 }), '{"a":1}');
    assert.strictEqual(stringifySafe({ toJSON() { throw new Error('bad'); } }), null);
  });

  it('exportNames aliases getExportNames', () => {
    assert.strictEqual(typeof exportNames, 'function');
    assert.deepStrictEqual(exportNames(), getExportNames());
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
      text: async () => '{"a":1}'
    };
    const data = await parseResponseJson(res);
    assert.deepStrictEqual(data, { a: 1 });
  });

  it('returns fallback for non-JSON content type', async () => {
    const res = {
      headers: { get: () => 'text/html' },
      text: async () => '<html></html>'
    };
    const data = await parseResponseJson(res);
    assert.deepStrictEqual(data, {});
  });

  it('returns fallback on JSON parse error', async () => {
    const res = {
      headers: { get: () => 'application/json' },
      text: async () => 'not valid json'
    };
    const data = await parseResponseJson(res, 'fallback');
    assert.strictEqual(data, 'fallback');
  });

  it('returns custom fallback when body empty', async () => {
    const res = {
      headers: { get: () => 'application/json' },
      text: async () => ''
    };
    const data = await parseResponseJson(res, { empty: true });
    assert.deepStrictEqual(data, { empty: true });
  });
});
