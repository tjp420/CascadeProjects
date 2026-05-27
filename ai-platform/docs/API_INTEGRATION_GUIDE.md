# API Integration Guide for Cascade Harness

This guide shows you how to integrate real LLM APIs with the Cascade Harness.

## Quick Setup

### 1. Get an OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-`)

### 2. Set Up Your API Key

#### Option A: Environment Variable (Recommended)
```bash
# Windows
set OPENAI_API_KEY=your-actual-api-key-here

# Linux/Mac
export OPENAI_API_KEY=your-actual-api-key-here
```

#### Option B: Configuration File
Create `~/.cascade_harness/config.json`:
```json
{
  "api_key": "your-actual-api-key-here",
  "model": "gpt-4",
  "api_base": "https://api.openai.com/v1"
}
```

### 3. Test the Integration

```bash
# Test with real API
python src/main_fixed.py prompt "Hello, can you help me write a Python function?"
```

## Supported Models

### OpenAI Models
- `gpt-4` - Most capable, best for complex tasks
- `gpt-4-turbo` - Faster, good for most tasks
- `gpt-3.5-turbo` - Fastest, most economical

### Usage Examples
```bash
# Use specific model
python src/main_fixed.py --model gpt-4-turbo prompt "Help me debug this code"

# Use specific tools
python src/main_fixed.py --tools read_file,write_file prompt "Read config.txt and update it"
```

## Alternative API Providers

### Using Other OpenAI-Compatible APIs

Set a custom API base URL:

```bash
# Environment variable
set CASCADE_API_BASE=https://api.anthropic.com/v1

# Or in config file
{
  "api_base": "https://api.anthropic.com/v1",
  "model": "claude-3-sonnet"
}
```

### Popular Alternatives
- **Anthropic Claude**: `https://api.anthropic.com/v1`
- **Google Gemini**: `https://generativelanguage.googleapis.com/v1beta`
- **Local LLMs**: `http://localhost:8080/v1` (Ollama, LM Studio, etc.)

## Configuration Options

### Full Configuration Example
```json
{
  "api_key": "your-api-key",
  "api_base": "https://api.openai.com/v1",
  "model": "gpt-4",
  "max_tokens": 4096,
  "temperature": 0.7,
  "debug": false,
  "session_dir": "~/.cascade_harness/sessions"
}
```

### Parameter Explanations
- `max_tokens`: Maximum response length (1-4096)
- `temperature`: Creativity (0.0-1.0, lower = more focused)
- `debug`: Enable detailed logging
- `session_dir`: Where to store conversation history

## Cost Management

### Monitor Usage
```bash
# Check session statistics
python src/main_fixed.py session show --id your-session-id

# List all sessions with token counts
python src/main_fixed.py session list --output-format json
```

### Cost-Saving Tips
1. Use `gpt-3.5-turbo` for simple tasks
2. Set reasonable `max_tokens` limits
3. Use mock mode for testing: `set OPENAI_API_KEY=test-key`
4. Clear old sessions regularly

## Troubleshooting

### Common Issues

#### "No API key provided"
```bash
# Check if key is set
echo %OPENAI_API_KEY%  # Windows
echo $OPENAI_API_KEY  # Linux/Mac

# Set the key
set OPENAI_API_KEY=your-key-here
```

#### "Invalid API key"
- Verify the key starts with `sk-`
- Check if the key has expired
- Ensure you have sufficient credits

#### "Model not found"
- Check supported models for your API provider
- Verify the model name spelling
- Some providers use different model names

#### "Rate limit exceeded"
- Wait a few minutes and retry
- Consider upgrading your API plan
- Use a less expensive model

### Debug Mode
```bash
# Enable debug logging
python src/main_fixed.py --debug prompt "Test message"
```

## Advanced Usage

### Custom Tool Integration
Add your own tools by extending the `Tool` class:

```python
class CustomTool(Tool):
    def __init__(self):
        super().__init__(
            name="my_tool",
            description="My custom tool",
            parameters={
                "type": "object",
                "properties": {
                    "input": {"type": "string"}
                }
            }
        )
    
    def execute(self, args):
        return {"result": f"Processed: {args['input']}"}
```

### Session Management
```bash
# Resume a previous session
python src/main_fixed.py --session-id abc123 prompt "Continue our conversation"

# Clear all sessions
python src/main_fixed.py session clear
```

### Batch Processing
Create a script to process multiple prompts:

```python
import subprocess
import json

prompts = [
    "Write a Python hello world script",
    "Explain recursion",
    "Create a simple REST API"
]

for prompt in prompts:
    result = subprocess.run([
        "python", "src/main_fixed.py", 
        "--output-format", "json",
        "prompt", prompt
    ], capture_output=True, text=True)
    
    response = json.loads(result.stdout)
    print(f"Prompt: {prompt}")
    print(f"Response: {response['content']}\n")
```

## Security Best Practices

1. **Never commit API keys to version control**
2. **Use environment variables in production**
3. **Rotate API keys regularly**
4. **Monitor usage for unusual activity**
5. **Set appropriate permissions**

## Next Steps

1. Start with mock mode to test functionality
2. Get an API key and test with simple prompts
3. Explore different models and tools
4. Build custom tools for your specific needs
5. Integrate into your workflow

## Support

- Check the [main README](README.md) for basic usage
- Review the code in `src/core/` for technical details
- Use `--debug` flag for troubleshooting
- Check session logs for error details
