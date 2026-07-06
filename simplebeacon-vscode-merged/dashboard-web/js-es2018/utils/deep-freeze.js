/**
 * Recursively freeze an object and all nested objects.
 * Handles Maps, Sets, Dates, RegExps, WeakMaps, and WeakSets safely.
 * @param {any} obj
 * @returns {any}
 */
export function deepFreeze(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Object.isFrozen(obj)) return obj;
  const ctor = obj.constructor;
  if (ctor === Date || ctor === RegExp || ctor === WeakMap || ctor === WeakSet) return obj;
  if (ctor === Map) {
    for (const [k, v] of obj) obj.set(k, deepFreeze(v));
    return Object.freeze(obj);
  }
  if (ctor === Set) {
    const frozenSet = new Set();
    for (const v of obj) frozenSet.add(deepFreeze(v));
    return Object.freeze(frozenSet);
  }
  try { Object.freeze(obj); } catch { return obj; }
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}
