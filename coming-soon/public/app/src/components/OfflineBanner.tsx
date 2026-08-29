import { useState, useEffect } from "react";
import { WifiOff, ShieldCheck } from "lucide-react";

/**
 * OfflineBanner — shows a dismissible banner when the browser is offline.
 *
 * The dashboard's fetch wrapper (main.tsx) short-circuits all API calls
 * when offline, returning synthetic empty responses. This banner gives
 * the user a visible explanation so they know why data is empty and
 * that local scanning still works.
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setDismissed(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setDismissed(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline || dismissed) return null;

  return (
    <div
      className="flex items-center gap-3 border-b border-warning bg-warning-subtle px-4 py-2.5 text-sm"
      role="alert"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-warning" />
      <div className="flex-1">
        <span className="font-medium text-warning">
          You&rsquo;re offline. Dashboard data is unavailable.
        </span>{" "}
        <span className="text-foreground-muted">
          <ShieldCheck className="mr-1 inline h-3 w-3" />
          Local browser scanning still works — your code never leaves your machine.
          Data will refresh when connectivity returns.
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-foreground-muted hover:text-foreground"
        aria-label="Dismiss offline banner"
      >
        &times;
      </button>
    </div>
  );
}
