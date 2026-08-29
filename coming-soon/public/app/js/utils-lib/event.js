/**
 * @module event
 */

/**
 * Create a typed pub/sub event bus.
 * @returns {{on:Function,off:Function,emit:Function,once:Function}}
 */
export function createEventBus() {
  const listeners = new Map();
  return {
    on(event, handler) {
      if (typeof handler !== "function") return () => {};
      const set = listeners.get(event);
      if (set) set.add(handler);
      else listeners.set(event, new Set([handler]));
      return () => this.off(event, handler);
    },
    off(event, handler) {
      const set = listeners.get(event);
      if (!set) return;
      set.delete(handler);
      if (set.size === 0) listeners.delete(event);
    },
    emit(event, payload) {
      const set = listeners.get(event);
      if (!set) return;
      for (const handler of set) {
        try {
          handler(payload);
        } catch {}
      }
    },
    once(event, handler) {
      if (typeof handler !== "function") return () => {};
      const wrapped = (payload) => {
        this.off(event, wrapped);
        handler(payload);
      };
      return this.on(event, wrapped);
    },
  };
}

/**
 * Create a cross-tab broadcast channel wrapper.
 * Falls back to localStorage events when BroadcastChannel is unavailable.
 * @param {string} name
 * @returns {{post:Function,on:Function,off:Function,close:Function}}
 */
export function createBroadcastChannel(name) {
  if (typeof BroadcastChannel !== "undefined") {
    const bc = new BroadcastChannel(name);
    return {
      post(data) {
        bc.postMessage(data);
      },
      on(handler) {
        bc.onmessage = (e) => handler(e.data);
      },
      off() {
        bc.onmessage = null;
      },
      close() {
        bc.close();
      },
    };
  }
  const key = `__broadcast_${name}`;
  let currentHandler = null;
  const onStorage = (e) => {
    if (e.key === key && currentHandler) {
      try {
        const data = JSON.parse(e.newValue);
        currentHandler(data);
      } catch {}
    }
  };
  return {
    post(data) {
      try {
        localStorage.setItem(key, JSON.stringify({ data, __ts: Date.now() }));
      } catch {}
    },
    on(handler) {
      currentHandler = handler;
      window.addEventListener("storage", onStorage);
    },
    off() {
      currentHandler = null;
      window.removeEventListener("storage", onStorage);
    },
    close() {
      this.off();
    },
  };
}
