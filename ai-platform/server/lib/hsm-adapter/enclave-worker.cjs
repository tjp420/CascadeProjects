class EnclaveWorker {
  constructor(manager, options = {}) {
    this.manager = manager;
    this.flushIntervalSec = options.flushIntervalSec || 30;
    this.rotateIntervalSec = options.rotateIntervalSec || 24 * 60 * 60;
    this.jitterSec = options.jitterSec || 5;
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
    this._scheduleFlush();
    this._scheduleRotate();
  }

  _scheduleFlush() {
    if (!this._running) return;
    const delay = this._withJitter(this.flushIntervalSec);
    this._flushTimer = setTimeout(() => {
      this._doFlush().finally(() => this._scheduleFlush());
    }, delay);

  }

  async _doFlush() {
    try {
      if (typeof this.manager.flushPendingReplications === 'function') {
        await this.manager.flushPendingReplications();
      }
    } catch (e) {
      // transient errors are swallowed; manager retains pending state
    }
  }

  _scheduleRotate() {
    if (!this._running) return;
    const delay = this._withJitter(this.rotateIntervalSec);
    this._rotateTimer = setTimeout(() => {
      this._doRotate().finally(() => this._scheduleRotate());
    }, delay);

  }

  async _doRotate() {
    try {
      if (this.generateNewWrapFn && typeof this.manager.rotateKek === 'function') {
        const newWrapFn = await this.generateNewWrapFn();
        await this.manager.rotateKek(newWrapFn);
      }
    } catch (e) {
      // rotation failures are logged by manager; continue
    }
  }

  stop() {
    if (this._flushTimer) { clearTimeout(this._flushTimer); this._flushTimer = null; }
    if (this._rotateTimer) { clearTimeout(this._rotateTimer); this._rotateTimer = null; }
    this._running = false;
  }
}

module.exports = { EnclaveWorker };
