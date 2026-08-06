import { useState, useEffect } from 'react';
import { ShieldCheck, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * OfflineStatusBadge — displays a real-time indicator showing whether the
 * browser sandbox is running in offline (Zero Data Custody) mode or online.
 *
 * When offline: green "Local Sandbox Active" badge — scans run 100% locally,
 * zero network requests, code never leaves the machine.
 * When online: muted "Online" badge — scans still run locally in the browser
 * sandbox, but the browser has network connectivity.
 */
export function OfflineStatusBadge() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <Badge
        variant="success"
        className="gap-1.5 cursor-default"
        title="Offline mode: scans run 100% in your browser. Zero network requests. Code never leaves your machine."
      >
        <ShieldCheck className="h-3 w-3" />
        Local Sandbox Active
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="gap-1.5 cursor-default text-foreground-muted"
      title="Browser is online. Scans still run locally in the browser sandbox — code is never uploaded to a server. Disconnect your internet to verify Zero Data Custody."
    >
      <Wifi className="h-3 w-3" />
      Online
    </Badge>
  );
}
