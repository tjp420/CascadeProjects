import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, Check, Share2, Twitter, Linkedin, Mail } from 'lucide-react';

interface PostScanShareBannerProps {
  qualityScore: number | null;
  gatePass: boolean;
  shareUrl?: string | null;
}

/**
 * Post-scan share banner for social/referral sharing of scan results.
 * Shows shareable score summary with copy link and social CTAs.
 */
export function PostScanShareBanner({ qualityScore, gatePass, shareUrl }: PostScanShareBannerProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState<string | null>(null);

  const score = qualityScore != null ? Math.round(qualityScore) : null;
  const gradeText = gatePass ? 'PASS' : 'FAIL';
  const shareText = `I just ran a local-first compliance scan on my repo with SimpleBeacon — Gate: ${gradeText}${score != null ? `, Quality: ${score}%` : ''}. Zero upload, runs on your machine. https://simplebeacon.ai`;
  const encodedText = encodeURIComponent(shareText);
  const url = shareUrl || 'https://simplebeacon.ai';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}`);
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
                <>Your repo passed the compliance gate{score != null ? ` with a ${score}% quality score` : ''}. Share the win with your network.</>
              ) : (
                <>Your scan flagged compliance issues. Share SimpleBeacon so your team can run their own local scans.</>
              )}
            </p>

            <div className="flex items-center gap-2 mt-3 bg-background/60 p-1.5 border border-border rounded-md">
              <input
                type="text"
                readOnly
                value={url}
                className="bg-transparent text-foreground-muted text-xs px-2 py-1 w-full font-mono outline-none truncate"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="whitespace-nowrap text-xs shrink-0"
              >
                {copied ? (
                  <><Check className="h-3.5 w-3.5 mr-1" /> Copied</>
                ) : (
                  <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>
                )}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodedText}`}
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
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&summary=${encodedText}`}
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
                href={`mailto:?subject=My%20SimpleBeacon%20Scan%20Result&body=${encodedText}`}
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
