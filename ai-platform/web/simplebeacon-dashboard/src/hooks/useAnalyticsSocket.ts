import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiBase } from '@/config';

export type AnalyticsUpdatePayload = {
  type: 'ANALYTICS_UPDATE';
  orgId: string;
  summary: any;
};

interface UseAnalyticsSocketResult {
  /** Latest analytics summary received via WebSocket push, or null if none received yet. */
  pushedSummary: any | null;
  /** Whether the WebSocket is currently connected. */
  connected: boolean;
  /** Whether the socket is actively trying to connect. */
  connecting: boolean;
}

/**
 * Subscribe to real-time ANALYTICS_UPDATE frames via WebSocket.
 *
 * Connects to the server's /ws endpoint and listens for
 * { type: 'ANALYTICS_UPDATE', orgId, summary } messages.
 * Automatically falls back to polling when the socket is unavailable
 * (the caller should use pushedSummary if non-null, otherwise poll).
 *
 * - Auto-reconnects on disconnect with exponential backoff (max 30s).
 * - Cleans up on unmount.
 * - No-op during SSR.
 */
export function useAnalyticsSocket(enabled: boolean): UseAnalyticsSocketResult {
  const [pushedSummary, setPushedSummary] = useState<any | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Build WebSocket URL from the API base
    const apiBase = getApiBase();
    let wsUrl: string;
    try {
      if (apiBase) {
        const url = new URL(apiBase);
        wsUrl = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/ws`;
      } else {
        // Same-origin fallback
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${proto}//${window.location.host}/ws`;
      }
    } catch {
      return; // Invalid URL — skip connection
    }

    setConnecting(true);

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      setConnecting(false);
      scheduleReconnect();
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      setConnecting(false);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ANALYTICS_UPDATE' && data.summary) {
          setPushedSummary(data.summary);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      setConnecting(false);
      scheduleReconnect();
    };

    ws.onerror = () => {
      // Error handler — onclose will fire after this
      if (!mountedRef.current) return;
      setConnecting(false);
    };
  }, [enabled]);

  function scheduleReconnect() {
    if (!mountedRef.current || !enabled) return;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

    const attempts = reconnectAttempts.current;
    const delay = Math.min(1000 * Math.pow(2, attempts), 30000); // Exponential backoff, max 30s
    reconnectAttempts.current = attempts + 1;

    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current && enabled) {
        connect();
      }
    }, delay);
  }

  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, connect]);

  return { pushedSummary, connected, connecting };
}

export default useAnalyticsSocket;
