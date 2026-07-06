/**
 * Recursively freeze an object and all nested objects.
 * @param {any} obj
 * @returns {any}
 */
function deepFreeze(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Object.isFrozen(obj)) return obj;
  try {
    Object.freeze(obj);
  } catch {
    return obj;
  }
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

module.exports = { deepFreeze };
