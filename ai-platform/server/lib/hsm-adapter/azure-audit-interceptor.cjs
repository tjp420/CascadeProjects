'use strict';

/**
 * Azure SDK audit interceptor.
 *
 * Wraps KeyClient and CryptographyClient calls to emit structured
 * audit events for every Azure Key Vault operation. Events are
 * logged via the adapter's logger.
 *
 * @module hsm-adapter/azure-audit-interceptor
 */

class AuditInterceptor {
  /**
   * @param {object} logger - logger with info/warn/error methods
   * @param {string} providerName - e.g. 'azure-keyvault'
   */
  constructor(logger, providerName) {
    this._logger = logger;
    this._providerName = providerName;
  }

  /**
   * Emit an audit event for a successful operation.
   * @param {string} event - e.g. 'CREATE_KEK', 'WRAP', 'UNWRAP'
   * @param {string} operation - Azure SDK operation name (e.g. 'createKey', 'encrypt')
   * @param {object} [extra] - additional metadata
   */
  logSuccess(event, operation, extra = {}) {
    if (!this._logger) return;
    this._logger.info(event, {
      status: 'success',
      operation,
      provider: this._providerName,
      ...extra,
    });
  }

  /**
   * Emit an audit event for a failed operation.
   * @param {string} event - e.g. 'CREATE_KEK', 'WRAP', 'UNWRAP'
   * @param {string} operation - Azure SDK operation name
   * @param {Error} error - the error that occurred
   * @param {object} [extra] - additional metadata
   */
  logFailure(event, operation, error, extra = {}) {
    if (!this._logger) return;
    this._logger.info(event, {
      status: 'failure',
      operation,
      provider: this._providerName,
      errorCode: error.code || error.statusCode || 'UNKNOWN',
      errorMessage: error.message,
      ...extra,
    });
  }

  /**
   * Wrap an async SDK call with audit logging.
   * @param {string} event - audit event name (e.g. 'CREATE_KEK', 'WRAP')
   * @param {string} operation - SDK operation name (e.g. 'createKey', 'encrypt')
   * @param {Function} fn - async function to execute
   * @param {object} [extra] - additional metadata to include in audit
   * @returns {Promise<*>} result of fn
   */
  async wrapCall(event, operation, fn, extra = {}) {
    try {
      const result = await fn();
      this.logSuccess(event, operation, extra);
      return result;
    } catch (error) {
      this.logFailure(event, operation, error, extra);
      throw error;
    }
  }
}

module.exports = { AuditInterceptor };
