import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings, Key, FolderTree, Cpu, Palette, Bell } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function SettingsView() {
  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-foreground-muted">Configure API keys, scan paths, AI providers, and preferences</p>
      </div>

      <Tabs defaultValue="api">
        <TabsList>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="paths">Scan Paths</TabsTrigger>
          <TabsTrigger value="ai">AI Providers</TabsTrigger>
          <TabsTrigger value="theme">Theme</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage API keys for scanning and analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>OpenAI API Key</Label>
                <Input type="password" placeholder="sk-..." />
              </div>
              <div className="space-y-2">
                <Label>Anthropic API Key</Label>
                <Input type="password" placeholder="sk-ant-..." />
              </div>
              <Button>Save Keys</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paths">
          <Card>
            <CardHeader>
              <CardTitle>Scan Paths</CardTitle>
              <CardDescription>Configure which directories to scan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Project Path</Label>
                <Input placeholder="/path/to/project" />
              </div>
              <div className="space-y-2">
                <Label>Production Paths</Label>
                <Input placeholder="server/, src/, web/" />
              </div>
              <Button>Save Paths</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle>AI Providers</CardTitle>
              <CardDescription>Configure AI analysis providers</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground-muted">AI provider configuration will be available here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="theme">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Customize the dashboard appearance</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground-muted">
                Use the theme toggle in the header to switch between light and dark mode.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Configure scan and alert notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground-muted">Notification settings will be available here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
