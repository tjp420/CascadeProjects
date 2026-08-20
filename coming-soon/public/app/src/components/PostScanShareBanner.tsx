import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, Check, Share2, Twitter, Linkedin, Mail } from 'lucide-react';
import { apiUrl } from '@/config';
import { resolveScanLetterGrade } from '@/lib/gradeFromScore';

interface PostScanShareBannerProps {
    qualityScore: number | null;
    gatePass: boolean;
    userEmail?: string | null;
    currentScanGrade?: string;
    shareUrl?: string | null;
}

function buildSocialShareText(grade: string, gatePass: boolean, score: number | null): string {
    if (gatePass && grade && grade !== '—') {
        return `Just cleared my codebase audit check with a SimpleBeacon grade of ${grade} using edge-speed local AI heuristics! No code uploads, 100% private. https://simplebeacon.ai`;
    }
    const scorePart = score != null ? `, Quality: ${score}%` : '';
    return `I ran a local-first compliance scan with SimpleBeacon — Gate: ${gatePass ? 'PASS' : 'FAIL'}${scorePart}. Zero upload, runs on your machine. https://simplebeacon.ai`;
}

/**
 * Post-scan share banner for social/referral sharing of scan results.
 * Fetches personalized referral link when user email is available.
 */
export function PostScanShareBanner({
    qualityScore,
    gatePass,
    userEmail,
    currentScanGrade,
    shareUrl: shareUrlProp
}: PostScanShareBannerProps) {
    const [copied, setCopied] = useState(false);
    const [shared, setShared] = useState<string | null>(null);
    const [referralUrl, setReferralUrl] = useState<string | null>(shareUrlProp ?? null);
    const [loadingLink, setLoadingLink] = useState(false);

    const score = qualityScore != null ? Math.round(qualityScore) : null;
    const grade = currentScanGrade || resolveScanLetterGrade(qualityScore);
    const shareText = buildSocialShareText(grade, gatePass, score);
    const encodedText = encodeURIComponent(shareText);

    useEffect(() => {
        if (shareUrlProp) {
            setReferralUrl(shareUrlProp);
            return;
        }
        if (!userEmail || !userEmail.includes('@')) {
            return;
        }

        let cancelled = false;
        setLoadingLink(true);
        fetch(`${apiUrl('referral/link')}?email=${encodeURIComponent(userEmail)}&channel=results-share`)
            .then(res => res.json())
            .then(data => {
                if (!cancelled && data?.success && data.shareUrl) {
                    setReferralUrl(String(data.shareUrl));
                }
            })
            .catch(() => {
                /* best-effort */
            })
            .finally(() => {
                if (!cancelled) setLoadingLink(false);
            });

        return () => {
            cancelled = true;
        };
    }, [userEmail, shareUrlProp]);

    const trackingUrl = referralUrl || 'https://simplebeacon.ai';

    const handleCopy = async () => {
        try {
            const payload = userEmail && referralUrl ? `${shareText.split(' https://')[0]} ${trackingUrl}` : shareText;
            await navigator.clipboard.writeText(payload.trim());
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            /* clipboard blocked */
        }
    };

    const handleSocial = (platform: string) => {
        setShared(platform);
        setTimeout(() => setShared(null), 2500);
    };

    const tweetText = encodeURIComponent(
        gatePass && grade && grade !== '—'
            ? `Just cleared my codebase audit check with a SimpleBeacon grade of ${grade} using edge-speed local AI heuristics! No code uploads, 100% private. ${trackingUrl}`
            : shareText.replace('https://simplebeacon.ai', trackingUrl)
    );

    return (
        <Card className="border-sky-500/30 bg-card shadow-md">
            <CardContent className="p-5">
                <div className="flex items-start gap-4">
                    <Share2 className="h-6 w-6 text-sky-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sky-400 font-bold font-mono text-sm tracking-wide">
                            Share Your Scan Result
                        </h4>
                        <p className="text-foreground-muted text-sm mt-1 leading-relaxed">
                            {gatePass ? (
                                <>
                                    Your repo passed the compliance gate
                                    {grade && grade !== '—' ? (
                                        <>
                                            {' '}
                                            with grade{' '}
                                            <span className="font-mono text-emerald-400 font-semibold">{grade}</span>
                                        </>
                                    ) : score != null ? (
                                        <> with a {score}% quality score</>
                                    ) : null}
                                    . Share the win — your link includes referral tracking when signed in.
                                </>
                            ) : (
                                <>
                                    Your scan flagged compliance issues. Share SimpleBeacon so your team can run their
                                    own local scans.
                                </>
                            )}
                        </p>

                        <div className="flex items-center gap-2 mt-3 bg-background/60 p-1.5 border border-border rounded-md">
                            <input
                                type="text"
                                readOnly
                                value={loadingLink ? 'Generating your tracking link…' : trackingUrl}
                                className="bg-transparent text-foreground-muted text-xs px-2 py-1 w-full font-mono outline-none truncate"
                                aria-label="Share URL"
                            />
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleCopy}
                                disabled={loadingLink}
                                className="whitespace-nowrap text-xs shrink-0"
                            >
                                {copied ? (
                                    <>
                                        <Check className="h-3.5 w-3.5 mr-1" /> Copied
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                                    </>
                                )}
                            </Button>
                        </div>

                        <p className="text-[11px] text-foreground-muted mt-2 font-mono truncate" title={shareText}>
                            Preview: {shareText}
                        </p>

                        <div className="flex flex-wrap gap-2 mt-3">
                            <a
                                href={`https://twitter.com/intent/tweet?text=${tweetText}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => handleSocial('twitter')}
                                className="inline-flex"
                            >
                                <Button type="button" size="sm" variant="outline" className="text-xs">
                                    <Twitter className="h-3.5 w-3.5 mr-1.5" />
                                    {shared === 'twitter' ? 'Opened!' : 'Tweet'}
                                </Button>
                            </a>
                            <a
                                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(trackingUrl)}&summary=${encodedText}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => handleSocial('linkedin')}
                                className="inline-flex"
                            >
                                <Button type="button" size="sm" variant="outline" className="text-xs">
                                    <Linkedin className="h-3.5 w-3.5 mr-1.5" />
                                    {shared === 'linkedin' ? 'Opened!' : 'LinkedIn'}
                                </Button>
                            </a>
                            <a
                                href={`mailto:?subject=${encodeURIComponent('My SimpleBeacon Scan Result')}&body=${encodeURIComponent(shareText.replace('https://simplebeacon.ai', trackingUrl))}`}
                                onClick={() => handleSocial('email')}
                                className="inline-flex"
                            >
                                <Button type="button" size="sm" variant="outline" className="text-xs">
                                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                                    {shared === 'email' ? 'Opened!' : 'Email'}
                                </Button>
                            </a>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
