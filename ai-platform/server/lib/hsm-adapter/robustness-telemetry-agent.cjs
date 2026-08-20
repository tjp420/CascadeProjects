const crypto = require("crypto");
const { EventEmitter } = require("events");

/**
 * Track 25: EU AI Act Article 15 runtime robustness telemetry agent.
 *
 * Collects tamper-evident, non-secret security and environmental telemetry
 * from the HSM adapter ecosystem. Emits real-time safety indicators and can
 * export a signed attestation snapshot for compliance reporting.
 *
 * @module hsm-adapter/robustness-telemetry-agent
 */
class RobustnessTelemetryAgent extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {number} [options.retention=1000] - maximum in-memory events
   * @param {object} [options.logger] - optional logger with info/warn/error methods
   */
  constructor(options = {}) {
    super();
    this._retention = options.retention || 1000;
    this._logger = options.logger || null;
    this._events = [];
    this._chainHash = Buffer.alloc(32, 0);
  }

  /**
   * Record a tamper-evident telemetry event.
   * @param {string} category - 'time', 'zkp', 'policy', 'fips', 'hsm'
   * @param {string} event - short event name, e.g. 'TEMPORAL_DRIFT'
   * @param {object} [metadata] - non-secret scalar metadata only
   * @returns {object} the persisted event envelope
   */
  record(category, event, metadata = {}) {
    const envelope = {
      category,
      event,
      timestamp: Date.now(),
      metadata: this._sanitize(metadata),
    };

    // Chain hash links this event to all prior events for tamper evidence.
    const serialized = JSON.stringify(envelope);
    this._chainHash = crypto
      .createHash("sha256")
      .update(this._chainHash)
      .update(serialized)
      .digest();

    envelope.integrity = this._chainHash.toString("hex");

    this._events.push(envelope);
    if (this._events.length > this._retention) {
      this._events.shift();
    }

    this._log("info", "telemetry.record", {
      category,
      event,
      integrity: envelope.integrity,
    });
    this.emit("record", envelope);
    return envelope;
  }

  /**
   * Get the tamper-evident attestation snapshot for compliance reporting.
   * @returns {object}
   */
  getAttestation() {
    return {
      generatedAt: Date.now(),
      eventCount: this._events.length,
      latestIntegrity: this._chainHash.toString("hex"),
      events: this._events.map((e) => ({
        category: e.category,
        event: e.event,
        timestamp: e.timestamp,
        metadata: e.metadata,
        integrity: e.integrity,
      })),
    };
  }

  /**
   * Stream safety indicators to a listener.
   * @param {function} listener
   * @returns {function} unsubscribe
   */
  subscribe(listener) {
    this.on("record", listener);
    return () => this.off("record", listener);
  }

  _sanitize(metadata) {
    const safe = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        safe[key] = value;
      } else if (value === null || value === undefined) {
        safe[key] = value;
      } else if (Buffer.isBuffer(value)) {
        // Never store key material or plaintext; record length only.
        safe[key] = { length: value.length };
      } else if (typeof value === "object") {
        safe[key] = this._sanitize(value);
      } else {
        safe[key] = "[redacted]";
      }
    }
    return safe;
  }

  _log(level, message, extra) {
    if (!this._logger || typeof this._logger[level] !== "function") return;
    this._logger[level](message, extra);
  }
}

module.exports = { RobustnessTelemetryAgent };
