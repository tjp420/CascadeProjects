import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

/**
 * AgentPDAPanel — Unified webview panel for the SimpleBeacon Agent PDA.
 *
 * Combines five views in a tabbed interface:
 * 1. Dashboard — registered agents, task summary, recent memories, policy violations
 * 2. Tasks — kanban-style task board (pending → in_progress → blocked → completed)
 * 3. Memory — agent memory browser (by category, search)
 * 4. Policies — policy editor (read/write .simplebeacon/policies.json)
 * 5. Handoff — handoff brief writer/reader
 *
 * Performance: uses direct require() of the agent-pda engine when available
 * (instant, no process spawn), falling back to CLI execSync only if the
 * engine module cannot be resolved.
 */

// Try to load the agent-pda engine directly for instant, non-blocking operations.
// This avoids spawning a node process per operation (was ~200ms each, now ~0ms).
let pdaEngine: any = null;
try {
  // Try bundled dependency first, then workspace package (dev mode)
  const candidates: string[] = [];
  // Also try relative to the extension's own location
  const extDir = path.dirname(__dirname);
  candidates.push(path.join(extDir, 'node_modules', 'simplebeacon', 'src', 'agent-pda'));
  // Try workspace packages dir (dev mode)
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (wsRoot) {
    candidates.push(path.join(wsRoot, 'packages', 'simplebeacon-cli', 'src', 'agent-pda'));
    candidates.push(path.join(path.dirname(wsRoot), 'packages', 'simplebeacon-cli', 'src', 'agent-pda'));
  }
  for (const candidate of candidates) {
    const indexPath = path.join(candidate, 'index.js');
    if (fs.existsSync(indexPath)) {
      pdaEngine = require(candidate);
      break;
    }
  }
} catch {
  // Engine not available — will fall back to CLI
}

interface Agent { id: string; name: string; type: string; createdAt: number; lastSeen: number; }
interface Task { id: string; agentId: string; title: string; description: string; status: string; priority: string; approvalRequired: boolean; approvedBy: string | null; blockReason: string | null; createdAt: number; updatedAt: number; completedAt: number | null; }
interface Memory { id: string; agentId: string; key: string; value: string; category: string; createdAt: number; updatedAt: number; }
interface Policy { id: string; type: string; action: string; description: string; severity: string; enabled: boolean; checkCommand?: string; }

