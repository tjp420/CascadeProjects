/**
 * Stub SIEM transport for winston.
 * Activated only when AUDIT_SIEM=true and AUDIT_SIEM_ENDPOINT is set.
 *
 * Also provides connectBroker() to receive SiemSecurityBroker
 * transport_winston_stream events and forward them to the Winston logger.
 */

const Transport = require('winston-transport');

let _brokerListener = null;

/**
 * SIEM transport.
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

/**
 * Connect a SiemSecurityBroker to the Winston transport.
 * The broker's `transport_winston_stream` events are forwarded to
 * the provided Winston logger instance.
 * @param {object} broker - SiemSecurityBroker instance
 * @param {object} logger - Winston logger instance
 */
function connectBroker(broker, logger) {
  if (!broker || typeof broker.on !== 'function') return;
  // Remove any previous listener
  if (_brokerListener) {
    try { _brokerListener.broker.removeListener('transport_winston_stream', _brokerListener.fn); } catch {}
  }
  const fn = (event) => {
    try {
      if (logger && typeof logger.warn === 'function') {
        const level = event.siemSeverity === 'CRITICAL' || event.siemSeverity === 'FATAL' ? 'error' : 'warn';
        logger[level](`[SIEM] ${event.siemCategory}`, {
          eventId: event.eventId,
          siemSeverity: event.siemSeverity,
          siemSource: event.siemSource,
          metadata: event.metadata,
        });
      }
    } catch {}
  };
  broker.on('transport_winston_stream', fn);
  _brokerListener = { broker, fn };
}

/**
 * Disconnect the broker listener.
 */
function disconnectBroker() {
  if (_brokerListener) {
    try { _brokerListener.broker.removeListener('transport_winston_stream', _brokerListener.fn); } catch {}
    _brokerListener = null;
  }
}

module.exports = SIEMTransport;
module.exports.connectBroker = connectBroker;
module.exports.disconnectBroker = disconnectBroker;
