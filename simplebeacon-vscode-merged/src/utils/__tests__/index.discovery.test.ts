import {
  getExportNames, getNamespaceNames, freezeNamespace,
  validateBarrelIntegrity, __barrel__, Utils
} from '../index';

describe('getExportNames discovery helper', () => {
  test('returns an array of strings', () => {
    const names = getExportNames();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => typeof n === 'string')).toBe(true);
  });

  test('contains expected flat exports', () => {
    const names = getExportNames();
    expect(names).toContain('escapeHtml');
    expect(names).toContain('clamp');
    expect(names).toContain('deepClone');
    expect(names).toContain('sleep');
    expect(names).toContain('freezeNamespace');
    expect(names).toContain('getExportNames');
    expect(names).toContain('once');
    expect(names).toContain('noop');
    expect(names).toContain('identity');
  });

  test('returned array is frozen', () => {
    const names = getExportNames();
    expect(Object.isFrozen(names)).toBe(true);
  });

  test('auto-generation includes exports from every sub-module', () => {
    const names = getExportNames();
    expect(names).toContain('getNonce');       // vscode
    expect(names).toContain('escapeHtml');     // string
    expect(names).toContain('clamp');          // number
    expect(names).toContain('deepClone');      // object
    expect(names).toContain('unique');         // array
    expect(names).toContain('sleep');          // async
    expect(names).toContain('sha256');         // fs
    expect(names).toContain('isValidUrl');     // network
    expect(names).toContain('relativePath');  // path
    expect(names).toContain('noop');           // misc
    expect(names).toContain('parseJsonSafe');  // json
    expect(names).toContain('isDefined');      // typeGuards
    expect(names).toContain('compose');        // inline
  });
});

describe('freezeNamespace exported utility', () => {
  test('freezes every property of a namespace', () => {
    const ns = freezeNamespace({
      a: { x: 1 },
      b: { y: 2 },
    });
    expect(Object.isFrozen(ns)).toBe(true);
    expect(Object.isFrozen(ns.a)).toBe(true);
    expect(Object.isFrozen(ns.b)).toBe(true);
  });

  test('gracefully handles unfreezable objects', () => {
    // Simulating an unfreezable namespace object by mocking Object.freeze to throw
    const originalFreeze = Object.freeze;
    let callCount = 0;
    Object.freeze = (obj: any) => {
      callCount++;
      if (callCount === 1) throw new Error('Cannot freeze');
      return originalFreeze(obj);
    };

    try {
      const ns = freezeNamespace({
        a: { x: 1 } as any,
        b: { y: 2 } as any,
      });
      // The first child couldn't be frozen, but the second should be
      expect(ns.a).toEqual({ x: 1 });
      expect(ns.b).toBeDefined();
    } finally {
      Object.freeze = originalFreeze;
    }
  });
});

describe('getNamespaceNames discovery helper', () => {
  test('returns an array of strings', () => {
    const names = getNamespaceNames();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => typeof n === 'string')).toBe(true);
  });

  test('contains expected namespaces', () => {
    const names = getNamespaceNames();
    expect(names).toContain('vscode');
    expect(names).toContain('string');
    expect(names).toContain('number');
    expect(names).toContain('object');
    expect(names).toContain('array');
    expect(names).toContain('async');
    expect(names).toContain('fs');
    expect(names).toContain('network');
    expect(names).toContain('path');
    expect(names).toContain('misc');
    expect(names).toContain('json');
    expect(names).toContain('typeGuards');
    expect(names).toContain('functional');
    expect(names).toContain('inline');
  });

  test('returns 18 namespaces including inline', () => {
    expect(getNamespaceNames().length).toBe(18);
  });

  test('returned array is frozen', () => {
    const names = getNamespaceNames();
    expect(Object.isFrozen(names)).toBe(true);
  });
});

