/**
 * Shared format for offline prep tool + homepage diagnostic drop zone.
 * type: simplebeacon-diagnostic-bundle
 */
(function (root) {
  'use strict';

  var BUNDLE_TYPE = 'simplebeacon-diagnostic-bundle';
  var BUNDLE_VERSION = '1';
  var ALLOWED_EXT = ['.json', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.env', '.yaml', '.yml', '.txt', '.md'];
  var MAX_SNIPPET_BYTES = 64 * 1024;
  var MAX_TOTAL_BYTES = 256 * 1024;

  function isAllowedFile(name) {
    var lower = String(name || '').toLowerCase();
    var dot = lower.lastIndexOf('.');
    if (dot === -1) return false;
    return ALLOWED_EXT.indexOf(lower.slice(dot)) !== -1;
  }

  function parseBundle(raw) {
    var data;
    try {
      data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
    if (!data || data.type !== BUNDLE_TYPE || !Array.isArray(data.snippets)) return null;
    return data;
  }

  function bundleToScanText(bundle) {
    return bundle.snippets
      .filter(function (s) { return s && typeof s.content === 'string' && s.content.trim(); })
      .map(function (s) {
        return '/* file: ' + String(s.path || 'snippet').replace(/\*\//g, '') + ' */\n' + s.content;
      })
      .join('\n\n')
      .slice(0, MAX_TOTAL_BYTES);
  }

  function buildBundle(snippets, meta) {
    return {
      type: BUNDLE_TYPE,
      version: BUNDLE_VERSION,
      generatedAt: new Date().toISOString(),
      generator: (meta && meta.generator) || 'simplebeacon-diagnostic-prep',
      fileCount: snippets.length,
      snippets: snippets
    };
  }

  root.SIMPLEBEACON_DIAGNOSTIC_BUNDLE = {
    BUNDLE_TYPE: BUNDLE_TYPE,
    BUNDLE_VERSION: BUNDLE_VERSION,
    ALLOWED_EXT: ALLOWED_EXT,
    MAX_SNIPPET_BYTES: MAX_SNIPPET_BYTES,
    MAX_TOTAL_BYTES: MAX_TOTAL_BYTES,
    isAllowedFile: isAllowedFile,
    parseBundle: parseBundle,
    bundleToScanText: bundleToScanText,
    buildBundle: buildBundle
  };
})(typeof window !== 'undefined' ? window : globalThis);
