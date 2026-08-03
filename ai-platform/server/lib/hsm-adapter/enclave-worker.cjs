class EnclaveWorker {
  constructor(manager, options = {}) {
    this.manager = manager;
    this.flushIntervalSec = options.flushIntervalSec || 30;
    this.rotateIntervalSec = options.rotateIntervalSec || 24 * 60 * 60;
    this.jitterSec = typeof options.jitterSec === 'number' ? options.jitterSec : 5;
    this._flushTimer = null;
    this._rotateTimer = null;
    this._running = false;
    this.generateNewWrapFn = options.generateNewWrapFn; // async () => newWrapFn
  }

  _withJitter(sec) {
    if (!this.jitterSec) return sec * 1000;
    const jitter = (Math.random() * 2 - 1) * this.jitterSec;
    return Math.max(0, Math.round((sec + jitter) * 1000));
  }

  start() {
    if (this._running) return;
    this._running = true;

    const flushMs = this._withJitter(this.flushIntervalSec);
    this._flushTimer = setInterval(async () => {
      try {
        if (typeof this.manager.flushPendingReplications === 'function') {
          await this.manager.flushPendingReplications();
        }
      } catch (e) {
        // transient errors are swallowed; manager retains pending state
      }
    }, flushMs);
    if (this._flushTimer && typeof this._flushTimer.unref === 'function') this._flushTimer.unref();

    const rotateMs = this._withJitter(this.rotateIntervalSec);
    this._rotateTimer = setInterval(async () => {
      try {
        if (this.generateNewWrapFn && typeof this.manager.rotateKek === 'function') {
          const newWrapFn = await this.generateNewWrapFn();
          await this.manager.rotateKek(newWrapFn);
        }
      } catch (e) {
        // rotation failures are logged by manager; continue
      }
    }, rotateMs);
    if (this._rotateTimer && typeof this._rotateTimer.unref === 'function') this._rotateTimer.unref();
  }

  stop() {
    if (this._flushTimer) { clearInterval(this._flushTimer); this._flushTimer = null; }
    if (this._rotateTimer) { clearInterval(this._rotateTimer); this._rotateTimer = null; }
    this._running = false;
  }
}

module.exports = { EnclaveWorker };
