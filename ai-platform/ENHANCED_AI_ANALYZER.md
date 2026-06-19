# Enhanced AI Analyzer Documentation

## Overview

The Enhanced AI Analyzer significantly improves the SimpleBeacon AI analysis capabilities with intelligent model selection, real-time streaming, progressive analysis enhancement, and machine learning-inspired pattern detection.

## Key Features

### 1. Enhanced AI Orchestration
- **Progressive Analysis**: Multi-layer analysis with static, semantic, contextual, and AI-powered insights
- **Intelligent Model Selection**: Automatic model selection based on analysis requirements and performance
- **Adaptive Fallback**: Graceful degradation when preferred models are unavailable

### 2. Real-time Analysis Streaming
- **WebSocket Support**: Real-time analysis updates via WebSocket connections
- **Incremental Processing**: Analyze code chunks as they're provided
- **Session Management**: Persistent analysis sessions with automatic cleanup

### 3. Enhanced Model Management
- **Circuit Breaker Pattern**: Automatic failover when models become unresponsive
- **Health Monitoring**: Track model performance and availability
- **Intelligent Routing**: Route requests to optimal models based on requirements

### 4. ML Pattern Detection
- **Statistical Analysis**: Pattern detection using statistical methods
- **Multiple Categories**: Architecture, security, performance, maintainability, testing patterns
- **Confidence Scoring**: Pattern confidence assessment with detailed insights

## Usage Examples

### Basic Enhanced Analysis

```javascript
const { progressiveAnalysis, ANALYSIS_PROFILES } = require('./server/lib/enhanced-ai-orchestrator.cjs');

// Perform balanced analysis
const result = await progressiveAnalysis(codeContent, {
    filePath: 'src/components/UserForm.js',
    projectPath: '/path/to/project',
    analysisType: 'general'
}, {
    profile: 'balanced',
    baseDir: __dirname
});

console.log('Analysis result:', result);
```

### Real-time Streaming Analysis

```javascript
// Create analysis session
const sessionResponse = await fetch('/api/realtime/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        profile: 'realtime',
        analysisType: 'security'
    })
});

const { sessionId } = await sessionResponse.json();

// Analyze code chunks
await fetch(`/api/realtime/analyze/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        chunkId: 'chunk-1',
        content: 'function validateInput(input) { return input.trim(); }',
        context: { filePath: 'utils/validation.js' }
    })
});

// Get results
const resultsResponse = await fetch(`/api/realtime/session/${sessionId}/results`);
const results = await resultsResponse.json();
```

### WebSocket Real-time Analysis

```javascript
const ws = new WebSocket('ws://localhost:8082/api/realtime/stream?sessionId=your-session-id');

ws.onopen = () => {
    console.log('Connected to real-time analysis');
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'analysis_result') {
        console.log('Real-time analysis result:', data.result);
    }
};

// Send analysis request
ws.send(JSON.stringify({
    type: 'analyze',
    chunkId: 'chunk-1',
    content: 'your code here',
    context: { filePath: 'example.js' }
}));
```

### Enhanced Model Management

```javascript
const { getModelManager } = require('./server/services/enhanced-model-manager.cjs');

const modelManager = getModelManager(__dirname);

// Get optimal model for analysis
const model = await modelManager.getOptimalModel({
    preferredProvider: 'openai',
    analysisType: 'security',
    complexity: 'high',
    maxResponseTime: 30000
});

// Execute analysis with automatic retry and fallback
const result = await modelManager.executeAnalysis(model.id, prompt, {
    timeout: 60000,
    maxRetries: 2,
    requirements: {
        analysisType: 'security',
        complexity: 'high'
    }
});
```

### ML Pattern Detection

```javascript
const { detectMLPatterns } = require('./server/lib/code-understanding/ml-pattern-detector.cjs');

const patterns = detectMLPatterns(codeContent, {
    filePath: 'src/controllers/UserController.js',
    projectPath: '/path/to/project',
    language: 'javascript'
});

console.log('Detected patterns:', patterns.patterns);
console.log('Pattern summary:', patterns.summary);
console.log('Insights:', patterns.insights);
```

## API Endpoints

### Enhanced Analysis Profiles

- `GET /api/analyze/providers` - Get available providers and analysis profiles
- `POST /api/analyze/flexible` - Perform enhanced analysis with profile selection

### Real-time Analysis

- `POST /api/realtime/session` - Create real-time analysis session
- `POST /api/realtime/analyze/:sessionId` - Analyze code chunk
- `GET /api/realtime/session/:sessionId/results` - Get session results
- `GET /api/realtime/session/:sessionId/status` - Get session status
- `DELETE /api/realtime/session/:sessionId` - Close session
- `WebSocket: ws://localhost:8082/api/realtime/stream` - Real-time streaming

## Analysis Profiles

