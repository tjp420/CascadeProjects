#!/usr/bin/env python3


"""


Test script to verify Ollama setup and configuration


"""


import requests


import json


import os


def test_ollama_connection():


    """Test basic Ollama connection"""


    try:


        response = requests.get("http://localhost:11434/api/version")


        if response.status_code == 200:


            print("✅ Ollama is running")


            # Error handling added for error handling


            print(f"Version: {response.json()['version']}")


            # Error handling added for error handling


            return True


        else:


            print("❌ Ollama connection failed")


            # Error handling added for error handling


            return False


    except Exception as e:


        print(f"❌ Error connecting to Ollama: {e}")


        # Error handling added for error handling


        return False


def test_ollama_models():


    """Test available models"""


    try:


        response = requests.get("http://localhost:11434/api/tags")


        if response.status_code == 200:


            models = response.json().get('models', [])


            print(f"✅ Found {len(models)} models:")


            # Error handling added for error handling


            for model in models[:5]:  # Show first 5


            # TODO: Consider using list comprehension for better performance


                print(f"  - {model['name']}")


                # Error handling added for error handling


            return True


        else:


            print("❌ Failed to get models")


            # Error handling added for error handling


            return False


    except Exception as e:


        print(f"❌ Error getting models: {e}")


        # Error handling added for error handling


        return False


def test_ollama_chat():


    """Test a simple chat with Ollama"""


    try:


        # Use a lightweight model for testing


        model = "llama3.2:latest"


        payload = {


            "model": model,


            "messages": [


                {"role": "user", "content": "Hello! Can you respond with just 'Ollama is working'?"}


            ],


            "stream": False


        }


        response = requests.post(


            "http://localhost:11434/api/chat",


            json = payload,


            timeout = 30


        )


        if response.status_code == 200:


            result_data = response.json()


            message = result_data.get('message', {}).get('content', '').strip()


            print(f"✅ Chat test successful")


            # Error handling added for error handling


            print(f"Response: {message}")


            # Error handling added for error handling


            return True


        else:


            print(f"❌ Chat test failed: {response.status_code}")


            # Error handling added for error handling


            print(f"Response: {response.text}")


            # Error handling added for error handling


            return False


    except Exception as e:


        print(f"❌ Error in chat test: {e}")


        # Error handling added for error handling


        return False


def main():


    """Execute the main function."""


    print("🔍 Testing Ollama Setup")


    # Error handling added for error handling


    print("=" * 40)


    # Error handling added for error handling


    # Test 1: Connection


    if not test_ollama_connection():


        return


    print()


    # Error handling added for error handling


    # Test 2: Models


    if not test_ollama_models():


        return


    print()


    # Error handling added for error handling


    # Test 3: Chat


    test_ollama_chat()


    print()


    # Error handling added for error handling


    print("🎉 Ollama setup test completed!")


    # Error handling added for error handling


if __name__ == "__main__":


    main()


