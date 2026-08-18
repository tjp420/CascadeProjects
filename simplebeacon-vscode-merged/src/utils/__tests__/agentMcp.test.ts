import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  detectMcpLaunch,
  mergeCursorMcpConfig,
  ensureCursorAgentRule,
  formatAgentBrief,
  writeAgentBriefFromReport,
  AGENT_RULE_FILENAME,
} from '../agentMcp';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sb-agent-mcp-'));
}

describe('agentMcp', () => {
  it('detects monorepo MCP launch when the CLI bin exists', () => {
    const root = tmpDir();
    const bin = path.join(root, 'packages', 'simplebeacon-cli', 'bin', 'simplebeacon-mcp.js');
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    fs.writeFileSync(bin, '// mcp\n');
    const launch = detectMcpLaunch(root);
    expect(launch.command).toBe('node');
    expect(launch.args[0]).toBe('packages/simplebeacon-cli/bin/simplebeacon-mcp.js');
  });

  it('merges simplebeacon into existing Cursor MCP config without dropping other servers', () => {
    const root = tmpDir();
    const configPath = path.join(root, '.cursor', 'mcp.json');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(
      configPath,
      JSON.stringify({ mcpServers: { other: { command: 'echo' } } }, null, 2)
    );
    const first = mergeCursorMcpConfig(root);
    expect(first.status).toBe('merged');
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(parsed.mcpServers.other.command).toBe('echo');
    expect(parsed.mcpServers.simplebeacon).toBeTruthy();
    const second = mergeCursorMcpConfig(root);
    expect(second.status).toBe('unchanged');
  });

  it('writes the Cursor agent rule once', () => {
    const root = tmpDir();
    const created = ensureCursorAgentRule(root);
    expect(created.status).toBe('created');
    expect(fs.existsSync(path.join(root, '.cursor', 'rules', AGENT_RULE_FILENAME))).toBe(true);
    const again = ensureCursorAgentRule(root);
    expect(again.status).toBe('unchanged');
  });

  it('formats and writes an agent brief from a scan report', () => {
    const root = tmpDir();
    const markdown = formatAgentBrief(
      {
        qualityScore: 88,
        gate: { pass: false },
        detectedIssues: [{ severity: 'high', type: 'credential', description: 'hardcoded token', file: 'src/a.js' }],
      },
      root
    );
    expect(markdown).toContain('Gate:** FAIL');
    expect(markdown).toContain('hardcoded token');
    const written = writeAgentBriefFromReport(root, {
      qualityScore: 88,
      gate: { pass: false },
      detectedIssues: [{ severity: 'high', type: 'credential', description: 'hardcoded token', file: 'src/a.js' }],
    });
    expect(fs.existsSync(written.path)).toBe(true);
    expect(written.markdown).toContain('supercharge_agent');
  });
});
