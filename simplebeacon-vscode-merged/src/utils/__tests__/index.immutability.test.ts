import Utils from '../index';

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
  });

  test('mutating frozen Utils is silently ignored or throws', () => {
    const originalKeys = Object.keys(Utils);
    // @ts-expect-error — mutation should be ignored at runtime
    Utils.newProp = 'should-not-stick';
    expect(Object.keys(Utils)).toEqual(originalKeys);
    expect((Utils as any).newProp).toBeUndefined();
  });
});
