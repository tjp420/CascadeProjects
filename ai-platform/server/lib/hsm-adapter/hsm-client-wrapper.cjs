let clientGauge = null;
let failureCounter = null;
let successCounter = null;

try {
  const promClient = require('prom-client');
  clientGauge = new promClient.Gauge({
    name: 'hsm_circuit_state',
    help: 'Current operational state of the HSM circuit breaker (0=CLOSED, 1=OPEN, 2=HALF-OPEN)',
    labelNames: ['component']
  });
  failureCounter = new promClient.Counter({
    name: 'hsm_circuit_failures_total',
    help: 'Total number of faulted hardware communication operations intercepted by the circuit breaker',
    labelNames: ['operation']
  });
  successCounter = new promClient.Counter({
    name: 'hsm_circuit_successes_total',
    help: 'Total number of successful hardware communication operations recorded by the circuit breaker',
    labelNames: ['operation']
  });
} catch (e) {
  console.error('hsm-client-wrapper.cjs error:', e);
  // best-effort: prom-client may not be present in lightweight test runs
}

class HsmCircuitBreakerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HsmCircuitBreakerError';
    this.code = 'ERR_HSM_CIRCUIT_OPEN';
  }
}

class HsmClientWrapper {
  constructor(rawClient, options = {}) {
    this.client = rawClient;
    this.threshold = Number(options.failureThreshold) || 5;
    this.baseDelay = (Number(options.baseDelaySec) || 60) * 1000;
    this.maxDelay = (Number(options.maxDelaySec) || 300) * 1000;
    this.jitter = Number(options.jitterPct) || 0.1;
    this.componentName = options.componentName || 'core-hsm';

    this.state = 'CLOSED'; // CLOSED | OPEN | HALF-OPEN
    this.failureCount = 0;
    this.nextAttemptTime = 0; // ms timestamp
    this.attempt = 0; // backoff attempt counter

    // Optional hooks for observability (external listeners)
    this.onStateChange = options.onStateChange || (() => {});

    // Register instance for operator tooling
    try {
      if (module && module.exports && typeof module.exports.__registerInstance === 'function') {
        module.exports.__registerInstance(this);
      }
    } catch (e) {
      console.error('hsm-client-wrapper.cjs error:', e);
      // ignore
    }

    // Initialize gauge to CLOSED
    this._updateMetricsGauge(0);
  }

  async execute(operation, ...args) {
    this._evaluateStateTransition();

    if (this.state === 'OPEN') {
      if (failureCounter) try { failureCounter.labels(operation).inc(); } catch (e) { console.error('hsm-client-wrapper.cjs error:', e); }
      throw new HsmCircuitBreakerError('Hardware communication is isolated due to preceding failures.');
    }

    if (typeof this.client[operation] !== 'function') {
      throw new Error(`ERR_HSM_INVALID_OPERATION: ${operation}`);
    }

    try {
      const result = await this.client[operation](...args);
      this._onSuccess(operation);
      return result;
    } catch (err) {
      this._onFailure(operation, err);
      throw err;
    }
  }

  _evaluateStateTransition() {
    if (this.state === 'OPEN' && Date.now() >= this.nextAttemptTime) {
      this.state = 'HALF-OPEN';
      this._updateMetricsGauge(2);
      this.onStateChange(this.state);
    }
  }

  _onSuccess(operation) {
    if (successCounter) try { successCounter.labels(operation).inc(); } catch (e) { console.error('hsm-client-wrapper.cjs error:', e); }
    if (this.state === 'HALF-OPEN') {
      this.state = 'CLOSED';
      this.failureCount = 0;
      this.attempt = 0;
      this.nextAttemptTime = 0;
      this._updateMetricsGauge(0);
      this.onStateChange(this.state);
    } else {
      // success in CLOSED: reduce failure count slowly
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  _onFailure(operation, err) {
    if (failureCounter) try { failureCounter.labels(operation).inc(); } catch (e) { console.error('hsm-client-wrapper.cjs error:', e); }
    this.failureCount++;

    const shouldOpen = this.state === 'HALF-OPEN' || this.failureCount >= this.threshold;
    if (shouldOpen) {
      this.state = 'OPEN';
      this._updateMetricsGauge(1);

      const backoff = Math.min(this.baseDelay * Math.pow(2, this.attempt), this.maxDelay);
      const jitterOffset = Math.floor(backoff * this.jitter * (Math.random() * 2 - 1));
      this.nextAttemptTime = Date.now() + backoff + jitterOffset;
      this.attempt++;

      this.onStateChange(this.state, { backoff, nextAttemptTime: this.nextAttemptTime, error: err && err.message });
      console.error(`[HSM CIRCUIT CRITICAL] Circuit shifted to OPEN. Backoff locked for ${backoff}ms. Error:`, err && err.message);
    }
  }

  _updateMetricsGauge(value) {
    if (clientGauge) try { clientGauge.labels(this.componentName).set(value); } catch (e) { console.error('hsm-client-wrapper.cjs error:', e); }
  }

  // Operator manual overrides
  forceOpen() { this.state = 'OPEN'; this.nextAttemptTime = Infinity; this._updateMetricsGauge(1); this.onStateChange(this.state); }
  forceClose() { this.state = 'CLOSED'; this.failureCount = 0; this.attempt = 0; this.nextAttemptTime = 0; this._updateMetricsGauge(0); this.onStateChange(this.state); }
}

// Internal registry for operator tooling
const _instances = new Set();

function __registerInstance(inst) {
  _instances.add(inst);
}

function listInstances() {
  return Array.from(_instances).map(i => ({ componentName: i.componentName, state: i.state }));
}

function findInstanceByName(name) {
  for (const i of _instances) {
    if (i.componentName === name) return i;
  }
  return null;
}

module.exports = { HsmClientWrapper, HsmCircuitBreakerError, __registerInstance, listInstances, findInstanceByName };
