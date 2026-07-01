/**
 * Platform and runtime environment detection helpers.
 * @module platform
 */

function isWindows() {
  return typeof process !== 'undefined' && process.platform === 'win32';
}

function isMacOS() {
  return typeof process !== 'undefined' && process.platform === 'darwin';
}

function isLinux() {
  return typeof process !== 'undefined' && process.platform === 'linux';
}

function isServer() {
  return typeof window === 'undefined';
}

function isBrowser() {
  return typeof window !== 'undefined';
}

module.exports = Object.freeze({
  isWindows,
  isMacOS,
  isLinux,
  isServer,
  isBrowser
});
