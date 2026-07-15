import * as path from 'path';
import Utils from '../index';

// Map namespace keys to their source module paths (relative to this test file)
const MODULE_MAP: Record<string, string> = {
  vscode: '../vscode',
  string: '../string',
  number: '../number',
  object: '../object',
  array: '../array',
  async: '../async',
  fs: '../fs',
  network: '../network',
  path: '../path',
  misc: '../misc',
  json: '../json',
  typeGuards: '../type-guards',
  clipboard: '../clipboard',
  theme: '../theme',
  event: '../event',
  polling: '../polling',
  functional: '../functional',
};

describe('Utils namespace integrity', () => {
  for (const [nsKey, modulePath] of Object.entries(MODULE_MAP)) {
    describe(`namespace "${nsKey}"`, () => {
      // Dynamically require the submodule to inspect its exports
      const mod = jest.requireActual(path.join(__dirname, modulePath));
      const ns = (Utils as any)[nsKey];

      test('Utils namespace exists', () => {
        expect(ns).toBeDefined();
        expect(typeof ns).toBe('object');
      });

      test('every submodule export is in Utils namespace', () => {
        const modExports = Object.keys(mod).filter((k) => k !== 'default');
        for (const name of modExports) {
          expect(ns[name]).toBeDefined();
        }
      });

      test('every submodule export is a flat named export from index', () => {
        const indexMod = require('../index');
        const modExports = Object.keys(mod).filter((k) => k !== 'default');
        for (const name of modExports) {
          // Skip type-only exports (they don't exist at runtime)
          if (typeof mod[name] === 'undefined') continue;
          expect(indexMod[name]).toBeDefined();
        }
      });
    });
  }

  test('no export collisions across sub-modules', () => {
    const seen = new Map<string, string>();
    for (const [nsKey, modulePath] of Object.entries(MODULE_MAP)) {
      const mod = jest.requireActual(path.join(__dirname, modulePath));
      for (const name of Object.keys(mod)) {
        if (name === 'default') continue;
        if (seen.has(name)) {
          throw new Error(
            `Export collision detected: "${name}" exists in both "${seen.get(name)}" and "${nsKey}"`
          );
        }
        seen.set(name, nsKey);
      }
    }
    expect(seen.size).toBeGreaterThan(0);
  });
});
