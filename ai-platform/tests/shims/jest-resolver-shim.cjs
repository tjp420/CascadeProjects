// SPDX-License-Identifier: MIT
/**
 * Custom Jest resolver that falls back to Node.js's require.resolve
 * when the default unrs-resolver fails to find a module.
 *
 * This works around a Jest 30 / unrs-resolver bug on Linux where
 * setupFilesAfterEnv modules are reported as "not found" even though
 * the files exist and are readable by Node.js.
 *
 * See: https://github.com/jestjs/jest/issues/15923
 *
 * @license MIT
 */

const path = require('path');

function customResolver(request, options) {
  // Try the default resolver first by requiring it indirectly
  // via Node.js's own module resolution
  const basedir = options.basedir;
  const extensions = options.extensions || ['.js', '.cjs', '.json'];

  // Handle absolute paths
  if (path.isAbsolute(request)) {
    try {
      // Try direct file access first
      const fs = require('fs');
      if (fs.existsSync(request)) {
        return request;
      }
      // Try with extensions
      for (const ext of extensions) {
        const withExt = request + ext;
        if (fs.existsSync(withExt)) {
          return withExt;
        }
      }
    } catch (e) {
      // fall through
    }
  }

  // Handle relative paths
  if (request.startsWith('./') || request.startsWith('../')) {
    const resolved = path.resolve(basedir, request);
    try {
      const fs = require('fs');
      if (fs.existsSync(resolved)) {
        return resolved;
      }
      for (const ext of extensions) {
        const withExt = resolved + ext;
        if (fs.existsSync(withExt)) {
          return withExt;
        }
      }
    } catch (e) {
      // fall through
    }
  }

  // Fallback: use Node.js's require.resolve
  try {
    return require.resolve(request, {
      paths: [basedir, ...(options.paths || [])],
      extensions
    });
  } catch (e) {
    // Re-throw with a clear message
    const err = new Error(`Cannot resolve module '${request}' from '${basedir}'`);
    err.code = 'MODULE_NOT_FOUND';
    throw err;
  }
}

module.exports = customResolver;
module.exports.sync = customResolver;
module.exports.async = async (request, options) => customResolver(request, options);
