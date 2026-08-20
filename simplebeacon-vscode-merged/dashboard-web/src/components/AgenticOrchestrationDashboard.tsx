import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Bot,
  RefreshCw,
  Loader2,
  Save,
  Trash2,
  Plus,
  Play,
  Pause,
  Square,
  Terminal,
  ShieldCheck,
  Wrench,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

type BadgeVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';

interface AgentStats {
  agentCount: number;
  activeExecutions: number;
  totalExecutions: number;
  completed: number;
  failed: number;
  aborted: number;
  guardrailBlocks: number;
  totalSteps: number;
  totalTokensUsed: number;
  totalLatencyMs: number;
  avgStepsPerExecution: number;
  avgLatencyMs: number;
  toolCount: number;
  builtinToolCount: number;
  customToolCount: number;
}

interface Agent {
  id: string;
  orgId: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  config: {
    maxSteps: number;
    stepTimeoutMs: number;
    guardrailEnabled: boolean;
    guardrailStrictMode: boolean;
    autoTerminateOnRefusal: boolean;
    autoTerminateOnRepetition: boolean;
    repetitionThreshold: number;
    provider: string;
    model: string | null;
    temperature: number;
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  executionCount: number;
  lastExecutedAt: string | null;
}

interface Execution {
  id: string;
  agentId: string;
  orgId: string;
  input: string;
  state: string;
  steps: Step[];
  currentStep: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  result: string | null;
  guardrailViolations: any[];
  totalTokensUsed: number;
  totalLatencyMs: number;
}

interface Step {
  index: number;
  state: string;
  prompt: string;
  reasoning: string;
  toolCalls: any[];
  toolResults: any[];
  guardrailResult: { passed: boolean; violations: string[]; severity: string } | null;
  startedAt: number;
  completedAt: number | null;
  latencyMs: number;
  tokensUsed: number;
  error: string | null;
}

interface ToolsData {
  builtin: Record<string, { name: string; description: string; parameters: Record<string, string>; category: string }>;
  custom: Record<string, any>;
}

const STATE_COLORS: Record<string, BadgeVariant> = {
  pending: 'secondary',
  running: 'default',
  paused: 'secondary',
  completed: 'success',
  aborted: 'destructive',
  failed: 'destructive',
  guardrail_blocked: 'destructive',
};

export function AgenticOrchestrationDashboard() {
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeExecs, setActiveExecs] = useState<Execution[]>([]);
  const [execHistory, setExecHistory] = useState<Execution[]>([]);
  const [tools, setTools] = useState<ToolsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Agent builder
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentName, setAgentName] = useState('');
  const [agentDesc, setAgentDesc] = useState('');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentProvider, setAgentProvider] = useState('openai');
  const [agentMaxSteps, setAgentMaxSteps] = useState('10');
  const [agentGuardrails, setAgentGuardrails] = useState(true);
  const [agentStrict, setAgentStrict] = useState(false);
  const [agentTools, setAgentTools] = useState<string[]>([]);

  // Execution input
  const [execInput, setExecInput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState('');

  // Guardrail inspector
  const [inspectText, setInspectText] = useState('');
  const [inspectResult, setInspectResult] = useState<any>(null);

  // Selected execution detail
  const [selectedExec, setSelectedExec] = useState<Execution | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResp, agentsResp, execsResp, toolsResp] = await Promise.all([
        fetch(apiUrl('/agentic/stats'), { headers: authHeaders() }),
        fetch(apiUrl('/agentic/agents'), { headers: authHeaders() }),
        fetch(apiUrl('/agentic/executions'), { headers: authHeaders() }),
        fetch(apiUrl('/agentic/tools'), { headers: authHeaders() }),
      ]);
      const statsData = await statsResp.json();
      const agentsData = await agentsResp.json();
      const execsData = await execsResp.json();
      const toolsData = await toolsResp.json();
      if (statsData.success) setStats(statsData.stats);
      if (agentsData.success) setAgents(agentsData.agents || []);
      if (execsData.success) {
        setActiveExecs(execsData.active || []);
        setExecHistory(execsData.history || []);
      }
      if (toolsData.success) setTools(toolsData.tools);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const createOrUpdateAgent = async () => {
    try {
      const body = {
        id: editingAgent?.id || undefined,
        name: agentName,
        description: agentDesc,
        systemPrompt: agentPrompt,
        tools: agentTools,
        config: {
          provider: agentProvider,
          maxSteps: parseInt(agentMaxSteps, 10) || 10,
          guardrailEnabled: agentGuardrails,
          guardrailStrictMode: agentStrict,
        },
      };
      const url = editingAgent ? apiUrl(`/agentic/agents/${editingAgent.id}`) : apiUrl('/agentic/agents');
      const resp = await fetch(url, {
        method: editingAgent ? 'PUT' : 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error(data.error?.message || 'Failed to save agent');
        return;
      }
      toast.success(editingAgent ? 'Agent updated' : 'Agent created');
      setShowBuilder(false);
      resetBuilder();
      fetchAll();
    } catch {
      toast.error('Failed to save agent');
    }
  };

  const resetBuilder = () => {
    setEditingAgent(null);
    setAgentName('');
    setAgentDesc('');
    setAgentPrompt('');
    setAgentProvider('openai');
    setAgentMaxSteps('10');
    setAgentGuardrails(true);
    setAgentStrict(false);
    setAgentTools([]);
  };

  const editAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setAgentName(agent.name);
    setAgentDesc(agent.description);
    setAgentPrompt(agent.systemPrompt);
    setAgentProvider(agent.config.provider || 'openai');
    setAgentMaxSteps(String(agent.config.maxSteps || 10));
    setAgentGuardrails(agent.config.guardrailEnabled !== false);
    setAgentStrict(agent.config.guardrailStrictMode || false);
    setAgentTools(agent.tools || []);
    setShowBuilder(true);
  };

  const deleteAgent = async (id: string) => {
    try {
      const resp = await fetch(apiUrl(`/agentic/agents/${id}`), { method: 'DELETE', headers: authHeaders() });
      const data = await resp.json();
      if (data.success) {
        toast.success('Agent deleted');
        fetchAll();
      }
    } catch {
      toast.error('Failed to delete agent');
    }
  };

  const executeAgent = async () => {
    if (!selectedAgentId) {
      toast.error('Select an agent first');
      return;
    }
    if (!execInput.trim()) {
      toast.error('Enter input text');
      return;
    }
    setExecuting(true);
    try {
      const resp = await fetch(apiUrl(`/agentic/agents/${selectedAgentId}/execute`), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: execInput }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error(data.error?.message || 'Execution failed');
        return;
      }
      toast.success(`Execution ${data.executionId} — ${data.steps || 0} steps`);
      setExecInput('');
      fetchAll();
    } catch {
      toast.error('Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const controlExec = async (execId: string, action: 'pause' | 'resume' | 'abort') => {
    try {
      const resp = await fetch(apiUrl(`/agentic/executions/${execId}/${action}`), {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (data.success) {
        toast.success(`Execution ${action}ed`);
        fetchAll();
      }
    } catch {
      toast.error(`Failed to ${action}`);
    }
  };

  const runInspect = async () => {
    try {
      const resp = await fetch(apiUrl('/agentic/inspect'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inspectText }),
      });
      const data = await resp.json();
      if (data.success) setInspectResult(data.result);
    } catch {
      toast.error('Inspection failed');
    }
  };

  const viewExecDetail = async (execId: string) => {
    try {
      const resp = await fetch(apiUrl(`/agentic/executions/${execId}`), { headers: authHeaders() });
      const data = await resp.json();
      if (data.success) setSelectedExec(data.execution);
    } catch {}
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return '\u2014';
    try {
      return new Date(ts).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  const allTools = tools ? { ...tools.builtin, ...tools.custom } : {};

  if (loading && !stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-foreground-muted">Loading agentic orchestration data...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Agentic Orchestration Workspace
              </CardTitle>
              <CardDescription>
                Multi-agent executor loop with tool wiring, state machine tracking, and guardrail inspection passes
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
                <Bot className="h-4 w-4 text-blue-600" />
                <p className="text-xs text-foreground-muted">Agents</p>
              </div>
              <p className="text-lg font-semibold">{stats?.agentCount ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-600" />
                <p className="text-xs text-foreground-muted">Active Executions</p>
              </div>
              <p className="text-lg font-semibold">{stats?.activeExecutions ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-orange-600" />
                <p className="text-xs text-foreground-muted">Guardrail Blocks</p>
              </div>
              <p className="text-lg font-semibold">{stats?.guardrailBlocks ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-purple-600" />
                <p className="text-xs text-foreground-muted">Tools Available</p>
              </div>
              <p className="text-lg font-semibold">{stats?.toolCount ?? 0}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">
              Completed: {stats?.completed ?? 0}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Failed: {stats?.failed ?? 0}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Aborted: {stats?.aborted ?? 0}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Total Steps: {stats?.totalSteps ?? 0}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Tokens: {stats?.totalTokensUsed ?? 0}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Avg Steps: {(stats?.avgStepsPerExecution ?? 0).toFixed(1)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Agent List & Builder */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Agents</CardTitle>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  resetBuilder();
                  setShowBuilder(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> New Agent
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showBuilder && (
              <div className="rounded-md border border-border bg-muted/10 p-3 space-y-2">
                <div className="text-xs font-medium">{editingAgent ? 'Edit Agent' : 'Create Agent'}</div>
                <div>
                  <label className="text-xs text-foreground-muted">Name</label>
                  <Input
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="Code Review Agent"
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-foreground-muted">Description</label>
                  <Input
                    value={agentDesc}
                    onChange={(e) => setAgentDesc(e.target.value)}
                    placeholder="Reviews code for security issues"
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-foreground-muted">System Prompt</label>
                  <textarea
                    value={agentPrompt}
                    onChange={(e) => setAgentPrompt(e.target.value)}
                    className="w-full text-xs font-mono border border-border rounded-md p-2 bg-background min-h-[60px]"
                    placeholder="You are a code review agent..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-foreground-muted">Provider</label>
                    <select
                      value={agentProvider}
                      onChange={(e) => setAgentProvider(e.target.value)}
                      className="w-full text-sm border border-border rounded-md p-1.5 bg-background"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="ollama">Ollama</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-foreground-muted">Max Steps</label>
                    <Input
                      value={agentMaxSteps}
                      onChange={(e) => setAgentMaxSteps(e.target.value)}
                      type="number"
                      className="text-sm"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agentGuardrails}
                      onChange={(e) => setAgentGuardrails(e.target.checked)}
                    />
                    Guardrails
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={agentStrict} onChange={(e) => setAgentStrict(e.target.checked)} />
                    Strict mode
                  </label>
                </div>
                <div>
                  <label className="text-xs text-foreground-muted">Tools</label>
                  <div className="flex flex-wrap gap-1 mt-1 max-h-[60px] overflow-y-auto">
                    {Object.keys(allTools).map((toolName) => (
                      <label key={toolName} className="flex items-center gap-1 text-[10px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agentTools.includes(toolName)}
                          onChange={(e) => {
                            if (e.target.checked) setAgentTools([...agentTools, toolName]);
                            else setAgentTools(agentTools.filter((t) => t !== toolName));
                          }}
                        />
                        {toolName}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="default" size="sm" onClick={createOrUpdateAgent}>
                    <Save className="h-3.5 w-3.5" /> {editingAgent ? 'Update' : 'Create'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowBuilder(false);
                      resetBuilder();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {agents.length === 0 && !showBuilder ? (
              <p className="text-xs text-foreground-muted text-center py-4">
                No agents configured. Click "New Agent" to create one.
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {agents.map((agent) => (
                  <div key={agent.id} className="rounded-md border border-border bg-muted/10 p-2 text-xs space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{agent.name}</span>
                      <Badge variant={agent.enabled ? 'success' : 'secondary'} className="text-[10px]">
                        {agent.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {agent.config.provider}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        Steps: {agent.config.maxSteps}
                      </Badge>
                      {agent.config.guardrailEnabled && (
                        <Badge variant="outline" className="text-[10px]">
                          <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />
                          Guardrails
                        </Badge>
                      )}
                      <span className="text-[10px] text-foreground-muted ml-auto">Runs: {agent.executionCount}</span>
                    </div>
                    {agent.description && <p className="text-[10px] text-foreground-muted">{agent.description}</p>}
                    {agent.tools && agent.tools.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {agent.tools.map((t) => (
                          <Badge key={t} variant="outline" className="text-[9px]">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px]"
                        onClick={() => editAgent(agent)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] text-destructive"
                        onClick={() => deleteAgent(agent.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Execution Console */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              Execution Console
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-foreground-muted">Select Agent</label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full text-sm border border-border rounded-md p-1.5 bg-background"
              >
                <option value="">— Select an agent —</option>
                {agents
                  .filter((a) => a.enabled)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-foreground-muted">Input / Task</label>
              <textarea
                value={execInput}
                onChange={(e) => setExecInput(e.target.value)}
                className="w-full text-xs font-mono border border-border rounded-md p-2 bg-background min-h-[80px]"
                placeholder="Enter the task or question for the agent..."
              />
            </div>
            <Button variant="default" size="sm" onClick={executeAgent} disabled={executing || !selectedAgentId}>
              {executing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Execute Agent
            </Button>

            {/* Active Executions */}
            {activeExecs.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium">Active Executions</div>
                {activeExecs.map((exec) => (
                  <div key={exec.id} className="rounded-md border border-border bg-muted/10 p-2 text-xs space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={STATE_COLORS[exec.state] || 'secondary'} className="text-[10px]">
                        {exec.state}
                      </Badge>
                      <span className="font-mono text-[10px] text-foreground-muted">{exec.id}</span>
                      <span className="text-[10px]">Step: {exec.currentStep + 1}</span>
                      <div className="ml-auto flex gap-1">
                        <Button variant="ghost" size="sm" className="h-5 px-1" onClick={() => viewExecDetail(exec.id)}>
                          <Activity className="h-3 w-3" />
                        </Button>
                        {exec.state === 'running' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1"
                            onClick={() => controlExec(exec.id, 'pause')}
                          >
                            <Pause className="h-3 w-3" />
                          </Button>
                        )}
                        {exec.state === 'paused' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1"
                            onClick={() => controlExec(exec.id, 'resume')}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1"
                          onClick={() => controlExec(exec.id, 'abort')}
                        >
                          <Square className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Execution History */}
            {execHistory.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium">Recent Executions</div>
                <div className="space-y-1 max-h-[150px] overflow-y-auto">
                  {execHistory.slice(0, 10).map((exec) => (
                    <div key={exec.id} className="rounded-md border border-border bg-muted/10 p-2 text-xs space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {exec.state === 'completed' ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : exec.state === 'failed' || exec.state === 'guardrail_blocked' ? (
                          <XCircle className="h-3 w-3 text-destructive" />
                        ) : exec.state === 'aborted' ? (
                          <Square className="h-3 w-3 text-foreground-muted" />
                        ) : (
                          <Clock className="h-3 w-3 text-foreground-muted" />
                        )}
                        <Badge variant={STATE_COLORS[exec.state] || 'secondary'} className="text-[10px]">
                          {exec.state}
                        </Badge>
                        <span className="font-mono text-[10px] text-foreground-muted">{exec.id}</span>
                        <span className="text-[10px]">Steps: {exec.steps.length}</span>
                        <span className="text-[10px]">Tokens: {exec.totalTokensUsed}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1 ml-auto"
                          onClick={() => viewExecDetail(exec.id)}
                        >
                          View
                        </Button>
                      </div>
                      {exec.error && <p className="text-[10px] text-destructive">{exec.error}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Guardrail Inspector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Guardrail Inspector
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-foreground-muted">Test text for guardrail inspection</label>
              <textarea
                value={inspectText}
                onChange={(e) => setInspectText(e.target.value)}
                className="w-full text-xs font-mono border border-border rounded-md p-2 bg-background min-h-[60px]"
                placeholder="Enter agent output to inspect for refusals, injections, repetition..."
              />
            </div>
            <Button variant="outline" size="sm" onClick={runInspect}>
              <ShieldCheck className="h-3.5 w-3.5" /> Inspect
            </Button>
            {inspectResult && (
              <div className="rounded-md border border-border bg-muted/10 p-3 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  {inspectResult.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  <Badge variant={inspectResult.passed ? 'success' : 'destructive'} className="text-[10px]">
                    {inspectResult.passed ? 'Passed' : 'Blocked'}
                  </Badge>
                  {inspectResult.severity !== 'none' && (
                    <Badge variant="outline" className="text-[10px]">
                      Severity: {inspectResult.severity}
                    </Badge>
                  )}
                </div>
                {inspectResult.violations && inspectResult.violations.length > 0 && (
                  <div className="space-y-1">
                    {inspectResult.violations.map((v: string, i: number) => (
                      <div key={i} className="text-[10px] text-destructive flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> {v}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Execution Detail View */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Execution Trace
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedExec ? (
              <p className="text-xs text-foreground-muted text-center py-6">
                Select an execution to view step-by-step trace
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <Badge variant={STATE_COLORS[selectedExec.state] || 'secondary'} className="text-[10px]">
                    {selectedExec.state}
                  </Badge>
                  <span className="font-mono text-[10px] text-foreground-muted">{selectedExec.id}</span>
                  <span className="text-[10px]">Steps: {selectedExec.steps.length}</span>
                  <span className="text-[10px]">Tokens: {selectedExec.totalTokensUsed}</span>
                  <span className="text-[10px]">Latency: {selectedExec.totalLatencyMs}ms</span>
                </div>
                {selectedExec.input && (
                  <div className="text-[10px] text-foreground-muted">
                    <span className="font-medium">Input:</span> {selectedExec.input.slice(0, 100)}
                  </div>
                )}
                {selectedExec.result && (
                  <div className="rounded-md border border-border bg-green-500/5 p-2 text-[10px]">
                    <span className="font-medium text-green-700">Result:</span> {selectedExec.result.slice(0, 200)}
                  </div>
                )}
                {selectedExec.steps.map((step, i) => (
                  <div key={i} className="rounded-md border border-border bg-muted/10 p-2 text-xs space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[10px]">Step {step.index}</span>
                      <Badge
                        variant={
                          step.state === 'completed'
                            ? 'success'
                            : step.state === 'blocked' || step.state === 'failed'
                              ? 'destructive'
                              : 'secondary'
                        }
                        className="text-[9px]"
                      >
                        {step.state}
                      </Badge>
                      <span className="text-[10px] text-foreground-muted">{step.latencyMs}ms</span>
                      <span className="text-[10px] text-foreground-muted">{step.tokensUsed} tokens</span>
                    </div>
                    {step.reasoning && (
                      <p className="text-[10px] text-foreground-muted break-words">{step.reasoning.slice(0, 150)}</p>
                    )}
                    {step.guardrailResult && !step.guardrailResult.passed && (
                      <div className="flex items-center gap-1 text-[10px] text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        {step.guardrailResult.violations.join(', ')}
                      </div>
                    )}
                    {step.toolCalls && step.toolCalls.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {step.toolCalls.map((tc, j) => (
                          <Badge key={j} variant="outline" className="text-[9px]">
                            <Wrench className="h-2.5 w-2.5 mr-0.5" />
                            {tc.tool}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tool Registry */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            Tool Registry
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tools && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries({ ...tools.builtin, ...tools.custom }).map(([id, tool]: [string, any]) => (
                <div key={id} className="rounded-md border border-border bg-muted/10 p-2 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-3 w-3 text-purple-600" />
                    <span className="font-medium">{tool.name}</span>
                    <Badge variant="outline" className="text-[9px] ml-auto">
                      {tool.category}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-foreground-muted">{tool.description}</p>
                  {tool.parameters && Object.keys(tool.parameters).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(tool.parameters).map(([param, type]) => (
                        <Badge key={param} variant="outline" className="text-[9px]">
                          {param}: {String(type)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
