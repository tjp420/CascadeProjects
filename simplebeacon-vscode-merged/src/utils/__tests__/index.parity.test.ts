import * as fs from 'fs';
import * as path from 'path';
import Utils from '../index';

/**
 * Parse namespace keys from the barrel source.
 * Handles both explicit re-exports and export * / import * patterns.
 * Returns a map: namespaceKey -> Set<exportName>
 */
function parseFlatExports(source: string): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();

  // Derive namespace keys from import * as X from './module' and export * from './module'
  const importMatches = source.matchAll(/import\s+\*\s+as\s+\w+\s+from\s+['"]\.\/([^'"]+)['"]/g);
  const starMatches = source.matchAll(/export\s+\*\s*from\s+['"]\.\/([^'"]+)['"]/g);
  for (const m of [...importMatches, ...starMatches]) {
    const moduleName = m[1];
    const nsKey = moduleName === 'type-guards' ? 'typeGuards' : moduleName;
    if (!result.has(nsKey)) {
      result.set(nsKey, new Set());
    }
  }

  // Also capture explicit re-exports: export const x = ModuleName.x;
  const matches = source.matchAll(/export\s+const\s+(\w+)\s*=\s*(\w+)\.\w+/g);
  for (const m of matches) {
    const name = m[1];
    const nsVar = m[2];
    const nsKey = nsVar.replace(/Utils$/, '').toLowerCase();
    const finalKey = nsKey === 'typeguard' ? 'typeGuards' : nsKey === 'vscode' ? 'vscode' : nsKey;
    if (!result.has(finalKey)) {
      result.set(finalKey, new Set());
    }
    result.get(finalKey)!.add(name);
  }
  return result;
}

/**
 * Build a map of flatExportName -> { namespaceKey }
 * by resolving each namespace variable to its key in Utils.
 */
function buildExpectedNamespaceMap(flatExports: Map<string, Set<string>>): Map<string, { ns: string }> {
  const map = new Map<string, { ns: string }>();
  for (const [nsKey, names] of flatExports) {
    for (const name of names) {
      map.set(name, { ns: nsKey });
    }
  }
  return map;
}

describe('Utils export parity', () => {
  const barrelPath = path.join(__dirname, '..', 'index.ts');
  const source = fs.readFileSync(barrelPath, 'utf-8');
  const flatExports = parseFlatExports(source);
  const expectedMap = buildExpectedNamespaceMap(flatExports);

  test('every flat export exists in the Utils namespace', () => {
    for (const [name, { ns }] of expectedMap) {
      expect((Utils as any)[ns][name]).toBeDefined();
    }
  });

  test('Utils namespace keys match barrel modules', () => {
    const nsKeys = Object.keys(Utils).sort();
    const moduleKeys = Array.from(flatExports.keys()).sort();
    // inline namespace is defined in barrel, not from a module
    expect(nsKeys.filter((k) => k !== 'inline' && k !== '__barrel__')).toEqual(moduleKeys);
  });
});
