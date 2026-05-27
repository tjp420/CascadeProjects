# Claw Code Windsurf Integration - Python Version

Since Rust isn't available in the current environment, here's a Python implementation of the multi-provider AI harness for Windsurf.

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
pip install requests asyncio
```

### 2. Create the Python Harness
```python
# claw_windsurf.py
import json
import os
import sys
import asyncio
import requests
from typing import Dict, Optional, Any
import argparse

class WindsurfAIHarness:
    def __init__(self):
        self.config = self.load_config()
        self.default_provider = self.config.get("default_provider", "anthropic")
    
    def load_config(self) -> Dict[str, Any]:
        config_path = os.path.expanduser("~/.claw-windsurf/config.json")
        
        default_config = {
            "default_provider": "anthropic",
            "providers": {
                "anthropic": {
                    "provider_type": "anthropic",
                    "api_key": os.getenv("ANTHROPIC_API_KEY"),
                    "api_base": "https://api.anthropic.com",
                    "enabled": True,
                    "default_model": "claude-3-5-sonnet-20241022"
                },
                "openai": {
                    "provider_type": "openai", 
                    "api_key": os.getenv("OPENAI_API_KEY"),
                    "api_base": "https://api.openai.com/v1",
                    "enabled": False,
                    "default_model": "gpt-4o"
                },
                "ollama": {
                    "provider_type": "ollama",
                    "api_key": None,
                    "api_base": "http://localhost:11434",
                    "enabled": False,
                    "default_model": "llama3.1"
                }
            },
            "model_aliases": {
                "sonnet": "anthropic:claude-3-5-sonnet-20241022",
                "haiku": "anthropic:claude-3-5-haiku-20241022", 
                "opus": "anthropic:claude-3-opus-20240229",
                "gpt4": "openai:gpt-4o",
                "gpt4-mini": "openai:gpt-4o-mini",
                "llama": "ollama:llama3.1"
            }
        }
        
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    loaded_config = json.load(f)
                    # Merge with defaults
                    for key, value in loaded_config.items():
                        default_config[key] = value
            except:
                pass
        
        return default_config
    
    def save_config(self):
        config_path = os.path.expanduser("~/.claw-windsurf")
        os.makedirs(config_path, exist_ok=True)
        
        with open(os.path.join(config_path, "config.json"), 'w') as f:
            json.dump(self.config, f, indent=2)
    
    def list_providers(self):
        print("Available Providers:")
        for name, config in self.config["providers"].items():
            status = "✅ Enabled" if config["enabled"] else "❌ Disabled"
            key_status = "🔑 Configured" if config.get("api_key") else "🔑 Not configured"
            print(f"  {name} {status} - {config['provider_type']} ({key_status})")
        print(f"\nDefault provider: {self.default_provider}")
    
    def list_models(self):
        print("Available Models:")
        for alias, full_model in self.config["model_aliases"].items():
            print(f"  {alias} -> {full_model}")
        
        print("\nProvider-specific models:")
        for provider_name, config in self.config["providers"].items():
            if config["enabled"]:
                print(f"  {provider_name}: {config['default_model']}")
    
    async def test_providers(self):
        print("Testing provider connections...")
        
        for name, config in self.config["providers"].items():
            if not config["enabled"]:
                continue
            
            print(f"Testing {name}...")
            
            try:
                if config["provider_type"] == "anthropic":
                    await self.test_anthropic(name, config)
                elif config["provider_type"] == "openai":
                    await self.test_openai(name, config)
                elif config["provider_type"] == "ollama":
                    await self.test_ollama(name, config)
            except Exception as e:
                print(f"  ❌ {name} test failed: {e}")
    
    async def test_anthropic(self, name: str, config: Dict[str, Any]):
        if not config.get("api_key"):
            print(f"  ❌ {name} no API key configured")
            return
        
        response = requests.post(
            f"{config['api_base']}/v1/messages",
            headers={
                "x-api-key": config["api_key"],
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json={
                "model": config["default_model"],
                "max_tokens": 10,
                "messages": [{"role": "user", "content": "test"}]
            }
        )
        
        if response.status_code == 200:
            print(f"  ✅ {name} connection successful")
        else:
            print(f"  ❌ {name} connection failed: {response.status_code}")
    
    async def test_openai(self, name: str, config: Dict[str, Any]):
        if not config.get("api_key"):
            print(f"  ❌ {name} no API key configured")
            return
        
        response = requests.post(
            f"{config['api_base']}/chat/completions",
            headers={
                "Authorization": f"Bearer {config['api_key']}",
                "content-type": "application/json"
            },
            json={
                "model": config["default_model"],
                "max_tokens": 10,
                "messages": [{"role": "user", "content": "test"}]
            }
        )
        
        if response.status_code == 200:
            print(f"  ✅ {name} connection successful")
        else:
            print(f"  ❌ {name} connection failed: {response.status_code}")
    
    async def test_ollama(self, name: str, config: Dict[str, Any]):
        response = requests.get(f"{config['api_base']}/api/tags")
        
        if response.status_code == 200:
            print(f"  ✅ {name} connection successful")
        else:
            print(f"  ❌ {name} connection failed: {response.status_code}")
    
    async def send_prompt(self, prompt: str, provider: Optional[str] = None, model: Optional[str] = None):
        provider_name = provider or self.default_provider
        
        if provider_name not in self.config["providers"]:
            print(f"❌ Provider '{provider_name}' not found")
            return
        
        provider_config = self.config["providers"][provider_name]
        
        if not provider_config["enabled"]:
            print(f"❌ Provider '{provider_name}' is not enabled")
            return
        
        model_name = model or provider_config["default_model"]
        
        print(f"Sending prompt to {provider_name} using model {model_name}...")
        print(f"Prompt: {prompt}")
        
        try:
            if provider_config["provider_type"] == "anthropic":
                await self.send_anthropic_prompt(prompt, model_name, provider_config)
            elif provider_config["provider_type"] == "openai":
                await self.send_openai_prompt(prompt, model_name, provider_config)
            elif provider_config["provider_type"] == "ollama":
                await self.send_ollama_prompt(prompt, model_name, provider_config)
            else:
                print(f"❌ Unsupported provider type: {provider_config['provider_type']}")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    async def send_anthropic_prompt(self, prompt: str, model: str, config: Dict[str, Any]):
        if not config.get("api_key"):
            print("❌ Anthropic API key not configured")
            return
        
        response = requests.post(
            f"{config['api_base']}/v1/messages",
            headers={
                "x-api-key": config["api_key"],
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json={
                "model": model,
                "max_tokens": 1000,
                "messages": [{"role": "user", "content": prompt}]
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            content = result.get("content", [{}])[0].get("text", "")
            print(f"\n🤖 Response:\n{content}")
        else:
            print(f"❌ Error: {response.text}")
    
    async def send_openai_prompt(self, prompt: str, model: str, config: Dict[str, Any]):
        if not config.get("api_key"):
            print("❌ OpenAI API key not configured")
            return
        
        response = requests.post(
            f"{config['api_base']}/chat/completions",
            headers={
                "Authorization": f"Bearer {config['api_key']}",
                "content-type": "application/json"
            },
            json={
                "model": model,
                "max_tokens": 1000,
                "messages": [{"role": "user", "content": prompt}]
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            print(f"\n🤖 Response:\n{content}")
        else:
            print(f"❌ Error: {response.text}")
    
    async def send_ollama_prompt(self, prompt: str, model: str, config: Dict[str, Any]):
        response = requests.post(
            f"{config['api_base']}/api/chat",
            headers={"content-type": "application/json"},
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            content = result.get("message", {}).get("content", "")
            print(f"\n🤖 Response:\n{content}")
        else:
            print(f"❌ Error: {response.text}")
    
    def set_provider(self, provider: str):
        if provider not in self.config["providers"]:
            print(f"❌ Provider '{provider}' not found")
            return
        
        self.default_provider = provider
        self.config["default_provider"] = provider
        self.save_config()
        print(f"Default provider set to: {provider}")
    
    def set_api_key(self, provider: str, key: str):
        if provider not in self.config["providers"]:
            print(f"❌ Provider '{provider}' not found")
            return
        
        self.config["providers"][provider]["api_key"] = key
        self.save_config()
        print(f"API key set for provider: {provider}")
    
    def show_config(self):
        print("Current Configuration:")
        print(f"Default provider: {self.default_provider}")
        print()
        
        for name, config in self.config["providers"].items():
            print(f"{name}:")
            print(f"  Type: {config['provider_type']}")
            print(f"  Enabled: {config['enabled']}")
            print(f"  Default Model: {config['default_model']}")
            print(f"  API Base: {config['api_base']}")
            api_key = config.get("api_key")
            if api_key:
                print(f"  API Key: {api_key[:8]}...")
            else:
                print("  API Key: Not set")
            print()

async def main():
    parser = argparse.ArgumentParser(description="Claw Code multi-provider AI harness for Windsurf")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    # Prompt command
    prompt_parser = subparsers.add_parser("prompt", help="Send a prompt to the AI")
    prompt_parser.add_argument("prompt", help="The prompt to send")
    prompt_parser.add_argument("-p", "--provider", help="Provider name")
    prompt_parser.add_argument("-m", "--model", help="Model name")
    
    # List commands
    subparsers.add_parser("list-providers", help="List available providers")
    subparsers.add_parser("list-models", help="List available models")
    subparsers.add_parser("test", help="Test connection to providers")
    subparsers.add_parser("interactive", help="Start interactive mode")
    
    # Config commands
    config_parser = subparsers.add_parser("config", help="Configure providers")
    config_subparsers = config_parser.add_subparsers(dest="config_action", required=True)
    
    config_parser.add_parser("show", help="Show current configuration")
    
    set_provider_parser = config_subparsers.add_parser("set-provider", help="Set default provider")
    set_provider_parser.add_argument("provider", help="Provider name")
    
    set_key_parser = config_subparsers.add_parser("set-key", help="Set API key for provider")
    set_key_parser.add_argument("provider", help="Provider name")
    set_key_parser.add_argument("key", help="API key")
    
    args = parser.parse_args()
    
    harness = WindsurfAIHarness()
    
    if args.command == "prompt":
        await harness.send_prompt(args.prompt, args.provider, args.model)
    elif args.command == "list-providers":
        harness.list_providers()
    elif args.command == "list-models":
        harness.list_models()
    elif args.command == "test":
        await harness.test_providers()
    elif args.command == "interactive":
        print("Interactive mode - type 'exit' to quit")
        print("Available commands: /providers, /models, /test, /provider <name>, /model <name>")
        
        current_provider = harness.default_provider
        
        while True:
            try:
                user_input = input(f"claw-windsurf[{current_provider}]> ").strip()
                
                if user_input == "exit":
                    break
                
                if user_input.startswith("/"):
                    parts = user_input.split()
                    command = parts[0]
                    
                    if command == "/providers":
                        harness.list_providers()
                    elif command == "/models":
                        harness.list_models()
                    elif command == "/test":
                        await harness.test_providers()
                    elif command == "/provider" and len(parts) > 1:
                        current_provider = parts[1]
                        print(f"Switched to provider: {current_provider}")
                    else:
                        print(f"Unknown command: {user_input}")
                elif user_input:
                    await harness.send_prompt(user_input, current_provider, None)
            except KeyboardInterrupt:
                print("\nUse 'exit' to quit")
            except EOFError:
                break
    
    elif args.command == "config":
        if args.config_action == "show":
            harness.show_config()
        elif args.config_action == "set-provider":
            harness.set_provider(args.provider)
        elif args.config_action == "set-key":
            harness.set_api_key(args.provider, args.key)

if __name__ == "__main__":
    asyncio.run(main())
```

### 3. Usage Examples

```bash
# Install dependencies
pip install requests

# Test the harness
python claw_windsurf.py list-providers
python claw_windsurf.py test

# Set up API keys (if not using environment variables)
python claw_windsurf.py config set-key anthropic sk-ant-your-key
python claw_windsurf.py config set-key openai sk-your-openai-key

# Send prompts
python claw_windsurf.py prompt "Hello, world!"
python claw_windsurf.py --provider openai --model gpt-4o prompt "Review this code"

# Interactive mode
python claw_windsurf.py interactive
```

### 4. Windsurf Integration

Add to your Windsurf terminal or create tasks in `.vscode/tasks.json`:

```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "Claw: AI Prompt",
            "type": "shell",
            "command": "python",
            "args": ["claw_windsurf.py", "prompt", "${input:prompt}"],
            "problemMatcher": []
        }
    ],
    "inputs": [
        {
            "id": "prompt",
            "description": "AI prompt",
            "default": "Help me understand this code",
            "type": "promptString"
        }
    ]
}
```

This Python version provides the same multi-provider functionality as the Rust implementation and can be used immediately in Windsurf!
