import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, Check, Terminal, Download, Zap, ShieldCheck } from 'lucide-react';

const VSIX_DOWNLOAD_URL = 'https://github.com/tjp420/simplebeacon/releases/latest/download/simplebeacon.vsix';
const CLI_INSTALL_CMD = 'npx simplebeacon scan --gate --offline';
const CLI_FULL_CMD = 'npx simplebeacon scan --full --gate --format json';

/**
 * Post-scan nudge panel shown after a web-based scan completes.
 * Encourages users to install the CLI or VS Code extension for deeper local scanning.
 */
export function PostScanCliNudge({ scanGatePass }: { scanGatePass?: boolean }) {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const handleCopy = async (cmd: string, key: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(key);
      setTimeout(() => setCopiedCmd(null), 2500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <Card className="border-emerald-500/30 bg-card shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Terminal className="h-7 w-7 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="text-emerald-400 font-bold font-mono text-sm tracking-wide">
              {scanGatePass ? 'Lock In Your Clean Gate — Run Scans Locally' : 'Get Deeper Findings — Run Scans Locally'}
            </h4>
            <p className="text-foreground-muted text-sm mt-1 leading-relaxed">
              The browser scan covers the basics. The CLI and VS Code extension run the full
              deterministic rule engine across your entire repository — no source code upload required.
            </p>

            <div className="grid gap-2 mt-4">
              <div className="flex items-center gap-2 bg-background/60 p-1.5 border border-border rounded-md">
                <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0 ml-1.5" />
                <input
                  type="text"
                  readOnly
                  value={CLI_INSTALL_CMD}
                  className="bg-transparent text-foreground-muted text-xs px-1 py-1 w-full font-mono outline-none truncate"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(CLI_INSTALL_CMD, 'install')}
                  className="whitespace-nowrap text-xs shrink-0"
                >
                  {copiedCmd === 'install' ? (
                    <><Check className="h-3.5 w-3.5 mr-1" /> Copied</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>
                  )}
                </Button>
              </div>

              <div className="flex items-center gap-2 bg-background/60 p-1.5 border border-border rounded-md">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-400 shrink-0 ml-1.5" />
                <input
                  type="text"
                  readOnly
                  value={CLI_FULL_CMD}
                  className="bg-transparent text-foreground-muted text-xs px-1 py-1 w-full font-mono outline-none truncate"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(CLI_FULL_CMD, 'full')}
                  className="whitespace-nowrap text-xs shrink-0"
                >
                  {copiedCmd === 'full' ? (
                    <><Check className="h-3.5 w-3.5 mr-1" /> Copied</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-4">
              <a href={VSIX_DOWNLOAD_URL} download className="inline-flex">
                <Button type="button" size="sm" className="text-xs">
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Download VS Code Extension
                </Button>
              </a>
              <span className="text-xs text-foreground-muted self-center">
                or run <code className="font-mono text-foreground-muted bg-muted px-1.5 py-0.5 rounded">npm i -g simplebeacon</code>
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
