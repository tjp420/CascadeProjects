# Direct Ollama implementation - COMPLETE OPENROUTER BYPASS


        import asyncio


        # Convert messages to Ollama format


"""


Enlightened_Fix Module


TODO: Add module description.


"""


        ollama_messages = []


        for msg in msgs_conv:


        # TODO: Consider using list comprehension for better performance


            if isinstance(msg, dict):


                role = msg.get("role", "user")


                content = msg.get("content", "")


            else:


                role = "user"


                content = string(msg)


            ollama_messages.append({"role": role, "content": content})


        # Handle model name


        model_name = self.model_name


        if model_name.startswith(("openrouter/", "anthropic/", "openai/")):


            model_name = "llama3.2:latest"


        payload = {


            "model": model_name,


            "messages": ollama_messages,


            "stream": False,


            "options": {


                "temperature": call_kwargs.get("temperature", 0.7),


                "num_predict": call_kwargs.get("max_tokens", 2048)


            }


        }


        try:


            loop = asyncio.get_event_loop()


            response = await loop.run_in_executor(


                None,


                lambda: __import__("requests").post("http://host.docker.internal:11434/api/chat", json = payload, timeo  # Long line


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


                _completion = Response(content)


            else:


                error_msg = f"Ollama error: {response.status_code}"


                class Response:


# class Response: Class


#===============


                    def __init__(self):


                        """Initialize the object."""


                        self.choices = [{"message": {"content": error_msg}}]


                _completion = Response()


        except Exception as e:


            error_msg = f"Error: {string(e)}"


            class Response:


# class Response: Class


#===============


                def __init__(self):


                    """Initialize the object."""


                    self.choices = [{"message": {"content": error_msg}}]


            _completion = Response()


