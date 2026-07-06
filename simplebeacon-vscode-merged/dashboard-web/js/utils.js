/**
 * @module utils
 * Barrel facade for js-es2018/utils.js.
 * Re-exports everything from the ES2018 barrel and adds facade metadata,
 * integrity validation, and a wrapped default export (all lazily evaluated).
 */

// Re-export all named exports from upstream barrel (export * does not include default)
export * from '../js-es2018/utils.js';

// Import upstream default separately so we can wrap it
import { default as UpstreamDefault, validateBarrelIntegrity as upstreamValidate, integrityTest as upstreamIntegrityTest } from '../js-es2018/utils.js';

// ── Lazy facade metadata ─────────────────────────────────────
let _facadeMeta = null;

/** Facade metadata for runtime introspection. */
export function getFacadeMeta() {
  if (!_facadeMeta) {
    _facadeMeta = Object.freeze({
      name: 'simplebeacon-dashboard-utils-facade',
      description: 'Facade re-export for js-es2018/utils.js',
      upstreamModule: 'js-es2018/utils.js',
      timestamp: new Date().toISOString()
    });
  }
  return _facadeMeta;
}

// ── Lazy default export ──────────────────────────────────────
let _defaultExport = null;
function _getDefaultExport() {
  if (!_defaultExport) {
    _defaultExport = Object.freeze({
      ...UpstreamDefault,
      __facade__: getFacadeMeta()
    });
  }
  return _defaultExport;
}

// ── Validation ─────────────────────────────────────────────
/**
 * Validate that the facade is consistent with the upstream barrel.
 * @returns {{ valid: boolean; errors: string[] }}
 */
export function validateFacadeIntegrity() {
  const errors = [];

  if (!UpstreamDefault) {
    errors.push('Upstream default export is missing');
  } else {
    if (!Object.isFrozen(UpstreamDefault)) {
      errors.push('Upstream default export is not frozen');
    }
    if (!UpstreamDefault.__barrel__) {
      errors.push('Upstream default export missing __barrel__');
    } else if (!Object.isFrozen(UpstreamDefault.__barrel__)) {
      errors.push('Upstream __barrel__ is not frozen');
    }
    if (UpstreamDefault.inline && !Object.isFrozen(UpstreamDefault.inline)) {
      errors.push('Upstream inline namespace is not frozen');
    }
  }

  const facadeMeta = getFacadeMeta();
  if (!Object.isFrozen(facadeMeta)) {
    errors.push('Facade metadata is not frozen');
  }

  // Verify no shadowing
  if (UpstreamDefault && '__facade__' in UpstreamDefault) {
    errors.push('Facade key "__facade__" shadows an upstream export');
  }

  // Delegate to upstream validator if available
  if (typeof upstreamValidate === 'function') {
    try {
      const upstreamResult = upstreamValidate();
      if (!upstreamResult.valid) {
        for (const e of upstreamResult.errors) {
          errors.push(`Upstream: ${e}`);
        }
      }
    } catch (e) {
      errors.push(`Upstream validateBarrelIntegrity threw: ${e.message}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Smoke tests ──────────────────────────────────────────────
/**
 * Run inline smoke tests for the facade and upstream barrel.
 * @returns {{ passed: boolean; failures: string[] }}
 */
export function integrityTest() {
  const failures = [];
  function assert(label, condition) { if (!condition) failures.push(label); }

  // Upstream tests
  if (typeof upstreamIntegrityTest === 'function') {
    try {
      const upstreamResult = upstreamIntegrityTest();
      if (!upstreamResult.passed) {
        for (const f of upstreamResult.failures) failures.push(`Upstream: ${f}`);
      }
    } catch (e) {
      failures.push(`Upstream integrityTest threw: ${e.message}`);
    }
  }

  // Facade tests
  assert('facade metadata frozen', Object.isFrozen(getFacadeMeta()));
  assert('default export has __facade__', '__facade__' in _getDefaultExport());
  assert('default export frozen', Object.isFrozen(_getDefaultExport()));

  return { passed: failures.length === 0, failures };
}

export default _getDefaultExport();
