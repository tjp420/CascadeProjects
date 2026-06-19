/**
 * Stub SIEM transport for winston.
 * Activated only when AUDIT_SIEM=true and AUDIT_SIEM_ENDPOINT is set.
 */

const Transport = require('winston-transport');

/**
 * S i e m transport.
 */
class SIEMTransport extends Transport {
  constructor(opts) {
    super(opts);
    this.endpoint = opts.endpoint;
    this.apiKey = opts.apiKey;
  }

  log(info, callback) {
    setImmediate(() => this.emit('logged', info));
    // Stub: in production this would POST to the SIEM endpoint
    callback();
  }
}

module.exports = SIEMTransport;