describe('__barrel__ metadata', () => {
  test('__barrel__ is defined and frozen', () => {
    expect(__barrel__).toBeDefined();
    expect(Object.isFrozen(__barrel__)).toBe(true);
  });

  test('__barrel__ has all required metadata fields', () => {
    expect(__barrel__.name).toBe('simplebeacon-utils-barrel');
    expect(typeof __barrel__.description).toBe('string');
    expect(__barrel__.moduleCount).toBe(17);
    expect(typeof __barrel__.exportCount).toBe('number');
    expect(typeof __barrel__.namespaceCount).toBe('number');
    expect(__barrel__.namespaceCount).toBe(18);
    expect(__barrel__.version).not.toBe('1.0.0');
    expect(typeof __barrel__.version).toBe('string');
    expect(__barrel__.version.split('.').length).toBeGreaterThanOrEqual(2);
    expect(typeof __barrel__.timestamp).toBe('string');
    expect(Date.parse(__barrel__.timestamp)).toBeGreaterThan(0);
    expect(typeof __barrel__.platform).toBe('string');
    expect(__barrel__.platform.length).toBeGreaterThan(0);
    expect(typeof __barrel__.nodeVersion).toBe('string');
    expect(__barrel__.nodeVersion.startsWith('v')).toBe(true);
    expect(Array.isArray(__barrel__.exports)).toBe(true);
    expect(Array.isArray(__barrel__.namespaces)).toBe(true);
  });

  test('__barrel__ is attached to Utils default export', () => {
    expect((Utils as unknown as Record<string, unknown>).__barrel__).toBeDefined();
    expect((Utils as unknown as Record<string, unknown>).__barrel__).toBe(__barrel__);
  });
});

describe('validateBarrelIntegrity', () => {
  test('passes for healthy barrel', () => {
    const result = validateBarrelIntegrity();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('is exported as a function', () => {
    expect(typeof validateBarrelIntegrity).toBe('function');
  });
});

describe('inline namespace', () => {
  test('exists on Utils default export and is frozen', () => {
    expect((Utils as any).inline).toBeDefined();
    expect(Object.isFrozen((Utils as any).inline)).toBe(true);
  });

  test('contains all barrel-native utilities', () => {
    expect(typeof (Utils as any).inline.compose).toBe('function');
    expect(typeof (Utils as any).inline.pipe).toBe('function');
    expect(typeof (Utils as any).inline.zipWith).toBe('function');
    expect(typeof (Utils as any).inline.curry).toBe('function');
    expect(typeof (Utils as any).inline.partial).toBe('function');
    expect(typeof (Utils as any).inline.tap).toBe('function');
    expect(typeof (Utils as any).inline.once).toBe('function');
    expect(typeof (Utils as any).inline.identity).toBe('function');
    expect(typeof (Utils as any).inline.constant).toBe('function');
    expect(typeof (Utils as any).inline.negate).toBe('function');
    expect(typeof (Utils as any).inline.flow).toBe('function');
    expect(typeof (Utils as any).inline.noop).toBe('function');
  });

  test('compose chains right-to-left', () => {
    const add1 = (x: number) => x + 1;
    const double = (x: number) => x * 2;
    expect((Utils as any).inline.compose(add1, double)(3)).toBe(7);
  });

  test('pipe chains left-to-right', () => {
    const add1 = (x: number) => x + 1;
    const double = (x: number) => x * 2;
    expect((Utils as any).inline.pipe(add1, double)(3)).toBe(8);
  });

  test('zipWith applies function to paired elements', () => {
    expect((Utils as any).inline.zipWith([1, 2], [3, 4], (a: number, b: number) => a + b)).toEqual([4, 6]);
  });

  test('tap runs side effects and returns original value', () => {
    let sideEffect = 0;
    const result = (Utils as any).inline.tap(5, (x: number) => { sideEffect = x; });
    expect(result).toBe(5);
    expect(sideEffect).toBe(5);
  });

  test('parseResponseJson is exported as flat name', () => {
    const names = getExportNames();
    expect(names).toContain('parseResponseJson');
  });
});
