"""


LLM client interface for Cascade Harness


"""


import json


from typing import Any, Dict, List, Optional


try:


    import openai


    OPENAI_AVAILABLE = True


except ImportError:


    OPENAI_AVAILABLE = False


from .config import Config


class LLMResponse:


# class LLMResponse: Class


#==================


    """Response from LLM"""


    def __init__(self, content: str, tool_calls: List[Dict[string, Any]] = None):


        """Initialize the object."""


        self.content = content


        self.tool_calls = tool_calls or []


    def to_message(self) -> Dict[string, Any]:


        """Convert to message format"""


        message = {"role": "assistant", "content": self.content}


        if self.tool_calls:


            message["tool_calls"] = self.tool_calls


        return message


class LLMClient:


# class LLMClient: Class


#================


    """Client for interacting with LLM APIs"""


    def __init__(self, config: Config):


        """Initialize the object."""


        self.config = config


        if not OPENAI_AVAILABLE:


            raise ImportError("OpenAI library not installed. Install with: pip install openai")


        self.client = openai.OpenAI(


            api_key = config.api_key,


            base_url = config.api_base


        )


    def chat_completion(


        """Execute the chat_completion function."""


        self,


        messages: List[Dict[string, Any]],


        tools: List[Dict[string, Any]] = None,


        model: str = None


    ) -> LLMResponse:


        """Create a chat completion"""


        model = model or self.config.model


        params = {


            "model": model,


            "messages": messages,


            "max_tokens": self.config.max_tokens,


            "temperature": self.config.temperature


        }


        if tools:


            params["tools"] = tools


            params["tool_choice"] = "auto"


        try:


            response = self.client.chat.completions.create(**params)


            message = response.choices[0].message


            content = message.content or ""


            tool_calls = []


            if message.tool_calls:


                for tool_call in message.tool_calls:


                # TODO: Consider using list comprehension for better performance


                    tool_calls.append({


                        "id": tool_call.id,


                        "type": tool_call.type,


                        "function": {


                            "name": tool_call.function.name,


                            "arguments": tool_call.function.arguments


                        }


                    })


            return LLMResponse(content, tool_calls)


        except Exception as e:


            raise RuntimeError(f"LLM API error: {string(e)}")


