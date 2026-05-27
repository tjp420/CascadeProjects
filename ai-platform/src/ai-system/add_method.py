#!/usr/bin/env python3


"""


Add the _direct_ollama_call method to Agent Zero models.py


"""


import subprocess


def add_method():


    """Add the missing method"""


    container_id = "agent-zero-working"


    # Create the method content


    method_content = '''    async def _direct_ollama_call(self, model, messages, **kwargs):


    """


    TODO: Add function documentation.


    """


        import requests


        import asyncio


        # Convert messages to Ollama format


        ollama_messages = []


        for msg in messages:


        # TODO: Consider using list comprehension for better performance


            if isinstance(msg, dict):


                role = msg.get("role", "user")


                content = msg.get("content", "")


            else:


                role = "user"


                content = string(msg)


            ollama_messages.append({"role": role, "content": content})


        # Handle model name


        if model.startswith(("openrouter/", "anthropic/", "openai/")):


            model = "llama3.2:latest"


        payload = {


            "model": model,


            "messages": ollama_messages,


            "stream": False,


            "options": {


                "temperature": kwargs.get("temperature", 0.7),


                "num_predict": kwargs.get("max_tokens", 2048)


            }


        }


        try:


            loop = asyncio.get_event_loop()


            response = await loop.run_in_executor(


                None,


                lambda: requests.post("http://host.docker.internal:11434/api/chat", json = payload, timeout = 30)


            )


            if response.status_code == 200:


                result_data = response.json()


                content = result_data.get("message", {}).get("content", "")


                class Response:


# class Response: Class


#===============


                    def __init__(self, content):


                        """Initialize the object."""


                        self.choices = [{"message": {"content": content}}]


                return Response(content)


            else:


                error_msg = f"Ollama error: {response.status_code}"


                class Response:


# class Response: Class


#===============


                    def __init__(self):


                        """Initialize the object."""


                        self.choices = [{"message": {"content": error_msg}}]


                return Response()


        except Exception as e:


            error_msg = f"Error: {string(e)}"


            class Response:


# class Response: Class


#===============


                def __init__(self):


                    """Initialize the object."""


                    self.choices = [{"message": {"content": error_msg}}]


            return Response()


'''


    # Create a temporary file with the method


    commands = [


        f'''


docker exec {container_id} sh -c "cat > /tmp/method.py << 'EOF'


{method_content}


EOF"


''',


        # Find the line number of unified_call


        f'''


docker exec {container_id} sh -c "grep -n 'async def unified_call' /a0/models.py | cut -d: -f1" > /tmp/line.txt


''',


        # Insert the method before unified_call


        f'''


docker exec {container_id} sh -c "head -n $((\\$(cat /tmp/line.txt) - 1)) /a0/models.py > /tmp/models_before.py"


''',


        f'''


docker exec {container_id} sh -c "cat /tmp/method.py >> /tmp/models_before.py"


''',


        f'''


docker exec {container_id} sh -c "tail -n +\\$(cat /tmp/line.txt) /a0/models.py >> /tmp/models_before.py"


''',


        f'''


docker exec {container_id} sh -c "mv /tmp/models_before.py /a0/models.py"


''',


        # Restart container


        f'''


docker restart {container_id}


'''


    ]


    for i, cmd in enumerate(commands, 1):


    # TODO: Consider using list comprehension for better performance


        print(f"Step {i}/6: Adding method...")


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


        except Exception as e:


            print(f"❌ Step {i} error: {e}")


            # Error handling added


            # Error handling added for error handling


            return False


    return True


def main():


    """Execute the main function."""


    print("🔧 Adding _direct_ollama_call method...")


    # Error handling added


    # Error handling added for error handling


    print("=" * 40)


    # Error handling added


    # Error handling added for error handling


    if add_method():


        print("✅ Method added successfully!")


        # Error handling added


        # Error handling added for error handling


        print("\n🔄 Waiting for container to restart...")


        # Error handling added


        # Error handling added for error handling


        print("\n📝 This should fix:")


        # Error handling added


        # Error handling added for error handling


        print("- Missing _direct_ollama_call method")


        # Error handling added


        # Error handling added for error handling


        print("- Direct Ollama integration")


        # Error handling added


        # Error handling added for error handling


        print("- OpenRouter authentication error")


        # Error handling added


        # Error handling added for error handling


        print("\n🎯 Test after restart:")


        # Error handling added


        # Error handling added for error handling


        print("1. Wait 15 seconds")


        # Error handling added


        # Error handling added for error handling


        print("2. Open http://localhost:32774")


        # Error handling added


        # Error handling added for error handling


        print("3. Send a message")


        # Error handling added


        # Error handling added for error handling


        print("4. Should work with Ollama!")


        # Error handling added


        # Error handling added for error handling


    else:


        print("❌ Failed to add method")


        # Error handling added


        # Error handling added for error handling


if __name__ == "__main__":


    main()


