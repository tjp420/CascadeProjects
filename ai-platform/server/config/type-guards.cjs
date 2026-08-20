/**
 * Type-checking guard functions.
 * @module type-guards
 */

function isNull(value) {
  return value === null;
}

function isUndefined(value) {
  return value === undefined;
}

function isNil(value) {
  return value == null;
}

function isSymbol(value) {
  return typeof value === "symbol";
}

function isMap(value) {
  return value instanceof Map;
}

function isSet(value) {
  return value instanceof Set;
}

module.exports = Object.freeze({
  isNull,
  isUndefined,
  isNil,
  isSymbol,
  isMap,
  isSet,
});
