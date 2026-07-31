/**
 * Path-pattern convenience checks.
 * @module paths
 */

const path = require('path');

function isDotFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const base = path.basename(filePath);
  return base.length > 0 && base.charAt(0) === '.';
}

function isTestFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const p = filePath.toLowerCase().replace(/\\/g, '/');
  return /\.(test|spec)\./.test(p) || /\/__tests__\//.test(p) || /\/test\//.test(p);
}

function isFixtureFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const p = filePath.toLowerCase().replace(/\\/g, '/');
  return /(fixture|fixtures|mock|mocks|sample|samples|testdata)/.test(p);
}

function isDockerFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const base = path.basename(filePath).toLowerCase();
  return base === 'dockerfile' || base.startsWith('docker-compose.');
}

function isNodeModulesPath(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  return filePath.toLowerCase().replace(/\\/g, '/').includes('node_modules');
}

function isGitPath(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  return filePath.toLowerCase().replace(/\\/g, '/').includes('.git');
}

function isHiddenPath(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  return filePath
    .toLowerCase()
    .replace(/\\/g, '/')
    .split('/')
    .some((seg) => seg.startsWith('.') && seg.length > 1);
}

module.exports = Object.freeze({
  isDotFile,
  isTestFile,
  isFixtureFile,
  isDockerFile,
  isNodeModulesPath,
  isGitPath,
  isHiddenPath,
});
