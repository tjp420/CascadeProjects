/**
 * Cursor / VS Code agent bridge — registers SimpleBeacon MCP and writes an
 * agent-readable brief. No VS Code imports so Jest can run this in Node.
 */
import * as fs from 'fs';
import * as path from 'path';

export const AGENT_RULE_FILENAME = 'simplebeacon-ai-workflow.mdc';
export const AGENT_BRIEF_FILENAME = 'agent-brief.md';
export const AGENT_SUPERCHARGE_FILENAME = 'agent-supercharge.md';

const SUPERCHARGE_TEMPLATE_CANDIDATES = [
  path.join(__dirname, '..', 'templates', 'simplebeacon-ai-workflow-supercharge.md'),
  path.join(__dirname, '..', '..', '..', 'packages', 'simplebeacon-cli', 'examples', 'agent', 'simplebeacon-ai-workflow-supercharge.md'),
];

export function loadSuperchargeRuleBody(): string {
  for (const candidate of SUPERCHARGE_TEMPLATE_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate, 'utf8').trim();
      }
    } catch {
      /* try next */
    }
  }
  return AGENT_RULE_CONTENT_SUPERCHARGE_FALLBACK;
}

function wrapSuperchargeMdc(body: string): string {
  return [
    '---',
    'description: SimpleBeacon Agent Supercharge — any coding agent plugin (local-only)',
    'alwaysApply: true',
    '---',
    '',
    body,
    '',
  ].join('\n');
}

const AGENT_RULE_CONTENT_SUPERCHARGE_FALLBACK = `---
description: SimpleBeacon Agent Supercharge — any coding agent plugin (local-only)
alwaysApply: true
---

# SimpleBeacon Agent Supercharge

Start every session with **\`supercharge_agent\`** — one MCP call for mission, gate, code suggestions, and plugin status.
`;

export const AGENT_RULE_CONTENT_SUPERCHARGE = AGENT_RULE_CONTENT_SUPERCHARGE_FALLBACK;

export const AGENT_RULE_CONTENT_FREE = `---
description: SimpleBeacon MCP scan workflow — free 2/10 preview (local-only)
alwaysApply: true
---

# SimpleBeacon scan workflow (free)

Start with **\`supercharge_agent\`** when MCP is available (2/10 preview):

- **\`supercharge_agent\`**, **\`scan_snippet\`**, **\`gate_status\`**, **\`handoff_check\`**, **\`code_suggestions\`**
- **\`suggest_fixes\`** — one teaser fix only

Blocked on free: scan_file, explain_finding, propose_fix, verify_fix, scan_staged, agent_status.

If a tool returns blocked: true, link https://simplebeacon.ai/pricing for the 11/10 paid agent loop.

Do not upload source. Focus on gate-blocking issues only.
`;

export const AGENT_RULE_CONTENT = `---
description: SimpleBeacon MCP scan workflow — paid 11/10 agent loop (local-only)
alwaysApply: true
---

# SimpleBeacon scan workflow (paid)

Start with **\`supercharge_agent\`** every session. Closed loop — all scans local.

## Before accepting edits

1. **\`supercharge_agent\`** or **\`scan_snippet\`** with content + filePath
2. If blockingCount > 0: **\`propose_fix\`** → apply → **\`verify_fix\`** → **\`agent_status\`**

## After editing

**\`scan_file\`** on the changed path.

## Before PR

**\`scan_staged\`** → **\`gate_status\`** → **\`handoff_check\`** → **\`suggest_fixes\`**

Read \`.simplebeacon/agent-supercharge.md\` and \`agent-brief.md\` when present.
`;

export type McpLaunch = { command: string; args: string[] };

export function detectMcpLaunch(projectRoot: string): McpLaunch {
  const root = path.resolve(projectRoot);
  const monorepoBin = path.join(root, 'packages', 'simplebeacon-cli', 'bin', 'simplebeacon-mcp.js');
  if (fs.existsSync(monorepoBin)) {
    return {
      command: 'node',
      args: ['packages/simplebeacon-cli/bin/simplebeacon-mcp.js', '--offline'],
    };
  }
  const localJs = path.join(root, 'node_modules', 'simplebeacon', 'bin', 'simplebeacon-mcp.js');
  const localBin = path.join(root, 'node_modules', '.bin', 'simplebeacon-mcp');
  const localCmd = path.join(root, 'node_modules', '.bin', 'simplebeacon-mcp.cmd');
  if (fs.existsSync(localJs) || fs.existsSync(localBin) || fs.existsSync(localCmd)) {
    return { command: 'npx', args: ['simplebeacon-mcp', '--offline'] };
  }
  return {
    command: 'npx',
    args: ['--yes', '-p', 'simplebeacon', 'simplebeacon-mcp', '--offline'],
  };
}

