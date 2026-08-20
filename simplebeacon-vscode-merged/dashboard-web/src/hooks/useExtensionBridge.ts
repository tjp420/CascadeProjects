import { useCallback, useEffect, useState } from 'react';
import {
  buildExtensionConnectDeepLink,
  discoverAndApplyExtensionBridge,
  getExtensionBridgeOrigin,
  getLocalBridgeFetch,
  isHostedHttpsDashboard,
  canUseParentBridgeFetch,
} from '@services/localAgentService.js';
import { persistExtensionBridge } from '@utils/utils-lib/url.js';

const BRIDGE_PORTS = [54358, 54697, 58681, 58000, 64772];
const BRIDGE_BASE_KEY = 'sb_bridge_base';
const BRIDGE_TOKEN_KEY = 'sb_bridge_token';

export type ExtensionBridgeStatus = 'idle' | 'discovering' | 'connected' | 'unavailable' | 'denied';

function readUrlBridgeBase(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('sb_api_base') || params.get('sb_notify_base');
    if (!raw) return null;
    return raw.replace(/\/api\/?$/i, '').replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function readStoredBridgeBase(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(BRIDGE_BASE_KEY) || getExtensionBridgeOrigin();
  } catch {
    return getExtensionBridgeOrigin();
  }
}

function persistBridge(base: string, token: string | null) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(BRIDGE_BASE_KEY, base);
    sessionStorage.setItem('sb_api_base', `${base}/api`);
    if (token) sessionStorage.setItem(BRIDGE_TOKEN_KEY, token);
  } catch {
    // best-effort
  }
}

/** True when blind loopback port scans are allowed without an explicit user gesture. */
function shouldAutoProbeLoopback(userInitiated: boolean): boolean {
  if (userInitiated) return true;
  if (canUseParentBridgeFetch()) return true;
  if (!isHostedHttpsDashboard()) return true;
  return false;
}

async function probeBridgePort(port: number): Promise<{ base: string; token: string | null } | null> {
  const doFetch = getLocalBridgeFetch();
  const origin = `http://127.0.0.1:${port}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await doFetch(`${origin}/api/health`, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    // Only accept servers that explicitly identify as a SimpleBeacon bridge.
    // Generic { status: 'ok' } responses are rejected to avoid port collisions
    // with other local servers (e.g. Devin CLI, VS Code, dev tools).
    if (data?.service === 'simplebeacon-bridge' || data?.platform === 'Simplebeacon') {
      return { base: origin, token: (data.bridgeToken as string) || null };
    }
  } catch {
    /* try next port */
  }
  return null;
}

export function useExtensionBridge() {
  const [bridgeBase, setBridgeBase] = useState<string | null>(() => {
    const fromUrl = readUrlBridgeBase();
    if (fromUrl) return fromUrl;
    return readStoredBridgeBase();
  });
  const [bridgeToken, setBridgeToken] = useState<string | null>(() => {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(BRIDGE_TOKEN_KEY);
  });
  const [status, setStatus] = useState<ExtensionBridgeStatus>('idle');

  const discoverBridge = useCallback(async (options: { userInitiated?: boolean } = {}) => {
    const userInitiated = options.userInitiated === true;

    const urlBase = readUrlBridgeBase();
    if (urlBase) {
      setBridgeBase(urlBase);
      setStatus('connected');
      return { ok: true as const, base: urlBase };
    }

    const storedBase = readStoredBridgeBase();

    // Hosted HTTPS: do not blind-scan loopback on page load — Chrome LNA prompts fire for
    // every port. Restore a saved bridge silently; probe only on explicit user action or
    // when the VS Code wrapper can relay fetches without LNA.
    if (isHostedHttpsDashboard() && !userInitiated && !canUseParentBridgeFetch()) {
      if (storedBase) {
        setBridgeBase(storedBase);
        setBridgeToken(typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(BRIDGE_TOKEN_KEY) : null);
        setStatus('connected');
        return { ok: true as const, base: storedBase, unverified: true as const };
      }
      setStatus('denied');
      return {
        ok: false as const,
        reason: 'needs-deep-link' as const,
        deepLink: buildExtensionConnectDeepLink('analyze'),
      };
    }

    setStatus('discovering');

    if (shouldAutoProbeLoopback(userInitiated)) {
      // On hosted HTTPS, only probe the specific configured bridge origin — not all ports.
      // Blind-scanning loopback ports from HTTPS causes CORS errors and LNA permission prompts.
      const portsToProbe =
        isHostedHttpsDashboard() && canUseParentBridgeFetch()
          ? BRIDGE_PORTS.filter((port) => {
              const bridgeOrigin = getExtensionBridgeOrigin();
              return bridgeOrigin && `http://127.0.0.1:${port}` === bridgeOrigin;
            })
          : BRIDGE_PORTS;
      const probes = await Promise.all(portsToProbe.map((port) => probeBridgePort(port)));
      const match = probes.find(Boolean);
      if (match) {
        persistExtensionBridge(`${match.base}/api`, {
          websiteMode: true,
          updateUrl: userInitiated,
        });
        persistBridge(match.base, match.token);
        setBridgeBase(match.base);
        setBridgeToken(match.token);
        setStatus('connected');
        return { ok: true as const, base: match.base, token: match.token };
      }
    }

    const discovery = await discoverAndApplyExtensionBridge({
      userInitiated,
    });
    const origin = getExtensionBridgeOrigin();
    if (discovery.ok && origin) {
      setBridgeBase(origin);
      persistBridge(origin, null);
      setStatus('connected');
      return { ok: true as const, base: origin };
    }

    if (discovery.needsDeepLink) {
      setStatus('denied');
      return {
        ok: false as const,
        reason: 'needs-deep-link' as const,
        deepLink: buildExtensionConnectDeepLink('analyze'),
      };
    }

    setStatus('unavailable');
    return { ok: false as const, reason: 'unavailable' as const };
  }, []);

  useEffect(() => {
    void discoverBridge();
  }, [discoverBridge]);

  const bridgeHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (bridgeToken) {
      headers['X-SimpleBeacon-Bridge-Token'] = bridgeToken;
    }
    return headers;
  }, [bridgeToken]);

  return {
    bridgeBase,
    bridgeToken,
    status,
    bridgeHeaders,
    recheck: (userInitiated = false) => discoverBridge({ userInitiated }),
  };
}
