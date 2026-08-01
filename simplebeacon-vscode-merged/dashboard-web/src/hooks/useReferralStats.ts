import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '@/config';

export interface ReferralLedgerEntry {
  id: string;
  date: string;
  status: string;
  reward: number;
  refereeEmail?: string | null;
}

export interface ReferralStatsPayload {
  clicks: number;
  signups: number;
  conversions: number;
  attributions: number;
  pendingPayout: number;
  partnerCode: string | null;
  shareUrl: string | null;
}

export interface ReferralStatsResponse {
  success: boolean;
  stats: ReferralStatsPayload;
  ledger: ReferralLedgerEntry[];
  error?: string;
}

interface UseReferralStatsResult {
  data: ReferralStatsResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function normalizeResponse(raw: Record<string, unknown>): ReferralStatsResponse {
  const nested = raw.stats as ReferralStatsPayload | undefined;
  const stats: ReferralStatsPayload = nested || {
    clicks: Number(raw.clicks) || 0,
    signups: Number(raw.signups) || 0,
    conversions: Number(raw.conversions) || 0,
    attributions: Number(raw.attributions) || 0,
    pendingPayout: Number(raw.certCreditCents || 0) / 100,
    partnerCode: (raw.partnerCode as string) || null,
    shareUrl: (raw.shareUrl as string) || null,
  };
  const ledger = Array.isArray(raw.ledger) ? (raw.ledger as ReferralLedgerEntry[]) : [];
  return { success: raw.success === true, stats, ledger, error: raw.error as string | undefined };
}

export function useReferralStats(email?: string | null): UseReferralStatsResult {
  const [data, setData] = useState<ReferralStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!email || !email.includes('@')) {
      setData(null);
      setError('Sign in with an email address to view referral stats.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${apiUrl('referral/stats')}?email=${encodeURIComponent(email)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(String(json?.error || `Request failed (${res.status})`));
        }
        return normalizeResponse(json);
      })
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
          if (!payload.success) {
            setError(payload.error || 'Unable to load referral stats.');
          }
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setData(null);
          setError(err.message || 'Unable to load referral stats.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [email, tick]);

  return { data, loading, error, refresh };
}
