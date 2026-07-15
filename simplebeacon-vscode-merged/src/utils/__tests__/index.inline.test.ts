import * as fs from 'fs';
import * as path from 'path';
import { Utils, getInlineSelection } from '../index';

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

describe('Utils inline namespace parity', () => {
  const inline = Utils.inline as unknown as Record<string, unknown>;

  test('every inline utility that exists in a submodule matches the submodule export', () => {
    const failures: string[] = [];
    const inlineKeys = Object.keys(inline).filter((k) => k !== '__barrel__');

    for (const key of inlineKeys) {
      const value = inline[key];
      let found = false;
      for (const modulePath of Object.values(MODULE_MAP)) {
        const mod = jest.requireActual(path.join(__dirname, modulePath));
        if (Object.prototype.hasOwnProperty.call(mod, key) && mod[key] === value) {
          found = true;
          break;
        }
      }
      if (!found) {
        // It is OK if the key is barrel-native (not mirrored from a submodule)
        const nativeKeys = new Set([
          'getExportNames',
          'getNamespaceNames',
          'getBarrelMeta',
          'getCollisionCount',
          'getInlineSelection',
          'freezeNamespace',
          'validateBarrelIntegrity',
          'integrityTest',
        ]);
        if (!nativeKeys.has(key)) {
          failures.push(`"${key}" does not reference the same export as any submodule`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  test('inline namespace is frozen', () => {
    expect(Object.isFrozen(Utils.inline)).toBe(true);
  });

  test('inline namespace contains newly exposed helpers', () => {
    expect(typeof Utils.inline.parseResponseJson).toBe('function');
    expect(typeof Utils.inline.getFileHashAsync).toBe('function');
    expect(typeof Utils.inline.writeTextFile).toBe('function');
    expect(typeof Utils.inline.isBoolean).toBe('function');
    expect(typeof Utils.inline.values).toBe('function');
    expect(typeof Utils.inline.hexToRgba).toBe('function');
    expect(typeof Utils.inline.waitForAsync).toBe('function');
    expect(typeof Utils.inline.retryWithBackoff).toBe('function');
  });

  test('every entry in getInlineSelection exists on Utils.inline and matches its submodule', () => {
    const selection = getInlineSelection();
    const failures: string[] = [];
    const inlineRecord = Utils.inline as unknown as Record<string, unknown>;

    for (const [nsKey, names] of Object.entries(selection)) {
      const modulePath = MODULE_MAP[nsKey];
      if (!modulePath) {
        failures.push(`missing MODULE_MAP entry for namespace "${nsKey}"`);
        continue;
      }
      const mod = jest.requireActual(path.join(__dirname, modulePath));
      for (const name of names) {
        if (!Object.prototype.hasOwnProperty.call(inlineRecord, name)) {
          failures.push(`"${name}" from "${nsKey}" is missing on Utils.inline`);
        } else if (inlineRecord[name] !== mod[name]) {
          failures.push(`"${name}" on Utils.inline does not reference ${nsKey}.${name}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  test('waitForAsync resolves when predicate returns true', async () => {
    let value = false;
    const promise = (
      Utils.inline.waitForAsync as (
        predicate: () => Promise<boolean>,
        intervalMs: number,
        timeoutMs: number
      ) => Promise<void>
    )(() => Promise.resolve(value), 10, 500);
    await sleep(50);
    value = true;
    await expect(promise).resolves.toBeUndefined();
  });

  test('waitForAsync rejects when predicate never returns true', async () => {
    await expect(
      (
        Utils.inline.waitForAsync as (
          predicate: () => Promise<boolean>,
          intervalMs: number,
          timeoutMs: number
        ) => Promise<void>
      )(() => Promise.resolve(false), 10, 50)
    ).rejects.toThrow('Timeout waiting for condition');
  });

  test('retryWithBackoff returns result on first success', async () => {
    const result = await (
      Utils.inline.retryWithBackoff as <T>(fn: () => Promise<T>, maxRetries: number, baseDelay: number) => Promise<T>
    )(() => Promise.resolve(42), 0, 10);
    expect(result).toBe(42);
  });

  test('retryWithBackoff retries until success', async () => {
    let attempts = 0;
    const result = await (
      Utils.inline.retryWithBackoff as <T>(fn: () => Promise<T>, maxRetries: number, baseDelay: number) => Promise<T>
    )(
      () => {
        attempts++;
        if (attempts < 3) return Promise.reject(new Error('not yet'));
        return Promise.resolve('ok');
      },
      5,
      10
    );
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  test('every public flat export from utils.ts is reachable on Utils.inline', () => {
    const utilsSrc = fs.readFileSync(path.resolve(__dirname, '../../../src/utils.ts'), 'utf8');
    const selection = getInlineSelection();
    const failures: string[] = [];

    const nsKeyFromModule = (moduleName: string): string => (moduleName === 'type-guards' ? 'typeGuards' : moduleName);

    // Re-exported utilities from submodules (skip barrel-native index re-exports)
    const reExportBlocks = utilsSrc.matchAll(/export\s*\{([^}]+)\}\s*from\s*['"]\.\/utils\/([\w-]+)['"]/g);
    for (const block of reExportBlocks) {
      const moduleName = block[2];
      if (moduleName === 'index') continue;
      const nsKey = nsKeyFromModule(moduleName);
      const names = block[1]
        .split(',')
        .map((raw) =>
          raw
            .trim()
            .split(/\s+as\s+/)
            .pop()
            ?.trim()
        )
        .filter((name): name is string => Boolean(name));
      const selected = (selection as Record<string, readonly string[]>)[nsKey] || [];
      for (const name of names) {
        if (/^[A-Z]/.test(name)) continue; // type-only exports
        if (!selected.includes(name)) {
          failures.push(
            `"${name}" is exported by utils.ts from ./utils/${moduleName} but missing from _inlineSelection.${nsKey}`
          );
        }
      }
    }

    // Barrel-native re-exports from index.ts
    const inlineRecord = Utils.inline as unknown as Record<string, unknown>;
    const barrelReExports = utilsSrc.matchAll(/export\s*\{([^}]+)\}\s*from\s*['"]\.\/utils\/index['"]/g);
    for (const block of barrelReExports) {
      const names = block[1]
        .split(',')
        .map((raw) =>
          raw
            .trim()
            .split(/\s+as\s+/)
            .pop()
            ?.trim()
        )
        .filter((name): name is string => Boolean(name));
      for (const name of names) {
        if (/^[A-Z]/.test(name)) continue; // type-only exports
        if (name === 'Utils' || name === '__barrel__') continue; // namespace objects
        if (typeof inlineRecord[name] !== 'function') {
          failures.push(`"${name}" is re-exported by utils.ts from ./utils/index but missing from Utils.inline`);
        }
      }
    }

    expect(failures).toEqual([]);
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
