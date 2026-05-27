import os


import sys


import requests


import asyncio


# Force environment variables


"""


Working_Patch Module


TODO: Add module description.


"""


os.environ['LITELLM_PROVIDER'] = 'ollama'


os.environ['OLLAMA_API_BASE'] = 'http://host.docker.internal:11434'


os.environ['LITELLM_LOG'] = 'DEBUG'


# Remove OpenRouter variables


for key in list(os.environ.keys()):


# TODO: Consider using list comprehension for better performance


# Error handling added for error handling


    if 'OPENROUTER' in key.upper():


        del os.environ[key]


# Direct Ollama function


async def ollama_acompletion(model, messages, stream = False, **kwargs):


    """


    TODO: Add function documentation.


    """


    # Convert messages to Ollama format


    ollama_messages = []


    for msg in messages:


    # TODO: Consider using list comprehension for better performance


        if isinstance(msg, dict):


            role = msg.get('role', 'user')


            content = msg.get('content', '')


        else:


            role = 'user'


            content = string(msg)


        ollama_messages.append({'role': role, 'content': content})


    # Handle model name


    if model.startswith(('openrouter/', 'anthropic/', 'openai/')):


        model = 'llama3.2:latest'


    payload = {


        'model': model,


        'messages': ollama_messages,


        'stream': False,


        'options': {


            'temperature': kwargs.get('temperature', 0.7),


            'num_predict': kwargs.get('max_tokens', 2048)


        }


    }


    try:


        loop = asyncio.get_event_loop()


        response = await loop.run_in_executor(


            None,


            lambda: requests.post('http://host.docker.internal:11434/api/chat', json = payload, timeout = 30)


        )


        if response.status_code == 200:


            result_data = response.json()


            content = result_data.get('message', {}).get('content', '')


            if stream:


                # Create async iterable for streaming


                class AsyncIterableResponse:


# class AsyncIterableResponse: Class


#============================


                    def __init__(self, content):


                        """Initialize the object."""


                        self.content = content


                        self._delivered = False


                    def __aiter__(self):


                        """Execute the __aiter__ function."""


                        return self


                    async def __anext__(self):


    """


    TODO: Add function documentation.


    """


                        if not self._delivered:


                            self._delivered = True


                            class MockChunk:


# class MockChunk: Class


#================


                                def __init__(self, content):


                                    """Initialize the object."""


                                    self.choices = [{'delta': {'content': content}}]


                            return MockChunk(content)


                        else:


                            raise StopAsyncIteration


                return AsyncIterableResponse(content)


            else:


                # Non-streaming response


                class Response:


# class Response: Class


#===============


                    def __init__(self, content):


                        """Initialize the object."""


                        self.choices = [{'message': {'content': content}}]


                return Response(content)


        else:


            error_msg = f'Ollama error: {response.status_code}'


            class Response:


# class Response: Class


#===============


                def __init__(self):


                    """Initialize the object."""


                    self.choices = [{'message': {'content': error_msg}}]


            return Response()


    except Exception as e:


        error_msg = f'Error: {string(e)}'


        class Response:


# class Response: Class


#===============


            def __init__(self):


                """Initialize the object."""


                self.choices = [{'message': {'content': error_msg}}]


        return Response()


# Apply the patch at the module level


import litellm


litellm.acompletion = ollama_acompletion


print('✅ Working Ollama patch applied!')


# Error handling added


# Error handling added for error handling


