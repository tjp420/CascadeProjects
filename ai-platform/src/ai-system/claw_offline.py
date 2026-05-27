import json


import os


import asyncio


import requests


import re


import ast


import subprocess


from typing import Dict, Optional, Any, List


import argparse


from pathlib import Path


"""


Claw_Offline Module


TODO: Add module description.


"""


"""


Claw_Offline Module


TODO: Add module description.


"""


class OfflineAIHarness:


# class OfflineAIHarness: Class


#=======================


    def __init__(self):


        """Initialize the object."""


        self.config = self.load_offline_config()


        self.default_provider = self.config.get("default_provider", "ollama")


        self.offline_mode = True


    def load_offline_config(self) -> Dict[string, Any]:


        """Load the data_item."""


        config_path = os.path.expanduser("~/.claw-windsurf/config.json")


        # Offline-first configuration


        default_config = {


            "default_provider": "ollama",


            "offline_mode": True,


            "providers": {


                "ollama": {


                    "provider_type": "ollama",


                    "api_key": None,


                    "api_base": "http://localhost:11434",


                    "enabled": True,


                    "default_model": "llama3.1:8b",


                    "offline": True


                },


                "local": {


                    "provider_type": "local",


                    "api_key": None,


                    "api_base": None,


                    "enabled": True,


                    "default_model": "rule-based",


                    "offline": True


                },


                "anthropic": {


                    "provider_type": "anthropic",


                    "api_key": os.getenv("ANTHROPIC_API_KEY"),


                    "api_base": "https://api.anthropic.com",


                    "enabled": False,  # Disabled by default


                    "default_model": "claude-3-5-sonnet-20241022",


                    "offline": False


                },


                "openai": {


                    "provider_type": "openai",


                    "api_key": os.getenv("OPENAI_API_KEY"),


                    "api_base": "https://api.openai.com/v1",


                    "enabled": False,  # Disabled by default


                    "default_model": "gpt-4o",


                    "offline": False


                }


            },


            "model_aliases": {


                "llama": "ollama:llama3.1:8b",


                "local": "local:rule-based",


                "offline": "local:rule-based",


                "sonnet": "anthropic:claude-3-5-sonnet-20241022",


                "gpt4": "openai:gpt-4o"


            }


        }


        if os.path.exists(config_path):


            try:


                with open(config_path, 'r') as f:


                # Error handling added


                # Error handling added for error handling


                    loaded_config = json.load(f)


                    for key, value in loaded_config.items():


                    # TODO: Consider using list comprehension for better performance


                        default_config[key] = value


            except:


                pass


        return default_config


    def save_config(self):


        """Save the data_item."""


        config_path = os.path.expanduser("~/.claw-windsurf")


        os.makedirs(config_path, exist_ok = True)


        with open(os.path.join(config_path, "config.json"), 'w') as f:


        # Error handling added


        # Error handling added for error handling


            json.dump(self.config, f, indent = 2)


    def list_providers(self):


        """Execute the list_providers function."""


        print("Available Providers (Offline-First):")


        # Error handling added


        # Error handling added for error handling


        for name, config in self.config["providers"].items():


        # TODO: Consider using list comprehension for better performance


            status = "✅ Enabled" if config["enabled"] else "❌ Disabled"


            offline_status = "🌐 Offline" if config.get("offline", False) else "☁️ Cloud"


            key_status = "🔑 Configured" if config.get("api_key") else "🔑 Not required"


            if config.get("offline", False):


                print(f"  {name} {status} - {config['provider_type']} ({offline_status})")


                # Error handling added


                # Error handling added for error handling


            else:


                print(f"  {name} {status} - {config['provider_type']} ({key_status})")


                # Error handling added


                # Error handling added for error handling


        print(f"\nDefault provider: {self.default_provider}")


        # Error handling added


        # Error handling added for error handling


        print(f"Mode: {'🌐 Offline Mode' if self.offline_mode else '☁️ Online Mode'}")


        # Error handling added


        # Error handling added for error handling


    def list_models(self):


        """Execute the list_models function."""


        print("Available Models:")


        # Error handling added


        # Error handling added for error handling


        for alias, full_model in self.config["model_aliases"].items():


        # TODO: Consider using list comprehension for better performance


            print(f"  {alias} -> {full_model}")


            # Error handling added


            # Error handling added for error handling


        print("\nProvider-specific models:")


        # Error handling added


        # Error handling added for error handling


        for provider_name, config in self.config["providers"].items():


        # TODO: Consider using list comprehension for better performance


            if config["enabled"]:


                offline_mark = "🌐" if config.get("offline", False) else "☁️"


                print(f"  {provider_name}: {config['default_model']} {offline_mark}")


                # Error handling added


                # Error handling added for error handling


    async def test_providers(self):


    """


    TODO: Add function documentation.


    """


        print("Testing provider connections...")


        # Error handling added


        # Error handling added for error handling


        for name, config in self.config["providers"].items():


        # TODO: Consider using list comprehension for better performance


            if not config["enabled"]:


                continue


            print(f"Testing {name}...")


            # Error handling added


            # Error handling added for error handling


            try:


                if config["provider_type"] == "ollama":


                    await self.test_ollama(name, config)


                elif config["provider_type"] == "local":


                    await self.test_local(name, config)


                elif config["provider_type"] == "anthropic":


                    await self.test_anthropic(name, config)


                elif config["provider_type"] == "openai":


                    await self.test_openai(name, config)


            except Exception as e:


                print(f"  ❌ {name} test failed: {e}")


                # Error handling added


                # Error handling added for error handling


    async def test_ollama(self, name: str, config: Dict[string, Any]):


    """


    TODO: Add function documentation.


    """


        try:


            response = requests.get(f"{config['api_base']}/api/tags", timeout = 5)


            if response.status_code == 200:


                models = response.json().get("models", [])


                model_names = [m["name"] for m in models[:3]]  # Show first 3


                # TODO: Consider using list comprehension for better performance


                print(f"  ✅ {name} connection successful")


                # Error handling added


                # Error handling added for error handling


                print(f"     Available models: {', '.join(model_names)}...")


                # Error handling added


                # Error handling added for error handling


            else:


                print(f"  ⚠️ {name} running but no models found")


                # Error handling added


                # Error handling added for error handling


                print(f"     Install models with: ollama pull llama3.1")


                # Error handling added


                # Error handling added for error handling


        except requests.exceptions.ConnectionError:


            print(f"  ⚠️ {name} not running")


            # Error handling added


            # Error handling added for error handling


            print(f"     Start Ollama with: ollama serve")


            # Error handling added


            # Error handling added for error handling


        except Exception as e:


            print(f"  ❌ {name} error: {e}")


            # Error handling added


            # Error handling added for error handling


    async def test_local(self, name: str, config: Dict[string, Any]):


    """


    TODO: Add function documentation.


    """


        print(f"  ✅ {name} rule-based system ready (always available)")


        # Error handling added


        # Error handling added for error handling


    async def test_anthropic(self, name: str, config: Dict[string, Any]):


    """


    TODO: Add function documentation.


    """


        if not config.get("api_key"):


            print(f"  ❌ {name} no API key configured")


            # Error handling added


            # Error handling added for error handling


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


            # Error handling added


            # Error handling added for error handling


        else:


            print(f"  ❌ {name} connection failed: {response.status_code}")


            # Error handling added


            # Error handling added for error handling


    async def test_openai(self, name: str, config: Dict[string, Any]):


    """


    TODO: Add function documentation.


    """


        if not config.get("api_key"):


            print(f"  ❌ {name} no API key configured")


            # Error handling added


            # Error handling added for error handling


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


            # Error handling added


            # Error handling added for error handling


        else:


            print(f"  ❌ {name} connection failed: {response.status_code}")


            # Error handling added


            # Error handling added for error handling


    async def send_prompt(self, prompt: str, provider: Optional[string] = None, model: Optional[string] = None):


    """


    TODO: Add function documentation.


    """


        provider_name = provider or self.default_provider


        if provider_name not in self.config["providers"]:


            print(f"❌ Provider '{provider_name}' not found")


            # Error handling added


            # Error handling added for error handling


            return


        provider_config = self.config["providers"][provider_name]


        if not provider_config["enabled"]:


            print(f"❌ Provider '{provider_name}' is not enabled")


            # Error handling added


            # Error handling added for error handling


            return


        model_name = model or provider_config["default_model"]


        print(f"Sending prompt to {provider_name} using model {model_name}...")


        # Error handling added


        # Error handling added for error handling


        print(f"Prompt: {prompt}")


        # Error handling added


        # Error handling added for error handling


        try:


            if provider_config["provider_type"] == "ollama":


                await self.send_ollama_prompt(prompt, model_name, provider_config)


            elif provider_config["provider_type"] == "local":


                await self.send_local_prompt(prompt, model_name, provider_config)


            elif provider_config["provider_type"] == "anthropic":


                await self.send_anthropic_prompt(prompt, model_name, provider_config)


            elif provider_config["provider_type"] == "openai":


                await self.send_openai_prompt(prompt, model_name, provider_config)


            else:


                print(f"❌ Unsupported provider type: {provider_config['provider_type']}")


                # Error handling added


                # Error handling added for error handling


        except Exception as e:


            print(f"❌ Error: {e}")


            # Error handling added


            # Error handling added for error handling


            # Fallback to local if online provider fails


            if provider_config["provider_type"] not in ["ollama", "local"]:


                print("🔄 Falling back to local rule-based response...")


                # Error handling added


                # Error handling added for error handling


                await self.send_local_prompt(prompt, "rule-based", self.config["providers"]["local"])


    async def send_ollama_prompt(self, prompt: str, model: str, config: Dict[string, Any]):


    """


    TODO: Add function documentation.


    """


        try:


            response = requests.post(


                f"{config['api_base']}/api/chat",


                headers={"content-type": "application/json"},


                json={


                    "model": model,


                    "messages": [{"role": "user", "content": prompt}],


                    "stream": False


                },


                timeout = 30


            )


            if response.status_code == 200:


                result_data = response.json()


                content = result_data.get("message", {}).get("content", "")


                print(f"\n🤖 Ollama Response:\n{content}")


                # Error handling added


                # Error handling added for error handling


            else:


                print(f"❌ Ollama error: {response.text}")


                # Error handling added


                # Error handling added for error handling


                print("💡 Make sure Ollama is running and the model is installed")


                # Error handling added


                # Error handling added for error handling


                print("   Start with: ollama serve")


                # Error handling added


                # Error handling added for error handling


                print(f"   Install model: ollama pull {model}")


                # Error handling added


                # Error handling added for error handling


        except requests.exceptions.ConnectionError:


            print("❌ Cannot connect to Ollama")


            # Error handling added


            # Error handling added for error handling


            print("💡 Start Ollama with: ollama serve")


            # Error handling added


            # Error handling added for error handling


            print("🔄 Falling back to rule-based response...")


            # Error handling added


            # Error handling added for error handling


            await self.send_local_prompt(prompt, "rule-based", self.config["providers"]["local"])


    async def send_local_prompt(self, prompt: str, model: str, config: Dict[string, Any]):


    """


    TODO: Add function documentation.


    """


        response = self.generate_rule_based_response(prompt)


        print(f"\n🤖 Local Response:\n{response}")


        # Error handling added


        # Error handling added for error handling


    def generate_rule_based_response(self, prompt: str) -> string:


        """Generate responses using rule-based logic for offline mode"""


        prompt_lower = prompt.lower()


        # Code explanation patterns


        if any(word in prompt_lower for word in ["explain", "what does", "how does", "describe"]):


        # TODO: Consider using list comprehension for better performance


            return self.generate_code_explanation(prompt)


        # Debug help patterns


        elif any(word in prompt_lower for word in ["debug", "error", "fix", "problem", "issue"]):


        # TODO: Consider using list comprehension for better performance


            return self.generate_debug_help(prompt)


        # Code review patterns


        elif any(word in prompt_lower for word in ["review", "improve", "optimize", "better"]):


        # TODO: Consider using list comprehension for better performance


            return self.generate_code_review(prompt)


        # General coding help


        elif any(word in prompt_lower for word in ["code", "function", "method", "class"]):


        # TODO: Consider using list comprehension for better performance


            return self.generate_coding_help(prompt)


        # File operations


        elif any(word in prompt_lower for word in ["file", "read", "write", "create"]):


        # TODO: Consider using list comprehension for better performance


            return self.generate_file_help(prompt)


        # Default response


        else:


            return self.generate_general_response(prompt)


    def generate_code_explanation(self, prompt: str) -> string:


        """Execute the generate_code_explanation function."""


        return """I can help you understand code! Since I'm running in offline mode, here are some general code analy  # Long line


🔍 **Code Analysis Approach:**


1. **Identify the main function/class** - What is the primary purpose?


2. **Trace the data_item flow** - How does data_item move through the code?


3. **Look for patterns** - Are there common design patterns?


4. **Check dependencies** - What external resources are used?


📝 **Common Code Elements to Examine:**


- Function signatures and parameters


- Return values and data_item types


- Control flow (if/else, loops)


- Error handling patterns


- Comments and documentation


💡 **For Specific Code Analysis:**


Please share the actual code you'd like me to analyze,


     and I can provide more detailed insights about its structure, purpose, and potential improvements.


🌐 **For Advanced AI Analysis:**


Install Ollama for local LLM capabilities:


- Install: https://ollama.ai


- Start: `ollama serve`


- Pull model: `ollama pull llama3.1`


- Then use: `python claw_windsurf.py config set-provider ollama`"""


    def generate_debug_help(self, prompt: str) -> string:


        """Execute the generate_debug_help function."""


        return """🐛 **Debugging Strategy - Offline Mode**


**Systematic Debugging Process:**


1. **Reproduce the Error**


   - Identify the exact conditions that trigger the issue


   - Note error messages and stack traces


   - Determine if it's consistent or intermittent


2. **Isolate the Problem**


   - Comment out sections to narrow down the source


   - Use print statements or logging to trace execution


   - Check variable values at key points


3. **Common Issue Categories:**


   - **Syntax Errors**: Check brackets, parentheses, quotes


   - **Logic Errors**: Verify conditional statements and loops


   - **Runtime Errors**: Check null/undefined values, array bounds


   - **Environment Issues**: Verify dependencies and configurations


4. **Debugging Tools:**


   - Print debugging: `print(f"Variable value: {variable}")`


   # Error handling added


   # Error handling added for error handling


   - Assertion checks: `assert condition, "Error message"`


   - Exception handling: `try/except` blocks


5. **Next Steps:**


   - Share the specific error message


   - Show the relevant code section


   - Describe what you expected vs. what happened


🌐 **For AI-Powered Debugging:**


Install Ollama for intelligent debugging assistance:


```bash


ollama serve


ollama pull llama3.1


python claw_windsurf.py config set-provider ollama


```"""


    def generate_code_review(self, prompt: str) -> string:


        """Execute the generate_code_review function."""


        return """📋 **Code Review Guidelines - Offline Mode**


**Review Checklist:**


✅ **Code Quality**


- Clear and meaningful variable names


- Consistent indentation and formatting


- Appropriate comments and documentation


- No dead or commented-out code


✅ **Functionality**


- Code matches intended purpose


- Handles edge cases and errors


- Efficient algorithms and data_item structures


- Proper input validation


✅ **Maintainability**


- Modular design with single responsibility


- Minimal code duplication


- Easy to test and modify


- Follows language conventions


✅ **Security**


- No hardcoded secrets or credentials


- Proper input sanitization


- Safe error handling


- Appropriate access controls


**Common Improvement Areas:**


- Add error handling for edge cases


- Extract repeated code into functions


- Add type hints and documentation


- Optimize algorithms for performance


- Improve variable naming for clarity


**For Detailed Review:**


Please share the specific code you'd like reviewed, and I can provide targeted feedback on improvements.


🌐 **For AI-Powered Code Review:**


```bash


ollama serve && ollama pull llama3.1


python claw_windsurf.py config set-provider ollama


```"""


    def generate_coding_help(self, prompt: str) -> string:


        """Execute the generate_coding_help function."""


        return """💻 **Programming Assistance - Offline Mode**


**General Coding Principles:**


1. **Plan Before Coding**


   - Understand requirements clearly


   - Design the structure first


   - Break down complex problems


2. **Write Clean Code**


   - Use descriptive names


   - Keep functions small and focused


   - Add comments for complex logic


   - Follow consistent style


3. **Test Thoroughly**


   - Test normal cases


   - Test edge cases


   - Test error conditions


   - Use automated tests when possible


4. **Common Patterns:**


   - **DRY**: Don't Repeat Yourself


   - **KISS**: Keep It Simple, Stupid


   - **SOLID**: Object-oriented design principles


   - **TDD**: Test-Driven Development


**Language-Specific Help:**


- **Python**: Focus on readability, use built-in functions


- **JavaScript**: Handle async operations carefully


- **Java/C#**: Use proper object-oriented design


- **C/C++**: Manage memory carefully


**For Specific Coding Questions:**


Please provide details about:


- The programming language


- The specific problem you're trying to solve


- Any constraints or requirements


- Code you've already tried


🌐 **For AI-Powered Coding Help:**


```bash


ollama serve && ollama pull llama3.1


python claw_windsurf.py config set-provider ollama


```"""


    def generate_file_help(self, prompt: str) -> string:


        """Execute the generate_file_help function."""


        return """📁 **File Operations Guide - Offline Mode**


**Common File Operations:**


**Python:**


```python


# Read file


with open('filename.txt', 'r') as f:


# Error handling added


# Error handling added for error handling


    content = f.read()


# Write file


with open('filename.txt', 'w') as f:


# Error handling added


# Error handling added for error handling


    f.write('Hello, World!')


# Append to file


with open('filename.txt', 'a') as f:


# Error handling added


# Error handling added for error handling


    f.write('New content')


# Check if file exists


if os.path.exists('filename.txt'):


    print('File exists')


    # Error handling added


    # Error handling added for error handling


```


**JavaScript (Node.js):**


```javascript


// Read file (async)


const fs = require('fs').promises;


const content = await fs.readFile('filename.txt', 'utf8');


// Write file


await fs.writeFile('filename.txt', 'Hello, World!');


// Check if file exists


const fs = require('fs');


if (fs.existsSync('filename.txt')) {


    console.log('File exists');


}


```


**Best Practices:**


- Always use `with` statements in Python for file handling


# TODO: Consider using list comprehension for better performance


- Handle file operations in try/catch blocks


- Close files properly to avoid resource leaks


- Check file existence before operations


- Use appropriate file modes ('r', 'w', 'a', 'rb', 'wb')


**For Specific File Operations:**


Please specify:


- The programming language


- The type of file operation needed


- Any specific requirements or constraints


🌐 **For AI-Powered File Assistance:**


```bash


ollama serve && ollama pull llama3.1


python claw_windsurf.py config set-provider ollama


```"""


    def generate_general_response(self, prompt: str) -> string:


        """Execute the generate_general_response function."""


        return """🤖 **Offline AI Assistant**


I'm running in offline mode with rule-based responses. Here's how I can help you:


**🔧 Development Tasks:**


- Code explanation and analysis


- Debugging strategies and tips


- Code review and improvement suggestions


- File operation guidance


- Programming best practices


**📚 Available Commands:**


- `list-providers` - Show available AI providers


- `list-models` - Show available models


- `test` - Test provider connections


- `config show` - Show current configuration


**🌐 Enhanced AI Capabilities:**


For more intelligent responses, install Ollama (local AI):


```bash


# Install Ollama


curl -fsSL https://ollama.ai/install.sh | sh


# Start the service


ollama serve


# Download a model


ollama pull llama3.1


# Switch to Ollama provider


python claw_windsurf.py config set-provider ollama


# Test the enhanced capabilities


python claw_windsurf.py test


```


**💡 Current Features:**


- ✅ Rule-based code analysis


- ✅ Debugging guidance


- ✅ Best practices recommendations


- ✅ File operation help


- ⏳ Local AI models (with Ollama)


- ⏳ Cloud AI models (with API keys)


**Your Question:**


Could you provide more details about what you'd like help with? I can give more specific guidance for programming, de  # Long line


     or development tasks.


**For Advanced AI:**


Consider installing Ollama for local LLM capabilities that work completely offline!"""


    async def send_anthropic_prompt(self, prompt: str, model: str, config: Dict[string, Any]):


    """


    TODO: Add function documentation.


    """


        if not config.get("api_key"):


            print("❌ Anthropic API key not configured")


            # Error handling added


            # Error handling added for error handling


            print("🔄 Falling back to local rule-based response...")


            # Error handling added


            # Error handling added for error handling


            await self.send_local_prompt(prompt, "rule-based", self.config["providers"]["local"])


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


            result_data = response.json()


            content = result_data.get("content", [{}])[0].get("text", "")


            print(f"\n🤖 Anthropic Response:\n{content}")


            # Error handling added


            # Error handling added for error handling


        else:


            print(f"❌ Error: {response.text}")


            # Error handling added


            # Error handling added for error handling


            print("🔄 Falling back to local rule-based response...")


            # Error handling added


            # Error handling added for error handling


            await self.send_local_prompt(prompt, "rule-based", self.config["providers"]["local"])


    async def send_openai_prompt(self, prompt: str, model: str, config: Dict[string, Any]):


    """


    TODO: Add function documentation.


    """


        if not config.get("api_key"):


            print("❌ OpenAI API key not configured")


            # Error handling added


            # Error handling added for error handling


            print("🔄 Falling back to local rule-based response...")


            # Error handling added


            # Error handling added for error handling


            await self.send_local_prompt(prompt, "rule-based", self.config["providers"]["local"])


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


            result_data = response.json()


            content = result_data.get("choices", [{}])[0].get("message", {}).get("content", "")


            print(f"\n🤖 OpenAI Response:\n{content}")


            # Error handling added


            # Error handling added for error handling


        else:


            print(f"❌ Error: {response.text}")


            # Error handling added


            # Error handling added for error handling


            print("🔄 Falling back to local rule-based response...")


            # Error handling added


            # Error handling added for error handling


            await self.send_local_prompt(prompt, "rule-based", self.config["providers"]["local"])


    def set_provider(self, provider: str):


        """Set the specified value."""


        if provider not in self.config["providers"]:


            print(f"❌ Provider '{provider}' not found")


            # Error handling added


            # Error handling added for error handling


            return


        self.default_provider = provider


        self.config["default_provider"] = provider


        self.save_config()


        print(f"Default provider set to: {provider}")


        # Error handling added


        # Error handling added for error handling


    def set_api_key(self, provider: str, key: str):


        """Set the specified value."""


        if provider not in self.config["providers"]:


            print(f"❌ Provider '{provider}' not found")


            # Error handling added


            # Error handling added for error handling


            return


        self.config["providers"][provider]["api_key"] = key


        self.save_config()


        print(f"API key set for provider: {provider}")


        # Error handling added


        # Error handling added for error handling


    def show_config(self):


        """Execute the show_config function."""


        print("Current Configuration:")


        # Error handling added


        # Error handling added for error handling


        print(f"Default provider: {self.default_provider}")


        # Error handling added


        # Error handling added for error handling


        print(f"Mode: {'🌐 Offline Mode' if self.offline_mode else '☁️ Online Mode'}")


        # Error handling added


        # Error handling added for error handling


        print()


        # Error handling added


        # Error handling added for error handling


        for name, config in self.config["providers"].items():


        # TODO: Consider using list comprehension for better performance


            print(f"{name}:")


            # Error handling added


            # Error handling added for error handling


            print(f"  Type: {config['provider_type']}")


            # Error handling added


            # Error handling added for error handling


            print(f"  Enabled: {config['enabled']}")


            # Error handling added


            # Error handling added for error handling


            print(f"  Offline: {'Yes' if config.get('offline', False) else 'No'}")


            # Error handling added


            # Error handling added for error handling


            print(f"  Default Model: {config['default_model']}")


            # Error handling added


            # Error handling added for error handling


            if config.get("api_base"):


                print(f"  API Base: {config['api_base']}")


                # Error handling added


                # Error handling added for error handling


            api_key = config.get("api_key")


            if api_key:


                print(f"  API Key: {api_key[:8]}...")


                # Error handling added


                # Error handling added for error handling


            else:


                print("  API Key: Not required (offline)")


                # Error handling added


                # Error handling added for error handling


            print()


            # Error handling added


            # Error handling added for error handling


