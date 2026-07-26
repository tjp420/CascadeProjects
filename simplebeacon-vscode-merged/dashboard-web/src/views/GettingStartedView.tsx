import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Rocket, FolderSearch, ClipboardList, Settings } from 'lucide-react';
import { navigate } from '@/router/HashRouter';

export function GettingStartedView() {
  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Getting Started</h1>
        <p className="text-foreground-muted">Quick start guide for SimpleBeacon</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <Rocket className="h-8 w-8 text-primary" />
            <CardTitle>1. Run Your First Scan</CardTitle>
            <CardDescription>Analyze a project for AI safety issues</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={() => navigate('analyze')}>
              Go to Analyze
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <FolderSearch className="h-8 w-8 text-primary" />
            <CardTitle>2. Configure Scan Paths</CardTitle>
            <CardDescription>Set up production paths and scan scope</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={() => navigate('settings')}>
              Open Settings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <ClipboardList className="h-8 w-8 text-primary" />
            <CardTitle>3. Review Results</CardTitle>
            <CardDescription>Check findings and gate status</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={() => navigate('results')}>
              View Results
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Settings className="h-8 w-8 text-primary" />
            <CardTitle>4. Export Reports</CardTitle>
            <CardDescription>Generate audit and compliance reports</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={() => navigate('audit')}>
              Go to Audit
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
