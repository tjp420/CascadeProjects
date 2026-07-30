import { useCallback, useEffect, useState } from 'react';
import {
  buildExtensionConnectDeepLink,
  discoverAndApplyExtensionBridge,
  getExtensionBridgeOrigin,
  getLocalBridgeFetch,
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
    if (data?.service === 'simplebeacon-bridge' || data?.platform === 'Simplebeacon') {
      return { base: origin, token: (data.bridgeToken as string) || null };
    }
    if (data?.status === 'ok' || data?.online === true) {
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
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(BRIDGE_BASE_KEY) || getExtensionBridgeOrigin();
    }
    return getExtensionBridgeOrigin();
  });
  const [bridgeToken, setBridgeToken] = useState<string | null>(() => {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(BRIDGE_TOKEN_KEY);
  });
  const [status, setStatus] = useState<ExtensionBridgeStatus>('idle');

  const discoverBridge = useCallback(async (options: { userInitiated?: boolean } = {}) => {
    const urlBase = readUrlBridgeBase();
    if (urlBase) {
      setBridgeBase(urlBase);
      setStatus('connected');
      return { ok: true as const, base: urlBase };
    }

    setStatus('discovering');

    // Parallel loopback probes run on hosted HTTPS too (Chrome LNA / Private Network Access).
    // Do not bail out early on needsDeepLink — that only means localAgentService skips its own probe.
    const probes = await Promise.all(BRIDGE_PORTS.map((port) => probeBridgePort(port)));
    const match = probes.find(Boolean);
    if (match) {
      persistExtensionBridge(`${match.base}/api`, { websiteMode: true, updateUrl: options.userInitiated === true });
      persistBridge(match.base, match.token);
      setBridgeBase(match.base);
      setBridgeToken(match.token);
      setStatus('connected');
      return { ok: true as const, base: match.base, token: match.token };
    }

    const discovery = await discoverAndApplyExtensionBridge({
      userInitiated: options.userInitiated === true,
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
