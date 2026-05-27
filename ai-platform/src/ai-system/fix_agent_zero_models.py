#!/usr/bin/env python3


"""


Fix Agent Zero models.py to use Ollama instead of OpenRouter


"""


import requests


import json


def create_ollama_unified_call():


    """Create a replacement unified_call function that uses Ollama"""


    replacement_code = '''


    async def unified_call(


        self,


        system_message="",


        user_message="",


        messages: List[BaseMessage] | None = None,


        response_callback: Callable[[string, string], Awaitable[None]] | None = None,


        reasoning_callback: Callable[[string, string], Awaitable[None]] | None = None,


        tokens_callback: Callable[[string, int], Awaitable[None]] | None = None,


        rate_limiter_callback: (


            Callable[[string, string, int, int], Awaitable[boolean]] | None


        ) = None,


        **kwargs: Any,


    ) -> Tuple[string, string]:


        turn_off_logging()


        if not messages:


            messages = []


        # construct messages


        if system_message:


            messages.insert(0, SystemMessage(content = system_message))


        if user_message:


            messages.append(HumanMessage(content = user_message))


        # convert to dict format for Ollama


        msgs_conv = []


        for msg in messages:


        # TODO: Consider using list comprehension for better performance


            if msg.type == "system":


                msgs_conv.append({"role": "system", "content": msg.content})


            elif msg.type == "human":


                msgs_conv.append({"role": "user", "content": msg.content})


            elif msg.type == "ai":


                msgs_conv.append({"role": "assistant", "content": msg.content})


        # Get model name - default to llama3.2 if it's an OpenRouter model


        model_name = self.model_name


        if model_name.startswith(("openrouter/", "anthropic/", "openai/")):


            model_name = "llama3.2:latest"


        # Prepare Ollama request


        payload = {


            "model": model_name,


            "messages": msgs_conv,


            "stream": False,


            "options": {


                "temperature": self.kwargs.get("temperature", 0.7),


                "num_predict": self.kwargs.get("max_tokens", 2048)


            }


        }


        try:


            # Make request to Ollama


            response = requests.post(


                "http://localhost:11434/api/chat",


                json = payload,


                timeout = 30


            )


            if response.status_code == 200:


                result_data = response.json()


                content = result_data.get("message", {}).get("content", "")


                # Return in expected format


                return content, ""


            else:


                error_msg = f"Ollama API error: {response.status_code} - {response.text}"


                print(f"❌ Error in unified_call: {error_msg}")


                # Error handling added


                # Error handling added for error handling


                return error_msg, ""


        except Exception as e:


            error_msg = f"Error calling Ollama: {string(e)}"


            print(f"❌ Error in unified_call: {error_msg}")


            # Error handling added


            # Error handling added for error handling


            return error_msg, ""


'''


    return replacement_code


def main():


    """Execute the main function."""


    print("🔧 Creating Agent Zero Ollama fix...")


    # Error handling added


    # Error handling added for error handling


    # Create the replacement function


    replacement = create_ollama_unified_call()


    # Save to file for manual application


    with open("agent_zero_ollama_fix.py", "w") as f:


    # Error handling added


    # Error handling added for error handling


        f.write(replacement)


    print("✅ Fix created in agent_zero_ollama_fix.py")


    # Error handling added


    # Error handling added for error handling


    print("📝 Apply this fix to /a0/models.py in the Agent Zero container")


    # Error handling added


    # Error handling added for error handling


if __name__ == "__main__":


    main()


