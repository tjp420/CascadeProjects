/**
 * @module event-bus
 * Lightweight pub/sub event bus for decoupled cross-view communication.
 */

/**
 * Create a new event bus instance.
 * @returns {object} Event bus with `on`, `off`, `emit`, and `once` methods.
 */
export function createEventBus() {
  const listeners = new Map();

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} unsubscribe function
   */
  function on(event, handler) {
    if (typeof handler !== 'function') return () => {};
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => off(event, handler);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {Function} handler
   */
  function off(event, handler) {
    const set = listeners.get(event);
    if (set) {
      set.delete(handler);
      if (set.size === 0) listeners.delete(event);
    }
  }

  /**
   * Emit an event with optional payload.
   * @param {string} event
   * @param {any} payload
   */
  function emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    // Clone to avoid issues if a handler mutates subscriptions during emit
    [...set].forEach(fn => {
      try {
        fn(payload, event);
      } catch (e) {
        // Swallow errors from individual handlers to prevent cascade failures
      }
    });
  }

  /**
   * Subscribe once to an event.
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} unsubscribe function
   */
  function once(event, handler) {
    if (typeof handler !== 'function') return () => {};
    const wrapper = (payload, ev) => {
      off(ev, wrapper);
      handler(payload, ev);
    };
    return on(event, wrapper);
  }

  /**
   * Remove all listeners for an event, or all events if no event given.
   * @param {string} [event]
   */
  function clear(event) {
    if (event) {
      listeners.delete(event);
    } else {
      listeners.clear();
    }
  }

  return { on, off, emit, once, clear };
}

/**
 * Create a DOM-backed event bus that also dispatches CustomEvents on document.
 * Useful for bridging vanilla JS modules and framework components.
 * @param {string} [namespace='sb']
 * @returns {object}
 */
export function createDomEventBus(namespace = 'sb') {
  const bus = createEventBus();

  const originalEmit = bus.emit;
  bus.emit = (event, payload) => {
    originalEmit(event, payload);
    try {
      const detail = typeof payload === 'undefined' ? {} : { detail: payload };
      document.dispatchEvent(new CustomEvent(`${namespace}:${event}`, detail));
    } catch (e) { /* ignore */ }
  };

  return bus;
}
