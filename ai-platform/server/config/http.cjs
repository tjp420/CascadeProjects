/**
 * HTTP status codes and predicates.
 * @module http
 */

/** Common HTTP status codes (frozen). */
const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503
});

/**
 * Check if a status code is in the 2xx range.
 * @param {number|string} status
 * @returns {boolean}
 */
function isSuccessCode(status) {
  const n = Number(status);
  return Number.isFinite(n) && n >= 200 && n <= 299;
}

/**
 * Check if a status code is in the 3xx range.
 * @param {number|string} status
 * @returns {boolean}
 */
function isRedirectCode(status) {
  const n = Number(status);
  return Number.isFinite(n) && n >= 300 && n <= 399;
}

/**
 * Check if a status code is in the 4xx range.
 * @param {number|string} status
 * @returns {boolean}
 */
function isClientErrorCode(status) {
  const n = Number(status);
  return Number.isFinite(n) && n >= 400 && n <= 499;
}

/**
 * Check if a status code is in the 5xx range.
 * @param {number|string} status
 * @returns {boolean}
 */
function isServerErrorCode(status) {
  const n = Number(status);
  return Number.isFinite(n) && n >= 500 && n <= 599;
}

/**
 * Check if a status code is 4xx or 5xx.
 * @param {number|string} status
 * @returns {boolean}
 */
function isErrorCode(status) {
  const n = Number(status);
  return Number.isFinite(n) && n >= 400;
}

module.exports = Object.freeze({
  HTTP_STATUS,
  isSuccessCode,
  isRedirectCode,
  isClientErrorCode,
  isServerErrorCode,
  isErrorCode
});
