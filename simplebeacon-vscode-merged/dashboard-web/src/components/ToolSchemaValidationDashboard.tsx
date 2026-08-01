import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ShieldCheck,
  RefreshCw,
  Loader2,
  Save,
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Code2,
  Sparkles,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

type BadgeVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';

interface SchemaStats {
  builtinSchemaCount: number;
  customSchemaCount: number;
  totalSchemaCount: number;
  strictMode: boolean;
  totalViolations: number;
  violationStats: {
    totalViolations: number;
    totalErrors: number;
    byTool: Record<string, number>;
    byDirection: { request: number; response: number };
  };
}

interface ToolSchema {
  toolId: string;
  orgId: string;
  request: any;
  response: any;
  strictMode: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SchemasData {
  builtin: Record<string, { request: any; response: any }>;
  custom: Record<string, ToolSchema>;
}

interface Violation {
  id: string;
  timestamp: string;
  toolId: string;
  orgId: string;
  direction: string;
  errors: Array<{ path: string; message: string }>;
  errorCount: number;
}

interface ValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
  skipped?: boolean;
}

export function ToolSchemaValidationDashboard() {
  const [stats, setStats] = useState<SchemaStats | null>(null);
  const [schemas, setSchemas] = useState<SchemasData | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedTool, setSelectedTool] = useState('');
  const [schemaEditorText, setSchemaEditorText] = useState('');
  const [schemaDirection, setSchemaDirection] = useState<'request' | 'response'>('response');
  const [strictMode, setStrictMode] = useState(false);
  const [globalStrict, setGlobalStrict] = useState(false);

  const [validatePayload, setValidatePayload] = useState('');
  const [validateDirection, setValidateDirection] = useState<'request' | 'response'>('response');
  const [validateResult, setValidateResult] = useState<ValidationResult | null>(null);

  const [inferPayload, setInferPayload] = useState('');
  const [inferredSchema, setInferredSchema] = useState<any>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResp, schemasResp, violationsResp, configResp] = await Promise.all([
        fetch(apiUrl('/tool-schemas/stats'), { headers: authHeaders() }),
        fetch(apiUrl('/tool-schemas'), { headers: authHeaders() }),
        fetch(apiUrl('/tool-schemas/violations/list?limit=50'), { headers: authHeaders() }),
        fetch(apiUrl('/tool-schemas/config'), { headers: authHeaders() }),
      ]);
      const statsData = await statsResp.json();
      const schemasData = await schemasResp.json();
      const violationsData = await violationsResp.json();
      const configData = await configResp.json();
      if (statsData.success) setStats(statsData.stats);
      if (schemasData.success) setSchemas(schemasData.schemas);
      if (violationsData.success) setViolations(violationsData.violations || []);
      if (configData.success) setGlobalStrict(configData.config?.strictMode || false);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const allSchemas = schemas ? { ...schemas.builtin, ...schemas.custom } : {};
  const builtinCount = schemas ? Object.keys(schemas.builtin).length : 0;
  const customCount = schemas ? Object.keys(schemas.custom).length : 0;

  const selectToolSchema = (toolId: string) => {
    setSelectedTool(toolId);
    const schema = allSchemas[toolId];
    if (schema) {
      const dirSchema = schema[schemaDirection];
      setSchemaEditorText(dirSchema ? JSON.stringify(dirSchema, null, 2) : '');
      if ('strictMode' in schema) setStrictMode((schema as ToolSchema).strictMode || false);
    }
  };

  const saveSchema = async () => {
    if (!selectedTool) { toast.error('Select a tool first'); return; }
    try {
      const parsed = JSON.parse(schemaEditorText);
      const body: any = { strictMode };
      body[schemaDirection] = parsed;
      const resp = await fetch(apiUrl(`/tool-schemas/${selectedTool}`), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) { toast.error(data.error?.message || 'Failed to save schema'); return; }
      toast.success('Schema saved for ' + selectedTool);
      fetchAll();
    } catch (e) { toast.error('Invalid JSON: ' + (e as Error).message); }
  };

  const deleteSchema = async (toolId: string) => {
    try {
      const resp = await fetch(apiUrl(`/tool-schemas/${toolId}`), { method: 'DELETE', headers: authHeaders() });
      const data = await resp.json();
      if (data.success) { toast.success('Schema deleted'); if (selectedTool === toolId) { setSelectedTool(''); setSchemaEditorText(''); } fetchAll(); }
    } catch { toast.error('Failed to delete schema'); }
  };

  const runValidation = async () => {
    if (!selectedTool) { toast.error('Select a tool first'); return; }
    try {
      const payload = JSON.parse(validatePayload);
      const resp = await fetch(apiUrl(`/tool-schemas/${selectedTool}/validate`), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, direction: validateDirection }),
      });
      const data = await resp.json();
      if (data.success) setValidateResult(data.result);
    } catch (e) { toast.error('Invalid JSON payload: ' + (e as Error).message); }
  };

  const runInfer = async () => {
    try {
      const payload = JSON.parse(inferPayload);
      const resp = await fetch(apiUrl('/tool-schemas/infer'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });
      const data = await resp.json();
      if (data.success) { setInferredSchema(data.schema); toast.success('Schema inferred'); }
    } catch (e) { toast.error('Invalid JSON: ' + (e as Error).message); }
  };

  const toggleGlobalStrict = async () => {
    try {
      const resp = await fetch(apiUrl('/tool-schemas/config'), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ strictMode: !globalStrict }),
      });
      const data = await resp.json();
      if (data.success) { setGlobalStrict(!globalStrict); toast.success('Global strict mode ' + (!globalStrict ? 'enabled' : 'disabled')); }
    } catch { toast.error('Failed to update config'); }
  };

  const clearViolations = async () => {
    try {
      const resp = await fetch(apiUrl('/tool-schemas/violations/clear'), { method: 'POST', headers: authHeaders() });
      const data = await resp.json();
      if (data.success) { toast.success('Violations cleared'); fetchAll(); }
    } catch { toast.error('Failed to clear violations'); }
  };

  if (loading && !stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-foreground-muted">Loading tool schema validation data...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Tool Payload Validation
              </CardTitle>
              <CardDescription>
                JSON schema enforcement for agent tool execution responses — validates tool outputs before passing to inference pipeline
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAll}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-blue-600" />
                <p className="text-xs text-foreground-muted">Total Schemas</p>
              </div>
              <p className="text-lg font-semibold">{stats?.totalSchemaCount ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <p className="text-xs text-foreground-muted">Builtin / Custom</p>
              </div>
              <p className="text-lg font-semibold">{builtinCount} / {customCount}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <p className="text-xs text-foreground-muted">Violations</p>
              </div>
              <p className="text-lg font-semibold">{stats?.totalViolations ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Strict Mode</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold">{globalStrict ? 'ON' : 'OFF'}</p>
                <Button variant="outline" size="sm" className="h-5 px-2 text-[10px]" onClick={toggleGlobalStrict}>
                  Toggle
                </Button>
              </div>
            </div>
          </div>
          {stats?.violationStats && stats.violationStats.totalErrors > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">Request Violations: {stats.violationStats.byDirection.request}</Badge>
              <Badge variant="outline" className="text-xs">Response Violations: {stats.violationStats.byDirection.response}</Badge>
              <Badge variant="outline" className="text-xs">Total Errors: {stats.violationStats.totalErrors}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Schema Registry & Editor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Schema Registry & Editor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-foreground-muted">Select Tool</label>
              <select
                value={selectedTool}
                onChange={(e) => selectToolSchema(e.target.value)}
                className="w-full text-sm border border-border rounded-md p-1.5 bg-background"
              >
                <option value="">\u2014 Select a tool \u2014</option>
                {Object.keys(allSchemas).map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </div>
            {selectedTool && (
              <>
                <div className="flex items-center gap-2">
                  <select
                    value={schemaDirection}
                    onChange={(e) => {
                      const dir = e.target.value as 'request' | 'response';
                      setSchemaDirection(dir);
                      const schema = allSchemas[selectedTool];
                      if (schema) setSchemaEditorText(schema[dir] ? JSON.stringify(schema[dir], null, 2) : '');
                    }}
                    className="text-xs border border-border rounded-md p-1 bg-background"
                  >
                    <option value="response">Response Schema</option>
                    <option value="request">Request Schema</option>
                  </select>
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input type="checkbox" checked={strictMode} onChange={(e) => setStrictMode(e.target.checked)} />
                    Strict (block on violation)
                  </label>
                  <Button variant="default" size="sm" className="ml-auto" onClick={saveSchema}>
                    <Save className="h-3.5 w-3.5" /> Save
                  </Button>
                  {!BUILTIN_TOOLS_HAS(selectedTool) && (
                    <Button variant="ghost" size="sm" onClick={() => deleteSchema(selectedTool)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
                <textarea
                  value={schemaEditorText}
                  onChange={(e) => setSchemaEditorText(e.target.value)}
                  className="w-full text-xs font-mono border border-border rounded-md p-2 bg-background min-h-[200px]"
                  placeholder='{"type":"object","required":["result"],"properties":{"result":{"type":"string"}}}'
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Validation Tester */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Validation Tester</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <select
                value={validateDirection}
                onChange={(e) => setValidateDirection(e.target.value as 'request' | 'response')}
                className="text-xs border border-border rounded-md p-1 bg-background"
              >
                <option value="response">Validate Response</option>
                <option value="request">Validate Request</option>
              </select>
              <Button variant="outline" size="sm" onClick={runValidation} disabled={!selectedTool}>
                <ShieldCheck className="h-3.5 w-3.5" /> Validate
              </Button>
            </div>
            <div>
              <label className="text-xs text-foreground-muted">Payload (JSON)</label>
              <textarea
                value={validatePayload}
                onChange={(e) => setValidatePayload(e.target.value)}
                className="w-full text-xs font-mono border border-border rounded-md p-2 bg-background min-h-[120px]"
                placeholder='{"result":"some output","rowCount":42}'
              />
            </div>
            {validateResult && (
              <div className="rounded-md border border-border bg-muted/10 p-3 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  {validateResult.valid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <Badge variant={validateResult.valid ? 'success' : 'destructive'} className="text-[10px]">
                    {validateResult.skipped ? 'Skipped (no schema)' : validateResult.valid ? 'Valid' : 'Invalid'}
                  </Badge>
                </div>
                {validateResult.errors && validateResult.errors.length > 0 && (
                  <div className="space-y-1">
                    {validateResult.errors.map((err, i) => (
                      <div key={i} className="text-[10px] text-destructive flex items-start gap-1">
                        <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span><span className="font-mono">{err.path}</span>: {err.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Schema Inference */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Schema Inference
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-foreground-muted">Sample Payload (JSON)</label>
              <textarea
                value={inferPayload}
                onChange={(e) => setInferPayload(e.target.value)}
                className="w-full text-xs font-mono border border-border rounded-md p-2 bg-background min-h-[80px]"
                placeholder='{"results":[{"filePath":"src/index.ts","lineStart":1}],"totalFound":1}'
              />
            </div>
            <Button variant="outline" size="sm" onClick={runInfer}>
              <Sparkles className="h-3.5 w-3.5" /> Infer Schema
            </Button>
            {inferredSchema && (
              <div className="rounded-md border border-border bg-muted/10 p-2">
                <pre className="text-[10px] font-mono overflow-x-auto max-h-[150px]">{JSON.stringify(inferredSchema, null, 2)}</pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Violation Log */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                Violation Log
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={clearViolations}>
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {violations.length === 0 ? (
              <p className="text-xs text-foreground-muted text-center py-4">No violations recorded</p>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {violations.map((v) => (
                  <div key={v.id} className="rounded-md border border-border bg-muted/10 p-2 text-xs space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={v.direction === 'request' ? 'warning' : 'destructive'} className="text-[10px]">
                        {v.direction}
                      </Badge>
                      <span className="font-medium text-[10px]">{v.toolId}</span>
                      <Badge variant="outline" className="text-[9px]">{v.errorCount} errors</Badge>
                      <span className="text-[10px] text-foreground-muted ml-auto">
                        {new Date(v.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {v.errors.slice(0, 3).map((err, i) => (
                      <div key={i} className="text-[10px] text-destructive flex items-start gap-1">
                        <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span><span className="font-mono">{err.path}</span>: {err.message}</span>
                      </div>
                    ))}
                    {v.errors.length > 3 && (
                      <div className="text-[10px] text-foreground-muted">+{v.errors.length - 3} more...</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BUILTIN_TOOLS_HAS(toolId: string): boolean {
  const builtin = ['code_search', 'file_read', 'web_search', 'code_execution', 'data_analysis', 'api_call', 'summarize', 'translate'];
  return builtin.indexOf(toolId) !== -1;
}
