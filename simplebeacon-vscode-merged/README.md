# SimpleBeacon — AI Coding Agent Verifier

[![Version](https://img.shields.io/badge/version-3.0.507-blue.svg)](https://github.com/simplebeacon/simplebeacon-vscode)
[![VSCode](https://img.shields.io/badge/VSCode-1.84.0+-green.svg)](https://code.visualstudio.com/)
[![Node.js](https://img.shields.io/badge/Node.js-22.0.0+-green.svg)](https://nodejs.org/)

**Verification layer for AI coding agents.** Catches what Cursor, Claude Code, Cline, Windsurf, Copilot, and Aider get wrong — phantom APIs, swallowed exceptions, hallucinated imports, and LLM slop — locally, before merge. Zero source upload.

96% of developers don't fully trust AI-generated code (Sonar 2026). 38% say reviewing AI code takes longer than reviewing human code. SimpleBeacon moves that review into the agent's edit loop.

## 🚀 The 3 Core Tools (Free)

| Tool | What it does | When the agent calls it |
|------|--------------|------------------------|
| **`verify_before_write`** | Runs swallowed-exception, phantom-API, hallucinated-import, and AI-slop scanners on proposed file content. Returns `ok-to-write`, `fix-and-retry`, or `consult-user`. Sub-100ms. | Before writing any file to disk |
| **`verify_completion`** | Checks gate pass, test suite, build status, and git cleanliness. Returns `canClaimComplete` with evidence per check. | Before claiming a task is "done" |
| **`watch_project`** | Real-time file monitoring with 500ms debounce. Pushes findings to the MCP client as the agent types. | Continuous — start at session start |

## 🛡️ The 4 Failure Patterns SimpleBeacon Catches

Backed by Columbia DAPLab 2025 and CodeHalu (AAAI 2025) research on AI coding agent failures.

1. **Phantom APIs** (37% of agent bugs) — hallucinated method calls on real libraries. `fs.readFilePromise`, `JSON.tryParse`, `Promise.retry`, `Array.first`. 100+ patterns with the real API suggestion.
2. **Swallowed Exceptions** — empty catch blocks, `except: pass`, `return nil` without wrapping. The #1 silent production failure mode.
3. **Hallucinated Imports** — imports that don't exist, wrong export names, invented packages. Caught before the build.
4. **LLM Slop** — markdown fences in code, `TODO: implement`, sample/mock production paths, fiction KPIs. Stripped before review.

## 🔌 Agent Support

Works with any MCP-compatible AI coding agent:
- Cursor
- Claude Code
- Cline
- Windsurf
- GitHub Copilot
- Aider
- Continue
- Universal (via `AGENTS.md`)

Wire any agent with one call:
```bash
npx simplebeacon init --starter --hosts all
```

Or via MCP: `install_agent_plugin` with `hosts: "cursor,windsurf,continue,copilot,cline,aider,universal"`.

## 📦 Installation

### From VSCode Marketplace
1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "SimpleBeacon AI Coding Agent Verifier"
4. Click Install

### From VSIX
1. Download the latest [VSIX package](https://github.com/simplebeacon/simplebeacon-vscode/releases)
2. Open VSCode
3. Go to Extensions (Ctrl+Shift+X)
4. Click "..." and select "Install from VSIX..."
5. Choose the downloaded VSIX file

## 🎯 Quick Start

### 1. Basic Scan
```bash
# Use the command palette (Ctrl+Shift+P)
> SimpleBeacon: Scan Workspace
```

### 2. Wire an AI Coding Agent
```bash
# Wire Cursor, Claude Code, Cline, and others
npx simplebeacon init --starter --hosts all
```

### 3. MCP Server (for non-VS-Code agents)
```bash
# Start the MCP stdio server
npx simplebeacon mcp start
```

### 4. CI Gate
```bash
npx simplebeacon scan --gate --offline --format json --output .simplebeacon/report.json
npx simplebeacon gate status
```

## 💰 Pricing

| Tier | Price | What you get |
|------|-------|--------------|
| **Free** | $0 | `verify_before_write`, `verify_completion`, `watch_project`, `supercharge_agent`, `solve_problem`, `diagnose_error`, 20 snippet scans/day |
| **Agent** | $25/mo or $250/yr | Fix loop for AI coding agents: `scan_file`, `propose_fix`, `verify_fix`, `agent_status`, `explain_finding`, unlimited scans |
| **Developer** | $49/mo or $490/yr | Everything in Agent plus `scan_staged`, `get_action_plan`, CI gate, CVE + git history scanners |

[See full pricing →](https://simplebeacon.ai/pricing)

## 🔒 Privacy

- **Zero source upload** — all scanning runs locally
- **Zero data retention** — your code is never stored, sold, or used to train AI models
- **Signed reports** — `.sbcert` artifacts verified against a public key
- **Local-first audit** — board-ready certificates without vendor data custody

## 📚 Documentation

- [Website](https://simplebeacon.ai)
- [CLI Documentation](https://github.com/tjp420/simplebeacon)
- [MCP Tools Reference](https://simplebeacon.ai/docs/mcp-tools)

## 📄 License

See [LICENSE](LICENSE)

## ⚙️ Configuration

### Analysis Profiles

| Profile | Description | Use Case |
|---------|-------------|----------|
| **Quick** | Fast, lightweight analysis | Quick feedback during development |
| **Balanced** | Comprehensive analysis | General purpose analysis |
| **Comprehensive** | Deep analysis with expert reviews | Code reviews and audits |
| **Real-time** | Incremental analysis | Live code analysis |

### Settings

```json
{
  "simplebeacon.analysisProfile": "balanced",
  "simplebeacon.enableRealtime": false,
  "simplebeacon.preferredAIProvider": "auto",
  "simplebeacon.autoScanOnOpen": false,
  "simplebeacon.maxFiles": 5000,
  "simplebeacon.excludePatterns": [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".vscode",
    ".simplebeacon"
  ]
}
```

### AI Providers

| Provider | Description | Setup |
|----------|-------------|-------|
| **Auto** | Automatic selection | No setup required |
| **OpenAI** | GPT models | Set `OPENAI_API_KEY` |
| **Anthropic** | Claude models | Set `ANTHROPIC_API_KEY` |
| **Ollama** | Local models | Install Ollama locally |

## 🎨 UI Overview

### Sidebar Views

#### 🛡️ SimpleBeacon (Main)
- **Header**: Quality score and gate status
- **Quick Actions**: Common analysis commands
- **Results Overview**: Scan summary and metrics
- **Detailed Results**: Findings by category and severity

#### ⚡ Enhanced AI
- **Model Health**: AI model availability and performance
- **Active Sessions**: Real-time analysis sessions
- **Detected Patterns**: Pattern detection results
- **Enhanced Actions**: Advanced analysis commands

#### ⚙️ Settings
- **Configuration**: Extension settings
- **AI Providers**: Model configuration
- **Analysis Profiles**: Profile management
- **Debug Options**: Troubleshooting tools

### Status Bar

The status bar shows:
- **Scan Status**: Current analysis state
- **Quality Score**: Overall code quality
- **Gate Status**: Pass/Fail indication
- **Quick Access**: Click to open dashboard

## 🔧 Advanced Usage

### Enhanced Analysis API

```javascript
// Use the enhanced analysis API programmatically
const result = await vscode.commands.executeCommand('simplebeacon.enhancedAnalysis', {
  profile: 'comprehensive',
  analysisType: 'security',
  includePatterns: true,
  maxDepth: 10
});
```

### Real-time Analysis

```javascript
// Create a real-time analysis session
const sessionId = await vscode.commands.executeCommand('simplebeacon.realtimeAnalysis');

// Analyze code chunks
await vscode.commands.executeCommand('simplebeacon.analyzeChunk', {
  sessionId,
  content: 'your code here',
  context: { filePath: 'src/example.js' }
});
```

### Pattern Detection

```javascript
// Detect patterns in current file
const patterns = await vscode.commands.executeCommand('simplebeacon.patternDetection', {
  categories: ['architecture', 'security'],
  confidence: 0.7
});
```

## 📊 Analysis Results

### Quality Score
- **0-59**: Poor quality - significant issues
- **60-79**: Fair quality - some issues present
- **80-89**: Good quality - minor issues
- **90-100**: Excellent quality - minimal issues

### Pattern Categories

#### Architecture Patterns
- **MVC**: Model-View-Controller pattern
- **Repository**: Data access layer pattern
- **Dependency Injection**: IoC container pattern

#### Security Patterns
- **Input Validation**: Data sanitization
- **Authentication**: User verification
- **Error Handling**: Exception management

#### Performance Patterns
- **Caching**: Data caching strategies
- **Async Operations**: Non-blocking processing
- **Data Pipelines**: Stream processing

#### Maintainability Patterns
- **Code Structure**: Organization and modularity
- **Testing**: Unit and integration tests
- **Documentation**: Code comments and docs

## 🚨 Troubleshooting

### Common Issues

#### Extension Not Loading
1. Check VSCode version (requires 1.84.0+)
2. Check Node.js version (requires 22.0.0+)
3. Restart VSCode
4. Reinstall extension

#### Analysis Not Working
1. Check server connection
2. Verify API keys (if using cloud providers)
3. Check file permissions
4. Review exclude patterns

#### Real-time Analysis Issues
1. Check WebSocket connection
2. Verify session status
3. Check network connectivity
4. Review server logs

#### Model Health Issues
1. Check provider configuration
2. Verify API credentials
3. Test model availability
4. Review performance metrics

### Debug Mode

Enable debug logging:

```json
{
  "simplebeacon.debug": true,
  "simplebeacon.verboseLogging": true
}
```

Check the output channel: `View > Output > SimpleBeacon`

### Performance Tips

1. **Use Appropriate Profiles**: Choose the right analysis profile for your needs
2. **Configure Excludes**: Exclude unnecessary files and directories
3. **Monitor Resources**: Check memory and CPU usage
4. **Optimize Sessions**: Clean up inactive real-time sessions

## 🔄 Integration

### CI/CD Pipeline

```yaml
# GitHub Actions example
- name: Enhanced AI Analysis
  uses: simplebeacon/action@v1
  with:
    profile: comprehensive
    output-format: json
    fail-on-issues: true
```

### Pre-commit Hooks

```bash
#!/bin/sh
# .git/hooks/pre-commit
npx simplebeacon analyze --profile quick --fail-on-blocking
```

### API Integration

```javascript
// Integrate with your own tools
const response = await fetch('http://localhost:3000/api/analyze/flexible', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectPath: '/path/to/project',
    analysisType: 'enhanced',
    profile: 'balanced'
  })
});

const result = await response.json();
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/simplebeacon/simplebeacon-vscode.git
cd simplebeacon-vscode

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run tests
npm test

# Build extension
npm run build
```

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/simplebeacon/simplebeacon-vscode/issues)
- **Discussions**: [GitHub Discussions](https://github.com/simplebeacon/simplebeacon-vscode/discussions)
- **Email**: support@simplebeacon.ai

---

**Made with care by the SimpleBeacon Team**
