import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Copy,
    Check,
    Terminal,
    Download,
    Zap,
    ShieldCheck,
    Eye,
    Wrench,
    ShieldAlert,
    FileText,
    GitBranch
} from 'lucide-react';

const EXTENSION_VERSION = '3.0.490';
const CLI_INSTALL_CMD = 'npx simplebeacon scan --gate --offline';
const CLI_FULL_CMD = 'npx simplebeacon scan --full --gate --format json';
const CLI_DRY_RUN_CMD = 'npx simplebeacon fix . --fix-dry-run';
const CLI_UPDATE_CVE_CMD = 'npx simplebeacon update-cve-db';

const CLI_ONLY_SCANNERS = [
    {
        icon: ShieldAlert,
        name: 'CVE Dependency Scanner',
        description:
            'Matches dependencies against NVD CVE database — finds known vulnerabilities with CVSS scores and fixed versions'
    },
    {
        icon: FileText,
        name: 'SBOM Generator',
        description:
            'Generates CycloneDX 1.5 Software Bill of Materials — required for SOC 2, EU AI Act, and EO 14028 compliance'
    },
    {
        icon: GitBranch,
        name: 'Git History Secret Scanner',
        description:
            'Scans git commit history for leaked secrets — catches credentials removed from working tree but still in git objects'
    }
];

function resolveVsixDownloadUrl(): string {
    if (typeof window !== 'undefined') {
        const cfg = (window as { SIMPLEBEACON_SITE_CONFIG?: { vsixDownloadUrl?: string } }).SIMPLEBEACON_SITE_CONFIG;
        if (cfg?.vsixDownloadUrl) {
            return cfg.vsixDownloadUrl;
        }
    }
    return 'https://github.com/tjp420/simplebeacon/releases/latest/download/simplebeacon.vsix';
}

/**
 * Post-scan nudge panel shown after a web-based scan completes.
 * Encourages users to install the CLI or VS Code extension for deeper local scanning.
 */
