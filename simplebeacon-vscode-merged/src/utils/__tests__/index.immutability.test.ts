import Utils, { freezeNamespace } from '../index';

describe('Utils namespace immutability', () => {
  test('root Utils object is frozen', () => {
    expect(Object.isFrozen(Utils)).toBe(true);
  });

  test('nested category objects are frozen', () => {
    expect(Object.isFrozen(Utils.vscode)).toBe(true);
    expect(Object.isFrozen(Utils.string)).toBe(true);
    expect(Object.isFrozen(Utils.number)).toBe(true);
    expect(Object.isFrozen(Utils.object)).toBe(true);
    expect(Object.isFrozen(Utils.array)).toBe(true);
    expect(Object.isFrozen(Utils.async)).toBe(true);
    expect(Object.isFrozen(Utils.fs)).toBe(true);
    expect(Object.isFrozen(Utils.network)).toBe(true);
    expect(Object.isFrozen(Utils.path)).toBe(true);
    expect(Object.isFrozen(Utils.misc)).toBe(true);
    expect(Object.isFrozen(Utils.json)).toBe(true);
    expect(Object.isFrozen(Utils.typeGuards)).toBe(true);
    expect(Object.isFrozen(Utils.clipboard)).toBe(true);
    expect(Object.isFrozen(Utils.theme)).toBe(true);
    expect(Object.isFrozen(Utils.event)).toBe(true);
    expect(Object.isFrozen(Utils.polling)).toBe(true);
  });

  test('mutating frozen Utils throws in strict mode', () => {
    const originalKeys = Object.keys(Utils);
    // mutation should throw at runtime in strict mode
    expect(() => { (Utils as any).newProp = 'should-not-stick'; }).toThrow();
    expect(Object.keys(Utils)).toEqual(originalKeys);
    expect((Utils as any).newProp).toBeUndefined();
  });

  test('freezeNamespace recursively freezes nested objects', () => {
    const ns = freezeNamespace({
      obj: { nested: { value: 1 } },
      arr: [1, 2, { three: 3 }],
    });
    expect(Object.isFrozen(ns.obj)).toBe(true);
    expect(Object.isFrozen(ns.obj.nested)).toBe(true);
    expect(Object.isFrozen(ns.arr)).toBe(true);
    expect(Object.isFrozen(ns.arr[2])).toBe(true);
  });

  test('freezeNamespace handles Map and Set', () => {
    const map = new Map([['a', { b: 1 }]]);
    const set = new Set([{ c: 2 }]);
    const ns = freezeNamespace({ map, set });
    expect(Object.isFrozen(ns.map)).toBe(true);
    expect(Object.isFrozen(ns.set)).toBe(true);
    expect(Object.isFrozen(ns.map.get('a'))).toBe(true);
    expect(Object.isFrozen([...ns.set][0])).toBe(true);
  });

  test('freezeNamespace handles circular references', () => {
    const obj: any = { a: 1 };
    obj.self = obj;
    const ns = freezeNamespace({ obj });
    expect(Object.isFrozen(ns.obj)).toBe(true);
    expect(ns.obj.self).toBe(ns.obj);
  });
});
