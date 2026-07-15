/**
 * Project root require helper.
 * Replaces deep relative imports like `require('../../../packages/...')`
 * with `requireProject('packages/...')`.
 */
const path = require('path');
const projectRoot = path.resolve(__dirname, '../..');

/**
 * Require a module relative to the ai-platform project root.
 * @param {string} relativePath — path relative to ai-platform root (e.g. 'packages/foo')
 * @returns {any} required module
 */
function requireProject(relativePath) {
    return require(path.join(projectRoot, relativePath));
}

module.exports = requireProject;