### Quick Profile
- **Use Case**: Fast feedback during development
- **Features**: Basic static analysis, 30-second timeout
- **Model Preference**: Local models preferred

### Balanced Profile
- **Use Case**: General purpose analysis
- **Features**: Static + semantic analysis, 60-second timeout
- **Model Preference**: Hybrid approach

### Comprehensive Profile
- **Use Case**: Deep analysis for code reviews
- **Features**: All analysis layers including expert reviews, 120-second timeout
- **Model Preference**: Cloud models preferred

### Realtime Profile
- **Use Case**: Live code analysis
- **Features**: Incremental analysis, 15-second timeout
- **Model Preference**: Local models for speed

## Pattern Categories

### Architecture Patterns
- MVC (Model-View-Controller)
- Repository Pattern
- Dependency Injection

### Security Patterns
- Input Validation
- Authentication Flow
- Error Handling

### Performance Patterns
- Caching
- Async Operations
- Data Pipelines

### Maintainability Patterns
- Code Structure
- Testing Patterns
- Documentation

## Configuration

### Environment Variables

```bash
# Real-time analysis
REALTIME_WS_PORT=8082

# Enhanced model management
MODEL_CACHE_TIMEOUT_MS=30000
CIRCUIT_BREAKER_TIMEOUT_MS=60000

# Analysis profiles
DEFAULT_ANALYSIS_PROFILE=balanced
MAX_ANALYSIS_TIMEOUT_MS=120000
```

### Model Configuration

Models are automatically discovered and managed. The system supports:

- **Ollama**: Local models via Ollama
- **OpenAI**: GPT models via API
- **Anthropic**: Claude models via API
- **Demo**: Deterministic fallback mode

## Error Handling

The enhanced analyzer includes comprehensive error handling:

- **Circuit Breaker**: Automatic failover when models fail
- **Graceful Degradation**: Fallback to deterministic analysis
- **Retry Logic**: Automatic retry with different models
- **Timeout Protection**: Configurable timeouts for all operations

## Performance Considerations

### Caching
- Model availability cached for 30 seconds
- Analysis sessions auto-expire after 30 minutes
- Pattern detection results cached per session

### Resource Management
- WebSocket connections limited and monitored
- Memory usage tracked for large analyses
- Automatic cleanup of inactive sessions

### Optimization Tips
1. Use appropriate analysis profiles for your use case
2. Prefer local models for real-time analysis
3. Configure timeouts based on your requirements
4. Monitor model health and availability

## Integration Examples

### VS Code Extension Integration

```javascript
// Enhanced analysis in VS Code extension
async function analyzeDocument(document) {
    const response = await fetch('/api/analyze/flexible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            projectPath: workspace.rootPath,
            analysisType: 'codebase',
            profile: 'balanced',
            understandingMode: 'enhanced',
            includePaths: [document.uri.fsPath]
        })
    });
    
    return await response.json();
}
```

### CI/CD Pipeline Integration

```javascript
// Enhanced analysis in CI/CD
async function runEnhancedAnalysis(projectPath) {
    const response = await fetch('/api/analyze/flexible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            projectPath,
            analysisType: 'complete',
            profile: 'comprehensive',
            understandingMode: 'enhanced'
        })
    });
    
    const result = await response.json();
    
    // Check for security patterns
    const securityPatterns = result.report.patterns?.filter(
        p => p.category === 'security'
    );
    
    if (securityPatterns.length === 0) {
        console.warn('No security patterns detected');
    }
    
    return result;
}
```

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check if REALTIME_WS_PORT is available
   - Verify firewall settings
   - Ensure session ID is valid

2. **Model Selection Fails**
   - Check model registry status
   - Verify API keys for cloud providers
   - Check Ollama service status

3. **Analysis Timeout**
   - Increase timeout for large codebases
   - Use appropriate analysis profile
   - Check system resources

### Debug Mode

Enable debug logging:

```bash
export DEBUG_LOGS=true
export RUNTIME_DEBUG=true
```

This will provide detailed logs for:
- Model selection process
- Circuit breaker state changes
- Analysis layer progress
- Performance metrics

## Future Enhancements

Planned improvements include:

- **Custom Pattern Definition**: User-defined pattern rules
- **Multi-language Support**: Enhanced pattern detection for more languages
- **Collaborative Analysis**: Shared analysis sessions
- **Advanced Metrics**: More sophisticated performance tracking
- **Integration Marketplace**: Pre-built integrations for popular tools

## Support

For issues and questions:

1. Check the debug logs for error details
2. Verify configuration and environment variables
3. Test with the demo profile to isolate issues
4. Review the health endpoints for system status

The enhanced AI analyzer is designed to be robust, scalable, and provide intelligent insights while maintaining backward compatibility with existing SimpleBeacon functionality.
