import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiUrl } from '@/config';
import { isPassingReferralGrade } from '@/lib/gradeFromScore';
import { Copy, Check, Trophy, Mail } from 'lucide-react';

interface ResultsReferralBannerProps {
  userEmail?: string;
  currentScanGrade: string;
}

/**
 * High-visibility referral banner shown after a B-or-better scan result.
 */
export function ResultsReferralBanner({ userEmail, currentScanGrade }: ResultsReferralBannerProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    if (!isPassingReferralGrade(currentScanGrade) || !userEmail) return;

    let cancelled = false;
    setLoading(true);
    fetch(`${apiUrl('referral/link')}?email=${encodeURIComponent(userEmail)}&channel=dashboard`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.success && data.shareUrl) {
          setShareUrl(String(data.shareUrl));
        }
      })
      .catch(() => {
        /* best-effort — banner still renders with fallback */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userEmail, currentScanGrade]);

  if (!isPassingReferralGrade(currentScanGrade)) return null;

  const computedTrackingUrl =
    shareUrl || `https://simplebeacon.ai/?ref=${encodeURIComponent(userEmail ? 'pending' : 'dev-token')}`;

  const handleCopyAction = async () => {
    try {
      await navigator.clipboard.writeText(computedTrackingUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      /* clipboard blocked — user can still select the input */
    }
  };

  const handleEmailLink = async () => {
    if (!userEmail || emailSending) return;
    setEmailSending(true);
    try {
      const res = await fetch(
        `${apiUrl('referral/link')}?email=${encodeURIComponent(userEmail)}&channel=dashboard&sendEmail=true`
      );
      const data = await res.json();
      if (data?.success && (data.emailSent || data.emailQueued)) {
        setEmailSent(true);
        setTimeout(() => setEmailSent(false), 4000);
      }
    } catch {
      /* best-effort */
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <Card className="mt-6 border-indigo-500/40 bg-card shadow-lg max-w-2xl mx-auto">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Trophy className="h-8 w-8 text-indigo-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="text-indigo-400 font-bold font-mono text-base tracking-wide">
              Pass Your Next Compliance Audit For Free
            </h4>
            <p className="text-foreground-muted text-sm mt-1 leading-relaxed">
              Your repository achieved a secure{' '}
              <span className="text-emerald-400 font-bold font-mono">[{currentScanGrade}]</span>. Share SimpleBeacon
              with another engineering manager. When they execute a private local code debt scan, you both instantly
              unlock{' '}
              <span className="text-foreground font-semibold">
                Unlimited SOC 2 Compliance PDF Certificate Generation
              </span>{' '}
              for 30 days.
            </p>

            <div className="flex items-center gap-2 mt-4 bg-background/60 p-1.5 border border-border rounded-md">
              <input
                type="text"
                readOnly
                value={loading ? 'Generating your share link…' : computedTrackingUrl}
                className="bg-transparent text-foreground-muted text-xs px-2 py-1 w-full font-mono outline-none truncate"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleEmailLink}
                disabled={loading || !userEmail || emailSending}
                className="whitespace-nowrap text-xs shrink-0"
              >
                {emailSent ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" /> Sent
                  </>
                ) : (
                  <>
                    <Mail className="h-3.5 w-3.5 mr-1" /> {emailSending ? 'Sending…' : 'Email Link'}
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCopyAction}
                disabled={loading || !shareUrl}
                className={`whitespace-nowrap text-xs shrink-0 ${
                  isCopied ? 'bg-emerald-600 hover:bg-emerald-600' : ''
                }`}
              >
                {isCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" /> Copied Link
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy Share URL
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
