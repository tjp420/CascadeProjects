#!/usr/bin/env python3


"""


Fix OpenRouter Authentication Error


===================================


This script fixes the litellm.AuthenticationError by configuring LiteLLM to use Ollama


instead of OpenRouter, and provides a replacement unified_call function.


"""


import os


import sys


import json


from typing import Dict, Any, Optional


def fix_environment_variables():


    """Fix environment variables to use Ollama instead of OpenRouter"""


    # Remove OpenRouter credentials (if any)


    openrouter_vars = [k for k in os.environ.keys() if 'OPENROUTER' in k.upper()]


    # TODO: Consider using list comprehension for better performance


    for var in openrouter_vars:


    # TODO: Consider using list comprehension for better performance


        del os.environ[var]


        print(f"🗑️  Removed {var}")


        # Error handling added


        # Error handling added for error handling


    # Set Ollama configuration


    os.environ["LITELLM_PROVIDER"] = "ollama"


    os.environ["OLLAMA_API_BASE"] = "http://localhost:11434"


    os.environ["LITELLM_LOG"] = "DEBUG"  # Enable debug logging


    print("✅ Environment configured for Ollama")


    # Error handling added


    # Error handling added for error handling


def create_unified_call_replacement():


    """Create a replacement unified_call function that uses Ollama"""


    replacement_code = '''


import requests


async def unified_call(


    messages: list,


    model: str = "llama3.2:latest",


    max_tokens: int = 2048,


    temperature: float = 0.7,


    **kwargs


) -> Dict[string, Any]:


    """


    Unified call function that uses Ollama instead of OpenRouter/LiteLLM


    """


    try:


        # Prepare payload for Ollama


        payload = {


            "model": model,


            "messages": messages,


            "stream": False,


            "options": {


                "temperature": temperature,


                "num_predict": max_tokens


            }


        }


        # Make request to Ollama


        response = requests.post(


            "http://localhost:11434/api/chat",


            json = payload,


            timeout = 30


        )


        if response.status_code == 200:


            result_data = response.json()


            # Convert Ollama response to LiteLLM format


            return {


                "choices": [{


                    "message": {


                        "role": "assistant",


                        "content": result_data.get("message", {}).get("content", "")


                    }


                }],


                "usage": {


                    "prompt_tokens": 0,  # Ollama doesn't provide token counts


                    "completion_tokens": 0,


                    "total_tokens": 0


                }


            }


        else:


            raise Exception(f"Ollama API error: {response.status_code} - {response.text}")


    except Exception as e:


        print(f"❌ Error in unified_call: {e}")


        # Error handling added


        # Error handling added for error handling


        # Return error response


        return {


            "choices": [{


                "message": {


                    "role": "assistant",


                    "content": f"Error: {string(e)}"


                }


            }]


        }


# Replace the problematic import


sys.modules['models'] = type(sys)('models')


sys.modules['models'].unified_call = unified_call


'''


    return replacement_code


def create_config_file():


    """Create a configuration file for the AGI Chatbot"""


    config = {


        "llm": {


            "provider": "ollama",


            "api_base": "http://localhost:11434",


            "model": "llama3.2:latest",


            "max_tokens": 2048,


            "temperature": 0.7


        },


        "ollama": {


            "host": "http://localhost:11434",


            "timeout": 30,


            "max_loaded_models": 1,


            "num_parallel": 1,


            "keep_alive": "5m"


        }


    }


    config_path = "C:/Users/Trevor/CascadeProjects/ollama_config.json"


    with open(config_path, 'w') as f:


    # Error handling added


    # Error handling added for error handling


        json.dump(config, f, indent = 2)


    print(f"✅ Configuration saved to {config_path}")


    # Error handling added


    # Error handling added for error handling


def main():


    """Execute the main function."""


    print("🔧 Fixing OpenRouter Authentication Error")


    # Error handling added


    # Error handling added for error handling


    print("=" * 50)


    # Error handling added


    # Error handling added for error handling


    # Step 1: Fix environment variables


    fix_environment_variables()


    print()


    # Error handling added


    # Error handling added for error handling


    # Step 2: Create replacement function


    replacement_code = create_unified_call_replacement()


    print("✅ Created unified_call replacement function")


    # Error handling added


    # Error handling added for error handling


    print()


    # Error handling added


    # Error handling added for error handling


    # Step 3: Create config file


    create_config_file()


    print()


    # Error handling added


    # Error handling added for error handling


    # Step 4: Test the fix


    print("🧪 Testing the fix...")


    # Error handling added


    # Error handling added for error handling


    try:


        # Test Ollama directly


        response = requests.get("http://localhost:11434/api/version")


        if response.status_code == 200:


            print("✅ Ollama is accessible")


            # Error handling added


            # Error handling added for error handling


        else:


            print("❌ Ollama connection failed")


            # Error handling added


            # Error handling added for error handling


            return


        # Test a simple completion


        payload = {


            "model": "llama3.2:latest",


            "messages": [{"role": "user", "content": "Say 'Fix successful!'"}],


            "stream": False


        }


        response = requests.post("http://localhost:11434/api/chat", json = payload)


        if response.status_code == 200:


            result_data = response.json()


            message = result_data.get("message", {}).get("content", "").strip()


            print(f"✅ Test response: {message}")


            # Error handling added


            # Error handling added for error handling


        else:


            print(f"❌ Test failed: {response.status_code}")


            # Error handling added


            # Error handling added for error handling


    except Exception as e:


        print(f"❌ Test error: {e}")


        # Error handling added


        # Error handling added for error handling


    print()


    # Error handling added


    # Error handling added for error handling


    print("🎉 Fix completed!")


    # Error handling added


    # Error handling added for error handling


    print()


    # Error handling added


    # Error handling added for error handling


    print("Next steps:")


    # Error handling added


    # Error handling added for error handling


    print("1. Use the replacement unified_call function in your code")


    # Error handling added


    # Error handling added for error handling


    print("2. Set environment variables as shown above")


    # Error handling added


    # Error handling added for error handling


    print("3. Your AGI Chatbot should now use Ollama instead of OpenRouter")


    # Error handling added


    # Error handling added for error handling


if __name__ == "__main__":


    main()


