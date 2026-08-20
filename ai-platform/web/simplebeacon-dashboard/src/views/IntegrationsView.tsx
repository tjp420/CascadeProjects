// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare,
  Building2,
  GitPullRequest,
  Plus,
  Trash2,
  Zap,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Webhook,
} from "lucide-react";
import { apiUrl, authHeaders } from "@/config";
import { toast } from "sonner";

type IntegrationType = {
  id: string;
  label: string;
  requiredFields: string[];
  secretFields: string[];
  description: string;
};

type IntegrationConfig = {
  configId: string;
  orgId: string;
  type: string;
  name: string;
  enabled: boolean;
  events: string[];
  config: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

type EventTypes = Record<string, string>;

const TYPE_ICONS: Record<string, React.ReactNode> = {
  slack: <MessageSquare className="h-5 w-5" />,
  teams: <Building2 className="h-5 w-5" />,
  jira: <Zap className="h-5 w-5" />,
  github: <GitPullRequest className="h-5 w-5" />,
};

export function IntegrationsView() {
  const [configs, setConfigs] = useState<IntegrationConfig[]>([]);
  const [types, setTypes] = useState<Record<string, IntegrationType>>({});
  const [events, setEvents] = useState<EventTypes>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    type: "slack",
    orgId: "",
    name: "",
    webhookUrl: "",
    host: "",
    email: "",
    apiToken: "",
    projectKey: "",
    token: "",
    owner: "",
    repo: "",
  });

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const [configsResp, typesResp, eventsResp] = await Promise.all([
        fetch(apiUrl("/integrations"), { headers: authHeaders() }),
        fetch(apiUrl("/integrations/types"), { headers: authHeaders() }),
        fetch(apiUrl("/integrations/events"), { headers: authHeaders() }),
      ]);
      if (configsResp.ok) {
        const data = await configsResp.json();
        setConfigs(data.configs || []);
      }
      if (typesResp.ok) {
        const data = await typesResp.json();
        setTypes(data.types || {});
      }
      if (eventsResp.ok) {
        const data = await eventsResp.json();
        setEvents(data.events || {});
      }
    } catch {
      toast.error("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleCreate = async () => {
    const form = createForm;
    const typeDef = types[form.type];
    if (!typeDef) return;

    const body: Record<string, unknown> = {
      type: form.type,
      orgId: form.orgId,
      name: form.name || `${typeDef.label} — ${form.orgId}`,
    };

    for (const field of typeDef.requiredFields) {
      if (!form[field]) {
        toast.error(`Missing required field: ${field}`);
        return;
      }
      body[field] = form[field];
    }

    try {
      const resp = await fetch(apiUrl("/integrations"), {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.message || "Create failed");
      }
      toast.success(`${typeDef.label} integration created`);
      setShowCreate(false);
      fetchConfigs();
    } catch (err: any) {
      toast.error(err.message || "Failed to create integration");
    }
  };

  const handleDelete = async (configId: string) => {
    try {
      const resp = await fetch(apiUrl(`/integrations/${configId}`), {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!resp.ok) throw new Error("Delete failed");
      toast.success("Integration deleted");
      fetchConfigs();
    } catch {
      toast.error("Failed to delete integration");
    }
  };

  const handleTest = async (configId: string) => {
    try {
      const resp = await fetch(apiUrl(`/integrations/${configId}/test`), {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        toast.success("Test notification sent successfully");
      } else {
        toast.error(data.message || data.error || "Test failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Test failed");
    }
  };

  const handleToggle = async (configId: string, enabled: boolean) => {
    try {
      const resp = await fetch(apiUrl(`/integrations/${configId}`), {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (!resp.ok) throw new Error("Toggle failed");
      toast.success(`Integration ${!enabled ? "enabled" : "disabled"}`);
      fetchConfigs();
    } catch {
      toast.error("Failed to toggle integration");
    }
  };

  const renderCreateFormFields = () => {
    const typeDef = types[createForm.type];
    if (!typeDef) return null;

    return typeDef.requiredFields.map((field) => (
      <div key={field} className="space-y-2">
        <Label htmlFor={field}>
          {field
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (s) => s.toUpperCase())}
        </Label>
        <Input
          id={field}
          type={typeDef.secretFields.includes(field) ? "password" : "text"}
          placeholder={
            field === "webhookUrl"
              ? "https://hooks.slack.com/services/..."
              : field
          }
          value={(createForm as any)[field] || ""}
          onChange={(e) =>
            setCreateForm({ ...createForm, [field]: e.target.value })
          }
        />
      </div>
    ));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Integration Marketplace</h3>
          <p className="text-sm text-muted-foreground">
            Connect compliance events to Slack, Teams, Jira, and GitHub PR
            comments
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchConfigs}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{" "}
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4" /> Add Integration
          </Button>
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Integration</CardTitle>
            <CardDescription>
              Configure a new notification channel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Integration Type</Label>
              <select
                id="type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={createForm.type}
                onChange={(e) =>
                  setCreateForm({ ...createForm, type: e.target.value })
                }
              >
                {Object.values(types).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              {types[createForm.type] && (
                <p className="text-xs text-muted-foreground">
                  {types[createForm.type].description}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgId">Organization ID</Label>
              <Input
                id="orgId"
                placeholder="org-id or 'default'"
                value={createForm.orgId}
                onChange={(e) =>
                  setCreateForm({ ...createForm, orgId: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                placeholder="My Slack #compliance channel"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, name: e.target.value })
                }
              />
            </div>
            {renderCreateFormFields()}
            <Separator />
            <div className="flex gap-2">
              <Button onClick={handleCreate}>Create Integration</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {configs.length === 0 && !loading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Webhook className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No integrations configured yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click "Add Integration" to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {configs.map((config) => {
            const typeDef = types[config.type];
            return (
              <Card key={config.configId}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      {TYPE_ICONS[config.type] || (
                        <Webhook className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-sm">{config.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {typeDef?.label || config.type} — {config.orgId}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={config.enabled ? "default" : "secondary"}>
                    {config.enabled ? "Active" : "Disabled"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {config.events.slice(0, 4).map((ev) => (
                      <Badge key={ev} variant="outline" className="text-xs">
                        {events[ev] || ev}
                      </Badge>
                    ))}
                    {config.events.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{config.events.length - 4} more
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTest(config.configId)}
                    >
                      <Zap className="h-3 w-3" /> Test
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleToggle(config.configId, config.enabled)
                      }
                    >
                      {config.enabled ? (
                        <XCircle className="h-3 w-3" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      {config.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(config.configId)}
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