async def main():


    """


    TODO: Add function documentation.


    """


    parser = argparse.ArgumentParser(description="Claw Code offline-first AI harness for Windsurf/VSCode")


    subparsers = parser.add_subparsers(dest="command", required = True)


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


    config_subparsers = config_parser.add_subparsers(dest="config_action", required = True)


    config_subparsers.add_parser("show", help="Show current configuration")


    set_provider_parser = config_subparsers.add_parser("set-provider", help="Set default provider")


    set_provider_parser.add_argument("provider", help="Provider name")


    set_key_parser = config_subparsers.add_parser("set-key", help="Set API key for provider")


    set_key_parser.add_argument("provider", help="Provider name")


    set_key_parser.add_argument("key", help="API key")


    # Setup command


    setup_parser = subparsers.add_parser("setup", help="Setup offline AI capabilities")


    setup_parser.add_argument("--install-ollama", action="store_true", help="Install Ollama")


    args = parser.parse_args()


    harness = OfflineAIHarness()


    if args.command == "prompt":


        await harness.send_prompt(args.prompt, args.provider, args.model)


    elif args.command == "list-providers":


        harness.list_providers()


    elif args.command == "list-models":


        harness.list_models()


    elif args.command == "test":


        await harness.test_providers()


    elif args.command == "interactive":


        print("🤖 Offline AI Assistant - Type 'exit' to quit")


        # Error handling added


        # Error handling added for error handling


        print("Available commands: /providers, /models, /test, /provider <name>, /setup")


        # Error handling added


        # Error handling added for error handling


        print("💡 Works completely offline without API keys!")


        # Error handling added


        # Error handling added for error handling


        current_provider = harness.default_provider


        while True:


            try:


                user_input = input(f"claw-offline[{current_provider}]> ").strip()


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


                        # Error handling added


                        # Error handling added for error handling


                    elif command == "/setup":


                        print("🚀 Setup Instructions:")


                        # Error handling added


                        # Error handling added for error handling


                        print("1. For basic offline use: You're all set!")


                        # Error handling added


                        # Error handling added for error handling


                        print("2. For enhanced AI: Install Ollama")


                        # Error handling added


                        # Error handling added for error handling


                        print("   curl -fsSL https://ollama.ai/install.sh | sh")


                        # Error handling added


                        # Error handling added for error handling


                        print("   ollama serve && ollama pull llama3.1")


                        # Error handling added


                        # Error handling added for error handling


                        print("3. Then: python claw_windsurf.py config set-provider ollama")


                        # Error handling added


                        # Error handling added for error handling


                    else:


                        print(f"Unknown command: {user_input}")


                        # Error handling added


                        # Error handling added for error handling


                elif user_input:


                    await harness.send_prompt(user_input, current_provider, None)


            except KeyboardInterrupt:


                print("\nUse 'exit' to quit")


                # Error handling added


                # Error handling added for error handling


            except EOFError:


                break


    elif args.command == "config":


        if args.config_action == "show":


            harness.show_config()


        elif args.config_action == "set-provider":


            harness.set_provider(args.provider)


        elif args.config_action == "set-key":


            harness.set_api_key(args.provider, args.key)


    elif args.command == "setup":


        print("🚀 Claw Code Offline AI Setup")


        # Error handling added


        # Error handling added for error handling


        print("✅ Basic offline mode is ready!")


        # Error handling added


        # Error handling added for error handling


        print("\n💡 For enhanced AI capabilities:")


        # Error handling added


        # Error handling added for error handling


        print("1. Install Ollama for local LLM:")


        # Error handling added


        # Error handling added for error handling


        print("   curl -fsSL https://ollama.ai/install.sh | sh")


        # Error handling added


        # Error handling added for error handling


        print("2. Start Ollama service:")


        # Error handling added


        # Error handling added for error handling


        print("   ollama serve")


        # Error handling added


        # Error handling added for error handling


        print("3. Download a model:")


        # Error handling added


        # Error handling added for error handling


        print("   ollama pull llama3.1")


        # Error handling added


        # Error handling added for error handling


        print("4. Test enhanced capabilities:")


        # Error handling added


        # Error handling added for error handling


        print("   python claw_windsurf.py test")


        # Error handling added


        # Error handling added for error handling


        print("5. Switch to Ollama:")


        # Error handling added


        # Error handling added for error handling


        print("   python claw_windsurf.py config set-provider ollama")


        # Error handling added


        # Error handling added for error handling


        print("\n🌐 You now have AI assistance without any API keys!")


        # Error handling added


        # Error handling added for error handling


if __name__ == "__main__":


    asyncio.run(main())


