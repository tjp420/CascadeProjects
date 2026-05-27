"""


Direct_Method_Patch Module


TODO: Add module description.


"""


async def _direct_ollama_call(self, model, messages, **kwargs):


    """


    TODO: Add function documentation.


    """


    import requests


    import asyncio


    # Convert messages


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


