// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Realtime Analysis WebSocket Service
 *
 * Connects to the server's /api/realtime/stream WebSocket endpoint for
 * streaming code analysis. Handles session creation, reconnection with
 * exponential backoff, and message dispatch.
 *
 * Usage:
 *   import { realtimeAnalysisService } from './realtimeAnalysisService.js';
 *   await realtimeAnalysisService.start({ profile: 'balanced' });
 *   realtimeAnalysisService.on('result', (data) => { ... });
 *   realtimeAnalysisService.stop();
 */
import { apiBase } from "./authService.js?v=20260731rt1";

/** @typedef {'disconnected'|'connecting'|'connected'|'reconnecting'|'error'} ConnectionState */

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const RECONNECT_MAX_ATTEMPTS = 10;
const PING_INTERVAL_MS = 30000;
const WS_PATH = "/api/realtime/stream";

/**
 * Resolve the WebSocket URL from the API base.
 * The realtime WS server runs on port 8082 (separate from the REST API).
 * For localhost dev: ws://localhost:8082/api/realtime/stream
 * For production: wss://<host>/api/realtime/stream (proxied)
 * @returns {string}
 */
function resolveWsUrl() {
  const base = apiBase();
  if (!base || /^(localhost|127\.0\.0\.1)$/i.test(location.hostname)) {
    // Local dev: WS server is on port 8082
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${location.hostname}:8082${WS_PATH}`;
  }
  // Production: same host, upgrade to wss
  const url = new URL(base);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${url.host}${WS_PATH}`;
}

class RealtimeAnalysisService {
  constructor() {
    /** @type {ConnectionState} */
    this.state = "disconnected";
    /** @type {WebSocket|null} */
    this._ws = null;
    /** @type {string|null} */
    this._sessionId = null;
    /** @type {number} */
    this._reconnectAttempts = 0;
    /** @type {ReturnType<typeof setTimeout>|null} */
    this._reconnectTimer = null;
    /** @type {ReturnType<typeof setInterval>|null} */
    this._pingTimer = null;
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
    /** @type {Object|null} */
    this._sessionOptions = null;
    /** @type {boolean} */
    this._intentionalStop = false;
  }

  /**
   * Start a realtime analysis session.
   * Creates a session via REST, then connects the WebSocket.
   * @param {Object} [options]
   * @param {string} [options.profile='balanced']
   * @param {string} [options.analysisType='general']
   * @returns {Promise<string>} sessionId
   */
  async start(options = {}) {
    if (this.state === "connected" || this.state === "connecting") {
      return this._sessionId;
    }
    this._intentionalStop = false;
    this._sessionOptions = options;
    this._setState("connecting");

    try {
      const sessionId = await this._createSession(options);
      this._sessionId = sessionId;
      this._connect(sessionId);
      return sessionId;
    } catch (err) {
      this._setState("error");
      this._emit("error", {
        message: "Failed to create analysis session",
        error: err,
      });
      throw err;
    }
  }

  /**
   * Stop the realtime session and close the WebSocket.
   */
  stop() {
    this._intentionalStop = true;
    this._clearTimers();
    if (this._ws) {
      try {
        this._ws.close(1000, "Client closed");
      } catch (_a) {
        /* ignore */
      }
      this._ws = null;
    }
    if (this._sessionId) {
      this._deleteSession(this._sessionId).catch(() => {
        /* best effort */
      });
      this._sessionId = null;
    }
    this._setState("disconnected");
  }

  /**
   * Send an analyze chunk request over the WebSocket.
   * @param {string} content
   * @param {string} [chunkId]
   * @param {Object} [context]
   */
  analyzeChunk(content, chunkId, context = {}) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this._ws.send(
      JSON.stringify({ type: "analyze", content, chunkId, context }),
    );
  }

  /**
   * Register an event listener.
   * @param {'status'|'analysis_result'|'error'|'state'|'pong'|'message'} event
   * @param {Function} callback
   * @returns {() => void} unsubscribe function
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => {
      this._listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Get the current session ID.
   * @returns {string|null}
   */
  get sessionId() {
    return this._sessionId;
  }

  // ── Private ───────────────────────────────────────────────

  /**
   * Create an analysis session via REST.
   * @param {Object} options
   * @returns {Promise<string>}
   */
  async _createSession(options) {
    const base = apiBase();
    const url = base ? `${base}/api/realtime/session` : "/api/realtime/session";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: options.profile || "balanced",
        analysisType: options.analysisType || "general",
      }),
    });
    if (!res.ok) {
      throw new Error(`Session creation failed: ${res.status}`);
    }
    const data = await res.json();
    if (!data.success || !data.sessionId) {
      throw new Error("Session creation returned no sessionId");
    }
    return data.sessionId;
  }

  /**
   * Delete a session via REST.
   * @param {string} sessionId
   * @returns {Promise<void>}
   */
  async _deleteSession(sessionId) {
    const base = apiBase();
    const url = base
      ? `${base}/api/realtime/session/${sessionId}`
      : `/api/realtime/session/${sessionId}`;
    await fetch(url, { method: "DELETE" }).catch(() => {
      /* best effort */
    });
  }

  /**
   * Connect the WebSocket to the server.
   * @param {string} sessionId
   */
  _connect(sessionId) {
    const url = `${resolveWsUrl()}?sessionId=${encodeURIComponent(sessionId)}`;
    try {
      this._ws = new WebSocket(url);
    } catch (err) {
      this._setState("error");
      this._emit("error", {
        message: "WebSocket construction failed",
        error: err,
      });
      this._scheduleReconnect();
      return;
    }

    this._ws.onopen = () => {
      this._reconnectAttempts = 0;
      this._setState("connected");
      this._startPing();
    };

    this._ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleMessage(msg);
      } catch (err) {
        this._emit("error", {
          message: "Failed to parse WebSocket message",
          error: err,
        });
      }
    };

    this._ws.onerror = () => {
      this._emit("error", { message: "WebSocket error" });
    };

    this._ws.onclose = (event) => {
      this._clearPing();
      this._ws = null;
      if (this._intentionalStop) {
        this._setState("disconnected");
        return;
      }
      // Unexpected close — attempt reconnection
      if (event.code !== 1000) {
        this._scheduleReconnect();
      }
    };
  }

  /**
   * Handle an incoming WebSocket message.
   * @param {Object} msg
   */
  _handleMessage(msg) {
    switch (msg.type) {
      case "status":
        this._emit("status", msg);
        break;
      case "pong":
        this._emit("pong", msg);
        break;
      case "analysis_result":
        this._emit("analysis_result", msg);
        break;
      case "error":
        this._emit("error", {
          message: msg.error || "Server error",
          sessionId: msg.sessionId,
        });
        break;
      default:
        // Unknown message type — emit as a generic event
        this._emit("message", msg);
        break;
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff.
   */
  _scheduleReconnect() {
    if (this._intentionalStop) return;
    if (this._reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      this._setState("error");
      this._emit("error", {
        message: `Max reconnection attempts (${RECONNECT_MAX_ATTEMPTS}) reached`,
      });
      return;
    }
    this._setState("reconnecting");
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this._reconnectAttempts),
      RECONNECT_MAX_MS,
    );
    this._reconnectAttempts++;
    this._reconnectTimer = setTimeout(() => {
      if (this._intentionalStop) return;
      // Recreate session if needed, then reconnect
      if (!this._sessionId) {
        this.start(this._sessionOptions || {}).catch(() => {
          /* will reschedule */
        });
      } else {
        this._connect(this._sessionId);
      }
    }, delay);
  }

  /**
   * Start the ping keepalive interval.
   */
  _startPing() {
    this._clearPing();
    this._pingTimer = setInterval(() => {
      if (this._ws && this._ws.readyState === WebSocket.OPEN) {
        this._ws.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL_MS);
  }

  /**
   * Clear the ping interval.
   */
  _clearPing() {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  /**
   * Clear all timers.
   */
  _clearTimers() {
    this._clearPing();
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  /**
   * Set the connection state and emit a state change event.
   * @param {ConnectionState} state
   */
  _setState(state) {
    this.state = state;
    this._emit("state", { state, sessionId: this._sessionId });
  }

  /**
   * Emit an event to all registered listeners.
   * @param {string} event
   * @param {Object} data
   */
  _emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const cb of listeners) {
        try {
          cb(data);
        } catch (_a) {
          /* ignore listener errors */
        }
      }
    }
  }
}

/** Singleton instance for the dashboard. */
export const realtimeAnalysisService = new RealtimeAnalysisService();
export { RealtimeAnalysisService };
