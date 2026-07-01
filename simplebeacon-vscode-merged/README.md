# SimpleBeacon Enhanced AI Extension

[![Version](https://img.shields.io/badge/version-3.0.344-blue.svg)](https://github.com/simplebeacon/simplebeacon-vscode)
[![VSCode](https://img.shields.io/badge/VSCode-1.84.0+-green.svg)](https://code.visualstudio.com/)
[![Node.js](https://img.shields.io/badge/Node.js-22.0.0+-green.svg)](https://nodejs.org/)

Privacy-first source code scanner with enhanced AI analysis. Analyze your repository for security, compliance, and quality issues with intelligent pattern detection and real-time analysis.

## 🚀 Features

### Enhanced AI Analysis
- **Progressive Analysis**: Multi-layer analysis with static, semantic, contextual, and AI-powered insights
- **Intelligent Model Selection**: Automatic model selection based on analysis requirements
- **Analysis Profiles**: Quick, balanced, comprehensive, and real-time analysis modes
- **Adaptive Fallback**: Graceful degradation when preferred models are unavailable

### Real-time Analysis
- **Live Code Analysis**: Analyze code as you type with WebSocket streaming
- **Session Management**: Persistent analysis sessions with automatic cleanup
- **Incremental Processing**: Analyze code chunks for immediate feedback
- **Performance Optimized**: Efficient real-time processing with minimal impact

### Pattern Detection
- **Architecture Patterns**: MVC, Repository, Dependency Injection
- **Security Patterns**: Input validation, authentication, error handling
- **Performance Patterns**: Caching, async operations, data pipelines
- **Maintainability Patterns**: Code structure, testing, documentation

### Model Management
- **Health Monitoring**: Real-time model availability and performance tracking
- **Circuit Breaker**: Automatic failover when models become unresponsive
- **Intelligent Routing**: Route requests to optimal models based on requirements
- **Multi-Provider Support**: OpenAI, Anthropic, Ollama, and local models

## 📦 Installation

### From VSCode Marketplace
1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "SimpleBeacon AI Slop Cop"
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

### 2. Enhanced AI Analysis
```bash
# Run comprehensive AI-powered analysis
> SimpleBeacon: Enhanced AI Analysis
```

### 3. Real-time Analysis
```bash
# Enable live code analysis
> SimpleBeacon: Real-time Analysis
```

### 4. Pattern Detection
```bash
# Detect code patterns and architecture
> SimpleBeacon: Pattern Detection
```

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

## 📚 Documentation

- [Enhanced AI Analyzer Documentation](https://github.com/simplebeacon/simplebeacon-ai-platform/blob/main/ENHANCED_AI_ANALYZER.md)
- [API Reference](https://github.com/simplebeacon/simplebeacon-ai-platform/blob/main/docs/api.md)
- [Configuration Guide](https://github.com/simplebeacon/simplebeacon-ai-platform/blob/main/docs/configuration.md)
- [Troubleshooting](https://github.com/simplebeacon/simplebeacon-ai-platform/blob/main/docs/troubleshooting.md)

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

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/simplebeacon/simplebeacon-vscode/issues)
- **Discussions**: [GitHub Discussions](https://github.com/simplebeacon/simplebeacon-vscode/discussions)
- **Documentation**: [Wiki](https://github.com/simplebeacon/simplebeacon-vscode/wiki)
- **Email**: support@simplebeacon.ai

## 🗺️ Roadmap

### Upcoming Features

- **Custom Pattern Definition**: User-defined pattern rules
- **Multi-language Support**: Enhanced pattern detection for more languages
- **Collaborative Analysis**: Shared analysis sessions
- **Advanced Metrics**: More sophisticated performance tracking
- **Integration Marketplace**: Pre-built integrations for popular tools

### Version 1.2.0 (Planned)
- Custom pattern engine
- Enhanced collaboration features
- Advanced analytics dashboard
- Performance optimizations

## 🎉 Thank You

Thank you for using SimpleBeacon Enhanced AI Extension! Your feedback and contributions help make this tool better for everyone.

---

**Made with ❤️ by the SimpleBeacon Team**
