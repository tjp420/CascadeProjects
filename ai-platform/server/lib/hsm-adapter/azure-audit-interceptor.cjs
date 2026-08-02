'use strict';

/**
 * Stage 2: Audit interceptor for Azure SDK calls.
 *
 * Wraps all Azure Key Vault client calls to emit synchronous audit logs
 * under the established event constants (CREATE_KEK, WRAP, UNWRAP, etc.).
 * Records operation name, duration, and success/failure status.
 *
 * @module hsm-adapter/azure-audit-interceptor
 */

/**
 * Audit interceptor that wraps SDK calls with structured logging.
 */
class AuditInterceptor {
  /**
   * @param {object} logger - logger with info/warn/error methods
   * @param {string} providerName - provider name for audit context
   */
  constructor(logger, providerName) {
    this.logger = logger;
    this.providerName = providerName;
  }

  /**
   * Wrap an async SDK call with audit logging.
   *
   * @param {string} action - audit event constant (e.g. 'CREATE_KEK', 'WRAP')
   * @param {string} operation - SDK operation name (e.g. 'createKey', 'encrypt')
   * @param {Function} fn - async function to wrap
   * @returns {Promise<*>} result of fn
   * @throws {Error} rethrows any error from fn after logging
   */
  async wrapCall(action, operation, fn) {
    const start = Date.now();
    try {
      const result = await fn();
      this._audit(action, {
        operation,
        durationMs: Date.now() - start,
        status: 'success',
      });
      return result;
    } catch (err) {
      this._audit(action, {
        operation,
        durationMs: Date.now() - start,
        status: 'failure',
        error: err.code || err.message,
      });
      throw err;
    }
  }

  /**
   * Emit an audit event to the logger.
   * @param {string} event - event constant
   * @param {object} extra - additional fields
   * @private
   */
  _audit(event, extra = {}) {
    if (!this.logger || !this.logger.info) return;
    this.logger.info(event, {
      sub: 'hsm-adapter',
      provider: this.providerName,
      ...extra,
    });
  }
}

module.exports = { AuditInterceptor };
