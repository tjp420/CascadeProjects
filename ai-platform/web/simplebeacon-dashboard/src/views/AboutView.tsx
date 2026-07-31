import { Card, CardContent } from '@/components/ui/card';
import { Info } from 'lucide-react';

export function AboutView() {
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">About</h1>
        <p className="text-foreground-muted">About SimpleBeacon</p>
      </div>
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7 text-primary-foreground"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 12 15 16 10" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold">SimpleBeacon</h2>
              <p className="text-sm text-foreground-muted">AI Safety Scanning Platform</p>
            </div>
          </div>
          <p className="text-sm text-foreground-secondary">
            SimpleBeacon is a deterministic AI safety scanner that checks repositories for
            credentials, mock paths, production leak directories, and compliance gate rules. It
            provides pattern-matching scans (not semantic code review) scoped to configured
            scanPaths and production directories.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
