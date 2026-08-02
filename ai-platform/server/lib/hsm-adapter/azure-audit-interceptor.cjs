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
}

module.exports = { AuditInterceptor };
