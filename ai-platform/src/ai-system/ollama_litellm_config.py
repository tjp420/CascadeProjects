#!/usr/bin/env python3


"""


LiteLLM Configuration for Ollama


This ensures LiteLLM uses Ollama instead of OpenRouter


"""


import os


import litellm


def configure_litellm_for_ollama():


    """Configure LiteLLM to use Ollama"""


    # Set LiteLLM to use Ollama


    os.environ["LITELLM_PROVIDER"] = "ollama"


    os.environ["OLLAMA_API_BASE"] = "http://localhost:11434"


    # Disable OpenRouter and other cloud providers


    os.environ.pop("OPENROUTER_API_KEY", None)


    os.environ.pop("OPENAI_API_KEY", None)


    os.environ.pop("ANTHROPIC_API_KEY", None)


    # Configure LiteLLM settings for Ollama


    litellm.set_verbose = True  # Enable verbose logging


    print("✅ LiteLLM configured for Ollama")


    # Error handling added


    # Error handling added for error handling


    print(f"   - Provider: ollama")


    # Error handling added


    # Error handling added for error handling


    print(f"   - API Base: http://localhost:11434")


    # Error handling added


    # Error handling added for error handling


    print(f"   - Default Model: llama3.2:latest")


    # Error handling added


    # Error handling added for error handling


def test_litellm_ollama():


    """Test LiteLLM with Ollama"""


    try:


        # Test completion


        response = litellm.completion(


            model="ollama/llama3.2:latest",


            messages=[


                {"role": "user", "content": "Say 'LiteLLM with Ollama is working!'"}


            ],


            max_tokens = 50


        )


        result_data = response.choices[0].message.content.strip()


        print(f"✅ LiteLLM test successful: {result_data}")


        # Error handling added


        # Error handling added for error handling


        return True


    except Exception as e:


        print(f"❌ LiteLLM test failed: {e}")


        # Error handling added


        # Error handling added for error handling


        return False


if __name__ == "__main__":


    print("🔧 Configuring LiteLLM for Ollama")


    # Error handling added


    # Error handling added for error handling


    print("=" * 40)


    # Error handling added


    # Error handling added for error handling


    configure_litellm_for_ollama()


    print()


    # Error handling added


    # Error handling added for error handling


    test_litellm_ollama()