export function buildSimplebeaconMcpServer(projectRoot: string, options?: { licenseToken?: string }): Record<string, unknown> {
  const root = path.resolve(projectRoot);
  const { command, args } = detectMcpLaunch(root);
  const env: Record<string, string> = {
    SIMPLEBEACON_PROJECT_ROOT: root,
    SIMPLEBEACON_OFFLINE: '1',
  };
  if (options?.licenseToken) {
    env.SIMPLEBEACON_LICENSE_TOKEN = options.licenseToken;
  }
  return {
    command,
    args,
    env,
  };
}

export type McpInstallResult = {
  status: 'created' | 'merged' | 'unchanged';
  configPath: string;
};

export function mergeCursorMcpConfig(projectRoot: string, options?: { licenseToken?: string }): McpInstallResult {
  const root = path.resolve(projectRoot);
  const configPath = path.join(root, '.cursor', 'mcp.json');
  const server = buildSimplebeaconMcpServer(root, options);
  let existing: { mcpServers?: Record<string, unknown> } = { mcpServers: {} };
  let hadFile = false;

  if (fs.existsSync(configPath)) {
    hadFile = true;
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        existing = parsed;
      }
    } catch {
      existing = { mcpServers: {} };
    }
  }

  if (!existing.mcpServers || typeof existing.mcpServers !== 'object') {
    existing.mcpServers = {};
  }

  const prev = existing.mcpServers.simplebeacon;
  if (prev && JSON.stringify(prev) === JSON.stringify(server)) {
    return { status: 'unchanged', configPath };
  }

  existing.mcpServers.simplebeacon = server;
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
  return { status: hadFile ? 'merged' : 'created', configPath };
}

export type RuleInstallResult = { status: 'created' | 'unchanged'; path: string };

