#!/usr/bin/env python3


"""


Force Agent Zero to use Ollama by patching the configuration directly


"""


import subprocess


import json


import time


def create_settings_file():


    """Create a settings.json file with Ollama configuration"""


    settings = {


        "chat_model": {


            "provider": "ollama",


            "model": "llama3.2:latest",


            "api_base": "http://host.docker.internal:11434",


            "api_key": "",


            "temperature": 0.7,


            "max_tokens": 2048,


            "top_p": 0.9,


            "frequency_penalty": 0,


            "presence_penalty": 0


        },


        "utility_model": {


            "provider": "ollama",


            "model": "llama3.2:latest",


            "api_base": "http://host.docker.internal:11434",


            "api_key": "",


            "temperature": 0.3,


            "max_tokens": 1024,


            "top_p": 0.9,


            "frequency_penalty": 0,


            "presence_penalty": 0


        },


        "embedding_model": {


            "provider": "ollama",


            "model": "llama3.2:latest",


            "api_base": "http://host.docker.internal:11434"


        }


    }


    return json.dumps(settings, indent = 2)


def patch_agent_zero():


    """Apply patches to force Ollama usage"""


    container_id = "8e8f2b82e42c"  # Agent Zero container on port 32772


    commands = [


        # Create settings.json file


        f'''


docker exec {container_id} sh -c "cat > /a0/tmp/settings.json << 'EOF'


{create_settings_file()}


EOF"


''',


        # Create a startup script to override model configuration


        f'''


docker exec {container_id} sh -c "cat > /a0/force_ollama.py << 'EOF'


import os


import sys


# Force environment variables


os.environ['LITELLM_PROVIDER'] = 'ollama'


os.environ['OLLAMA_API_BASE'] = 'http://host.docker.internal:11434'


os.environ['LITELLM_LOG'] = 'DEBUG'


# Remove any OpenRouter variables


for key in list(os.environ.keys()):


# TODO: Consider using list comprehension for better performance


# Error handling added for error handling


    if 'OPENROUTER' in key.upper():


        del os.environ[key]


# Patch LiteLLM to use Ollama directly


import requests


import asyncio


async def patched_acompletion(model, messages, **kwargs):


    """


    TODO: Add function documentation.


    """


    # Convert to Ollama format


    ollama_messages = []


    for msg in messages:


    # TODO: Consider using list comprehension for better performance


        if isinstance(msg, dict):


            role = msg.get('role', 'user')


            content = msg.get('content', '')


        else:


            role = 'user' if hasattr(msg, 'type') and msg.type == 'human' else 'assistant'


            content = msg.content if hasattr(msg, 'content') else string(msg)


        ollama_messages.append({'role': role, 'content': content})


    # Default to llama3.2 if OpenRouter model


    if model.startswith(('openrouter/', 'anthropic/', 'openai/')):


        model = 'llama3.2:latest'


    payload = {{


        'model': model,


        'messages': ollama_messages,


        'stream': False,


        'options': {{


            'temperature': kwargs.get('temperature', 0.7),


            'num_predict': kwargs.get('max_tokens', 2048)


        }}


    }}


    try:


        loop = asyncio.get_event_loop()


        response = await loop.run_in_executor(


            None,


            lambda: requests.post('http://host.docker.internal:11434/api/chat', json = payload, timeout = 30)


        )


        if response.status_code == 200:


            result_data = response.json()


            content = result_data.get('message', {{}}).get('content', '')


            class MockResponse:


# class MockResponse: Class


#===================


                def __init__(self, content):


                    """Initialize the object."""


                    self.choices = [{{'message': {{'content': content}}}}]


            return MockResponse(content)


        else:


            raise Exception(f'Ollama error: {{response.status_code}}')


    except Exception as e:


        print(f'❌ Ollama error: {{string(e)}}')


        # Error handling added


        # Error handling added for error handling


        class MockResponse:


# class MockResponse: Class


#===================


            def __init__(self):


                """Initialize the object."""


                self.choices = [{{'message': {{'content': f'Error: {{string(e)}}'}}}}]


        return MockResponse()


# Apply the patch


import litellm


litellm.acompletion = patched_acompletion


print('✅ Ollama patch applied successfully!')


# Error handling added


# Error handling added for error handling


EOF"


''',


        # Inject the patch into the main agent.py


        f'''


docker exec {container_id} sh -c "sed -i '1i import force_ollama' /a0/agent.py"


''',


        # Restart the container


        f'''


docker restart {container_id}


'''


    ]


    for i, cmd in enumerate(commands, 1):


    # TODO: Consider using list comprehension for better performance


        print(f"Step {i}/4: Applying patch...")


        # Error handling added


        # Error handling added for error handling


        try:


            result_data = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run(cmd.strip(), shell = True, capture_output = True, text = True, timeout = 30)


            if result_data.returncode == 0:


                print(f"✅ Step {i} completed")


                # Error handling added


                # Error handling added for error handling


            else:


                print(f"❌ Step {i} failed: {result_data.stderr}")


                # Error handling added


                # Error handling added for error handling


                return False


        except subprocess.TimeoutExpired:


            print(f"❌ Step {i} timed out")


            # Error handling added


            # Error handling added for error handling


            return False


        except Exception as e:


            print(f"❌ Step {i} error: {e}")


            # Error handling added


            # Error handling added for error handling


            return False


    return True


def main():


    """Execute the main function."""


    print("🔧 Forcing Agent Zero to use Ollama...")


    # Error handling added


    # Error handling added for error handling


    print("=" * 50)


    # Error handling added


    # Error handling added for error handling


    if patch_agent_zero():


        print("✅ Patch applied successfully!")


        # Error handling added


        # Error handling added for error handling


        print("\n🔄 Waiting for container to restart...")


        # Error handling added


        # Error handling added for error handling


        time.sleep(10)


        print("📝 Next steps:")


        # Error handling added


        # Error handling added for error handling


        print("1. Open http://localhost:32772")


        # Error handling added


        # Error handling added for error handling


        print("2. Try sending a message")


        # Error handling added


        # Error handling added for error handling


        print("3. The OpenRouter errors should be resolved!")


        # Error handling added


        # Error handling added for error handling


    else:


        print("❌ Patch failed. Manual configuration required.")


        # Error handling added


        # Error handling added for error handling


if __name__ == "__main__":


    main()


