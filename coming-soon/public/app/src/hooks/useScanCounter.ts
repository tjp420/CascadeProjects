import { useState, useCallback, useEffect } from 'react';
import { useFeatureAccess } from './useFeatureAccess';
import { apiUrl, waitForApiBase } from '@/config';

const STORAGE_KEY = 'sb_scan_count';
const MONTH_KEY = 'sb_scan_month';
const RESET_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getStoredMonth(): number {
  try {
    return parseInt(localStorage.getItem(MONTH_KEY) || '0', 10);
  } catch {
    return 0;
  }
}

function getStoredCount(): number {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  } catch {
    return 0;
  }
}

function setStoredCount(count: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(count));
    const now = Date.now();
    localStorage.setItem(MONTH_KEY, String(now));
  } catch { /* ignore */ }
}

function shouldReset(): boolean {
  const lastMonth = getStoredMonth();
  if (!lastMonth) return false;
  return Date.now() - lastMonth > RESET_INTERVAL_MS;
}

export function useScanCounter() {
  const { capabilities } = useFeatureAccess();
  const [scanCount, setScanCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load count on mount and reset if month has elapsed
  useEffect(() => {
    if (shouldReset()) {
      setStoredCount(0);
    }
    setScanCount(getStoredCount());

    // Sync with backend if authenticated
    (async () => {
      try {
        const token = localStorage.getItem('sb_token') || localStorage.getItem('sb-token');
        if (!token) return;
        await waitForApiBase();
        const resp = await fetch(apiUrl('/scans/count'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          if (typeof data.count === 'number') {
            setScanCount(data.count);
            setStoredCount(data.count);
          }
        }
      } catch { /* ignore — use local count */ }
    })();
  }, []);

  const increment = useCallback(async () => {
    setLoading(true);
    const newCount = scanCount + 1;
    setScanCount(newCount);
    setStoredCount(newCount);

    // Best-effort backend sync
    try {
      const token = localStorage.getItem('sb_token') || localStorage.getItem('sb-token');
      if (token) {
        await waitForApiBase();
        await fetch(apiUrl('/scans/increment'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch { /* ignore — local count is the source of truth for free tier */ }
    finally { setLoading(false); }
  }, [scanCount]);

  const remaining = Math.max(0, capabilities.maxScans - scanCount);
  const limitReached = capabilities.maxScans !== Infinity && scanCount >= capabilities.maxScans;
  const canScan = !limitReached && !loading;

  return { scanCount, remaining, limitReached, canScan, increment, maxScans: capabilities.maxScans };
}