export class AgentPDAPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'simplebeacon-agent-pda';
  private view?: vscode.WebviewView;
  private currentTab: string = 'dashboard';

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = this.getHtml();
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'refresh':
          await this.pushUpdate(message.tab || this.currentTab);
          break;
        case 'switchTab':
          this.currentTab = message.tab;
          await this.pushUpdate(this.currentTab);
          break;
        case 'taskCreate':
          await this.callCli(['task', 'add', message.title, '--priority', message.priority || 'medium']);
          await this.pushUpdate('tasks');
          break;
        case 'taskUpdate':
          await this.callCli(['task', 'update', message.taskId, '--status', message.status]);
          await this.pushUpdate('tasks');
          break;
        case 'taskComplete':
          await this.callCli(['task', 'complete', message.taskId]);
          await this.pushUpdate('tasks');
          break;
        case 'memoryAdd':
          await this.callCli(['agent', 'remember', message.key, message.value, '--category', message.category || 'context']);
          await this.pushUpdate('memory');
          break;
        case 'memoryDelete':
          await this.callCli(['agent', 'forget', message.key]);
          await this.pushUpdate('memory');
          break;
        case 'policyToggle':
          await this.callCli(['policy', 'toggle', message.policyId, '--enabled', message.enabled ? 'true' : 'false']);
          await this.pushUpdate('policies');
          break;
        case 'policyInit':
          await this.callCli(['policy', 'init', '--force']);
          await this.pushUpdate('policies');
          break;
        case 'policyAdd':
          await this.callCli(['policy', 'add', '--type', message.type || 'forbidden_action', '--action', message.action || '', '--description', message.description || '', '--severity', message.severity || 'block']);
          await this.pushUpdate('policies');
          break;
        case 'policyRemove':
          await this.callCli(['policy', 'remove', message.policyId]);
          await this.pushUpdate('policies');
          break;
        case 'handoffWrite':
          await this.callCli(['handoff', 'write', '--summary', message.summary || '', '--notes', message.notes || '']);
          await this.pushUpdate('handoff');
          break;
        case 'gateFinalize':
          const result = await this.callCli(['gate-finalize', '--no-scan']);
          this.view?.webview.postMessage({ command: 'gateResult', result });
          break;
      }
    });
    this.pushUpdate('dashboard');
  }

  private getProjectRoot(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
  }

  /**
   * Execute a PDA operation. Uses the direct engine require() when available
   * (instant, no process spawn), falling back to CLI execSync only if the
   * engine module is not loaded.
   */
  private async callCli(args: string[]): Promise<any> {
    const root = this.getProjectRoot();

    // Fast path: use the engine directly (no process spawn)
    if (pdaEngine) {
      try {
        return this.callEngineDirect(args, root);
      } catch (err: any) {
        // Engine call failed — fall through to CLI
        console.error('[AgentPDA] Engine call failed, falling back to CLI:', err.message);
      }
    }

    // Slow path: shell out to the CLI
    const cliPath = path.join(this.extensionUri.fsPath, 'node_modules', 'simplebeacon', 'bin', 'simplebeacon.js');
    const cli = fs.existsSync(cliPath) ? cliPath : 'simplebeacon';
    try {
      const cmd = `node "${cli}" ${args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`;
      const output = execSync(cmd, { cwd: root, encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] });
      return JSON.parse(output);
    } catch (err: any) {
      try {
        return JSON.parse(err.stdout || '{}');
      } catch {
        return { success: false, error: err.message };
      }
    }
  }

  /**
   * Call the PDA engine directly without spawning a process.
   * Maps CLI arg arrays to engine function calls.
   */
  private callEngineDirect(args: string[], root: string): any {
    const sub = args[0];
    const getArg = (flag: string): string | undefined => {
      const idx = args.indexOf(flag);
      return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
    };
    const getFlag = (flag: string): boolean => args.includes(flag);

    // Auto-register agent
    const agent = pdaEngine.autoRegister(root);
    const agentId = agent.id;

    switch (sub) {
      case 'agent': {
        const action = args[1];
        if (action === 'list') {
          const agents = pdaEngine.listAgents(root);
          return { success: true, agents, count: agents.length };
        }
        if (action === 'detect') {
          const detected = pdaEngine.detectAgent();
          return { success: true, detected };
        }
        if (action === 'remember') {
          const key = args[2] || '';
          const value = args[3] || '';
          const category = getArg('--category') || 'context';
          const memory = pdaEngine.remember(root, agentId, key, value, category);
          return { success: true, memory };
        }
        if (action === 'recall') {
          const key = getArg('--key');
          const category = getArg('--category');
          const memories = pdaEngine.recall(root, agentId, { key, category });
          return { success: true, memories, count: memories.length };
        }
        if (action === 'forget') {
          const key = args[2] || '';
          const result = pdaEngine.forget(root, agentId, key);
          return { success: true, ...result };
        }
        break;
      }
      case 'task': {
        const action = args[1];
        if (action === 'list') {
          const tasks = pdaEngine.listTasks(root, agentId);
          return { success: true, tasks, count: tasks.length };
        }
        if (action === 'add') {
          const title = args[2] || '';
          const priority = getArg('--priority') || 'medium';
          const task = pdaEngine.createTask(root, agentId, { title, priority });
          return { success: true, task };
        }
        if (action === 'complete') {
          const taskId = args[2] || '';
          const task = pdaEngine.completeTask(root, taskId);
          return { success: true, task };
        }
        if (action === 'update') {
          const taskId = args[2] || '';
          const status = getArg('--status') || undefined;
          const priority = getArg('--priority') || undefined;
          const task = pdaEngine.updateTask(root, taskId, { status, priority });
          return { success: true, task };
        }
        break;
      }
      case 'policy': {
        const action = args[1];
        if (action === 'list') {
          const { policies, source } = pdaEngine.listPolicies(root);
          return { success: true, policies, source, count: policies.length };
        }
        if (action === 'check') {
          const actionName = args[2] || '';
          const result = pdaEngine.checkAction(root, actionName, {});
          return { success: true, ...result };
        }
        if (action === 'init') {
          pdaEngine.initPolicies(root, getFlag('--force'));
          const { policies, source } = pdaEngine.listPolicies(root);
          return { success: true, policies, source, count: policies.length };
        }
        if (action === 'add') {
          const type = getArg('--type') || 'forbidden_action';
          const actionName = getArg('--action') || '';
          const description = getArg('--description') || '';
          const severity = getArg('--severity') || 'block';
          const policy = pdaEngine.addPolicy(root, { type, action: actionName, description, severity });
          return { success: true, policy };
        }
        if (action === 'remove') {
          const policyId = args[2] || '';
          const deleted = pdaEngine.removePolicy(root, policyId);
          return { success: true, deleted };
        }
        if (action === 'toggle') {
          const policyId = args[2] || '';
          const enabled = getArg('--enabled') === 'true';
          const policy = pdaEngine.togglePolicy(root, policyId, enabled);
          return { success: true, policy };
        }
        break;
      }
      case 'handoff': {
        const action = args[1];
        if (action === 'read') {
          const handoff = pdaEngine.readHandoff(root);
          return { success: true, handoff };
        }
        if (action === 'write') {
          const summary = getArg('--summary') || '';
          const notes = getArg('--notes') || '';
          const brief = {
            summary,
            completedTasks: [],
            pendingTasks: [],
            notes,
            filesChanged: [],
            writtenAt: Date.now(),
            fromAgent: agentId
          };
          const memory = pdaEngine.remember(root, agentId, 'handoff-brief', JSON.stringify(brief), 'handoff');
          return { success: true, brief, memoryId: memory.id };
        }
        break;
      }
      case 'gate-finalize': {
        const result = pdaEngine.canFinalize(root, agentId, {
          runScan: !getFlag('--no-scan'),
          useExistingReport: getFlag('--use-existing-report'),
          action: 'finalize-changes'
        });
        // Return compact summary (not the full gate report)
        return {
          success: true,
          canFinalize: result.canFinalize,
          blockingCount: result.blockingCount,
          violations: result.violations,
          warnings: result.warnings,
          approvalsNeeded: result.approvalsNeeded,
          gateSummary: result.gateResult ? {
            pass: result.gateResult.pass,
            blockingCount: result.gateResult.blockingCount,
            qualityScore: result.gateResult.qualityScore,
            error: result.gateResult.error || undefined
          } : null,
          agentId: result.agentId
        };
      }
    }
    return { success: false, error: `Unknown command: ${args.join(' ')}` };
  }

  private async pushUpdate(tab: string) {
    if (!this.view) return;
    const data: any = { command: 'update', tab };

    try {
      if (tab === 'dashboard') {
        const agents = await this.callCli(['agent', 'list']);
        const tasks = await this.callCli(['task', 'list']);
        data.agents = agents.agents || [];
        data.tasks = tasks.tasks || [];
        data.taskSummary = this.summarizeTasks(data.tasks);
      } else if (tab === 'tasks') {
        const tasks = await this.callCli(['task', 'list']);
        data.tasks = tasks.tasks || [];
      } else if (tab === 'memory') {
        // Memory recall requires agent ID — use the first registered agent or auto-register
        const agents = await this.callCli(['agent', 'list']);
        const agentId = agents.agents?.[0]?.id;
        if (agentId) {
          // Recall all memories (no key filter)
          const memResult = await this.callCli(['agent', 'recall']);
          data.memories = memResult.memories || [];
        } else {
          data.memories = [];
        }
      } else if (tab === 'policies') {
        const policies = await this.callCli(['policy', 'list']);
        data.policies = policies.policies || [];
        data.policySource = policies.source || 'defaults';
      } else if (tab === 'handoff') {
        const handoff = await this.callCli(['handoff', 'read']);
        data.handoff = handoff.handoff || null;
      }
    } catch (err) {
      data.error = err instanceof Error ? err.message : String(err);
    }

    this.view.webview.postMessage(data);
  }

  private summarizeTasks(tasks: Task[]): Record<string, number> {
    const summary: Record<string, number> = { pending: 0, in_progress: 0, blocked: 0, completed: 0, cancelled: 0 };
    for (const t of tasks) {
      if (summary[t.status] !== undefined) summary[t.status]++;
    }
    return summary;
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent PDA</title>
<style>
  body { font-family: var(--vscode-font-family, sans-serif); font-size: 12px; margin: 0; padding: 0; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
  .tabs { display: flex; border-bottom: 1px solid var(--vscode-panel-border); padding: 0 4px; }
  .tab { padding: 6px 10px; cursor: pointer; border: 1px solid transparent; border-bottom: none; opacity: 0.7; }
  .tab.active { border-color: var(--vscode-panel-border); border-bottom-color: var(--vscode-editor-background); background: var(--vscode-editor-background); opacity: 1; }
  .tab:hover { opacity: 1; }
  .content { padding: 8px; }
  .card { background: var(--vscode-editor-inactive-selection-background); border-radius: 4px; padding: 8px; margin-bottom: 8px; }
  .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold; }
  .badge-high { background: var(--vscode-errorForeground, #f44); color: #fff; }
  .badge-medium { background: var(--vscode-editorWarning-foreground, #fa0); color: #000; }
  .badge-low { background: var(--vscode-disabledForeground, #888); color: #fff; }
  .badge-completed { background: var(--vscode-testing-iconPassed, #4a4); color: #fff; }
  .badge-blocked { background: var(--vscode-errorForeground, #f44); color: #fff; }
  .badge-pending { background: var(--vscode-editorWidget-background, #666); color: #fff; }
  .badge-in_progress { background: var(--vscode-editorInfo-foreground, #08f); color: #fff; }
  .kanban { display: flex; gap: 4px; }
  .kanban-col { flex: 1; min-width: 0; }
  .kanban-col h4 { font-size: 11px; margin: 0 0 4px 0; text-transform: uppercase; opacity: 0.7; }
  .kanban-item { background: var(--vscode-editor-inactive-selection-background); border-radius: 3px; padding: 4px 6px; margin-bottom: 4px; cursor: pointer; }
  .kanban-item:hover { background: var(--vscode-editor-selection-background); }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 4px 10px; border-radius: 2px; cursor: pointer; font-size: 11px; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  input, textarea, select { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 3px 6px; border-radius: 2px; font-size: 11px; width: 100%; box-sizing: border-box; }
  .row { display: flex; gap: 4px; margin-bottom: 4px; }
  .row > * { flex: 1; }
  .empty { opacity: 0.5; text-align: center; padding: 16px; }
  .policy-item { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--vscode-panel-border); }
  .policy-item:last-child { border-bottom: none; }
  .enabled-yes { color: var(--vscode-testing-iconPassed, #4a4); }
  .enabled-no { color: var(--vscode-disabledForeground, #888); }
  pre { white-space: pre-wrap; word-wrap: break-word; background: var(--vscode-textCodeBlock-background); padding: 6px; border-radius: 3px; font-size: 11px; }
</style>
</head>
<body>
<div class="tabs">
  <div class="tab active" data-tab="dashboard">Dashboard</div>
  <div class="tab" data-tab="tasks">Tasks</div>
  <div class="tab" data-tab="memory">Memory</div>
  <div class="tab" data-tab="policies">Policies</div>
  <div class="tab" data-tab="handoff">Handoff</div>
</div>
<div class="content" id="content">
  <div class="empty">Loading...</div>
</div>
<script>
const vscode = acquireVsCodeApi();
let currentTab = 'dashboard';

document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    currentTab = t.dataset.tab;
    vscode.postMessage({ command: 'switchTab', tab: currentTab });
  });
});

window.addEventListener('message', event => {
  const msg = event.data;
  if (msg.command === 'update') renderTab(msg.tab, msg);
  else if (msg.command === 'gateResult') renderGateResult(msg.result);
});

function renderTab(tab, data) {
  const el = document.getElementById('content');
  if (data.error) { el.innerHTML = '<div class="card">Error: ' + escapeHtml(data.error) + '</div>'; return; }
  if (tab === 'dashboard') renderDashboard(data, el);
  else if (tab === 'tasks') renderTasks(data, el);
  else if (tab === 'memory') renderMemory(data, el);
  else if (tab === 'policies') renderPolicies(data, el);
  else if (tab === 'handoff') renderHandoff(data, el);
}

function renderDashboard(data, el) {
  const s = data.taskSummary || {};
  const agents = data.agents || [];
  el.innerHTML = \`
    <div class="card"><strong>Agents</strong> (\${agents.length})
      \${agents.map(a => '<div>• ' + escapeHtml(a.name) + ' <span class="badge badge-low">' + a.type + '</span></div>').join('')}
    </div>
    <div class="card"><strong>Task Summary</strong>
      <div>Pending: \${s.pending||0} | In Progress: \${s.in_progress||0} | Blocked: \${s.blocked||0} | Completed: \${s.completed||0}</div>
    </div>
    <div class="card">
      <strong>Self-Gate Check</strong>
      <button onclick="runGate()">Run Gate Finalize</button>
      <div id="gate-result"></div>
    </div>
  \`;
}

function runGate() {
  vscode.postMessage({ command: 'gateFinalize' });
}

function renderGateResult(result) {
  const el = document.getElementById('gate-result');
  if (!el) return;
  if (result.canFinalize) {
    el.innerHTML = '<div style="color: var(--vscode-testing-iconPassed)">✓ Gate PASSED — work can be finalized</div>';
  } else {
    el.innerHTML = '<div style="color: var(--vscode-errorForeground)">✗ Gate FAILED — ' + (result.blockingCount||0) + ' blocking issue(s)</div>';
  }
}

function renderTasks(data, el) {
  const tasks = data.tasks || [];
  const cols = ['pending', 'in_progress', 'blocked', 'completed'];
  el.innerHTML = \`
    <div class="row">
      <input type="text" id="task-title" placeholder="New task title..." />
      <select id="task-pri"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
      <button onclick="addTask()">Add</button>
    </div>
    <div class="kanban">
      \${cols.map(c => {
        const items = tasks.filter(t => t.status === c);
        return '<div class="kanban-col"><h4>' + c.replace('_',' ') + ' (' + items.length + ')</h4>' +
          items.map(t => '<div class="kanban-item" onclick="completeTask(\\'' + t.id + '\\')">' +
            escapeHtml(t.title) + ' <span class="badge badge-' + t.priority + '">' + t.priority + '</span></div>'
          ).join('') + '</div>';
      }).join('')}
    </div>
  \`;
}

function addTask() {
  const title = document.getElementById('task-title').value;
  const pri = document.getElementById('task-pri').value;
  if (!title) return;
  vscode.postMessage({ command: 'taskCreate', title, priority: pri });
  document.getElementById('task-title').value = '';
}

function completeTask(id) {
  vscode.postMessage({ command: 'taskComplete', taskId: id });
}

function renderMemory(data, el) {
  const mems = data.memories || [];
  el.innerHTML = \`
    <div class="row">
      <input type="text" id="mem-key" placeholder="Key" />
      <input type="text" id="mem-val" placeholder="Value" />
      <select id="mem-cat"><option value="context">Context</option><option value="fact">Fact</option><option value="decision">Decision</option><option value="session-note">Session Note</option></select>
      <button onclick="addMemory()">Save</button>
    </div>
    \${mems.length === 0 ? '<div class="empty">No memories yet</div>' :
      mems.map(m => '<div class="card"><strong>' + escapeHtml(m.key) + '</strong> <span class="badge badge-low">' + m.category + '</span><pre>' + escapeHtml(m.value) + '</pre><button onclick="delMemory(\\'' + escapeHtml(m.key) + '\\')">Delete</button></div>').join('')}
  \`;
}

function addMemory() {
  const key = document.getElementById('mem-key').value;
  const value = document.getElementById('mem-val').value;
  const category = document.getElementById('mem-cat').value;
  if (!key || !value) return;
  vscode.postMessage({ command: 'memoryAdd', key, value, category });
  document.getElementById('mem-key').value = '';
  document.getElementById('mem-val').value = '';
}

function delMemory(key) {
  vscode.postMessage({ command: 'memoryDelete', key });
}

function renderPolicies(data, el) {
  const policies = data.policies || [];
  el.innerHTML = \`
    <div class="card">
      <strong>Policy Editor</strong> — Source: <strong>\${data.policySource || 'defaults'}</strong>
      <button onclick="initPolicies()">Init from Defaults</button>
    </div>
    <div class="card">
      <strong>Add Policy</strong>
      <div class="row">
        <select id="pol-type">
          <option value="forbidden_action">Forbidden Action</option>
          <option value="required_check">Required Check</option>
          <option value="approval_required">Approval Required</option>
        </select>
        <input id="pol-action" placeholder="Action (e.g. commit-secrets)" />
      </div>
      <div class="row">
        <input id="pol-description" placeholder="Description" />
        <select id="pol-severity">
          <option value="block">Block</option>
          <option value="warn">Warn</option>
        </select>
      </div>
      <button onclick="addPolicy()">Add Policy</button>
    </div>
    \${policies.map(p => 
      '<div class="policy-item">' +
        '<div>' +
          '<strong>' + escapeHtml(p.action) + '</strong> — ' + escapeHtml(p.description || '') +
          '<br><span class="badge badge-' + (p.severity === 'block' ? 'high' : 'medium') + '">' + p.type + '</span> ' +
          '<span class="' + (p.enabled ? 'enabled-yes' : 'enabled-no') + '">' + (p.enabled ? 'enabled' : 'disabled') + '</span>' +
          '<br><span style="font-size:10px;opacity:0.6">ID: ' + escapeHtml(p.id) + '</span>' +
        '</div>' +
        '<div>' +
          '<button onclick="togglePolicy(\\'' + p.id + '\\', ' + !p.enabled + ')">' + (p.enabled ? 'Disable' : 'Enable') + '</button> ' +
          '<button onclick="removePolicy(\\'' + p.id + '\\')" style="background:var(--vscode-errorForeground)">Remove</button>' +
        '</div>' +
      '</div>'
    ).join('')}
  \`;
}

function initPolicies() {
  vscode.postMessage({ command: 'policyInit' });
}

function addPolicy() {
  const type = document.getElementById('pol-type').value;
  const action = document.getElementById('pol-action').value;
  const description = document.getElementById('pol-description').value;
  const severity = document.getElementById('pol-severity').value;
  if (!action) return;
  vscode.postMessage({ command: 'policyAdd', type, action, description, severity });
}

function togglePolicy(policyId, enabled) {
  vscode.postMessage({ command: 'policyToggle', policyId, enabled });
}

function removePolicy(policyId) {
  vscode.postMessage({ command: 'policyRemove', policyId });
}

function renderHandoff(data, el) {
  const h = data.handoff;
  el.innerHTML = \`
    <div class="card">
      <strong>Write Handoff Brief</strong>
      <textarea id="ho-summary" placeholder="Summary of what was done..." rows="3"></textarea>
      <textarea id="ho-notes" placeholder="Notes for the next agent..." rows="3"></textarea>
      <button onclick="writeHandoff()">Write Handoff</button>
    </div>
    <div class="card">
      <strong>Latest Handoff</strong>
      \${h ? '<pre>' + escapeHtml(JSON.stringify(h, null, 2)) + '</pre>' : '<div class="empty">No handoff brief found</div>'}
    </div>
  \`;
}

function writeHandoff() {
  const summary = document.getElementById('ho-summary').value;
  const notes = document.getElementById('ho-notes').value;
  vscode.postMessage({ command: 'handoffWrite', summary, notes });
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
</script>
</body>
</html>`;
  }
}