export function PostScanCliNudge({ scanGatePass }: { scanGatePass?: boolean }) {
    const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
    const vsixDownloadUrl = resolveVsixDownloadUrl();

    const handleCopy = async (cmd: string, key: string) => {
        try {
            await navigator.clipboard.writeText(cmd);
            setCopiedCmd(key);
            setTimeout(() => setCopiedCmd(null), 2500);
        } catch {
            /* clipboard blocked */
        }
    };

    const copyButton = (cmd: string, key: string) => (
        <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleCopy(cmd, key)}
            className="whitespace-nowrap text-xs shrink-0"
        >
            {copiedCmd === key ? (
                <>
                    <Check className="h-3.5 w-3.5 mr-1" /> Copied
                </>
            ) : (
                <>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                </>
            )}
        </Button>
    );

    return (
        <Card className="border-emerald-500/30 bg-card shadow-md">
            <CardContent className="p-5">
                <div className="flex items-start gap-4">
                    <Terminal className="h-7 w-7 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-emerald-400 font-bold font-mono text-sm tracking-wide">
                                {scanGatePass
                                    ? 'Lock In Your Clean Gate — Run Scans Locally'
                                    : 'Get Deeper Findings — Run Scans Locally'}
                            </h4>
                            <Badge variant="outline" className="text-[10px] font-mono">
                                Extension v{EXTENSION_VERSION}
                            </Badge>
                        </div>
                        <p className="text-foreground-muted text-sm mt-1 leading-relaxed">
                            The browser scan covers the basics. The CLI and VS Code extension run the full deterministic
                            rule engine across your entire repository — no source code upload required.
                        </p>

                        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                            <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                                <Zap className="h-3.5 w-3.5 shrink-0" />
                                IDE Automation Active
                            </p>
                            <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
                                Set{' '}
                                <code className="font-mono bg-muted px-1 py-0.5 rounded">
                                    simplebeacon.enableDryRunOnSave: true
                                </code>{' '}
                                to preview safe remediation recipes directly inside your Output channel on every
                                document save.
                            </p>
                        </div>

                        <div className="grid gap-1.5 mt-3">
                            <div className="flex items-center gap-2 text-xs text-foreground-muted">
                                <Eye className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                                <span>
                                    Real-time IDE compliance — catch algorithmic redundancy and token exposure as you
                                    type
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-foreground-muted">
                                <Wrench className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                <span>
                                    Safe pre-commit previews — run{' '}
                                    <code className="font-mono bg-muted px-1 py-0.5 rounded">
                                        Preview Safe AI Code Fixes (Dry Run)
                                    </code>{' '}
                                    from the command palette (v{EXTENSION_VERSION})
                                </span>
                            </div>
                        </div>

                        <div className="grid gap-2 mt-4">
                            <div className="flex items-center gap-2 bg-background/60 p-1.5 border border-border rounded-md">
                                <Wrench className="h-3.5 w-3.5 text-amber-400 shrink-0 ml-1.5" />
                                <input
                                    type="text"
                                    readOnly
                                    value={CLI_DRY_RUN_CMD}
                                    className="bg-transparent text-foreground-muted text-xs px-1 py-1 w-full font-mono outline-none truncate"
                                    aria-label="Dry-run fix command"
                                />
                                {copyButton(CLI_DRY_RUN_CMD, 'dryrun')}
                            </div>

                            <div className="flex items-center gap-2 bg-background/60 p-1.5 border border-border rounded-md">
                                <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0 ml-1.5" />
                                <input
                                    type="text"
                                    readOnly
                                    value={CLI_INSTALL_CMD}
                                    className="bg-transparent text-foreground-muted text-xs px-1 py-1 w-full font-mono outline-none truncate"
                                    aria-label="Gate scan command"
                                />
                                {copyButton(CLI_INSTALL_CMD, 'install')}
                            </div>

                            <div className="flex items-center gap-2 bg-background/60 p-1.5 border border-border rounded-md">
                                <ShieldCheck className="h-3.5 w-3.5 text-indigo-400 shrink-0 ml-1.5" />
                                <input
                                    type="text"
                                    readOnly
                                    value={CLI_FULL_CMD}
                                    className="bg-transparent text-foreground-muted text-xs px-1 py-1 w-full font-mono outline-none truncate"
                                    aria-label="Full scan command"
                                />
                                {copyButton(CLI_FULL_CMD, 'full')}
                            </div>
                        </div>

                        <div className="mt-4 rounded-md border border-indigo-500/30 bg-indigo-500/5 px-3 py-3">
                            <p className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5 mb-2">
                                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                CLI-Only Scanners (3 enterprise-grade checks)
                            </p>
                            <div className="grid gap-2">
                                {CLI_ONLY_SCANNERS.map(({ icon: Icon, name, description }) => (
                                    <div key={name} className="flex items-start gap-2 text-xs text-foreground-muted">
                                        <Icon className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-semibold text-foreground">{name}</span>
                                            <span className="block mt-0.5 leading-relaxed">{description}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 bg-background/60 p-1.5 border border-border rounded-md mt-2.5">
                                <ShieldAlert className="h-3.5 w-3.5 text-indigo-400 shrink-0 ml-1.5" />
                                <input
                                    type="text"
                                    readOnly
                                    value={CLI_UPDATE_CVE_CMD}
                                    className="bg-transparent text-foreground-muted text-xs px-1 py-1 w-full font-mono outline-none truncate"
                                    aria-label="Update CVE database command"
                                />
                                {copyButton(CLI_UPDATE_CVE_CMD, 'cveupdate')}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 mt-4">
                            <a
                                href={vsixDownloadUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex"
                            >
                                <Button type="button" size="sm" className="text-xs">
                                    <Download className="h-3.5 w-3.5 mr-1.5" /> Download VS Code Extension
                                </Button>
                            </a>
                            <span className="text-xs text-foreground-muted self-center">
                                or run{' '}
                                <code className="font-mono text-foreground-muted bg-muted px-1.5 py-0.5 rounded">
                                    npm i -g simplebeacon
                                </code>
                            </span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
