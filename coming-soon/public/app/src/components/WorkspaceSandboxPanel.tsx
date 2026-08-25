import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Link, Webhook, Loader2 } from 'lucide-react';

interface SandboxSummary {
    success: boolean;
    orgId: string;
    sso: { count: number; providers: string[] };
    integrations: { count: number; types: Record<string, number> };
    webhooks: { count: number; targets: string[] };
}

interface WorkspaceSandboxPanelProps {
    summary: SandboxSummary | null;
    loading: boolean;
    error: string | null;
}

export function WorkspaceSandboxPanel({ summary, loading, error }: WorkspaceSandboxPanelProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Multi-Tenant Sandbox Telemetry
                </CardTitle>
                <CardDescription>Read-only metadata counts for cryptographic tenant isolation.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading && (
                    <div className="flex items-center gap-2 text-sm text-foreground-muted">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading sandbox telemetry...
                    </div>
                )}
                {error && !loading && (
                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
                )}
                {!loading && !error && summary && (
                    <div className="grid gap-4 sm:grid-cols-3">
                        <SandboxCard
                            icon={<Shield className="h-4 w-4" />}
                            label="SSO Configs"
                            count={summary.sso.count}
                            tags={summary.sso.providers}
                        />
                        <SandboxCard
                            icon={<Link className="h-4 w-4" />}
                            label="Integrations"
                            count={summary.integrations.count}
                            tags={Object.entries(summary.integrations.types).map(([k, v]) => `${k} (${v})`)}
                        />
                        <SandboxCard
                            icon={<Webhook className="h-4 w-4" />}
                            label="Webhook Targets"
                            count={summary.webhooks.count}
                            tags={summary.webhooks.targets}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function SandboxCard({
    icon,
    label,
    count,
    tags
}: {
    icon: React.ReactNode;
    label: string;
    count: number;
    tags: string[];
}) {
    return (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground-muted">
                {icon}
                {label}
            </div>
            <div className="mt-2 text-2xl font-bold">{count}</div>
            <div className="mt-2 flex flex-wrap gap-1">
                {tags.slice(0, 6).map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                    </Badge>
                ))}
                {tags.length > 6 && (
                    <Badge variant="secondary" className="text-xs">
                        +{tags.length - 6}
                    </Badge>
                )}
            </div>
        </div>
    );
}
