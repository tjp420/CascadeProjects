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
      if (typeof handler !== 'function') return function() {};
      const set = listeners.get(event);
      if (set) set.add(handler);
      else listeners.set(event, new Set([handler]));
      return function() { this.off(event, handler); }.bind(this);
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
        try { handler(payload); } catch (e) {}
      }
    },
    once(event, handler) {
      if (typeof handler !== 'function') return function() {};
      var self = this;
      var wrapped = function(payload) {
        self.off(event, wrapped);
        handler(payload);
      };
      return this.on(event, wrapped);
    }
  };
}

/**
 * Create a cross-tab broadcast channel wrapper.
 * Falls back to localStorage events when BroadcastChannel is unavailable.
 * @param {string} name
 * @returns {{post:Function,on:Function,off:Function,close:Function}}
 */
export function createBroadcastChannel(name) {
  if (typeof BroadcastChannel !== 'undefined') {
    var bc = new BroadcastChannel(name);
    return {
      post: function(data) { bc.postMessage(data); },
      on: function(handler) { bc.onmessage = function(e) { handler(e.data); }; },
      off: function() { bc.onmessage = null; },
      close: function() { bc.close(); }
    };
  }
  var key = '__broadcast_' + name;
  var currentHandler = null;
  function onStorage(e) {
    if (e.key === key && currentHandler) {
      try {
        var data = JSON.parse(e.newValue);
        currentHandler(data);
      } catch (e) {}
    }
  }
  return {
    post: function(data) {
      try {
        localStorage.setItem(key, JSON.stringify({ data: data, __ts: Date.now() }));
      } catch (e) {}
    },
    on: function(handler) {
      currentHandler = handler;
      window.addEventListener('storage', onStorage);
    },
    off: function() {
      currentHandler = null;
      window.removeEventListener('storage', onStorage);
    },
    close: function() {
      this.off();
    }
  };
}
