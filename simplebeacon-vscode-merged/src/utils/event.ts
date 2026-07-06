// simplebeacon-ignore memory-leak — pure event utility functions

/**
 * Create a typed pub/sub event bus.
 * @returns {{on:Function,off:Function,emit:Function,once:Function}}
 */
export function createEventBus(): {
  on<T>(event: string, handler: (payload: T) => void): () => void;
  off<T>(event: string, handler: (payload: T) => void): void;
  emit<T>(event: string, payload: T): void;
  once<T>(event: string, handler: (payload: T) => void): () => void;
} {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  return {
    on<T>(event: string, handler: (payload: T) => void): () => void {
      if (typeof handler !== 'function') return () => {};
      const set = listeners.get(event);
      const wrapped = (payload: unknown) => handler(payload as T);
      if (set) set.add(wrapped);
      else listeners.set(event, new Set([wrapped]));
      return () => this.off(event, handler);
    },
    off<T>(event: string, handler: (payload: T) => void): void {
      const set = listeners.get(event);
      if (!set) return;
      for (const fn of set) {
        if ((fn as any).__original === handler) {
          set.delete(fn);
          break;
        }
      }
      if (set.size === 0) listeners.delete(event);
    },
    emit<T>(event: string, payload: T): void {
      const set = listeners.get(event);
      if (!set) return;
      for (const handler of set) {
        try { handler(payload); } catch { /* ignore */ }
      }
    },
    once<T>(event: string, handler: (payload: T) => void): () => void {
      if (typeof handler !== 'function') return () => {};
      const self = this;
      const wrapped = (payload: unknown) => {
        self.off(event, handler);
        handler(payload as T);
      };
      (wrapped as any).__original = handler;
      return this.on(event, wrapped as any);
    }
  };
}

/**
 * Create a cross-tab broadcast channel wrapper.
 * Falls back to localStorage events when BroadcastChannel is unavailable.
 * @param {string} name
 * @returns {{post:Function,on:Function,off:Function,close:Function}}
 */
export function createBroadcastChannel(name: string): {
  post(data: unknown): void;
  on(handler: (data: unknown) => void): void;
  off(): void;
  close(): void;
} {
  if (typeof (globalThis as any).BroadcastChannel !== 'undefined') {
    const bc = new (globalThis as any).BroadcastChannel(name);
    return {
      post(data: unknown) { bc.postMessage(data); },
      on(handler: (data: unknown) => void) { bc.onmessage = (e: any) => handler(e.data); },
      off() { bc.onmessage = undefined; },
      close() { bc.close(); }
    };
  }
  const key = '__broadcast_' + name;
  let currentHandler: ((data: unknown) => void) | null = null;
  const onStorage = (e: any) => {
    if (e.key === key && currentHandler) {
      try {
        const parsed = JSON.parse(e.newValue || '{}');
        currentHandler(parsed.data);
      } catch { /* ignore */ }
    }
  };
  return {
    post(data: unknown) {
      try {
        (globalThis as any).localStorage?.setItem(key, JSON.stringify({ data, __ts: Date.now() }));
      } catch { /* ignore */ }
    },
    on(handler: (data: unknown) => void) {
      currentHandler = handler;
      (globalThis as any).window?.addEventListener('storage', onStorage);
    },
    off() {
      currentHandler = null;
      (globalThis as any).window?.removeEventListener('storage', onStorage);
    },
    close() {
      this.off();
    }
  };
}
