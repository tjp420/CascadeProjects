/**
 * type utilities.
 */


/**
 * Type guard: returns true if the value is neither null nor undefined.
 * @template T
 * @param {T | null | undefined} value
 * @returns {value is T}
 */
export function isDefined(value) {
  return value !== null && value !== undefined;
}


/** Type guard: value is null.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNull(value) {
  return value === null;
}


/** Type guard: value is undefined.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isUndefined(value) {
  return value === undefined;
}


/** Type guard: value is null or undefined.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNil(value) {
  return value == null;
}


/** Type guard: value is a symbol.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSymbol(value) {
  return typeof value === 'symbol';
}


/** Type guard: value is a Map.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isMap(value) {
  return value instanceof Map;
}


/** Type guard: value is a Set.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSet(value) {
  return value instanceof Set;
}

