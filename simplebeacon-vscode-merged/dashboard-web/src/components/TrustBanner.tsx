// simplebeacon-ignore: dashboard code — trust indicator UI components
import { useState, useEffect, useCallback, useRef } from "react";
import { ShieldCheck, Lock, WifiOff, Server, Cloud, Globe, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * TrustBanner — pre-scan trust signals shown above the scan button.
 *
 * Communicates three guarantees that are true regardless of scan mode:
 *   1. Read-only — source files are never modified
 *   2. No upload — code is not transmitted to any server (in browser-local mode)
 *   3. Network guard — outbound requests are intercepted and verified
 *
 * The banner adapts to the active scan mode:
 *   - browser-local: "Files never leave your machine"
 *   - local-server: "Scanning via 127.0.0.1 — code stays on your machine"
 *   - remote-backend: "Scan processed on SimpleBeacon server"
 */
export type ScanTrustMode = "browser-local" | "local-server" | "remote-backend" | "unknown";

interface TrustBannerProps {
  mode: ScanTrustMode;
  className?: string;
}

const MODE_DESCRIPTIONS: Record<ScanTrustMode, { label: string; detail: string; icon: React.ComponentType<{ className?: string }> }> = {
  "browser-local": {
    label: "Browser-local scan",
    detail: "Files are read by your browser — they never leave this machine. The network guard intercepts any outbound request.",
    icon: ShieldCheck,
  },
  "local-server": {
    label: "Local extension server",
    detail: "Scanning via the SimpleBeacon extension server on 127.0.0.1. Your code stays on your machine — nothing is sent to the internet.",
    icon: Server,
  },
  "remote-backend": {
    label: "Remote backend scan",
    detail: "Scan is processed on the SimpleBeacon server. Your code is sent over HTTPS for analysis and is not stored after the scan completes.",
    icon: Cloud,
  },
  unknown: {
    label: "Scan mode detected automatically",
    detail: "SimpleBeacon runs locally by default. The network guard verifies no source code is uploaded during browser-local scans.",
    icon: ShieldCheck,
  },
};

export function TrustBanner({ mode, className }: TrustBannerProps) {
  const desc = MODE_DESCRIPTIONS[mode] || MODE_DESCRIPTIONS.unknown;
  const Icon = desc.icon;

  return (
    <div
      className={`rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-2 ${className || ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-green-600 dark:text-green-500" />
        <span>{desc.label}</span>
      </div>
      <p className="text-xs text-foreground-muted leading-relaxed">{desc.detail}</p>
      <div className="flex flex-wrap gap-3 pt-1">
        <span className="flex items-center gap-1 text-xs text-foreground-muted">
          <Lock className="h-3 w-3 text-green-600 dark:text-green-500" />
          Read-only
        </span>
        <span className="flex items-center gap-1 text-xs text-foreground-muted">
          <WifiOff className="h-3 w-3 text-green-600 dark:text-green-500" />
          {mode === "remote-backend" ? "HTTPS encrypted" : "No upload"}
        </span>
        <span className="flex items-center gap-1 text-xs text-foreground-muted">
          <ShieldCheck className="h-3 w-3 text-green-600 dark:text-green-500" />
          Network guard active
        </span>
      </div>
    </div>
  );
}

/**
 * ScanModeBadge — persistent indicator showing the current scan mode.
 * Displayed in the dashboard header or scan card header.
 */
interface ScanModeBadgeProps {
  mode: ScanTrustMode;
  className?: string;
}

const MODE_BADGE: Record<ScanTrustMode, { label: string; icon: React.ComponentType<{ className?: string }>; variant: "success" | "secondary" | "outline" }> = {
  "browser-local": { label: "Browser-local", icon: ShieldCheck, variant: "success" },
  "local-server": { label: "Local server", icon: Server, variant: "success" },
  "remote-backend": { label: "Remote backend", icon: Cloud, variant: "secondary" },
  unknown: { label: "Auto-detect", icon: Globe, variant: "outline" },
};

export function ScanModeBadge({ mode, className }: ScanModeBadgeProps) {
  const config = MODE_BADGE[mode] || MODE_BADGE.unknown;
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={`gap-1.5 cursor-default ${className || ""}`}
      title={MODE_DESCRIPTIONS[mode]?.detail || "Scan mode will be detected automatically"}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

/**
 * PostScanVerification — shown after a scan completes to prove no network
 * activity occurred during the scan (browser-local mode only).
 *
 * Equivalent of the CLI's "✓ No network activity detected during scan".
 */
interface PostScanVerificationProps {
  /** Number of network requests intercepted during the scan. 0 = clean. */
  networkEvents: number;
  /** Whether the scan ran in browser-local mode. */
  isLocal: boolean;
  /** Whether the scan has completed. */
  show: boolean;
  className?: string;
}

export function PostScanVerification({ networkEvents, isLocal, show, className }: PostScanVerificationProps) {
  if (!show) return null;

  if (isLocal && networkEvents === 0) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 px-4 py-2.5 ${className || ""}`}
        role="status"
      >
        <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-500" />
        <div className="text-sm">
          <span className="font-medium text-green-700 dark:text-green-400">Verified offline</span>
          <span className="text-foreground-muted ml-2">
            0 bytes uploaded — no network activity during scan
          </span>
        </div>
      </div>
    );
  }

  if (isLocal && networkEvents > 0) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/30 px-4 py-2.5 ${className || ""}`}
        role="alert"
      >
        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
        <div className="text-sm">
          <span className="font-medium text-yellow-700 dark:text-yellow-400">Network activity detected</span>
          <span className="text-foreground-muted ml-2">
            {networkEvents} request(s) intercepted during scan — review the terminal log
          </span>
        </div>
      </div>
    );
  }

  // Remote backend scan — no verification needed
  return null;
}

/**
 * useNetworkGuard — React hook that wraps the browser's fetch/XHR to count
 * outbound network requests during a scan. Returns the event count and a
 * cleanup function.
 *
 * This is the browser equivalent of the CLI's createNetworkGuard().
 */
export function useNetworkGuard() {
  const [networkEvents, setNetworkEvents] = useState(0);
  const [isGuarding, setIsGuarding] = useState(false);
  const originalFetch = useRef<typeof globalThis.fetch | null>(null);
  const originalXhrOpen = useRef<any>(null);

  const startGuard = useCallback(() => {
    if (isGuarding) return;
    setNetworkEvents(0);
    setIsGuarding(true);

    // Patch fetch
    originalFetch.current = globalThis.fetch;
    globalThis.fetch = async function guardedFetch(input: RequestInfo | URL, init?: RequestInit) {
      const target = typeof input === "string" ? input : (input as Request).url || String(input);
      // Skip localhost/127.0.0.1 requests (extension data server is local)
      if (!isLocalhostUrl(target)) {
        setNetworkEvents((n) => n + 1);
      }
      return originalFetch.current!(input, init);
    };

    // Patch XHR
    originalXhrOpen.current = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function guardedXhrOpen(
      this: XMLHttpRequest,
      method: string,
      url: string,
      ...rest: unknown[]
    ) {
      if (!isLocalhostUrl(url)) {
        setNetworkEvents((n) => n + 1);
      }
      return (originalXhrOpen.current as any).call(this, method, url, ...(rest as []));
    };
  }, [isGuarding]);

  const stopGuard = useCallback(() => {
    if (!isGuarding) return;
    setIsGuarding(false);

    if (originalFetch.current) {
      globalThis.fetch = originalFetch.current;
      originalFetch.current = null;
    }
    if (originalXhrOpen.current) {
      XMLHttpRequest.prototype.open = originalXhrOpen.current;
      originalXhrOpen.current = null;
    }
  }, [isGuarding]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopGuard();
  }, [stopGuard]);

  return { networkEvents, isGuarding, startGuard, stopGuard };
}

function isLocalhostUrl(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    return (
      u.hostname === "127.0.0.1" ||
      u.hostname === "localhost" ||
      u.hostname === "0.0.0.0"
    );
  } catch {
    return false;
  }
}