export function ensureCursorAgentRule(
  projectRoot: string,
  options?: { paidTier?: boolean; supercharge?: boolean; force?: boolean }
): RuleInstallResult {
  const target = path.join(path.resolve(projectRoot), '.cursor', 'rules', AGENT_RULE_FILENAME);
  const useSupercharge = options?.supercharge !== false;
  const content = useSupercharge
    ? wrapSuperchargeMdc(loadSuperchargeRuleBody())
    : (options?.paidTier ? AGENT_RULE_CONTENT : AGENT_RULE_CONTENT_FREE);
  if (fs.existsSync(target) && !options?.force) {
    return { status: 'unchanged', path: target };
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  return { status: 'created', path: target };
}

export type AgentBridgeResult = {
  mcp: McpInstallResult;
  rule: RuleInstallResult;
};

export function ensureWorkspaceAgentBridge(
  projectRoot: string,
  options?: { licenseToken?: string; paidTier?: boolean; supercharge?: boolean }
): AgentBridgeResult {
  return {
    mcp: mergeCursorMcpConfig(projectRoot, { licenseToken: options?.licenseToken }),
    rule: ensureCursorAgentRule(projectRoot, {
      paidTier: options?.paidTier,
      supercharge: options?.supercharge,
    }),
  };
}

function pickIssues(report: Record<string, unknown> | null | undefined): Array<Record<string, unknown>> {
  if (!report || typeof report !== 'object') return [];
  const raw =
    (report.detectedIssues as unknown) ||
    (report.rawIssues as unknown) ||
    (report.findings as unknown) ||
    (report.issues as unknown) ||
    [];
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

export function formatAgentBrief(report: Record<string, unknown> | null | undefined, projectRoot?: string, options?: { paid?: boolean }): string {
  const paid = options?.paid === true;
  const data = report && typeof report === 'object' ? report : {};
  const gate = (data.gate as Record<string, unknown>) || {};
  const pass = gate.pass === true;
  const blockingCount = Number(gate.blockingCount ?? 0);
  const score = data.qualityScore ?? (data.summary as Record<string, unknown> | undefined)?.qualityScore ?? 'N/A';
  const issues = pickIssues(data);
  const blocking = issues.filter((i) => {
    const sev = String(i.severity || i.sev || '').toLowerCase();
    return sev === 'critical' || sev === 'high' || i.blocking === true;
  });

  if (!paid) {
    const teaser = (blocking.length ? blocking : issues).slice(0, 1);
    const lines = [
      '# SimpleBeacon agent brief (free preview)',
      '',
      `- **Gate:** ${pass ? 'PASS' : 'FAIL'} (${blockingCount} blocking)`,
      `- **Issues detected:** ${issues.length}`,
      '',
      'Start sessions with MCP **`supercharge_agent`**. Free tier = **2/10**.',
      '- https://simplebeacon.ai/pricing',
      '',
    ];
    if (teaser.length) {
      const t = teaser[0];
      const desc = String(t.description || t.message || t.title || '').trim();
      const snippet = desc ? `: ${desc.slice(0, 180)}` : '';
      lines.push(`- Sample: [${t.severity || 'high'}]${snippet}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  const top = (blocking.length ? blocking : issues).slice(0, 12);
  const lines = [
    '# SimpleBeacon agent brief',
    '',
    `- **Project:** ${projectRoot || data.projectRoot || data.projectPath || 'unknown'}`,
    `- **Gate:** ${pass ? 'PASS' : 'FAIL'} (${blockingCount} blocking)`,
    `- **Quality score:** ${score}`,
    `- **Issues:** ${issues.length}`,
    `- **Blocking / high:** ${blocking.length}`,
    `- **Updated:** ${new Date().toISOString()}`,
    '',
    'Start: **`supercharge_agent`**. Loop: scan_snippet → propose_fix → verify_fix. Pre-PR: scan_staged → handoff_check.',
    '',
  ];
  if (top.length > 0) {
    lines.push('## Top findings');
    lines.push('');
    for (const issue of top) {
      const sev = issue.severity || issue.sev || 'low';
      const type = issue.type || issue.pattern || issue.category || 'issue';
      const desc = String(issue.description || issue.message || issue.title || '').slice(0, 180);
      const file = issue.file || issue.path || issue.filePath || '';
      lines.push(`- [${sev}] ${type}${file ? ` @ ${file}` : ''}${desc ? `: ${desc}` : ''}`);
    }
    lines.push('');
  } else {
    lines.push('_No findings in the latest report._');
    lines.push('');
  }
  lines.push('Remediate gate-blocking issues before claiming the workspace is clean.');
  return lines.join('\n');
}

export function formatAgentSuperchargeBrief(
  report: Record<string, unknown> | null | undefined,
  projectRoot?: string,
  options?: { paid?: boolean }
): string {
  const brief = formatAgentBrief(report, projectRoot, options);
  const data = report && typeof report === 'object' ? report : {};
  const gate = (data.gate as Record<string, unknown>) || {};
  const pass = gate.pass === true;
  const blockingCount = Number(gate.blockingCount ?? 0);
  const mission = pass
    ? 'Gate passed — run handoff_check before claiming done'
    : blockingCount > 0
      ? `Fix ${blockingCount} gate blocker${blockingCount === 1 ? '' : 's'}`
      : 'Run scan_project with gate:true to refresh baseline';

  return [
    '# SimpleBeacon Agent Supercharge',
    '',
    `> Mission: **${mission}**`,
    '',
    '## MCP session start',
    '',
    '1. Call **`supercharge_agent`** (refreshes this file when writeDisk:true)',
    '2. Read `.simplebeacon/code-suggestions.md` before editing gate-blocking files',
    '3. **`scan_snippet`** before accepting generated code',
    '4. **`handoff_check`** before claiming done',
    '',
    'Wire plugins: **`install_agent_plugin`** or `npx simplebeacon init --starter --hosts all`',
    '',
    '---',
    '',
    brief,
  ].join('\n');
}

export function writeAgentBriefFromReport(
  projectRoot: string,
  report: Record<string, unknown> | null | undefined,
  options?: { paid?: boolean; writeSupercharge?: boolean }
): { path: string; markdown: string; superchargePath?: string } {
  const root = path.resolve(projectRoot);
  const briefPath = path.join(root, '.simplebeacon', AGENT_BRIEF_FILENAME);
  const markdown = formatAgentBrief(report, root, options);
  fs.mkdirSync(path.dirname(briefPath), { recursive: true });
  fs.writeFileSync(briefPath, markdown, 'utf8');

  let superchargePath: string | undefined;
  if (options?.writeSupercharge !== false) {
    superchargePath = path.join(root, '.simplebeacon', AGENT_SUPERCHARGE_FILENAME);
    fs.writeFileSync(superchargePath, formatAgentSuperchargeBrief(report, root, options), 'utf8');
  }

  return { path: briefPath, markdown, superchargePath };
}
